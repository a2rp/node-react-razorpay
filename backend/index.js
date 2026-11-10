require("dotenv").config();

const { createHmac, randomUUID, timingSafeEqual } = require("node:crypto");
const cors = require("cors");
const express = require("express");
const Razorpay = require("razorpay");
const { rateLimit } = require("express-rate-limit");

const app = express();
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5173";
const ORDER_AMOUNT = 49900;
const ORDER_CURRENCY = "INR";
const ORDER_TTL_MS = 30 * 60 * 1000;
const MAX_PENDING_ORDERS = 1000;
const pendingOrders = new Map();

const razorpay = KEY_ID && KEY_SECRET ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }) : null;

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: "16kb", strict: true }));

const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ message: "Too many order requests. Try again later." })
});

const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ message: "Too many verification requests. Try again later." })
});

function cleanExpiredOrders() {
    const expiresBefore = Date.now() - ORDER_TTL_MS;
    for (const [orderId, order] of pendingOrders) {
        if (order.createdAt < expiresBefore) pendingOrders.delete(orderId);
    }
}

function paymentError(res, error) {
    console.error("Razorpay request failed:", error.statusCode || error.error?.code || error.name);
    return res.status(502).json({ message: "The payment provider could not complete the request." });
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/razorpay", orderLimiter, async (_req, res) => {
    if (!razorpay) return res.status(503).json({ message: "Payment service is not configured." });

    cleanExpiredOrders();
    if (pendingOrders.size >= MAX_PENDING_ORDERS) {
        return res.status(503).json({ message: "The payment service is busy. Try again later." });
    }

    try {
        const order = await razorpay.orders.create({
            amount: ORDER_AMOUNT,
            currency: ORDER_CURRENCY,
            receipt: `rcpt_${randomUUID().replace(/-/g, "")}`,
            payment_capture: 1
        });

        pendingOrders.set(order.id, {
            amount: ORDER_AMOUNT,
            currency: ORDER_CURRENCY,
            createdAt: Date.now(),
            verifiedPaymentId: null
        });

        return res.status(201).json({
            keyId: KEY_ID,
            id: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (error) {
        return paymentError(res, error);
    }
});

app.post("/razorpay/verify-payment", verificationLimiter, async (req, res) => {
    if (!razorpay) return res.status(503).json({ message: "Payment service is not configured." });

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;
    if (typeof orderId !== "string" || !/^order_[A-Za-z0-9]+$/.test(orderId)
        || typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]+$/.test(paymentId)
        || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
        return res.status(400).json({ message: "Payment verification details are invalid." });
    }

    cleanExpiredOrders();
    const expectedOrder = pendingOrders.get(orderId);
    if (!expectedOrder) return res.status(410).json({ message: "Order is unknown or expired. Create a new order." });

    const expectedSignature = createHmac("sha256", KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest();
    const receivedSignature = Buffer.from(signature, "hex");
    if (receivedSignature.length !== expectedSignature.length
        || !timingSafeEqual(expectedSignature, receivedSignature)) {
        return res.status(400).json({ message: "Payment signature is invalid." });
    }

    if (expectedOrder.verifiedPaymentId && expectedOrder.verifiedPaymentId !== paymentId) {
        return res.status(409).json({ message: "This order has already been verified with a different payment." });
    }

    try {
        let payment = await razorpay.payments.fetch(paymentId);
        if (payment.order_id !== orderId
            || payment.amount !== expectedOrder.amount
            || payment.currency !== expectedOrder.currency) {
            return res.status(400).json({ message: "Payment details do not match this order." });
        }

        if (payment.status === "authorized") {
            payment = await razorpay.payments.capture(paymentId, expectedOrder.amount, expectedOrder.currency);
        }
        if (payment.status !== "captured") {
            return res.status(409).json({ message: "Payment is not captured yet. Check the Razorpay dashboard before retrying." });
        }

        expectedOrder.verifiedPaymentId = paymentId;
        return res.json({ verified: true, order_id: orderId, payment_id: paymentId, status: payment.status });
    } catch (error) {
        return paymentError(res, error);
    }
});

app.use((req, res) => res.status(404).json({ message: "Route not found." }));

app.use((error, _req, res, _next) => {
    if (error.type === "entity.parse.failed") return res.status(400).json({ message: "Request body must contain valid JSON." });
    if (error.type === "entity.too.large") return res.status(413).json({ message: "Request body is too large." });

    console.error("Request failed:", error.statusCode || error.name);
    return res.status(500).json({ message: "An unexpected server error occurred." });
});

async function startServer() {
    if (!KEY_ID || !KEY_SECRET) {
        throw Object.assign(new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required."), { code: "CONFIGURATION_ERROR" });
    }

    const port = Number(process.env.PORT || 1337);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw Object.assign(new Error("PORT must be an integer between 1 and 65535."), { code: "CONFIGURATION_ERROR" });
    }

    const host = process.env.HOST || "127.0.0.1";
    return new Promise((resolve, reject) => {
        const server = app.listen(port, host, () => {
            console.log(`Razorpay demo API listening at http://${host}:${port}`);
            resolve(server);
        });
        server.once("error", reject);
    });
}

if (require.main === module) {
    startServer().catch((error) => {
        if (error.code === "CONFIGURATION_ERROR") console.error(error.message);
        else console.error("Could not start Razorpay demo API:", error.code || error.name);
        process.exitCode = 1;
    });
}

module.exports = app;
