import React, { useState, useEffect } from "react";
import logo from './logo.svg';
import './App.css';
import axios from 'axios';

const __DEV__ = document.domain === "localhost";

function App() {
    let loadScript = (src) => {
        return new Promise((resolve)=> {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => {
                resolve(true)
            };
            script.onerror = () => {
                resolve(false);
            };
            document.body.appendChild(script);
        });
    };

    useEffect(() => {
        loadScript("https://checkout.razorpay.com/v1/checkout.js");
    });

    let displayRazorpay = async ()=> {
        const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        if (!res) {
            alert("razorpay sdk failed to load... network error");
            return;
        }

        const {data} = await axios.post("http://localhost:1337/razorpay");
        console.log(data);

        const options = {
            "key": __DEV__ ? "rzp_test_VBUfO13Gq8Te8F" : "PRODUCTION_KEY",
            currency: data.currency,
            amount: data.amount.toString(),
            order_id: data.id,
            "name": "Donation",
            "description": "Test Transaction",
            "image": "http://localhost:1337/logo.svg",
            "handler": function (response){
                // alert(response.razorpay_payment_id);
                setPaymentId(response.razorpay_payment_id);
                // alert(response.razorpay_order_id);
                setOrderId(response.razorpay_order_id);
                // alert(response.razorpay_signature)
                setSignature(response.razorpay_signature);
            },
            "prefill": {
                "name": "Gaurav Kumar",
                "email": "gaurav.kumar@example.com",
                "contact": "9999999999"
            },
            "notes": {
                "address": "Razorpay Corporate Office"
            },
            "theme": {
                "color": "#000"
            }
        };
        const paymentObject = new window.Razorpay(options);
		paymentObject.open();
    };

    const styles = {
        display: "inline-block",
        width: "200px", height: "100px",
        padding: "20px",
        backgroundColor: "#eee",
        margin: "20px"
    };

    const [order_id, setOrderId] = useState("");
    const [payment_id, setPaymentId] = useState("");
    const [signature, setSignature] = useState("");
   
    return (
        <div className="App">
            <div style={styles}>
                Product name: t shirt<br />
                price: 499<br />
                <button onClick={displayRazorpay}>Pay 499</button>
            </div>
            <div>
                razorpay_payment_id:: {payment_id}<br />
                razorpay_order_id:: {order_id}<br />
                razorpay_signature:: {signature}<br />
            </div>
        </div>
    );
}

export default App;
