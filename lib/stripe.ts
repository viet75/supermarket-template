// lib/stripe.ts
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Restituisce un'istanza singleton di Stripe.
 * - Se STRIPE_API_VERSION è settato in .env → usa quella versione (pinnata).
 * - Altrimenti fallback alla API version configurata nell'account Stripe.
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
