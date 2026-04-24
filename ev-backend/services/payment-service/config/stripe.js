import Stripe from "stripe";
import { env } from "./env.js";

let stripeClient;

export const getStripeClient = () => {
  if (!env.stripeSecretKey) {
    const error = new Error("Stripe is not configured");
    error.statusCode = 500;
    throw error;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey);
  }

  return stripeClient;
};
