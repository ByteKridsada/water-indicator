# Frontend — ระบบรายงานคุณภาพน้ำและแผนที่

React + Vite SPA for the water-quality reporting system. Talks to the backend REST API
documented in [../docs/api-spec.md](../docs/api-spec.md).

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL if the backend isn't on localhost:4000
npm run dev
```

Requires the backend running separately — either against a real PostgreSQL instance
(`npm run dev` in `../backend`) or, with no Docker/Postgres available, the PGlite-backed
dev server (`npm run dev:pglite` in `../backend`).

## Structure

- `src/api/` — one file per backend resource, thin wrappers around a shared `axios` client
- `src/context/AuthContext.jsx` — JWT session state (token in `localStorage`, user profile in memory)
- `src/components/` — route guards, shell/nav, the Leaflet location picker, the popup sparkline chart
- `src/pages/` — one page per route: login, register, dashboard (location list), location
  create/edit form, map view, admin users/teams

## Pages implemented

| Route | Page | Notes |
|---|---|---|
| `/login`, `/register` | Auth | |
| `/` | Dashboard | location list, search/team filter, create/delete |
| `/locations/new`, `/locations/:id/edit` | Location form | place search (Nominatim/OpenStreetMap), map-click pin and typed coordinates, avatar image upload |
| `/map` | Map | Leaflet markers, popup with small-multiples sparkline charts per indicator, table-view toggle |
| `/admin/users` | Admin | team creation, team assignment, role/active toggles — admin only |
