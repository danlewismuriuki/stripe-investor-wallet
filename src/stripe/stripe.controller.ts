import { Controller, Post, Body, Req, Res, Headers } from "@nestjs/common";
import { StripeService } from "./stripe.service";
import { Request, Response } from "express";

@Controller("stripe")
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  /** ✅ Create a Stripe Connected Account for a user */
  @Post("create-account")
  async createConnectedAccount(@Body() body) {
    const { email } = body;
    return this.stripeService.createConnectedAccount(email);
  }

  /** ✅ Generate an onboarding link */
  @Post("account-link")
  async generateAccountLink(@Body() body) {
    const { accountId } = body;
    return this.stripeService.generateAccountLink(accountId);
  }

    /** ✅ Investor Funds Their Wallet */
    @Post("fund-wallet")
    async fundInvestorWallet(@Body() body) {
    const { amount, currency, paymentMethodId } = body;
    return this.stripeService.fundWallet(amount, currency, paymentMethodId);
    }

 
  /** ✅ Create a payment that transfers funds to a connected account */
  @Post("create-payment")
  async createPaymentWithTransfer(@Body() body) {
    const { amount, currency, connectedAccountId } = body;
    return this.stripeService.createPaymentWithTransfer(amount, currency, connectedAccountId);
  }

  /** ✅ Payout funds to a connected account */
  @Post("payout")
  async createPayout(@Body() body) {
    const { amount, currency, connectedAccountId } = body;
    return this.stripeService.createPayout(amount, currency, connectedAccountId);
  }

  /** ✅ Webhook for Stripe events */
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

