# Cowboy Cold Daily Briefing

Daily briefing dashboard for **Cowboy Cold** taproom at 815 SW 2nd St, Oklahoma City, OK 73109.

Shows bartenders what's happening today and this week: Thunder games, TV sports, local events, tap list changes, holidays, and our own taproom events.

## Features

- **Thunder Game Tracker** -- Live scores, upcoming games with TV channel info
- **TV Sports Schedule** -- All major games across NFL, NBA, MLB, NHL, CFB, CBB
- **Google Calendar Integration** -- Taproom events (watch parties, food trucks, karaoke)
- **Untappd Menu Sync** -- Live tap list with change detection (new/removed beers)
- **Local Events** -- Concerts, festivals, community events within 10mi via Eventbrite + PredictHQ
- **Custom Holidays** -- Drinking holidays, observances, and custom dates
- **Weather** -- Daily forecast for OKC
- **Print View** -- Ink-friendly daily sheet for behind the bar
- **Daily Email** -- Morning briefing email at 7 AM CT via Vercel Cron
- **Admin Panel** -- Manage holidays, sports priorities, email recipients, quick events

## Quick Start

```bash
npm install
cp .env.example .env.local
# Fill in your API keys in .env.local
npm run dev
```

Visit http://localhost:3000

## Setup Checklist

### Required API Keys

| Env Variable | Service | Where to Get It | Required? |
|---|---|---|---|
| GOOGLE_CALENDAR_ID | Google Calendar | Google Cloud Console | Optional |
| GOOGLE_SERVICE_ACCOUNT_EMAIL | Google Calendar | Create Service Account | Optional |
| GOOGLE_PRIVATE_KEY | Google Calendar | Download JSON key | Optional |
| UNTAPPD_API_URL | Untappd for Business | business.untappd.com | Optional |
| UNTAPPD_API_KEY | Untappd for Business | Same as above | Optional |
| PREDICTHQ_API_KEY | PredictHQ | predicthq.com (free tier) | Optional |
| EVENTBRITE_API_KEY | Eventbrite | eventbrite.com/platform/api | Optional |
| OPENWEATHERMAP_API_KEY | OpenWeatherMap | openweathermap.org/api (free) | Optional |
| RESEND_API_KEY | Resend | resend.com | For email |
| EMAIL_RECIPIENTS | - | Comma-separated emails | For email |
| ADMIN_PASSWORD | - | Any password | For admin |
| CRON_SECRET | Vercel | Auto-set or random string | For cron |

All API keys are optional. The dashboard shows "Configure [service]" messages for unconfigured services.

## Routes

| Route | Description |
|---|---|
| / | Main dashboard |
| /print | Print-friendly daily sheet |
| /admin | Admin panel (password protected) |
| /api/sports | Sports data (ESPN CDN) |
| /api/calendar | Google Calendar events |
| /api/events | Local events (Eventbrite + PredictHQ) |
| /api/holidays | Public + custom holidays |
| /api/menu | Untappd tap list with changes |
| /api/weather | OKC weather |
| /api/send-briefing | Send daily email (POST) |
| /api/send-briefing/preview | Preview email in browser |
| /api/cron | Vercel Cron endpoint (7 AM CT) |
| /api/health | Health check / service status |

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

The vercel.json cron config sends the daily email at 7 AM CT (12:00 UTC).
