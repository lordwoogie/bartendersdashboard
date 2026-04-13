import { format } from "date-fns";
import type { BriefingData } from "./types";

function weatherEmoji(condition?: string): string {
  if (!condition) return "☀️";
  const c = condition.toLowerCase();
  if (c.includes("rain") || c.includes("drizzle")) return "🌧️";
  if (c.includes("storm") || c.includes("thunder")) return "⛈️";
  if (c.includes("snow")) return "🌨️";
  if (c.includes("cloud") || c.includes("overcast")) return "☁️";
  if (c.includes("clear")) return "☀️";
  if (c.includes("fog") || c.includes("mist")) return "🌫️";
  return "☀️";
}

export function generateEmailHtml(data: BriefingData): string {
  const emoji = weatherEmoji(data.weather?.condition);
  const newTaps = data.menuData.changes.filter((c) => c.type === "added");
  const removedTaps = data.menuData.changes.filter((c) => c.type === "removed");

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #1a1410; color: #f5e6d3; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .header { text-align: center; border-bottom: 2px solid #3d3225; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; margin: 0 0 4px; color: #d4a056; }
    .header .date { color: #8b7d6b; font-size: 14px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: bold; color: #d4a056; margin-bottom: 8px; border-bottom: 1px solid #3d3225; padding-bottom: 4px; }
    .card { background: #231c14; border: 1px solid #3d3225; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .thunder-card { background: linear-gradient(135deg, #001f3f, #003366); border: 2px solid #007ac1; }
    .new-tap { background: rgba(212, 160, 86, 0.1); border: 1px solid rgba(212, 160, 86, 0.3); border-radius: 6px; padding: 8px 12px; margin-bottom: 4px; }
    .game-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #2a2218; font-size: 13px; }
    .muted { color: #8b7d6b; }
    .amber { color: #d4a056; }
    .thunder-blue { color: #007ac1; }
    .badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
    .badge-holiday { background: rgba(183, 115, 51, 0.2); color: #b87333; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #2a2218; }
    th { color: #8b7d6b; font-size: 11px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤠 Cowboy Cold Briefing</h1>
      <div class="date">${format(new Date(data.date), "EEEE, MMMM d, yyyy")}</div>`;

  // Weather
  if (data.weather) {
    html += `
      <div style="margin-top: 8px; font-size: 14px;">
        ${emoji} ${data.weather.temp}°F &mdash; ${data.weather.description} (H: ${data.weather.high}° / L: ${data.weather.low}°)
      </div>`;
  }

  // Holidays
  if (data.holidays.length > 0) {
    html += `<div style="margin-top: 8px;">`;
    for (const h of data.holidays) {
      html += `<span class="badge badge-holiday">${h.emoji || ""} ${h.name}</span> `;
    }
    html += `</div>`;
  }

  html += `</div>`;

  // New Taps
  if (newTaps.length > 0) {
    html += `
    <div class="section">
      <div class="section-title">🍺 New On Tap</div>`;
    for (const change of newTaps) {
      html += `
      <div class="new-tap">
        <strong>🆕 ${change.item.name}</strong>
        ${change.item.brewery ? `<span class="muted"> &middot; ${change.item.brewery}</span>` : ""}
        ${change.item.style ? `<br><span class="muted" style="font-size: 12px;">${change.item.style}${change.item.abv ? ` &middot; ${change.item.abv}%` : ""}</span>` : ""}
      </div>`;
    }
    if (removedTaps.length > 0) {
      html += `<div style="margin-top: 8px; font-size: 11px;" class="muted">Pulled: ${removedTaps.map((c) => c.item.name).join(", ")}</div>`;
    }
    html += `</div>`;
  }

  // Thunder game
  if (data.thunderGame) {
    const g = data.thunderGame;
    const isHome = g.homeTeam.toLowerCase().includes("thunder");
    html += `
    <div class="section">
      <div class="card thunder-card">
        <div style="font-size: 18px; font-weight: bold; color: white;">⚡ OKC Thunder</div>
        <div class="thunder-blue" style="font-size: 16px; margin-top: 4px;">
          ${isHome ? `vs ${g.awayTeam}` : `@ ${g.homeTeam}`}
        </div>
        <div class="muted" style="margin-top: 4px;">
          ${isHome ? "Home" : "Away"} &middot; ${format(new Date(g.time), "h:mm a")}${g.channel ? ` &middot; ${g.channel}` : ""}
        </div>
      </div>
    </div>`;
  }

  // TV Games
  if (data.tvGames.length > 0) {
    html += `
    <div class="section">
      <div class="section-title">📺 What's On TV</div>
      <table>
        <thead><tr><th>Time</th><th>Matchup</th><th>Channel</th></tr></thead>
        <tbody>`;
    for (const g of data.tvGames.slice(0, 15)) {
      html += `
          <tr>
            <td class="amber" style="white-space: nowrap;">${format(new Date(g.time), "h:mm a")}</td>
            <td>${g.awayTeam} @ ${g.homeTeam}</td>
            <td class="muted">${g.channel || "—"}</td>
          </tr>`;
    }
    html += `</tbody></table></div>`;
  }

  // Our Events
  if (data.calendarEvents.length > 0) {
    html += `
    <div class="section">
      <div class="section-title">🤠 Our Events</div>`;
    for (const e of data.calendarEvents) {
      html += `
      <div class="card">
        <strong>${e.summary}</strong>
        <div class="amber" style="font-size: 13px; margin-top: 4px;">
          ${format(new Date(e.start), "h:mm a")}${e.end ? ` — ${format(new Date(e.end), "h:mm a")}` : ""}
        </div>
        ${e.description ? `<div class="muted" style="font-size: 12px; margin-top: 4px;">${e.description}</div>` : ""}
      </div>`;
    }
    html += `</div>`;
  }

  // Local Events
  if (data.localEvents.length > 0) {
    html += `
    <div class="section">
      <div class="section-title">🌆 Around OKC</div>`;
    for (const e of data.localEvents.slice(0, 8)) {
      html += `
      <div style="padding: 4px 0; border-bottom: 1px solid #2a2218; font-size: 13px;">
        <strong>${e.name}</strong>
        ${e.venue ? `<span class="muted"> @ ${e.venue}</span>` : ""}
        ${e.start ? `<span class="amber" style="float: right;">${format(new Date(e.start), "h:mm a")}</span>` : ""}
      </div>`;
    }
    html += `</div>`;
  }

  // Full Tap List
  if (data.menuData.items.length > 0) {
    html += `
    <div class="section">
      <div class="section-title">🍺 Full Tap List</div>
      <table>
        <thead><tr><th>Beer</th><th>Style</th><th>ABV</th></tr></thead>
        <tbody>`;
    const newIds = new Set(newTaps.map((c) => c.item.id));
    for (const item of data.menuData.items) {
      const isNew = newIds.has(item.id);
      html += `
          <tr>
            <td>${isNew ? "🆕 " : ""}${item.name}${item.brewery ? `<br><span class="muted" style="font-size: 11px;">${item.brewery}</span>` : ""}</td>
            <td class="muted">${item.style || "—"}</td>
            <td class="amber">${item.abv ? `${item.abv}%` : "—"}</td>
          </tr>`;
    }
    html += `</tbody></table></div>`;
  }

  html += `
    <div style="text-align: center; color: #8b7d6b; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #3d3225;">
      Cowboy Cold &middot; 815 SW 2nd St, OKC &middot; Generated ${format(new Date(), "h:mm a")}
    </div>
  </div>
</body>
</html>`;

  return html;
}

export function generateEmailSubject(data: BriefingData): string {
  const emoji = weatherEmoji(data.weather?.condition);
  return `${emoji} Cowboy Cold Briefing — ${format(new Date(data.date), "EEEE, MMM d")}`;
}
