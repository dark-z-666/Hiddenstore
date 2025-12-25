import { isOptions, json, storeStrong, getOrInitConfig, makePurchaseId } from "./_lib.mjs";

export default async (req, context) => {
  if (isOptions(req)) return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const productId = String(body.productId || "").trim();
    if (!productId) return json({ ok: false, error: "Product required" }, 400);

    const store = storeStrong();
    const config = await getOrInitConfig(store);
    const p = (config.products || []).find(x => x.id === productId);
    if (!p) return json({ ok: false, error: "Product not found" }, 404);

    const purchaseId = makePurchaseId();
    const key = `orders/${purchaseId}`;

    const order = {
      purchaseId,
      status: "awaiting_payment",
      createdAt: new Date().toISOString(),
      updatedAt: null,

      productId: p.id,
      productName: p.name,
      price: Number(p.price || 0),

      transactionId: null,
      telegram: null,
      email: null,

      ip: context?.ip || null
    };

    await store.setJSON(key, order);

    return json({
      ok: true,
      purchaseId,
      paymentNumber: config.payment?.number || "01576593082",
      amount: order.price
    });
  } catch (e) {
    return json({ ok: false, error: "Could not start checkout" }, 500);
  }
};

