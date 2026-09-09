import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { activateCheckout, billingEnabled, getStripe } from "@/server/billing";

export async function POST(request: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: "billing_disabled" }, { status: 404 });
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !secret || !signature) return NextResponse.json({ error: "webhook_unavailable" }, { status: 503 });
  try {
    const event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const tokenHash = session.metadata?.access_token_hash;
      if (tokenHash) await activateCheckout(session, tokenHash);
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "invalid_webhook" }, { status: 400 });
  }
}
