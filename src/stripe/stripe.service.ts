import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import Stripe from "stripe";
import { User } from "../user.entity";

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not defined");
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    });
  }

 
  // async createConnectedAccount(email: string) {
  //   const accountIdPattern = /^acct_[a-zA-Z0-9]{24}$/;  // Stripe account ID format (acct_123abc...)

  //   try {
  //     // Creating a Stripe connected account
  //     const account = await this.stripe.accounts.create({
  //       type: "express",
  //       country: "US",
  //       email,
  //       capabilities: {
  //         transfers: { requested: true },
  //       },
  //     });

  //     console.log("Stripe account created:", account.id);

  //     // Start a database transaction to ensure atomicity
  //     const queryRunner = this.userRepository.manager.connection.createQueryRunner();
  //     await queryRunner.startTransaction();

  //     try {
  //       // Check if the user already exists in the database
  //       const user = await this.userRepository.findOne({ where: { email } });
  //       if (user) {
  //         // Update the user with the connected account ID if user exists
  //         user.connectedAccountId = account.id;
  //         await queryRunner.manager.save(user);
  //       } else {
  //         // Save the new user with the connected account ID
  //         await queryRunner.manager.save({ email, connectedAccountId: account.id });
  //       }

  //       // Commit the transaction
  //       await queryRunner.commitTransaction();
  //       return { accountId: account.id };
  //     } catch (error) {
  //       // Rollback in case of an error
  //       console.error("Database transaction failed:", error);
  //       await queryRunner.rollbackTransaction();
  //       throw new HttpException(`Failed to create connected account: ${error.message}`, HttpStatus.BAD_REQUEST);
  //     } finally {
  //       // Release the query runner
  //       await queryRunner.release();
  //     }

  //   } catch (error) {
  //     // Catching Stripe API or other errors
  //     console.error("Failed to create connected account:", error);
  //     throw new HttpException(`Failed to create connected account: ${error.message}`, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // Function to generate the account link for onboarding
  // async generateAccountLink(accountId: string) {
  //   const accountIdPattern = /^acct_[a-zA-Z0-9]{24}$/;  // Stripe account ID format (acct_123abc...)

  //   // Validate the account ID format
  //   if (!accountId || !accountIdPattern.test(accountId)) {
  //     throw new Error("Invalid Account ID. Please ensure a valid account ID is passed.");
  //   }

  //   console.log("Generating account link for account ID:", accountId);

  //   try {
  //     // Creating account link for onboarding
  //     const accountLink = await this.stripe.accountLinks.create({
  //       account: accountId,
  //       refresh_url: "https://stripe-investor-frontend.vercel.app/reauth",
  //       return_url: "https://stripe-investor-frontend.vercel.app/paymentdashboard",
  //       type: "account_onboarding",
  //     });

  //     if (!accountLink || !accountLink.url) {
  //       throw new Error("Failed to generate account link.");
  //     }

  //     return { url: accountLink.url };
  //   } catch (error) {
  //     // Log and handle the error
  //     console.error("Error creating account link:", error);
  //     throw new HttpException("An error occurred while generating the account link. Please try again.", HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  // }


  async createConnectedAccount(email: string) {
    try {
        const account = await this.stripe.accounts.create({
            type: "express",
            country: "US",
            email,
            capabilities: {
                transfers: { requested: true },
            },
        });

        console.log("✔️ Stripe account created:", account.id);

        // Fetch user before saving
        let user = await this.userRepository.findOne({ where: { email } });
        console.log("🔍 User before update:", user);

        if (user) {
            user.connectedAccountId = account.id;
            await this.userRepository.save(user);
        } else {
            user = await this.userRepository.save({ email, connectedAccountId: account.id });
        }

        console.log("✅ User after update:", user);

        return { accountId: account.id };
    } catch (error) {
        console.error("❌ Failed to create connected account:", error);
        throw new HttpException(`Failed to create connected account: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
}


  async generateAccountLink(accountId: string) {
    console.log("🟢 Received accountId for link generation:", accountId);

    if (!accountId || typeof accountId !== 'string' || !accountId.startsWith("acct_")) {
        console.error("❌ Invalid Account ID passed:", accountId);
        throw new Error("Invalid Account ID. Please ensure a valid account ID is passed.");
    }

    try {
        const accountLink = await this.stripe.accountLinks.create({
            account: accountId,
            refresh_url: "https://stripe-investor-frontend.vercel.app/reauth",
            return_url: "https://stripe-investor-frontend.vercel.app/paymentdashboard",
            type: "account_onboarding",
        });

        console.log("🔗 Generated Stripe account link:", accountLink.url);

        return { url: accountLink.url };
    } catch (error) {
        console.error("❌ Error creating account link:", error);
        throw new Error(`Failed to create account link: ${error.message}`);
    }
}

    

  async getSavedPaymentMethodsForAccount(accountId: string) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: accountId,
        type: "card",
      });
  
      return paymentMethods.data;
    } catch (error) {
      console.error("Failed to retrieve payment methods:", error);
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

   async completeOnboarding(customerId: string, email: string) {
    try {
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

  async attachPaymentMethodToCustomer(customerId: string, paymentMethodId: string) {
    try {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to attach payment method: ${error.message}`);
    }
  }
 
  async fundWallet(amount: number, currency: string, customerId: string, paymentMethodId: string) {
    try {
      console.log(`Fetching payment methods for customer: ${customerId}`);
      const paymentMethods = await this.getSavedPaymentMethodsForAccount(customerId);
      console.log("Payment Methods:", paymentMethods);
      if (paymentMethods.length === 0) {
        throw new HttpException("No payment methods found. Please add a card.", HttpStatus.BAD_REQUEST);
      }
  
      // Ensure the selected payment method is valid
      const selectedPaymentMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);
      if (!selectedPaymentMethod) {
        throw new HttpException("Invalid payment method selected", HttpStatus.BAD_REQUEST);
      }
  
      // Set the payment method as the default for the customer
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
      throw new HttpException(`Failed to fund wallet: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }


  async createPaymentWithTransfer(amount: number, currency: string, connectedAccountId: string) {
    try {
      const transfer = await this.stripe.transfers.create({
        amount,
        currency,
        destination: connectedAccountId,
      });

      return { transferId: transfer.id };
    } catch (error) {
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }

  async createPayout(amount: number, currency: string, connectedAccountId: string) {
    try {
      const payout = await this.stripe.payouts.create({
        amount,
        currency,
        destination: connectedAccountId,
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