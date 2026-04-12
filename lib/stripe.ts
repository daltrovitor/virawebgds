import "server-only"

import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
	if (_stripe) return _stripe

	const key = process.env.STRIPE_SECRET_KEY
	if (!key) {
		// Throwing here gives clearer runtime errors in server logs instead of failing at module import time
		throw new Error("STRIPE_SECRET_KEY is not set in environment variables")
	}

	_stripe = new Stripe(key)
	return _stripe
}
