const express = require("express");
const app = express();
const path = require("path");
const shortid = require("shortid");
const Razorpay = require("razorpay");
const cors = require("cors");

app.use(cors());

const razorpay = new Razorpay({
    key_id: "rzp_test_VBUfO13Gq8Te8F",
    key_secret: "7y6yT0MiQ5yVFbGNOGjptPs9",
});

app.get("/logo.svg", (req, res) => {
    res.sendFile(path.join(__dirname,"logo.svg"));
});

app.get("/test", (req, res) => {
    res.json({"test key": "test value"});
});

app.post("/razorpay", async (req, res) => {
    const amount = 499;
    const currency = "INR";
    const payment_capture = 1;

    const options = {
        amount: amount * 100, 
        currency, 
        receipt: shortid.generate(), 
        payment_capture
    };

    const response = await razorpay.orders.create(options);
    console.log(response);
    res.json({
        id: response.id,
        currency: response.currency,
        amount: response.amount
    });
});

const PORT = 1337;
app.listen(PORT, ()=> {
    console.log(`listening on port ${PORT}`);
});

