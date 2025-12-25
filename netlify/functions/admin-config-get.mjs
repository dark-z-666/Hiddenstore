import { isOptions, json, storeStrong, getOrInitConfig, verifyAdminToken, requireAllowedIp } from "./_lib.mjs";

export default async (req, context) => {
  if (isOptions(req)) return json({ ok: true });
  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);

  const ipErr = requireAllowedIp(context);
  if (ipErr) return json({ ok: false, error: ipErr }, 403);

  const auth = verifyAdminToken(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  const store = storeStrong();
  const config = await getOrInitConfig(store);
  return json({ ok: true, config });
};

