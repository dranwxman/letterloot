export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: "Email service not configured" });
  }

  // Who we send from / notify. FROM must be on the verified letterloot.net domain.
  const FROM = "LetterLoot <hello@letterloot.net>";
  const ADMIN_TO = "hello@letterloot.net";
  const APP_URL = "https://apps.apple.com/app/id6769522298";

  const { type, word, playerName, email, status, reportedAt } = req.body || {};

  if (!type || !word) {
    return res.status(400).json({ error: "Missing type or word" });
  }

  const name = (playerName && playerName.trim()) ? playerName.trim() : "there";
  const W = String(word).toUpperCase();

  // Build the message (to, subject, html, text) based on the flow.
  let msg;

  if (type === "admin_notify") {
    // Fires at submission — notify the admin that a word needs review.
    const who = (playerName && playerName.trim()) ? playerName.trim() : "Guest";
    const mail = (email && email.trim()) ? email.trim() : "Guest — no email";
    const when = reportedAt ? new Date(reportedAt).toLocaleString() : new Date().toLocaleString();
    msg = {
      to: [ADMIN_TO],
      subject: `\uD83D\uDCDD New word submitted: ${W}`,
      text:
        `New word report for review:\n\n` +
        `Word: ${W}\n` +
        `Player: ${who}\n` +
        `Email: ${mail}\n` +
        `Submitted: ${when}\n\n` +
        `Review it in the admin panel.`,
      html:
        `<p>New word report for review:</p>` +
        `<p><strong>Word:</strong> ${W}<br>` +
        `<strong>Player:</strong> ${who}<br>` +
        `<strong>Email:</strong> ${mail}<br>` +
        `<strong>Submitted:</strong> ${when}</p>` +
        `<p>Review it in the admin panel.</p>`,
    };
  } else if (type === "player_status") {
    // Fires on approve/reject — notify the player of the outcome.
    // Requires a player email; guests have none, so caller should skip those.
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "No player email to send to" });
    }
    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (status === "approved") {
      msg = {
        to: [email.trim()],
        subject: "Your LetterLoot word was added! \uD83C\uDFF4\u200D\u2620\uFE0F",
        text:
          `Ahoy ${name}!\n\n` +
          `Thanks for submitting ${W} for review \u2014 we appreciate you helping make LetterLoot better.\n\n` +
          `Good news: ${W} met our criteria and is now accepted going forward. You'll find it counts in future games.\n\n` +
          `Thanks again for the submission. We hope you keep enjoying LetterLoot \u2014 and if you do, please share it with your friends!\n\n` +
          `${APP_URL}\n\n` +
          `\u2014 The LetterLoot Crew`,
        html:
          `<p>Ahoy ${name}!</p>` +
          `<p>Thanks for submitting <strong>${W}</strong> for review \u2014 we appreciate you helping make LetterLoot better.</p>` +
          `<p>Good news: <strong>${W}</strong> met our criteria and is now accepted going forward. You'll find it counts in future games.</p>` +
          `<p>Thanks again for the submission. We hope you keep enjoying LetterLoot \u2014 and if you do, please <a href="${APP_URL}">share it with your friends</a>!</p>` +
          `<p>\u2014 The LetterLoot Crew</p>`,
      };
    } else {
      msg = {
        to: [email.trim()],
        subject: "Thanks for your LetterLoot submission \uD83C\uDFF4\u200D\u2620\uFE0F",
        text:
          `Ahoy ${name}!\n\n` +
          `Thanks for submitting ${W} for review \u2014 we appreciate you taking the time.\n\n` +
          `After a look, ${W} didn't quite meet our criteria for inclusion this time. No worries \u2014 every submission helps us sharpen the dictionary.\n\n` +
          `Thanks again. We hope you keep enjoying LetterLoot \u2014 and if you do, please share it with your friends!\n\n` +
          `${APP_URL}\n\n` +
          `\u2014 The LetterLoot Crew`,
        html:
          `<p>Ahoy ${name}!</p>` +
          `<p>Thanks for submitting <strong>${W}</strong> for review \u2014 we appreciate you taking the time.</p>` +
          `<p>After a look, <strong>${W}</strong> didn't quite meet our criteria for inclusion this time. No worries \u2014 every submission helps us sharpen the dictionary.</p>` +
          `<p>Thanks again. We hope you keep enjoying LetterLoot \u2014 and if you do, please <a href="${APP_URL}">share it with your friends</a>!</p>` +
          `<p>\u2014 The LetterLoot Crew</p>`,
      };
    }
  } else {
    return res.status(400).json({ error: "Unknown type" });
  }

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
    });

    const data = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      return res.status(502).json({ error: "Email send failed", detail: data });
    }

    return res.status(200).json({ success: true, id: data.id || null });
  } catch (err) {
    return res.status(500).json({ error: "Email send failed", detail: err.message });
  }
}
