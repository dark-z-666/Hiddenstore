import { isOptions, json, storeStrong, verifyAdminToken, requireAllowedIp } from "./_lib.mjs";

export default async (req, context) => {
  if (isOptions(req)) return json({ ok: true });
  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);

  const ipErr = requireAllowedIp(context);
  if (ipErr) return json({ ok: false, error: ipErr }, 403);

  const auth = verifyAdminToken(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  try{
    const store = storeStrong();
    const { blobs } = await store.list({ prefix: "orders/" });

    const orders = [];
    for (const b of blobs.slice(0, 500)) {
      const o = await store.get(b.key, { type: "json" });
      if (o) orders.push(o);
    }

    orders.sort((a,b)=> String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    return json({ ok: true, orders: orders.slice(0, 200) });
  }catch(e){
    return json({ ok: false, error: "Could not list orders" }, 500);
  }
};

