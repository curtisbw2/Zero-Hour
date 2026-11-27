// Fires automatically on every verified Netlify Forms submission.
// Stores the guest data in Netlify Blobs under a random token (7-day TTL,
// enforced on read) and emails social@thezerohourgroup.com. The intake watcher
// on the VPS (zhg-intake-watcher) reads that mailbox, pulls the record through
// get-guest with the token in the email, writes the announcement doc + graphic
// and sends them to Benny. Keep "Intake token: <hex>" in the email: it parses it.
//
// Env vars (set in Netlify UI):
//   RESEND_API_KEY  - required, from resend.com (thezerohourgroup.com is verified there)
//   NOTIFY_EMAIL    - fallback recipient only, used if the social@ send fails
//   RESEND_FROM     - fallback sender only, same
//   SITE_URL        - optional, defaults to https://guest.thezerohourgroup.com

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

// Primary route (Bucky, 2026-11-27): our own domain sender -> the social@ shared mailbox the watcher reads.
const PRIMARY_TO = "social@thezerohourgroup.com";
const PRIMARY_FROM = "ZHG Guest Intake <intake@thezerohourgroup.com>";
// Old route, kept as a fallback so an intake is never silently lost
const FALLBACK_TO = process.env.NOTIFY_EMAIL || "info@thezerohourgroup.com";
const FALLBACK_FROM =
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
    email: data.email || "",
    appearance_format: data.appearance_format || "",
    off_camera_info: data.off_camera_info || "",
    bio: data.bio || "",
    additional_info: data.additional_info || "",
    links: [data.link_1, data.link_2].filter((l) => typeof l === "string" && l.trim()).map((l) => l.trim()),
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

  const row = (k, v) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#888;vertical-align:top">${k}</td><td style="padding:6px 0">${v}</td></tr>`;
  const html = `
        <div style="font-family:sans-serif;max-width:560px">
          <h2 style="margin-bottom:4px">New guest intake submission</h2>
          <p style="color:#666;margin-top:0">Sunday Night Live guest pipeline</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            ${row("Name", `<strong>${escapeHtml(guest.preferred_name)}</strong>`)}
            ${row("Email", `<a href="mailto:${escapeHtml(guest.email)}">${escapeHtml(guest.email)}</a>`)}
            ${row("Camera", escapeHtml(guest.appearance_format))}
            ${guest.off_camera_info ? row("Camera notes", escapeHtml(guest.off_camera_info)) : ""}
            ${row("Bio", escapeHtml(guest.bio))}
            ${guest.links.length ? row("Links", guest.links.map((l) => `<a href="${escapeHtml(l)}">${escapeHtml(l)}</a>`).join("<br>")) : ""}
            ${guest.additional_info ? row("Additional info", escapeHtml(guest.additional_info)) : ""}
            ${guest.logo_url ? row("Logo", `<a href="${escapeHtml(guest.logo_url)}">${escapeHtml(guest.logo_url)}</a>`) : ""}
          </table>
          <p style="margin:24px 0">
            <a href="${generateUrl}"
               style="background:#f97316;color:#000;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
              Generate announcement &rarr;
            </a>
          </p>
          <p style="color:#999;font-size:12px">This link expires in 7 days.<br>Intake token: ${token}</p>
        </div>`;
  const subject = `New guest intake: ${guest.preferred_name || "Unknown guest"}`;

  const send = (from, to) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

  let emailRes = await send(PRIMARY_FROM, PRIMARY_TO);
  if (!emailRes.ok) {
    console.error("Resend error (social@ route):", emailRes.status, await emailRes.text());
    emailRes = await send(FALLBACK_FROM, FALLBACK_TO);
    if (!emailRes.ok) {
      // Data is stored either way; log the failure but don't 500 the trigger
      console.error("Resend error (fallback route):", emailRes.status, await emailRes.text());
    }
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
