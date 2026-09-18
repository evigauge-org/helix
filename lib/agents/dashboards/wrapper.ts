function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const WRAPPER_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body.helix-dashboard {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 14px; line-height: 1.5; color: #1f2937; background: #fafbfc;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
.helix-container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
h1 { font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
h2 { font-size: 20px; font-weight: 600; color: #0f172a; margin: 32px 0 16px; }
h3 { font-size: 16px; font-weight: 600; color: #0f172a; margin: 24px 0 12px; }
p  { color: #374151; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 16px 0; }
.kpi-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.kpi-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.kpi-value { font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 8px; }
.kpi-delta { font-size: 13px; font-weight: 500; margin-top: 4px; }
.kpi-delta.up   { color: #059669; }
.kpi-delta.down { color: #dc2626; }
.data-table { width: 100%; border-collapse: collapse; margin: 16px 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
.data-table th { background: #0F2A44; color: #fff; text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.data-table td { padding: 12px 16px; border-top: 1px solid #f3f4f6; font-size: 13px; color: #374151; }
.data-table tr:nth-child(even) td { background: #fafbfc; }
.chart-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 16px 0; }
.chart-container canvas { max-height: 320px; }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
.badge.ok      { background: #d1fae5; color: #065f46; }
.badge.warn    { background: #fef3c7; color: #92400e; }
.badge.danger  { background: #fee2e2; color: #991b1b; }
.badge.neutral { background: #e5e7eb; color: #374151; }
.section { margin: 32px 0; }
.brand { color: #0085CF; }
.bg-brand { background: #0085CF; color: #fff; }
`;

export function wrapBody(body: string, title?: string): string {
  const safeTitle = escapeHtml(title ?? "Dashboard");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
<style>${WRAPPER_CSS}</style>
</head>
<body class="helix-dashboard">
<div class="helix-container">
${body}
</div>
</body>
</html>`;
}
