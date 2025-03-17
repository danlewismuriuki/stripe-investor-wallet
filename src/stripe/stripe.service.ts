import { Injectable } from "@nestjs/common";
import Stripe from "stripe";

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });
  }

  /** ✅ Create a Connected Account for a user (Investor or Project Owner) */
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

      return { accountId: account.id };
    } catch (error) {
      throw new Error(`Failed to create connected account: ${error.message}`);
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

async getSavedPaymentMethods(customerId: string) {
  try {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card', // Fetch only card payment methods
    });

    return paymentMethods.data; // Returns an array of saved payment methods
  } catch (error) {
    throw new Error(`Failed to retrieve payment methods: ${error.message}`);
  }
}


  // /** ✅ Investors deposit funds into their Stripe balance */
  // async fundWallet(amount: number, currency: string, paymentMethodId: string) {
  //   try {
  //     const paymentIntent = await this.stripe.paymentIntents.create({
  //       amount,
  //       currency,
  //       payment_method: paymentMethodId,
  //       confirm: true, // Auto-confirm the payment
  //     });

  //     return { clientSecret: paymentIntent.client_secret };
  //   } catch (error) {
  //     throw new Error(`Failed to fund wallet: ${error.message}`);
  //   }
  // }


  async fundWallet(amount: number, currency: string, customerId: string) {
    try {
      // Fetch saved payment methods for the customer
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card', // Fetch only card payment methods
      });
  
      if (paymentMethods.data.length === 0) {
        throw new Error('No payment methods found for this customer.');
      }
  
      // Use the first payment method (or let the user choose one)
      const paymentMethodId = paymentMethods.data[0].id;
  
      // Create a PaymentIntent using the valid payment method
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        payment_method: paymentMethodId,
        customer: customerId, // Associate the PaymentIntent with the customer
        confirm: true, // Auto-confirm the payment
        off_session: true, // Allow payments without user interaction
      });
  
      return { clientSecret: paymentIntent.client_secret };
    } catch (error) {
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
        // source_type: "card",
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

  // /** ✅ Webhook event handling */
  // constructWebhookEvent(payload: Buffer, sig: string | string[], endpointSecret: string) {
  //   return this.stripe.webhooks.constructEvent(payload, sig, endpointSecret);
  // }

  constructWebhookEvent(rawBody: Buffer, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
