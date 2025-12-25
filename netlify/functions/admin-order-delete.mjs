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
    if(!purchaseId) return json({ ok:false, error:"Missing purchaseId" }, 400);

    const store = storeStrong();
    await store.delete(`orders/${purchaseId}`);
    return json({ ok:true });
  }catch(e){
    return json({ ok:false, error:"Delete failed" }, 500);
  }
};

