import { isOptions, json, storeStrong, getOrInitConfig } from "./_lib.mjs";

export default async (req, context) => {
  if (isOptions(req)) return json({ ok: true });

  try {
    const store = storeStrong();
    const config = await getOrInitConfig(store);

    // Public config (safe fields only)
    return json({ ok: true, config });
  } catch (e) {
    return json({ ok: false, error: "Config load failed" }, 500);
  }
};

