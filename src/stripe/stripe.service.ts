import { Injectable } from "@nestjs/common";
import Stripe from "stripe";

// Load dotenv only in local development
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

  async createPaymentIntent(amount: number, currency: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        automatic_payment_methods: { enabled: true },
      });
      return { clientSecret: paymentIntent.client_secret };
    } catch (error) {
      throw new Error(`Payment Intent creation failed: ${error.message}`);
    }
  }

  constructWebhookEvent(payload: Buffer, sig: string | string[], endpointSecret: string) {
    return this.stripe.webhooks.constructEvent(payload, sig, endpointSecret);
  }
}
