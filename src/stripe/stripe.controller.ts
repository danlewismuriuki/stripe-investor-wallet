// import { Controller } from '@nestjs/common';

// @Controller('stripe')
// export class StripeController {}


import { Controller, Post, Body, Req, Res, Headers } from "@nestjs/common";
import { StripeService } from "./stripe.service";
import { Request, Response } from "express";

@Controller("stripe")
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post("create-payment-intent")
  async createPaymentIntent(@Body() body) {
    const { amount, currency } = body;
    return this.stripeService.createPaymentIntent(amount, currency);
  }

  @Post("webhook")
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("stripe-signature") sig: string
  ) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    try {
      const event = this.stripeService.constructWebhookEvent(req.body, sig, endpointSecret);

      switch (event.type) {
        case "payment_intent.succeeded":
          console.log("✅ Payment successful! Update investor's balance.");
          break;

        case "balance.available":
          console.log("💰 Funds available for transactions.");
          break;
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
}
