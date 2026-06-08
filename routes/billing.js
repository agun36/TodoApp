var express = require('express');
var router = express.Router();
const { jsonOk, jsonError } = require('../shared/api-response.js');
const { requireAuth } = require('../shared/require-auth.js');
const { findUserById } = require('../shared/user.service.js');
const {
    getWorkspaceForOwner,
    serializeWorkspace,
    updateWorkspacePlan,
    FREE_MEMBER_LIMIT
} = require('../shared/workspace.service.js');
const {
    getStripe,
    getPublishableKey,
    isStripeConfigured,
    createEmbeddedCheckoutSession,
    fulfillCheckoutSession,
    handleWebhookEvent
} = require('../shared/stripe.service.js');

router.get('/', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) return jsonError(res, 'User not found', 404);

        const workspace = await getWorkspaceForOwner(user.id);
        if (!workspace) return jsonError(res, 'Workspace not found', 404);

        return jsonOk(res, {
            workspace: serializeWorkspace(workspace),
            billing: {
                plan: workspace.plan || 'free',
                freeMemberLimit: FREE_MEMBER_LIMIT,
                membersAreFree: true,
                stripeConfigured: isStripeConfigured()
            }
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

router.post('/checkout', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) return jsonError(res, 'User not found', 404);

        const workspace = await getWorkspaceForOwner(user.id);
        if (!workspace) return jsonError(res, 'Only the workspace owner can manage billing', 403);

        if (workspace.plan === 'paid') {
            return jsonError(res, 'Your workspace is already on Pro', 409);
        }

        if (!isStripeConfigured()) {
            return jsonError(
                res,
                'Payments are not configured yet. Add STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_ID to the server .env.',
                503
            );
        }

        const session = await createEmbeddedCheckoutSession({ workspace, user });
        if (!session.client_secret) {
            return jsonError(res, 'Could not start checkout', 500);
        }

        return jsonOk(res, {
            sessionId: session.id,
            clientSecret: session.client_secret,
            publishableKey: getPublishableKey()
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, error.message || 'An error occurred', error.status || 500);
    }
});

router.get('/checkout/status', requireAuth, async function (req, res) {
    try {
        const sessionId = String(req.query.session_id || '').trim();
        if (!sessionId) return jsonError(res, 'session_id is required', 400);

        const user = await findUserById(req.auth.userId);
        if (!user) return jsonError(res, 'User not found', 404);

        const workspace = await getWorkspaceForOwner(user.id);
        if (!workspace) return jsonError(res, 'Workspace not found', 404);

        let result = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                result = await fulfillCheckoutSession(sessionId);
                break;
            } catch (dbError) {
                const transient = /timeout|terminated|ECONNRESET|connection/i.test(
                    dbError.message || ''
                );
                if (!transient || attempt === 2) throw dbError;
                await new Promise(function (resolve) {
                    setTimeout(resolve, 1000 * (attempt + 1));
                });
            }
        }
        if (!result) return jsonError(res, 'Stripe is not configured', 503);

        if (result.status !== 'complete' || !result.workspace) {
            return jsonOk(res, {
                status: result.status,
                workspace: serializeWorkspace(workspace),
                billing: {
                    plan: workspace.plan || 'free',
                    freeMemberLimit: FREE_MEMBER_LIMIT,
                    membersAreFree: true,
                    stripeConfigured: isStripeConfigured()
                }
            });
        }

        return jsonOk(res, {
            status: 'complete',
            message: 'Payment successful. Welcome to Pro!',
            workspace: serializeWorkspace(result.workspace),
            billing: {
                plan: result.workspace.plan || 'free',
                freeMemberLimit: FREE_MEMBER_LIMIT,
                membersAreFree: true,
                stripeConfigured: isStripeConfigured()
            }
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, error.message || 'An error occurred', error.status || 500);
    }
});

router.post('/plan', requireAuth, async function (req, res) {
    try {
        const user = await findUserById(req.auth.userId);
        if (!user) return jsonError(res, 'User not found', 404);

        const plan = String(req.body.plan || '').trim().toLowerCase();
        if (plan !== 'free' && plan !== 'paid') {
            return jsonError(res, 'Plan must be free or paid', 400);
        }

        if (plan === 'paid') {
            return jsonError(res, 'Use checkout to upgrade to Pro', 400);
        }

        const workspace = await updateWorkspacePlan(user.id, plan);
        if (!workspace) return jsonError(res, 'Only the workspace owner can manage billing', 403);

        return jsonOk(res, {
            message: 'Switched to Free',
            workspace: serializeWorkspace(workspace),
            billing: {
                plan: workspace.plan || 'free',
                freeMemberLimit: FREE_MEMBER_LIMIT,
                membersAreFree: true,
                stripeConfigured: isStripeConfigured()
            }
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 'An error occurred', 500);
    }
});

async function stripeWebhook(req, res) {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !webhookSecret) {
        return res.status(503).send('Stripe webhook is not configured');
    }

    const signature = req.headers['stripe-signature'];
    if (!signature) {
        return res.status(400).send('Missing Stripe signature');
    }

    try {
        const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
        await handleWebhookEvent(event);
        return res.json({ received: true });
    } catch (error) {
        console.error('[Stripe webhook]', error.message);
        return res.status(400).send('Webhook error: ' + error.message);
    }
}

module.exports = router;
module.exports.stripeWebhook = stripeWebhook;
