// POST /.netlify/functions/generate-announcement
// Body: {
//   token:  string   - intake token (also gates access to this endpoint)
//   mode:   "generate" | "edit"
//   show:   { date, time, cohost, topics, milestones, links, notes }
//   draft:      string  - (edit mode) the current full draft
//   selection:  string  - (edit mode, optional) the selected portion to change
//   instruction:string  - (edit mode) what to change
// }
// Streams the announcement back as plain text.
//
// Env vars: ANTHROPIC_API_KEY (read automatically by the SDK)

import Anthropic from "@anthropic-ai/sdk";
import { loadGuest } from "./get-guest.mjs";

let anthropic;
function client() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return (anthropic ??= new Anthropic());
}

const SYSTEM_PROMPT = `You write guest announcements for The Zero Hour Group (ZHG), a retail-investor media brand focused on defense and drone-sector equities. The announcements promote the Sunday Night Live stream and are posted to Substack and X. You write them in Benny's voice.

THE VOICE
- Carnival-barker enthusiasm with a wink: "folks!!", "people...you don't want to miss it!", exclamation points used freely.
- Playful and self-deprecating where it fits ("Hey, JT's on vacay, I'm doing the best I can here!").
- Hypes the guests hard but with real substance: their actual expertise, credentials, and trading style, told with color and personality (hobbies, quirks, fun asides like "building rockets maybe?").
- Community-minded: thanks co-hosts, sends viewers to the guest's channel/community, "tell them ZHG sent you."
- Never sounds corporate, never sounds like a press release, never hedges.

REFERENCE ANNOUNCEMENT (match this structure and energy):
---
TONIGHT: ZHG Sunday Night Livestream — 8:30 PM EDT
It's here. Tonight at 8:30 PM EDT, The Zero Hour Group goes live from the ZHG Substack page
Not only that, but history will be made as Sunday Night Live gets simulstreamed on YouTube, X, and Substack all at the same time for the first time, folks!!  Not only can fans now tune in where ever and when ever they choose for the best streams in the business, but tonight's show will be ZHG's first podcast going out to the rest of the world on Spotify tomorrow!
Exciting things happening at The Zero Hour Group, people…you don't want to miss it!
Now for the lineup:
You all know Ryan and a previous guest on the show.   He is filling in for JT who is on vacation this week.  Ryan is a serious long term investor in equities, but he butters his bread with defined risk options strategies.  Thanks for co-hosting, Ryan!  Find out more about Ryan at the

→ LP Options Academy

If you don't know our very special guest tonight, Ann, you should.  Ann is a doctor two times over!  A PhD in math didn't do the trick, so she went and earned an MD, folks!  Now, between practicing medicine, family obligations, rock climbing (and idk what else, building rockets maybe?) Ann applies her mad analytical skills to selling index options.  You can find her and her trade ideas on her channel over in The Kingdom Discord.  Go see her after the show and tell her ZHG sent you:
 https://whop.com/kingdom-ann/the-kingdom-c5-ee6a/

▶ JOIN THE STREAM HERE:
https://thezerohourgroup.com/live
or here:
https://www.youtube.com/watch?v=SsWrtfwFdhs
The lobby opens at 8, entertainment provided for early arrivals
The Show starts at 8:30.
The Zero Hour Group content is for educational and entertainment purposes only and is not financial advice. We are not financial advisors. Do your own research.
---

STRUCTURE (follow it, but let the content breathe):
1. "TONIGHT: ZHG Sunday Night Livestream — [time]" style header (adjust the day word if the show isn't tonight/Sunday).
2. A hype paragraph or two: when and where it's happening, plus any milestones or announcements Benny provided.
3. "Now for the lineup:" — the co-host situation, then the guest spotlight paragraph(s) with their bio brought to life, ending with where to find them.
4. "▶ JOIN THE STREAM HERE:" followed by the stream links.
5. Lobby/show timing lines.
6. Close with this disclaimer VERBATIM: "The Zero Hour Group content is for educational and entertainment purposes only and is not financial advice. We are not financial advisors. Do your own research."

HARD RULES
- Use ONLY the facts provided about the guest and the show. Never invent credentials, links, tickers, or milestones. If a detail is missing, write around it.
- If the guest is off-camera or has special appearance notes, work it in naturally if relevant, otherwise skip it.
- Output the announcement text ONLY - no preamble, no markdown headers or formatting syntax, no commentary. Plain text ready to paste into Substack.`;

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "bad_json" }, { status: 400 });

  const { token, mode = "generate", show = {}, draft, selection, instruction } = body;

  // The token gates the endpoint - no valid intake, no Claude calls
  const { record, error, status } = await loadGuest(token);
  if (error) return Response.json({ error }, { status });

  const guest = record.guest;
  const guestBlock = [
    `Name/handle: ${guest.preferred_name || "(not given)"}`,
    `Camera: ${guest.appearance_format || "(not given)"}${guest.off_camera_info ? ` - ${guest.off_camera_info}` : ""}`,
    `Bio (guest's own words): ${guest.bio || "(not given)"}`,
    `Additional info from guest: ${guest.additional_info || "(none)"}`,
  ].join("\n");

  const showBlock = [
    `Show date: ${show.date || "(not given)"}`,
    `Show time: ${show.time || "8:30 PM EDT"}`,
    `Co-host situation: ${show.cohost || "(not given)"}`,
    `Topics for this show: ${show.topics || "(not given)"}`,
    `Milestones / announcements to hype: ${show.milestones || "(none)"}`,
    `Stream links:\n${show.links || "(not given)"}`,
    `Extra notes from Benny: ${show.notes || "(none)"}`,
  ].join("\n");

  let userMessage;
  if (mode === "edit" && draft) {
    userMessage = `Here is the current announcement draft:

<draft>
${draft}
</draft>

${selection ? `The part to change is this selected portion:\n\n<selection>\n${selection}\n</selection>\n\n` : ""}Edit instruction from Benny: ${instruction || "(none given)"}

Apply the edit. Change ONLY what the instruction requires${selection ? " (focused on the selected portion)" : ""} and keep the rest of the draft word-for-word identical. Return the complete revised announcement.

For reference, the guest and show context:

GUEST INTAKE:
${guestBlock}

SHOW DETAILS:
${showBlock}`;
  } else {
    userMessage = `Write the announcement for this show.

GUEST INTAKE:
${guestBlock}

SHOW DETAILS:
${showBlock}`;
  }

  const ai = client();
  if (!ai) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set in Netlify environment variables" },
      { status: 500 },
    );
  }

  const stream = ai.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
      try {
        await stream.finalMessage();
      } catch (err) {
        console.error("Anthropic stream error:", err);
        controller.enqueue(
          encoder.encode("\n\n[Generation failed - hit Regenerate to try again]"),
        );
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
