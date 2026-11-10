# Razorpay Checkout Frontend

React checkout UI built with Vite. It requests a server-created order and sends the Checkout response to the backend for verification.

## Run locally

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` if the backend is not at `http://127.0.0.1:1337`. Only the public Razorpay Key ID is sent to the browser by the backend; keep the Key Secret in the backend environment.
