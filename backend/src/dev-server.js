// Local dev server backed by PGlite — for running the API without Docker/Postgres installed.
// Not used in production; production always uses index.js against a real PostgreSQL instance.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { config } from './config.js';
import { setClient } from './db.js';
import { runMigrations } from './migrate.js';
import { createApp } from './app.js';

const SOCKET_PORT = Number(process.env.PGLITE_PORT || 5433);

const pglite = new PGlite();
setClient(pglite);
await runMigrations();

// Lets pgAdmin or psql inspect the in-memory database. Bound to localhost only;
// PGlite is single-connection, so the socket server multiplexes clients onto it.
const socketServer = new PGLiteSocketServer({
  db: pglite,
  host: '127.0.0.1',
  port: SOCKET_PORT,
  maxConnections: 10,
});
await socketServer.start();

createApp().listen(config.port, () => {
  console.log(`Dev API (PGlite) ready at http://localhost:${config.port}`);
  console.log(`PGlite database open to local tools at postgres://postgres@127.0.0.1:${SOCKET_PORT}/postgres`);
});
