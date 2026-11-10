# React and Node.js Razorpay Checkout Demo

A small React and Express project that creates Razorpay Orders on the server and verifies payments before showing success. The sample product price is fixed by the backend at ₹499.

## Important key action

A Razorpay key secret was committed in earlier repository history. I removed it from the current source, but it remains in public Git history. Revoke/rotate that secret in the Razorpay Dashboard before using this project, and do not reuse it. The replacement secret belongs only in `backend/.env`; the browser receives only the public Key ID.

## Requirements

- Node.js 22.12 or newer
- npm
- Razorpay test-mode API keys

## Start the API

```powershell
Set-Location backend
Copy-Item .env.example .env
```

Add your new Razorpay test Key ID and Key Secret to `backend/.env`, then run:

```powershell
npm ci
npm run dev
```

The API listens on `http://127.0.0.1:1337` by default.

## Start the React checkout

In a second terminal:

```powershell
Set-Location frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Open the local Vite address shown in the terminal. The frontend uses `VITE_API_BASE_URL` to locate the API; CORS on the backend allows the origin configured by `FRONTEND_URL`.

## Payment flow

1. The backend creates a ₹499 Razorpay Order and returns its ID, amount, currency, and public Key ID.
2. Razorpay Checkout collects the payment details.
3. The browser posts Razorpay's order ID, payment ID, and signature to the backend.
4. The backend verifies the HMAC signature, checks the payment against the server-created order, and confirms a captured payment before reporting success.

The backend keeps pending order details in memory for this demo. Restarting it clears pending verification state. A production integration needs durable order storage, webhooks, deployment-specific origin and proxy settings, and an operational review. Do not use this demo to fulfill real purchases as-is.

## API routes

- `GET /health`
- `POST /razorpay` — create the fixed-price order
- `POST /razorpay/verify-payment` — verify and confirm a captured payment

The order creation and verification endpoints are rate limited. Test keys simulate payments; use a new key pair after rotating the leaked credential.
