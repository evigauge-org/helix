import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface CarouselSlide {
  type: "hero" | "problem" | "solution" | "features" | "details" | "steps" | "cta";
  bg: "light" | "dark" | "gradient";
  tag: string;
  heading: string;
  body?: string;
  bullets?: { icon: string; label: string; description: string }[];
  steps?: { title: string; description: string }[];
  quote?: string;
  cta?: string;
}

interface CarouselData {
  brandName: string;
  handle: string;
  primaryColor: string;
  topic: string;
  slides: CarouselSlide[];
}

async function generateCarouselContent(topic: string, brandName: string, sourceText?: string): Promise<CarouselData> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter not configured");

  const sourceBlock = sourceText
    ? `\n\nUse the following source material from the prior conversation as the primary basis for the carousel. Ground every slide in this content; do not invent facts not supported by it.\n\n<source>\n${sourceText}\n</source>`
    : "";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [
        {
          role: "system",
          content: `You generate Instagram carousel content. Return ONLY valid JSON, no markdown fences.

Format:
{
  "brandName": "${brandName}",
  "handle": "@helix_ai",
  "primaryColor": "#0085CF",
  "topic": "...",
  "slides": [
    {"type": "hero", "bg": "light", "tag": "CATEGORY", "heading": "Bold hook headline", "body": "Supporting text"},
    {"type": "problem", "bg": "dark", "tag": "THE PROBLEM", "heading": "Pain point", "body": "Description of the issue"},
    {"type": "solution", "bg": "gradient", "tag": "THE SOLUTION", "heading": "What solves it", "quote": "A compelling quote or stat"},
    {"type": "features", "bg": "light", "tag": "FEATURES", "heading": "What you get", "bullets": [{"icon": "✦", "label": "Feature 1", "description": "Detail"}, ...]},
    {"type": "details", "bg": "dark", "tag": "HOW IT WORKS", "heading": "Key details", "bullets": [...]},
    {"type": "steps", "bg": "light", "tag": "GET STARTED", "heading": "Steps to begin", "steps": [{"title": "Step name", "description": "What to do"}, ...]},
    {"type": "cta", "bg": "gradient", "tag": "TAKE ACTION", "heading": "Call to action headline", "cta": "Learn More →", "body": "Final compelling line"}
  ]
}

Rules:
- Generate exactly 7 slides following the hero→problem→solution→features→details→steps→cta arc
- Each heading: 4-8 words, punchy, scroll-stopping
- Body text: 1-2 sentences max
- Features: 3-4 items with emoji icon, label, description
- Steps: 3-4 numbered steps
- Alternate light/dark/gradient backgrounds`,
        },
        { role: "user", content: `Create an Instagram carousel about: ${topic}${sourceBlock}` },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error("AI generation failed");
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(jsonStr);
}

function buildCarouselHTML(data: CarouselData): string {
  const B = data.primaryColor || "#0085CF";
  const BL = B + "40";
  const LIGHT_BG = "#F8F6F3";
  const DARK_BG = "#0F172A";
  const total = data.slides.length;

  function progressBar(index: number, isLight: boolean) {
    const pct = ((index + 1) / total) * 100;
    const track = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";
    const fill = isLight ? B : "#fff";
    const label = isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.4)";
    return `<div style="position:absolute;bottom:0;left:0;right:0;padding:16px 28px 20px;z-index:10;display:flex;align-items:center;gap:10px;">
      <div style="flex:1;height:3px;background:${track};border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${fill};border-radius:2px;"></div>
      </div>
      <span style="font-size:11px;color:${label};font-weight:500;">${index + 1}/${total}</span>
    </div>`;
  }

  function swipeArrow(isLight: boolean) {
    const bg = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";
    const stroke = isLight ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.35)";
    return `<div style="position:absolute;right:0;top:0;bottom:0;width:48px;z-index:9;display:flex;align-items:center;justify-content:center;background:linear-gradient(to right,transparent,${bg});">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>`;
  }

  const slideHTML = data.slides.map((slide, i) => {
    // Normalize bg value — AI might return unexpected strings
    const bgType = (slide.bg === "dark" || slide.bg === "gradient") ? slide.bg : (i % 2 === 0 ? "light" : "dark");
    const isLight = bgType === "light";
    const isGradient = bgType === "gradient";
    const bg = isGradient
      ? `linear-gradient(165deg, #003754 0%, ${B} 50%, #4DABE1 100%)`
      : isLight ? LIGHT_BG : DARK_BG;
    const textColor = isLight ? "#1A1918" : "#FFFFFF";
    const subColor = isLight ? "#6B6560" : "rgba(255,255,255,0.75)";
    const tagColor = isLight ? B : isGradient ? "rgba(255,255,255,0.7)" : "#80C3EA";

    let content = "";

    // Tag
    content += `<span style="display:inline-block;font-size:10px;font-weight:600;letter-spacing:2px;color:${tagColor};margin-bottom:16px;">${slide.tag}</span>`;

    // Heading
    content += `<h2 style="font-size:30px;font-weight:600;line-height:1.12;letter-spacing:-0.3px;color:${textColor};margin:0 0 12px;">${slide.heading}</h2>`;

    // Body
    if (slide.body) {
      content += `<p style="font-size:14px;line-height:1.55;color:${subColor};margin:0 0 16px;">${slide.body}</p>`;
    }

    // Quote
    if (slide.quote) {
      content += `<div style="padding:16px;background:rgba(0,0,0,0.15);border-radius:12px;border:1px solid rgba(255,255,255,0.08);margin:12px 0;">
        <p style="font-size:15px;color:#fff;font-style:italic;line-height:1.4;">"${slide.quote}"</p>
      </div>`;
    }

    // Bullets/features
    if (slide.bullets) {
      const border = isLight ? "#E8E4E0" : "rgba(255,255,255,0.08)";
      content += slide.bullets.map((b) => `
        <div style="display:flex;align-items:flex-start;gap:14px;padding:10px 0;border-bottom:1px solid ${border};">
          <span style="color:${isLight ? B : "#fff"};font-size:15px;width:18px;text-align:center;">${b.icon}</span>
          <div>
            <span style="font-size:14px;font-weight:600;color:${textColor};display:block;">${b.label}</span>
            <span style="font-size:12px;color:${subColor};">${b.description}</span>
          </div>
        </div>
      `).join("");
    }

    // Steps
    if (slide.steps) {
      const border = isLight ? "#E8E4E0" : "rgba(255,255,255,0.08)";
      content += slide.steps.map((s, si) => `
        <div style="display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid ${border};">
          <span style="font-size:26px;font-weight:300;color:${isLight ? B : "#fff"};min-width:34px;line-height:1;">0${si + 1}</span>
          <div>
            <span style="font-size:14px;font-weight:600;color:${textColor};display:block;">${s.title}</span>
            <span style="font-size:12px;color:${subColor};">${s.description}</span>
          </div>
        </div>
      `).join("");
    }

    // CTA button
    if (slide.cta) {
      content += `<div style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:${LIGHT_BG};color:${B};font-weight:600;font-size:14px;border-radius:28px;margin-top:16px;">${slide.cta}</div>`;
    }

    const isLast = i === total - 1;
    const bgStyle = isGradient ? `background:${bg};` : `background-color:${bg};`;

    return `<div class="slide" style="min-width:420px;width:420px;height:525px;position:relative;${bgStyle}display:flex;flex-direction:column;justify-content:${slide.type === "cta" || slide.type === "hero" ? "center" : "flex-end"};padding:36px 36px 52px;box-sizing:border-box;overflow:hidden;">
      ${content}
      ${progressBar(i, isLight)}
      ${!isLast ? swipeArrow(isLight) : ""}
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'DM Sans',sans-serif; background:#f5f5f5; display:flex; justify-content:center; padding:40px; }
h2 { font-family:'Playfair Display',serif; }
.ig-frame { width:420px; background:#fff; border-radius:12px; box-shadow:0 2px 20px rgba(0,0,0,0.1); overflow:hidden; }
.ig-header { display:flex; align-items:center; gap:10px; padding:12px 14px; }
.ig-avatar { width:32px; height:32px; border-radius:50%; background:${B}; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:14px; }
.carousel-viewport { width:420px; aspect-ratio:4/5; overflow:hidden; cursor:grab; }
.carousel-track { display:flex; transition:transform 0.3s ease; }
.ig-dots { display:flex; justify-content:center; gap:4px; padding:10px; }
.ig-dot { width:6px; height:6px; border-radius:50%; background:#ddd; }
.ig-dot.active { background:${B}; }
.ig-actions { display:flex; gap:16px; padding:10px 14px; }
.ig-caption { padding:0 14px 14px; font-size:13px; line-height:1.4; color:#333; }
.ig-caption b { font-weight:600; }
</style>
</head><body>
<div class="ig-frame">
  <div class="ig-header">
    <div class="ig-avatar">${data.brandName.charAt(0)}</div>
    <div>
      <div style="font-size:13px;font-weight:600;">${data.brandName}</div>
      <div style="font-size:11px;color:#999;">${data.handle}</div>
    </div>
  </div>
  <div class="carousel-viewport" id="viewport">
    <div class="carousel-track" id="track">
      ${slideHTML}
    </div>
  </div>
  <div class="ig-dots">
    ${data.slides.map((_, i) => `<div class="ig-dot${i === 0 ? " active" : ""}" data-idx="${i}"></div>`).join("")}
  </div>
  <div class="ig-actions">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#333" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#333" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#333" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="margin-left:auto;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="#333" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>
  <div class="ig-caption"><b>${data.handle}</b> ${data.topic}<br><span style="color:#999;font-size:11px;">2 HOURS AGO</span></div>
</div>
<script>
let current = 0;
const track = document.getElementById('track');
const viewport = document.getElementById('viewport');
const dots = document.querySelectorAll('.ig-dot');
const total = ${total};
function goTo(idx) {
  current = Math.max(0, Math.min(idx, total - 1));
  track.style.transform = 'translateX(' + (-current * 420) + 'px)';
  dots.forEach((d, i) => d.classList.toggle('active', i === current));
}
let startX = 0;
viewport.addEventListener('pointerdown', e => { startX = e.clientX; viewport.setPointerCapture(e.pointerId); });
viewport.addEventListener('pointerup', e => {
  const diff = e.clientX - startX;
  if (diff < -30) goTo(current + 1);
  else if (diff > 30) goTo(current - 1);
});
dots.forEach(d => d.addEventListener('click', () => goTo(+d.dataset.idx)));
</script>
</body></html>`;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topic, brandName, sourceText } = await req.json();
  if (!topic) return NextResponse.json({ error: "Topic required" }, { status: 400 });

  try {
    let data: CarouselData;
    try {
      data = await generateCarouselContent(topic, brandName ?? "Helix", sourceText);
    } catch (parseErr) {
      console.error("AI JSON parse failed, using fallback slides:", parseErr);
      // Fallback: create simple slides from the topic
      data = {
        brandName: brandName ?? "Helix",
        handle: "@helix_ai",
        primaryColor: "#0085CF",
        topic,
        slides: [
          { type: "hero", bg: "light", tag: "INTRODUCING", heading: topic, body: "Swipe to learn more →" },
          { type: "problem", bg: "dark", tag: "THE CHALLENGE", heading: "Why This Matters", body: "Understanding the key issues and opportunities." },
          { type: "solution", bg: "gradient", tag: "THE SOLUTION", heading: "A Better Approach", quote: "Innovation starts with asking the right questions." },
          { type: "features", bg: "light", tag: "KEY POINTS", heading: "What You Need to Know", bullets: [
            { icon: "✦", label: "Insight 1", description: "First key takeaway from the research" },
            { icon: "◆", label: "Insight 2", description: "Second important finding" },
            { icon: "●", label: "Insight 3", description: "Third critical point to consider" },
          ]},
          { type: "steps", bg: "light", tag: "NEXT STEPS", heading: "How to Get Started", steps: [
            { title: "Research", description: "Deep dive into the topic" },
            { title: "Plan", description: "Build your strategy" },
            { title: "Execute", description: "Take action on your plan" },
          ]},
          { type: "cta", bg: "gradient", tag: "TAKE ACTION", heading: "Ready to Begin?", cta: "Learn More →", body: "Follow us for more insights" },
        ],
      };
    }

    const html = buildCarouselHTML(data);

    return NextResponse.json({
      html,
      slideCount: data.slides.length,
      brandName: data.brandName,
      topic: data.topic,
    });
  } catch (error) {
    console.error("Carousel generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate carousel" },
      { status: 500 },
    );
  }
}
