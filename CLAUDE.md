# CLAUDE.md

Water-quality reporting system with an interactive map, built from a Thai TOR (`TOR_Indicators_Map_System_Draft4.docx`).

- `backend/`: Express + PostgreSQL REST API (ES modules, plain JavaScript)
- `frontend/`: React + Vite SPA with Leaflet/OpenStreetMap
- `db/`: `schema.sql` and `seed.sql`
- `docs/`: `architecture.md` and `api-spec.md`

## Commands

Backend (run in `backend/`; needs a `.env` copied from `.env.example` with `JWT_SECRET` set):

```bash
npm test             # integration tests on PGlite; no database needed
npm run dev:pglite   # API on :4000 without Docker/Postgres; data is in memory and lost on restart.
                     # The same database is open to pgAdmin/psql at postgres://postgres@127.0.0.1:5433/postgres
npm run dev          # API against DATABASE_URL
npm run migrate      # apply schema and seed, create the admin from ADMIN_EMAIL/ADMIN_PASSWORD
```

Frontend (run in `frontend/`; there are no frontend tests):

```bash
npm run dev     # :5173
npm run build
npm run lint
```

`docker compose up` from the repo root runs Postgres and the API; it requires `POSTGRES_PASSWORD` and `JWT_SECRET`.

## Rules

- Ask before assuming when a requirement is ambiguous. Don't pick a default silently.
- Don't invent answers to these open requirements (`docs/api-spec.md` §11):
  1. What Meta Data 1 stores (free text for now)
  2. How `line_user_id` gets bound to a location (blocks the LINE webhook)
  3. Water-quality thresholds (no status field or threshold lines until these exist)
  4. Whether the map is public (authentication required for now)
- Write code comments, `console.*` output and thrown `Error` messages in English.
- Keep API error messages returned to clients and all UI text in Thai.
- Keep the owner's explanatory comments in the code, including the ones comparing React to Swift/iOS concepts.

## Backend invariants

- Authorization lives in one rule, `canEditLocation` in `backend/src/lib/authz.js`: admins can edit everything, and members can edit locations in their own team. Edit rights never come from `created_by_user_id`, which is audit-only.
- The server sets `role`, `team_id` at registration, `created_by_user_id` and reading `source`. Never accept them from the client where the route assigns them.
- Only return raw `line_user_id` to users who pass `canEditLocation`; list responses expose the boolean `line_linked`.
- Detect upload types from magic bytes, generate filenames with UUIDs, and serve files through authenticated routes, never a static directory.
- Use parameterized SQL only. Go through `backend/src/db.js`, which supports both `pg` and PGlite.
- Tests run on PGlite, so SQL must work on both engines. PGlite is PostgreSQL 18 while `docker-compose.yml` runs 16; error codes can differ between them (RESTRICT violations are `23001` on 18, `23503` on 16).

## Gotchas

- `migrate.js` skips `schema.sql` once the `locations` table exists, and there are no incremental migrations. A schema change won't reach an existing database without a manual step.
- `docs/api-spec.md` is the design, not the current state. Not implemented yet: the LINE webhook, AI image interpretation, the 24-hour retention job and the `/images` routes (§8–10).
- `<img src>` can't send the bearer token, so load protected images through `fetchLocationImageUrl`.

## Frontend conventions

- Add API calls in `src/api/<resource>.js` as thin wrappers around `apiClient`. Pages don't call axios directly.
- `apiClient` moves the server's error message into `err.message`, so pages display that.
- Hiding UI by role is for usability only; the backend enforces permissions.
- Styling follows design direction C: tokens at the top of `src/index.css`; teal is the brand and data color, indigo is for interaction and selection. Keep status colors (green, amber, red) out of the UI until water-quality thresholds exist.

Known gaps: overlapping map markers aren't clustered, there's no "forgot password" flow, and there are no frontend tests.
