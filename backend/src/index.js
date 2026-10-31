import pg from 'pg';
import { config } from './config.js';
import { setClient, query } from './db.js';
import { createApp } from './app.js';

if (!config.databaseUrl) {
  console.error('DATABASE_URL must be set before starting the server');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: config.databaseUrl });
setClient(pool);

try {
  await query('SELECT 1');
} catch (err) {
  console.error('Failed to connect to the database:', err.message);
  process.exit(1);
}

createApp().listen(config.port, () => {
  console.log(`API ready at http://localhost:${config.port}`);
});
