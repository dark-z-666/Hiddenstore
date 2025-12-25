import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";

const STORE_NAME = "hidden-community-store";

// ---------- CORS ----------
export function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "cache-control": "no-store, max-age=0"
  };
}
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extraHeaders
    }
  });
}
export function isOptions(req) {
  return req.method === "OPTIONS";
}

// ---------- Store ----------
export function storeStrong() {
  // Strong consistency so updates appear immediately
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function getOrInitConfig(store) {
  let cfg = await store.get("config", { type: "json" });

  if (!cfg) {
    const pay = process.env.PAYMENT_NUMBER || "01576593082";
    const support = process.env.SUPPORT_TELEGRAM || "@HiddenSupport";

    cfg = {
      version: 1,
      updatedAt: new Date().toISOString(),
      brand: {
        name: "Hidden Community Store",
        tagline: "Premium Python tools • Manual payment • Verified delivery"
      },
      payment: {
        number: pay,
        methods: ["bKash", "Nagad"]
      },
      support: { telegram: support },
      products: [
        { id: "p-starter", name: "Python Starter Kit", description: "A clean toolkit to jumpstart your automation projects.", price: 199 },
        { id: "p-scraper", name: "Pro Web Scraper", description: "Fast scraping utilities with retry logic and export options.", price: 299 },
        { id: "p-bot", name: "Telegram Bot Toolkit", description: "A production-ready bot template with commands & utilities.", price: 349 }
      ]
    };

    await store.setJSON("config", cfg);
  }

  return cfg;
}

// ---------- IDs ----------
export function makePurchaseId() {
  // Short professional ID: HC-YYMMDD-XXXXXX
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = randomBytes(3).toString("hex").toUpperCase(); // 6 chars
  return `HC-${yy}${mm}${dd}-${rand}`;
}

// ---------- Admin Auth (HMAC token) ----------
function b64url(str) {
  return Buffer.from(str).toString("base64url");
}
function sign(data, secret) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function requireAllowedIp(context) {
  const allowed = (process.env.ADMIN_ALLOWED_IP || "").trim();
  if (!allowed) return null;
  const ip = context?.ip || "";
  if (ip !== allowed) return `Admin blocked for this IP (${ip})`;
  return null;
}

export function issueAdminToken() {
  const secret = process.env.ADMIN_TOKEN_SECRET || "";
  if (!secret) throw new Error("Missing ADMIN_TOKEN_SECRET");
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 60 * 60 * 8 }; // 8 hours
  const h = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64url(JSON.stringify(payload));
  const sig = sign(`${h}.${p}`, secret);
  return `${h}.${p}.${sig}`;
}

export function verifyAdminToken(req) {
  const secret = process.env.ADMIN_TOKEN_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!secret || !token) return { ok: false, error: "Unauthorized" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "Unauthorized" };
  const [h, p, sig] = parts;

  const expected = sign(`${h}.${p}`, secret);
  // timing safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "Unauthorized" };

  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (!payload?.exp || now > payload.exp) return { ok: false, error: "Session expired" };

  return { ok: true };
}

export function requireAdminPassword(body) {
  const pw = String(body?.password || "");
  const envPw = String(process.env.ADMIN_PASSWORD || "");
  if (!envPw) return { ok: false, error: "Admin password not set" };
  if (!pw) return { ok: false, error: "Password required" };

  const a = Buffer.from(pw);
  const b = Buffer.from(envPw);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "Invalid password" };
  return { ok: true };
}

// ---------- Notifications ----------
export async function sendTelegram(order, config) {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (!token || !chatId) return { ok: false, skipped: true };

  const lines = [
    "🧾 New Order (Under Review)",
    `• Purchase ID: ${order.purchaseId}`,
    `• Product: ${order.productName}`,
    `• Price: ৳${order.price}`,
    `• TrxID: ${order.transactionId}`,
    `• Telegram: ${order.telegram}`,
    `• Email: ${order.email}`,
    `• Time: ${order.updatedAt || order.createdAt}`
  ];

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join("\n")
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok !== true) return { ok: false, error: "Telegram failed" };
  return { ok: true };
}

export async function sendEmailJS(order, config) {
  const service_id = process.env.EMAILJS_SERVICE_ID || "";
  const template_id = process.env.EMAILJS_TEMPLATE_ID || "";
  const user_id = process.env.EMAILJS_PUBLIC_KEY || "";
  if (!service_id || !template_id || !user_id) return { ok: false, skipped: true };

  const support = config?.support?.telegram || (process.env.SUPPORT_TELEGRAM || "@HiddenSupport");

  const payload = {
    service_id,
    template_id,
    user_id,
    template_params: {
      product_name: order.productName,
      price: `৳${order.price}`,
      purchase_id: order.purchaseId,
      transaction_id: order.transactionId,
      support_telegram: support,
      message: "Thanks! Your purchase is under review. We will confirm and deliver shortly."
    }
  };

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) return { ok: false, error: "EmailJS failed" };
  return { ok: true };
}

