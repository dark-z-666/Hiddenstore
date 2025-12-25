import { isOptions, json, requireAdminPassword, issueAdminToken, requireAllowedIp } from "./_lib.mjs";

export default async (req, context) => {
  if (isOptions(req)) return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const ipErr = requireAllowedIp(context);
  if (ipErr) return json({ ok: false, error: ipErr }, 403);

  try{
    const body = await req.json().catch(() => ({}));
    const chk = requireAdminPassword(body);
    if (!chk.ok) return json({ ok: false, error: chk.error }, 401);

    const token = issueAdminToken();
    return json({ ok: true, token });
  }catch(e){
    return json({ ok: false, error: "Login failed" }, 500);
  }
};

