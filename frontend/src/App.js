import React, { useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:1337";
let razorpayScriptPromise;

function loadRazorpayScript() {
    if (window.Razorpay) return Promise.resolve(true);
    if (!razorpayScriptPromise) {
        razorpayScriptPromise = new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.onload = () => resolve(Boolean(window.Razorpay));
            script.onerror = () => {
                razorpayScriptPromise = null;
                resolve(false);
            };
            document.body.appendChild(script);
        });
    }
    return razorpayScriptPromise;
}

function App() {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [paymentId, setPaymentId] = useState("");

    const startPayment = async () => {
        setIsLoading(true);
        setMessage("");
        setPaymentId("");

        try {
            const sdkLoaded = await loadRazorpayScript();
            if (!sdkLoaded) throw new Error("Razorpay Checkout could not load. Check your connection and retry.");

            const { data: order } = await axios.post(`${API_BASE_URL}/razorpay`);
            if (!order.id || !order.keyId || !order.amount || !order.currency) {
                throw new Error("The server returned an invalid order.");
            }

            const checkout = new window.Razorpay({
                key: order.keyId,
                amount: String(order.amount),
                currency: order.currency,
                order_id: order.id,
                name: "Ashish Ranjan",
                description: "T-shirt",
                theme: { color: "#1769ff" },
                handler: async (response) => {
                    setIsLoading(true);
                    setMessage("Payment received. Verifying it securely…");
                    try {
                        const { data } = await axios.post(`${API_BASE_URL}/razorpay/verify-payment`, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });
                        if (!data.verified) throw new Error("Payment could not be verified.");

                        setPaymentId(data.payment_id);
                        setMessage("Payment verified successfully.");
                    } catch {
                        setMessage("We could not confirm the payment. Check the Razorpay dashboard before retrying.");
                    } finally {
                        setIsLoading(false);
                    }
                },
                modal: {
                    ondismiss: () => setMessage("Checkout was closed before payment completed.")
                }
            });

            checkout.on("payment.failed", () => setMessage("Payment failed. You can try again."));
            checkout.open();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Could not start checkout. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="App">
            <section className="product-card" aria-labelledby="product-name">
                <p className="eyebrow">Secure checkout demo</p>
                <h1 id="product-name">Classic T-shirt</h1>
                <p className="price">₹499</p>
                <p className="description">A sample product for testing a Razorpay payment flow.</p>
                <button type="button" onClick={startPayment} disabled={isLoading}>
                    {isLoading ? "Preparing checkout…" : "Pay ₹499"}
                </button>
                <p className="payment-message" role="status" aria-live="polite">{message}</p>
                {paymentId && <p className="payment-reference">Payment ID: {paymentId}</p>}
            </section>
        </main>
    );
}

export default App;
