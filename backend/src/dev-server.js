// Local dev server backed by PGlite — for running the API without Docker/Postgres installed.
// Not used in production; production always uses index.js against a real PostgreSQL instance.
import { PGlite } from '@electric-sql/pglite';
import { config } from './config.js';
import { setClient } from './db.js';
import { runMigrations } from './migrate.js';
import { createApp } from './app.js';

const pglite = new PGlite();
setClient(pglite);
await runMigrations();

createApp().listen(config.port, () => {
  console.log(`Dev API (PGlite) ready at http://localhost:${config.port}`);
});
