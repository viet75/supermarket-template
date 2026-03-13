// lib/stripe.ts
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Returns a singleton instance of Stripe.
 * - If STRIPE_API_VERSION is set in .env → use that version (pinned).
 * - Otherwise fallback to the API version configured in the Stripe account.
 */
export function getStripe() {
    if (_stripe) return _stripe;

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error('Missing STRIPE_SECRET_KEY');
    }

    const apiVersionEnv = process.env.STRIPE_API_VERSION;

    _stripe = apiVersionEnv
        ? new Stripe(key, { apiVersion: apiVersionEnv as Stripe.LatestApiVersion })
        : new Stripe(key);

    return _stripe;
}
