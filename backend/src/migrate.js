import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { setClient, exec, one } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

async function applySchema() {
  const present = await one(`SELECT to_regclass('public.locations') AS reg`);
  if (present && present.reg) {
    console.log('schema: tables already exist — skipping');
    return;
  }
  const sql = await fs.readFile(path.join(repoRoot, 'db/schema.sql'), 'utf8');
  await exec(sql);
  console.log('schema: applied db/schema.sql');
}

async function applySeed() {
  const sql = await fs.readFile(path.join(repoRoot, 'db/seed.sql'), 'utf8');
  await exec(sql);
  console.log('seed: applied db/seed.sql');
}

// create the admin account from env — never hardcode a password in the repo
async function applyAdmin() {
  const { email, password } = config.seedAdmin;
  if (!email || !password) {
    console.log('admin: ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping');
    return;
  }
  const existing = await one(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
  if (existing) {
    console.log(`admin: ${email} already exists — skipping`);
    return;
  }
  const hash = await bcrypt.hash(password, config.bcryptRounds);
  await one(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin') RETURNING id`,
    [email.toLowerCase(), hash]
  );
  console.log(`admin: created account ${email}`);
}

export async function runMigrations() {
  await applySchema();
  await applySeed();
  await applyAdmin();
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here, 'migrate.js');

if (invokedDirectly) {
  const pg = (await import('pg')).default;
  if (!config.databaseUrl) {
    console.error('DATABASE_URL must be set before running migrate');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  setClient(pool);
  try {
    await runMigrations();
  } finally {
    await pool.end();
  }
}
