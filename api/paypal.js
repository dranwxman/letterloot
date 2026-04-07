export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderID } = req.body;
  if (!orderID) {
    return res.status(400).json({ error: "Missing orderID" });
  }

  const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
  const PAYPAL_BASE = "https://api-m.paypal.com";

  try {
    // Get access token
    const authRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });
    const authData = await authRes.json();
    if (!authData.access_token) {
      return res.status(500).json({ error: "Failed to get PayPal access token" });
    }

    // Verify the order
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, {
      headers: {
        "Authorization": `Bearer ${authData.access_token}`,
        "Content-Type": "application/json",
      },
    });
    const orderData = await orderRes.json();

    if (orderData.status !== "COMPLETED") {
      return res.status(400).json({ error: "Order not completed", status: orderData.status });
    }

    // Get amount paid
    const amount = parseFloat(orderData.purchase_units[0].amount.value);
    let points = 0;
    if (amount >= 10) points = 20000;
    else if (amount >= 5) points = 7500;
    else if (amount >= 1) points = 1000;

    return res.status(200).json({ success: true, points, amount });
  } catch (err) {
    return res.status(500).json({ error: "PayPal verification failed", detail: err.message });
  }
}
