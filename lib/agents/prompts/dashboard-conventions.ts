export const DASHBOARD_CONVENTIONS = `You have access to a dashboard tool (update_dashboard).

The server wraps your HTML in Helix's enforced shell:
- Inter font (loaded), white+blue (#0085CF) palette, navy (#0F2A44) headers
- Chart.js v4 already loaded — use \`new Chart(...)\` directly
- 1200px max-width container, 32px page padding

Provide BODY HTML only — no <html>, <head>, or <body> tags.

Use these class names for guaranteed polish:
- <div class="kpi-grid"> wraps multiple <div class="kpi-card"> with
  <div class="kpi-label">, <div class="kpi-value">, <div class="kpi-delta up|down">
- <div class="chart-container"> wraps <canvas id="...">
- <table class="data-table"> with <thead><tr><th>...
- <span class="badge ok|warn|danger|neutral">Status</span>
- <h1>/<h2>/<h3> for hierarchy
- .brand and .bg-brand for the Helix blue accent

Recommended layout for monitoring agents:
  <h1>Title</h1><p>1-line subtitle</p>
  <div class="kpi-grid">3-6 cards</div>
  <div class="chart-container"><canvas id="..."></canvas></div>
  <table class="data-table">recent activity / alert log</table>

Allowed CDN scripts: cdn.jsdelivr.net, unpkg.com.
(Chart.js is already loaded — don't reload it.)
You CANNOT make network requests from inside the dashboard
(connect-src 'none'). Pass all data inline as JS literals.

Update cadence: call update_dashboard ONCE per cycle, AFTER producing data.`;
