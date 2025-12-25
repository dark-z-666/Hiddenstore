import { isOptions, json, storeStrong, getOrInitConfig, verifyAdminToken, requireAllowedIp } from "./_lib.mjs";

function cleanConfig(inCfg, oldCfg){
  const cfg = structuredClone(oldCfg);

  // Accept only safe editable fields
  if (inCfg?.brand) {
    cfg.brand = cfg.brand || {};
    cfg.brand.name = String(inCfg.brand.name || cfg.brand.name || "").slice(0, 80);
    cfg.brand.tagline = String(inCfg.brand.tagline || cfg.brand.tagline || "").slice(0, 120);
  }
  if (inCfg?.payment) {
    cfg.payment = cfg.payment || {};
    cfg.payment.number = String(inCfg.payment.number || cfg.payment.number || "").slice(0, 30);
  }
  if (inCfg?.support) {
    cfg.support = cfg.support || {};
    cfg.support.telegram = String(inCfg.support.telegram || cfg.support.telegram || "").slice(0, 50);
  }

  if (Array.isArray(inCfg?.products)) {
    cfg.products = inCfg.products
      .slice(0, 200)
      .map(p => ({
        id: String(p.id || "").slice(0, 40),
        name: String(p.name || "").slice(0, 120),
        description: String(p.description || "").slice(0, 300),
        price: Math.max(0, Number(p.price || 0))
      }))
      .filter(p => p.id && p.name && p.price >= 0);
  }

  cfg.version = Number(cfg.version || 1) + 1;
  cfg.updatedAt = new Date().toISOString();
  return cfg;
}

export default async (req, context) => {
  if (isOptions(req)) return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const ipErr = requireAllowedIp(context);
  if (ipErr) return json({ ok: false, error: ipErr }, 403);

  const auth = verifyAdminToken(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  try{
    const body = await req.json().catch(() => ({}));
    const inCfg = body.config;

    const store = storeStrong();
    const oldCfg = await getOrInitConfig(store);
    const nextCfg = cleanConfig(inCfg, oldCfg);

    await store.setJSON("config", nextCfg);
    return json({ ok: true, version: nextCfg.version });
  }catch(e){
    return json({ ok: false, error: "Update failed" }, 500);
  }
};

