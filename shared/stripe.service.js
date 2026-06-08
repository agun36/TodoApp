const Stripe = require('stripe');
const { prisma } = require('./prisma.service.js');
const { getAppBaseUrl } = require('./workspace.service.js');

function getStripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return null;
    return new Stripe(secretKey);
}

function getPublishableKey() {
    return process.env.STRIPE_PUBLISHABLE_KEY || '';
}

function getPriceId() {
    const priceId = process.env.STRIPE_PRICE_ID || '';
    if (priceId.startsWith('prod_')) {
        const err = new Error(
            'STRIPE_PRICE_ID must be a Price ID (price_...), not a Product ID (prod_...). ' +
            'Open your product in Stripe → Pricing → copy the Price ID.'
        );
        err.status = 400;
        throw err;
    }
    return priceId;
}

function isStripeConfigured() {
    return !!(getStripe() && getPublishableKey() && getPriceId());
}

async function createEmbeddedCheckoutSession({ workspace, user }) {
    const stripe = getStripe();
    const priceId = getPriceId();
    if (!stripe || !priceId) {
        const err = new Error('Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_PRICE_ID.');
        err.status = 503;
        throw err;
    }

    const returnUrl =
        getAppBaseUrl() + '/dashboard/subscription?session_id={CHECKOUT_SESSION_ID}';

    const sessionParams = {
        ui_mode: 'embedded_page',
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        return_url: returnUrl,
        metadata: {
            workspaceId: workspace.id,
            ownerId: user.id
        },
        subscription_data: {
            metadata: {
                workspaceId: workspace.id,
                ownerId: user.id
            }
        }
    };

    if (workspace.stripeCustomerId) {
        sessionParams.customer = workspace.stripeCustomerId;
    } else {
        sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return session;
}

async function fulfillCheckoutSession(sessionId) {
    const stripe = getStripe();
    if (!stripe || !sessionId) return null;

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid =
        session.status === 'complete' || session.payment_status === 'paid';
    if (!isPaid) {
        return { status: session.status || 'open', workspace: null };
    }

    const workspaceId = session.metadata && session.metadata.workspaceId;
    if (!workspaceId) {
        const err = new Error('Checkout session is missing workspace metadata');
        err.status = 400;
        throw err;
    }

    const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
            plan: 'paid',
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
            stripeSubscriptionId:
                typeof session.subscription === 'string' ? session.subscription : null
        }
    });

    return { status: 'complete', workspace };
}

async function handleWebhookEvent(event) {
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.metadata && session.metadata.workspaceId) {
            await prisma.workspace.update({
                where: { id: session.metadata.workspaceId },
                data: {
                    plan: 'paid',
                    stripeCustomerId:
                        typeof session.customer === 'string' ? session.customer : undefined,
                    stripeSubscriptionId:
                        typeof session.subscription === 'string' ? session.subscription : undefined
                }
            });
        }
        return;
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const workspaceId = subscription.metadata && subscription.metadata.workspaceId;
        if (!workspaceId) return;

        await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                plan: 'free',
                stripeSubscriptionId: null
            }
        });
    }
}

module.exports = {
    getStripe,
    getPublishableKey,
    getPriceId,
    isStripeConfigured,
    createEmbeddedCheckoutSession,
    fulfillCheckoutSession,
    handleWebhookEvent
};
