// Landing-page feedback form (letterloot.net) -> email to hello@letterloot.net via Resend.
// Same Resend setup as send-word-email.js (RESEND_API_KEY env var, verified support.letterloot.net sender).
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: "Email service not configured" });

  const FROM = "LetterLoot <noreply@support.letterloot.net>";
  const ADMIN_TO = "hello@letterloot.net";

  const body = req.body || {};

  // Honeypot: bots fill the hidden "website" field. Pretend success, send nothing.
  if (body.website) return res.status(200).json({ success: true });

  const clip = (v, n) => String(v || "").trim().slice(0, n);
  const kind = ["Bug", "Idea", "Other"].includes(body.kind) ? body.kind : "Other";
  const message = clip(body.message, 3000);
  const name = clip(body.name, 80);
  const email = clip(body.email, 200);
  const ua = clip(body.ua, 300);
  const page = clip(body.page, 300);

  if (message.length < 5) return res.status(400).json({ error: "Message too short" });
  const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return res.status(400).json({ error: "Invalid email" });

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const icon = kind === "Bug" ? "🐛" : kind === "Idea" ? "💡" : "✉️";
  const who = name || "Anonymous";
  const mail = email || "(no email given)";
  const when = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT";

  const payload = {
    from: FROM,
    to: [ADMIN_TO],
    subject: `${icon} LetterLoot ${kind}: ${message.slice(0, 50).replace(/\s+/g, " ")}${message.length > 50 ? "…" : ""}`,
    text:
      `New ${kind} from letterloot.net\n\n` +
      `From: ${who}\nEmail: ${mail}\nWhen: ${when}\n\n` +
      `${message}\n\n` +
      `---\nDevice: ${ua || "unknown"}\nPage: ${page || "unknown"}`,
    html:
      `<p><strong>New ${kind}</strong> from letterloot.net</p>` +
      `<p><strong>From:</strong> ${esc(who)}<br><strong>Email:</strong> ${esc(mail)}<br><strong>When:</strong> ${esc(when)}</p>` +
      `<p style="white-space:pre-wrap;border-left:3px solid #7c3aed;padding-left:12px">${esc(message)}</p>` +
      `<p style="color:#888;font-size:12px">Device: ${esc(ua || "unknown")}<br>Page: ${esc(page || "unknown")}</p>`,
  };
  if (email) payload.reply_to = email; // hit Reply in your inbox to answer the player directly

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: "Email send failed", detail: data });
    return res.status(200).json({ success: true, id: data.id || null });
  } catch (err) {
    return res.status(500).json({ error: "Email send failed", detail: err.message });
  }
}
