import { isOptions, json, storeStrong, getOrInitConfig, sendTelegram, sendEmailJS } from "./_lib.mjs";

export default async (req, context) => {
  if (isOptions(req)) return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    const purchaseId = String(body.purchaseId || "").trim();
    const transactionId = String(body.transactionId || "").trim();
    const telegram = String(body.telegram || "").trim();
    const email = String(body.email || "").trim();

    if (!purchaseId) return json({ ok: false, error: "Purchase ID missing" }, 400);
    if (transactionId.length < 5) return json({ ok: false, error: "Invalid Transaction ID" }, 400);
    if (!telegram) return json({ ok: false, error: "Telegram username required" }, 400);
    if (!email.includes("@")) return json({ ok: false, error: "Invalid email address" }, 400);

    const store = storeStrong();
    const config = await getOrInitConfig(store);

    const key = `orders/${purchaseId}`;
    const order = await store.get(key, { type: "json" });
    if (!order) return json({ ok: false, error: "Purchase ID not found. Please start checkout again." }, 404);

    const updated = {
      ...order,
      status: "under_review",
      updatedAt: new Date().toISOString(),
      transactionId,
      telegram,
      email
    };

    await store.setJSON(key, updated);

    // Send Telegram + Email (do not fail the buyer flow if they are misconfigured)
    const tg = await sendTelegram(updated, config).catch(() => ({ ok: false }));
    const em = await sendEmailJS(updated, config).catch(() => ({ ok: false }));

    return json({
      ok: true,
      purchaseId,
      status: updated.status,
      telegramSent: !!tg.ok,
      emailSent: !!em.ok
    });
  } catch (e) {
    return json({ ok: false, error: "Could not complete purchase" }, 500);
  }
};

