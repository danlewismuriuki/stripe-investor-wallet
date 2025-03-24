// import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
// import Stripe from "stripe";
// import { User } from "../user.entity";
// import { InjectRepository } from "@nestjs/typeorm";
// import { Repository } from "typeorm";

// if (process.env.NODE_ENV !== "production") {
//   require("dotenv").config();
// }

// @Injectable()
// export class StripeService {
//   private stripe: Stripe;

//   constructor(
//     @InjectRepository(User) private readonly userRepository: Repository<User>,) {
//     this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//       apiVersion: "2025-02-24.acacia",
//     });
//   }

import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import Stripe from "stripe";
import { UserRepository } from "../stripe/user.repository";  // Import the UserRepository
import { InjectRepository } from "@nestjs/typeorm";
// import { UserRepository } from '../user.repository'; // Ensure to use your custom repository

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(UserRepository) private readonly userRepository: UserRepository, // Inject UserRepository
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });
  }

  async createConnectedAccount(email: string) {
    try {
      const account = await this.stripe.accounts.create({
        type: "express",
        country: "US", // Change based on user location
        email,
        capabilities: {
          transfers: { requested: true },
        },
      });
  
      // Save the email and connectedAccountId in the database
      const user = await this.userRepository.findOne({ where: { email } });
      if (user) {
        user.connectedAccountId = account.id;
        await this.userRepository.save(user);
      } else {
        await this.userRepository.save({ email, connectedAccountId: account.id });
      }
  
      return { accountId: account.id };
    } catch (error) {
      throw new HttpException(`Failed to create connected account: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /** ✅ Generate an onboarding link for the user */
  async generateAccountLink(accountId: string) {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: "https://stripe-investor-frontend.vercel.app/reauth",
        return_url: "https://stripe-investor-frontend.vercel.app/paymentdashboard",
        type: "account_onboarding",
      });

      return { url: accountLink.url };
    } catch (error) {
      throw new Error(`Failed to create account link: ${error.message}`);
    }
  }

  /** ✅ Retrieve saved payment methods for a customer */
  async getSavedPaymentMethods(customerId: string) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: "card", // Fetch only card payment methods
      });

      return paymentMethods.data; // Returns an array of saved payment methods
    } catch (error) {
      throw new Error(`Failed to retrieve payment methods: ${error.message}`);
    }
  }

  async getConnectedAccountId(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
  
    if (!user || !user.connectedAccountId) {
      throw new HttpException("User not found or no connected account", HttpStatus.NOT_FOUND);
    }
  
    return { connectedAccountId: user.connectedAccountId };
  }

   /** ✅ Complete onboarding by attaching the payment method to the platform's customer */
   async completeOnboarding(customerId: string, email: string) {
    try {
      // Fetch the connectedAccountId using the user's email
      const { connectedAccountId } = await this.getConnectedAccountId(email);
      const paymentMethods = await this.getConnectedAccountPaymentMethods(connectedAccountId);

      if (paymentMethods.length === 0) {
        throw new Error("No payment methods found in the connected account.");
      }
      const paymentMethodId = paymentMethods[0].id;
      await this.attachPaymentMethodToCustomer(customerId, paymentMethodId);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to complete onboarding: ${error.message}`);
    }
  }


  async getConnectedAccountPaymentMethods(connectedAccountId: string) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list(
        { type: "card" },
        { stripeAccount: connectedAccountId }
      );
  
      return paymentMethods.data;
    } catch (error) {
      throw new Error(`Failed to retrieve payment methods: ${error.message}`);
    }
  }

  /** ✅ Attach a payment method to the platform's customer */
  async attachPaymentMethodToCustomer(customerId: string, paymentMethodId: string) {
    try {
      // Attach the payment method to the platform's customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Set the payment method as the default for the customer
      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to attach payment method: ${error.message}`);
    }
  }
 

  /** ✅ Fund the wallet using a saved payment method */
  async fundWallet(amount: number, currency: string, customerId: string) {
    try {
      console.log(`Fetching payment methods for customer: ${customerId}`);

      // Fetch saved payment methods for the customer
      const paymentMethods = await this.getSavedPaymentMethods(customerId);

      console.log("Payment Methods:", paymentMethods); // Log to debug

      if (paymentMethods.length === 0) {
        throw new Error("No payment methods found. Please add a card.");
      }

      const paymentMethodId = paymentMethods[0].id;

      // Ensure payment method is set as default
      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Create PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        payment_method: paymentMethodId,
        customer: customerId,
        confirm: true,
        off_session: true,
      });

      return { clientSecret: paymentIntent.client_secret };
    } catch (error) {
      console.error("Stripe API Error:", error);
      throw new Error(`Failed to fund wallet: ${error.message}`);
    }
  }

  /** ✅ Transfer funds from investor balance to borrower's account */
  async createPaymentWithTransfer(amount: number, currency: string, connectedAccountId: string) {
    try {
      const transfer = await this.stripe.transfers.create({
        amount,
        currency,
        destination: connectedAccountId, // Borrower’s Stripe account
      });

      return { transferId: transfer.id };
    } catch (error) {
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }

  /** ✅ Payout funds from the platform to a Connected Account's bank */
  async createPayout(amount: number, currency: string, connectedAccountId: string) {
    try {
      const payout = await this.stripe.payouts.create({
        amount,
        currency,
        destination: connectedAccountId, // This should be the recipient's Stripe account ID
      });

      return { payoutId: payout.id };
    } catch (error) {
      throw new Error(`Payout failed: ${error.message}`);
    }
  }

  /** ✅ Webhook event handling */
  constructWebhookEvent(rawBody: Buffer, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}