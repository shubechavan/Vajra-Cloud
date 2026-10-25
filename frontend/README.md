# Vajra Cloud — Auto-Scaling & Load Balancing Dashboard

## Stage 1 — Frontend Dashboard

A polished React dashboard for monitoring cloud infrastructure, load balancing, and auto-scaling — built as part of a college Cloud Computing project.

> **Note:** This is Stage 1 (frontend only). All metrics shown are **sample data** for demonstration purposes. Real backend integration will be added in Stage 2.

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (download from [nodejs.org](https://nodejs.org/))
- **npm** (bundled with Node.js)

### Installation

```bash
cd frontend
npm install
```

### Run the Development Server

```bash
npm run dev
```

The dashboard will open at **http://localhost:5173**.

### Production Build

```bash
npm run build
npm run preview
```

---

## Adding Your Custom Video

The dashboard includes a **video player card** for your demo recording.

### Steps:

1. Record or prepare your demo video as an **MP4** file.
2. Place the file at:
   ```
   frontend/public/videos/cloudscale-demo.mp4
   ```
3. Restart the dev server (or refresh the page).
4. Your video will appear in the dashboard's featured video card with playback controls.

### What happens if the video is missing?

A graceful placeholder with a play icon and instructions will be shown instead. The rest of the dashboard works normally without the video.

---

## Project Structure

```
frontend/
├── public/
│   └── videos/
│       └── cloudscale-demo.mp4   ← Place your video here
├── src/
│   ├── components/
│   │   ├── ActivityCard.jsx       — Scaling events timeline (dark card)
│   │   ├── AutoScalingCard.jsx    — Auto-scaling config & CPU gauge
│   │   ├── LoadBalancingCard.jsx  — Traffic distribution visual
│   │   ├── MetricsRow.jsx        — Four key metric cards
│   │   ├── Navbar.jsx            — Top navigation bar
│   │   ├── ServerInstancesCard.jsx — Instance health status
│   │   ├── TrafficChart.jsx      — Traffic chart with Recharts
│   │   ├── VideoCard.jsx         — Custom video player
│   │   └── WelcomeSection.jsx    — Welcome heading & status badges
│   ├── pages/
│   │   └── PlaceholderPage.jsx   — Placeholder for Stage 2 pages
│   ├── App.jsx                   — Root component & state management
│   ├── App.css                   — Component & layout styles
│   ├── index.css                 — Global design system (variables, reset)
│   └── main.jsx                  — React entry point
├── index.html                    — HTML shell with SEO meta tags
├── vite.config.js                — Vite configuration
├── package.json
└── README.md                     ← You are here
```

---

## Tech Stack

| Technology   | Purpose                    |
|-------------|----------------------------|
| React 19    | UI framework               |
| Vite 8      | Build tool & dev server    |
| JavaScript  | Language (no TypeScript)   |
| Plain CSS   | Styling (no Tailwind)      |
| Lucide React| Icons                      |
| Recharts    | Charts & data visualization|

---

## Features (Stage 1)

- ✅ Warm cream/beige/yellow premium dashboard design
- ✅ Responsive layout (desktop, tablet, mobile)
- ✅ Interactive navigation between views
- ✅ Refreshable sample metrics with animation
- ✅ Custom video player with fallback
- ✅ Traffic area chart
- ✅ Server instance health cards
- ✅ Load balancing traffic distribution visual
- ✅ Auto-scaling config display with CPU gauge
- ✅ Scaling events timeline
- ✅ Accessibility labels and ARIA attributes

---

## Limitations (Stage 1)

- All metrics are **sample data** — no backend connection
- Navigation pages beyond Dashboard show placeholder content
- Auto-scaling controls are **display-only** — no actual scaling
- No authentication or user accounts
- No persistent state (refreshing the page resets metrics)

---

## What's Next (Stage 2)

- Flask/Python backend with real metrics
- NGINX load balancer integration
- Actual auto-scaling logic
- Live WebSocket metric updates
- Activity log persistence
- User authentication

---

*Built for a college Cloud Computing course project.*
