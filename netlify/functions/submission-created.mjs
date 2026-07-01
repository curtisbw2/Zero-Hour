// Fires automatically on every verified Netlify Forms submission.
// Stores the guest data in Netlify Blobs under a random token (7-day TTL,
// enforced on read) and emails Benny a link to the /generate page.
//
// Env vars (set in Netlify UI):
//   RESEND_API_KEY  - required, from resend.com
//   NOTIFY_EMAIL    - optional, defaults to benofghent@gmail.com
//   RESEND_FROM     - optional, defaults to Resend's onboarding sender
//   SITE_URL        - optional, defaults to https://guest.thezerohourgroup.com

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "benofghent@gmail.com";
const RESEND_FROM =
  process.env.RESEND_FROM || "ZHG Guest Intake <onboarding@resend.dev>";
const SITE_URL = process.env.SITE_URL || "https://guest.thezerohourgroup.com";

export default async (req) => {
  const body = await req.json();
  const payload = body.payload || {};
  const data = payload.data || {};

  const formName = payload.form_name || data["form-name"];
  if (formName !== "guest-intake") {
    return new Response("ignored", { status: 200 });
  }

  // Logo arrives as an object with a hosted URL when a file was uploaded
  const logo = data.logo;
  const logoUrl =
    (logo && typeof logo === "object" && logo.url) ||
    (typeof logo === "string" ? logo : "");

  const guest = {
    preferred_name: data.preferred_name || "",
    appearance_format: data.appearance_format || "",
    off_camera_info: data.off_camera_info || "",
    bio: data.bio || "",
    additional_info: data.additional_info || "",
    logo_url: logoUrl,
  };

  const token = randomBytes(16).toString("hex");
  const store = getStore({ name: "guest-intake", consistency: "strong" });
  await store.setJSON(token, {
    createdAt: Date.now(),
    submittedAt: payload.created_at || new Date().toISOString(),
    guest,
  });

  const generateUrl = `${SITE_URL}/generate?token=${token}`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [NOTIFY_EMAIL],
      subject: `New guest intake: ${guest.preferred_name || "Unknown guest"}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px">
          <h2 style="margin-bottom:4px">New guest intake submission</h2>
          <p style="color:#666;margin-top:0">Sunday Night Live guest pipeline</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            <tr><td style="padding:6px 12px 6px 0;color:#888">Name</td><td style="padding:6px 0"><strong>${escapeHtml(guest.preferred_name)}</strong></td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#888">Camera</td><td style="padding:6px 0">${escapeHtml(guest.appearance_format)}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#888;vertical-align:top">Bio</td><td style="padding:6px 0">${escapeHtml(guest.bio)}</td></tr>
          </table>
          <p style="margin:24px 0">
            <a href="${generateUrl}"
               style="background:#f97316;color:#000;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
              Generate announcement &rarr;
            </a>
          </p>
          <p style="color:#999;font-size:12px">This link expires in 7 days.</p>
        </div>`,
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    console.error("Resend error:", emailRes.status, err);
    // Data is stored either way; log the failure but don't 500 the trigger
  }

  return new Response("ok", { status: 200 });
};

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
