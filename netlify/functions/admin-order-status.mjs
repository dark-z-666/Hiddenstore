import { isOptions, json, storeStrong, verifyAdminToken, requireAllowedIp } from "./_lib.mjs";

export default async (req, context) => {
  if (isOptions(req)) return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const ipErr = requireAllowedIp(context);
  if (ipErr) return json({ ok: false, error: ipErr }, 403);

  const auth = verifyAdminToken(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  try{
    const body = await req.json().catch(() => ({}));
    const purchaseId = String(body.purchaseId || "").trim();
    const status = String(body.status || "").trim();

    if(!purchaseId || !status) return json({ ok:false, error:"Missing fields" }, 400);

    const store = storeStrong();
    const key = `orders/${purchaseId}`;
    const order = await store.get(key, { type:"json" });
    if(!order) return json({ ok:false, error:"Order not found" }, 404);

    order.status = status;
    order.updatedAt = new Date().toISOString();
    await store.setJSON(key, order);

    return json({ ok:true });
  }catch(e){
    return json({ ok:false, error:"Update failed" }, 500);
  }
};

