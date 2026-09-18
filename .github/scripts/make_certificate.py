#!/usr/bin/env python3
"""Render a Certificate of Contribution as SVG.

Invoked by the contributor-certificate workflow when a pull request from a
contributor who has accepted the CLA is merged. Writes SVG to stdout.
"""
from __future__ import annotations

import argparse
import hashlib
from xml.sax.saxutils import escape


def certificate_id(repo: str, pr: str) -> str:
    """Stable, verifiable id derived from the repo and PR number."""
    digest = hashlib.sha256(f"{repo}#{pr}".encode()).hexdigest()[:12].upper()
    return f"{digest[:4]}-{digest[4:8]}-{digest[8:12]}"


def truncate(text: str, limit: int) -> str:
    text = text.strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def render(args: argparse.Namespace) -> str:
    name = escape(truncate(args.name, 42))
    handle = escape(truncate(args.handle, 39))
    repo = escape(args.repo)
    title = escape(truncate(args.title, 68))
    cid = certificate_id(args.repo, args.pr)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1123" height="794" viewBox="0 0 1123 794" role="img" aria-label="Certificate of Contribution for {name}">
  <defs>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="55%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#14b8a6"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>

  <rect width="1123" height="794" fill="url(#sheen)"/>
  <rect x="26" y="26" width="1071" height="742" fill="none" stroke="url(#edge)" stroke-width="3"/>
  <rect x="38" y="38" width="1047" height="718" fill="none" stroke="#cbd5e1" stroke-width="1"/>

  <!-- helix mark -->
  <g transform="translate(561.5,112)" stroke="url(#edge)" stroke-width="3.5" fill="none" stroke-linecap="round">
    <path d="M-26,-34 C 26,-14 -26,14 26,34"/>
    <path d="M26,-34 C -26,-14 26,14 -26,34"/>
    <path d="M-19,-20 H 19 M-23,0 H 23 M-19,20 H 19" stroke-width="2.2" opacity="0.65"/>
  </g>

  <text x="561.5" y="196" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" letter-spacing="7" fill="#475569">EVIGAUGE TECHNOLOGIES PVT. LTD.</text>

  <text x="561.5" y="268" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="50" font-weight="bold" fill="#0f172a">Certificate of Contribution</text>

  <line x1="392" y1="296" x2="731" y2="296" stroke="url(#edge)" stroke-width="2.5"/>

  <text x="561.5" y="352" text-anchor="middle" font-family="Georgia, serif" font-size="19" fill="#475569">This is to certify that</text>

  <text x="561.5" y="420" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="bold" fill="#0f172a">{name}</text>
  <text x="561.5" y="452" text-anchor="middle" font-family="'SF Mono', Menlo, Consolas, monospace" font-size="17" fill="#64748b">@{handle}</text>

  <text x="561.5" y="506" text-anchor="middle" font-family="Georgia, serif" font-size="19" fill="#475569">has made an accepted contribution to the open project</text>

  <text x="561.5" y="548" text-anchor="middle" font-family="'SF Mono', Menlo, Consolas, monospace" font-size="25" font-weight="bold" fill="#0f172a">{repo}</text>

  <text x="561.5" y="588" text-anchor="middle" font-family="Georgia, serif" font-size="16" fill="#64748b">merged as pull request #{args.pr} &#8212; &#8220;{title}&#8221;</text>

  <line x1="150" y1="664" x2="420" y2="664" stroke="#94a3b8" stroke-width="1"/>
  <text x="285" y="686" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#64748b">Date of merge</text>
  <text x="285" y="652" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#0f172a">{escape(args.date)}</text>

  <line x1="703" y1="664" x2="973" y2="664" stroke="#94a3b8" stroke-width="1"/>
  <text x="838" y="686" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#64748b">For Evigauge Technologies Pvt. Ltd.</text>
  <text x="838" y="650" text-anchor="middle" font-family="Georgia, serif" font-size="20" font-style="italic" fill="#0f172a">Evigauge Open Source</text>

  <text x="561.5" y="730" text-anchor="middle" font-family="'SF Mono', Menlo, Consolas, monospace" font-size="12" fill="#94a3b8">CERTIFICATE ID {cid}</text>
  <text x="561.5" y="748" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="#b0bac6">This certificate acknowledges a contribution. It confers no ownership interest, licence or other right in the project.</text>
</svg>
"""


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--name", required=True)
    p.add_argument("--handle", required=True)
    p.add_argument("--repo", required=True)
    p.add_argument("--pr", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--date", required=True)
    print(render(p.parse_args()), end="")


if __name__ == "__main__":
    main()
