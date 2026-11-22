import test from 'node:test';
import assert from 'node:assert/strict';

// env vars must be set before importing any module that reads config — hence the dynamic imports throughout
process.env.JWT_SECRET = 'integration-test-secret';
process.env.ADMIN_EMAIL = 'admin@example.org';
process.env.ADMIN_PASSWORD = 'admin-password-123';
process.env.UPLOAD_DIR = './tmp-test-uploads';
process.env.BCRYPT_ROUNDS = '4';

const { PGlite } = await import('@electric-sql/pglite');
const { setClient } = await import('../src/db.js');

const pglite = new PGlite();
setClient(pglite);

const { runMigrations } = await import('../src/migrate.js');
await runMigrations();

const { createApp } = await import('../src/app.js');
const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(async () => {
  server.close();
  await pglite.close();
  const fs = await import('node:fs/promises');
  await fs.rm('./tmp-test-uploads', { recursive: true, force: true });
});

async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

const NAMES = { first_name: 'สุชาดา', last_name: 'อินทร' };

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1)
]);

async function upload(path, token, buffer, type, filename) {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type }), filename);
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form
  });
  return { status: res.status, data: await res.json() };
}

const register = async (email) => {
  const res = await call('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password: 'password-1234', ...NAMES }
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return { token: res.data.data.token, id: res.data.data.user.id };
};

// ---------- shared fixtures used by every test below ----------
let adminToken;
let teamPing;
let teamWang;
let memberA;
let memberB;
let memberC;

test('setup: admin login, teams, members', async () => {
  const login = await call('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.org', password: 'admin-password-123' }
  });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  assert.equal(login.data.data.user.role, 'admin');
  adminToken = login.data.data.token;

  const ping = await call('/api/v1/teams', {
    token: adminToken,
    method: 'POST',
    body: { team_name: 'ทีมลุ่มน้ำปิง' }
  });
  assert.equal(ping.status, 201, JSON.stringify(ping.data));
  teamPing = ping.data.data.id;

  const wang = await call('/api/v1/teams', {
    token: adminToken,
    method: 'POST',
    body: { team_name: 'ทีมลุ่มน้ำวัง' }
  });
  teamWang = wang.data.data.id;

  memberA = await register('a@example.org');
  memberB = await register('b@example.org');
  memberC = await register('c@example.org');
});

test('register ตั้ง role=member และ team=null เสมอ แม้ client ส่ง role มา', async () => {
  const res = await fetch(base + '/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'sneaky@example.org',
      password: 'password-1234',
      ...NAMES,
      role: 'admin'
    })
  });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.data.user.role, 'member');
  assert.equal(body.data.user.team, null);
});

test('email ซ้ำ -> 409', async () => {
  const res = await call('/api/v1/auth/register', {
    method: 'POST',
    body: { email: 'a@example.org', password: 'password-1234', ...NAMES }
  });
  assert.equal(res.status, 409);
});

test('register ต้องมีชื่อและนามสกุล -> 400 ถ้าไม่มี', async () => {
  const missing = await call('/api/v1/auth/register', {
    method: 'POST',
    body: { email: 'noname@example.org', password: 'password-1234' }
  });
  assert.equal(missing.status, 400);

  const blank = await call('/api/v1/auth/register', {
    method: 'POST',
    body: { email: 'blank@example.org', password: 'password-1234', first_name: '  ', last_name: 'x' }
  });
  assert.equal(blank.status, 400);

  const me = await call('/api/v1/auth/me', { token: memberA.token });
  assert.equal(me.data.data.first_name, 'สุชาดา');
  assert.equal(me.data.data.last_name, 'อินทร');
  assert.equal(me.data.data.avatar_url, null);
});

test('รหัสผ่านผิด -> 401 และข้อความไม่บอกว่า email มีอยู่จริง', async () => {
  const wrongPassword = await call('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'a@example.org', password: 'wrong-password' }
  });
  const noSuchUser = await call('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'nobody@example.org', password: 'wrong-password' }
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(noSuchUser.status, 401);
  assert.equal(wrongPassword.data.error.message, noSuchUser.data.error.message);
});

test('สมาชิกที่ยังไม่มีทีม สร้าง location ไม่ได้ -> 403', async () => {
  const res = await call('/api/v1/locations', {
    token: memberA.token,
    method: 'POST',
    body: {
      location_name: 'ท่าน้ำบ้านดง',
      latitude: 18.7904,
      longitude: 98.9847
    }
  });
  assert.equal(res.status, 403);
});

test('admin กำหนดทีมให้สมาชิก และ ?unassigned=true กรองได้', async () => {
  const before = await call('/api/v1/users?unassigned=true', { token: adminToken });
  assert.ok(before.data.meta.total >= 4);

  for (const [member, team] of [
    [memberA, teamPing],
    [memberB, teamPing],
    [memberC, teamWang]
  ]) {
    const res = await call(`/api/v1/users/${member.id}`, {
      token: adminToken,
      method: 'PATCH',
      body: { team_id: team }
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.data.team.id, team);
  }

  const after = await call('/api/v1/users?unassigned=true', { token: adminToken });
  assert.equal(after.data.meta.total, before.data.meta.total - 3);
});

test('admin แก้ชื่อและนามสกุลของผู้ใช้ได้', async () => {
  const res = await call(`/api/v1/users/${memberC.id}`, {
    token: adminToken,
    method: 'PATCH',
    body: { first_name: '  สมชาย ', last_name: 'ใจดี' }
  });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.data.first_name, 'สมชาย');
  assert.equal(res.data.data.last_name, 'ใจดี');
});

test('แก้เฉพาะชื่อ ไม่กระทบทีม บทบาท และสถานะ', async () => {
  const find = async () => {
    const list = await call('/api/v1/users?limit=100', { token: adminToken });
    return list.data.data.find((u) => u.id === memberA.id);
  };
  const before = await find();
  const res = await call(`/api/v1/users/${memberA.id}`, {
    token: adminToken,
    method: 'PATCH',
    body: { first_name: 'ชื่อใหม่' }
  });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const after = await find();
  assert.equal(after.first_name, 'ชื่อใหม่');
  assert.deepEqual(after.team, before.team);
  assert.equal(after.role, before.role);
  assert.equal(after.is_active, before.is_active);
});

test('ชื่อว่างหรือยาวเกิน 100 ตัวอักษร -> 400 ข้อความภาษาไทย', async () => {
  const blank = await call(`/api/v1/users/${memberA.id}`, {
    token: adminToken,
    method: 'PATCH',
    body: { first_name: '   ' }
  });
  assert.equal(blank.status, 400);
  assert.match(blank.data.error.message, /[ก-๙]/);

  const long = await call(`/api/v1/users/${memberA.id}`, {
    token: adminToken,
    method: 'PATCH',
    body: { last_name: 'ก'.repeat(101) }
  });
  assert.equal(long.status, 400);
});

test('member แก้ชื่อผู้ใช้ผ่าน PATCH /users/:id ไม่ได้ -> 403', async () => {
  const res = await call(`/api/v1/users/${memberA.id}`, {
    token: memberA.token,
    method: 'PATCH',
    body: { first_name: 'แฮก' }
  });
  assert.equal(res.status, 403);
});

let locationId;

test('สมาชิกที่มีทีมแล้ว สร้าง location ได้ และ meta_data_1 ถูกเก็บ', async () => {
  const res = await call('/api/v1/locations', {
    token: memberA.token,
    method: 'POST',
    body: {
      location_name: 'ท่าน้ำบ้านดง',
      latitude: 18.7904,
      longitude: 98.9847,
      meta_data_1: 'แม่น้ำ',
      line_user_id: 'U4af4980629'
    }
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.equal(res.data.data.team.id, teamPing);
  assert.equal(res.data.data.meta_data_1, 'แม่น้ำ');
  assert.equal(res.data.data.latitude, 18.7904);
  assert.equal('member_name' in res.data.data, false);
  locationId = res.data.data.id;
});

test('สมาชิกส่ง team_id ของทีมอื่น -> 403', async () => {
  const res = await call('/api/v1/locations', {
    token: memberA.token,
    method: 'POST',
    body: {
      team_id: teamWang,
      location_name: 'y',
      latitude: 18,
      longitude: 98
    }
  });
  assert.equal(res.status, 403);
});

test('พิกัดนอกช่วง -> 400 ก่อนถึง DB', async () => {
  const res = await call('/api/v1/locations', {
    token: memberA.token,
    method: 'POST',
    body: { location_name: 'y', latitude: 999, longitude: 98 }
  });
  assert.equal(res.status, 400);
  assert.equal(res.data.error.code, 'VALIDATION_FAILED');
});

// this is the test that proves out moving edit rights to the team instead of a single owner
test('สมาชิกคนอื่นในทีมเดียวกัน แก้ไข location ได้', async () => {
  const res = await call(`/api/v1/locations/${locationId}`, {
    token: memberB.token,
    method: 'PATCH',
    body: { location_name: 'ท่าน้ำบ้านดง (แก้โดยเพื่อนร่วมทีม)' }
  });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.data.location_name, 'ท่าน้ำบ้านดง (แก้โดยเพื่อนร่วมทีม)');
});

test('สมาชิกต่างทีม แก้ไขไม่ได้ -> 403', async () => {
  const res = await call(`/api/v1/locations/${locationId}`, {
    token: memberC.token,
    method: 'PATCH',
    body: { location_name: 'ไม่ควรแก้ได้' }
  });
  assert.equal(res.status, 403);
});

test('สมาชิกย้าย location ไปทีมอื่นไม่ได้ แต่ admin ได้', async () => {
  const asMember = await call(`/api/v1/locations/${locationId}`, {
    token: memberA.token,
    method: 'PATCH',
    body: { team_id: teamWang }
  });
  assert.equal(asMember.status, 403);

  const asAdmin = await call(`/api/v1/locations/${locationId}`, {
    token: adminToken,
    method: 'PATCH',
    body: { team_id: teamPing }
  });
  assert.equal(asAdmin.status, 200);
});

test('list ส่ง line_linked ไม่ส่ง line_user_id ดิบ', async () => {
  const res = await call('/api/v1/locations', { token: memberC.token });
  assert.equal(res.status, 200);
  const item = res.data.data.find((l) => l.id === locationId);
  assert.equal(item.line_linked, true);
  assert.equal('line_user_id' in item, false);
});

test('detail ส่ง line_user_id ให้คนที่แก้ไขได้ แต่ไม่ส่งให้คนอื่น', async () => {
  const editor = await call(`/api/v1/locations/${locationId}`, { token: memberA.token });
  assert.equal(editor.data.data.can_edit, true);
  assert.equal(editor.data.data.line_user_id, 'U4af4980629');

  const outsider = await call(`/api/v1/locations/${locationId}`, { token: memberC.token });
  assert.equal(outsider.data.data.can_edit, false);
  assert.equal('line_user_id' in outsider.data.data, false);
});

test('ค้นหาและ bbox กรองได้ และ bbox ผิดรูป -> 400', async () => {
  const found = await call('/api/v1/locations?q=บ้านดง', { token: adminToken });
  assert.equal(found.data.meta.total, 1);

  const inBox = await call('/api/v1/locations?bbox=98.9,18.7,99.0,18.8', { token: adminToken });
  assert.equal(inBox.data.meta.total, 1);

  const outOfBox = await call('/api/v1/locations?bbox=100.0,10.0,101.0,11.0', { token: adminToken });
  assert.equal(outOfBox.data.meta.total, 0);

  const malformed = await call('/api/v1/locations?bbox=1,2,3', { token: adminToken });
  assert.equal(malformed.status, 400);
});

test('seed สร้าง indicator_types 4 ตัว', async () => {
  const res = await call('/api/v1/indicator-types', { token: memberA.token });
  assert.equal(res.status, 200);
  assert.equal(res.data.data.length, 4);
  assert.ok(res.data.data.some((t) => t.code === 'ph'));
});

test('บันทึกค่าด้วยมือได้ และ source ถูกบังคับเป็น manual แม้ client ส่ง ai มา', async () => {
  const types = await call('/api/v1/indicator-types', { token: memberA.token });
  const ph = types.data.data.find((t) => t.code === 'ph');

  const res = await call(`/api/v1/locations/${locationId}/readings`, {
    token: memberA.token,
    method: 'POST',
    body: { indicator_type_id: ph.id, value: 7.4, source: 'ai' }
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.equal(res.data.data.source, 'manual');
  assert.equal(res.data.data.value, 7.4);
});

test('readings ตอบแบบ group ตาม indicator type', async () => {
  const res = await call(`/api/v1/locations/${locationId}/readings`, { token: memberC.token });
  assert.equal(res.status, 200);
  assert.equal(res.data.data.length, 1);
  assert.equal(res.data.data[0].indicator_type.code, 'ph');
  assert.equal(res.data.data[0].series.length, 1);
});

test('include=latest_readings แนบค่าล่าสุดมากับ list', async () => {
  const res = await call('/api/v1/locations?include=latest_readings', { token: adminToken });
  assert.equal(res.status, 200);
  const item = res.data.data.find((l) => l.id === locationId);
  assert.equal(item.latest_readings.length, 1);
  assert.equal(item.latest_readings[0].value, 7.4);
});

test('สมาชิกต่างทีมบันทึกค่าไม่ได้ -> 403', async () => {
  const types = await call('/api/v1/indicator-types', { token: memberC.token });
  const ph = types.data.data.find((t) => t.code === 'ph');
  const res = await call(`/api/v1/locations/${locationId}/readings`, {
    token: memberC.token,
    method: 'POST',
    body: { indicator_type_id: ph.id, value: 1 }
  });
  assert.equal(res.status, 403);
});

test('ลบ indicator_type ที่มีค่าอ้างอยู่ -> 409', async () => {
  const types = await call('/api/v1/indicator-types', { token: adminToken });
  const ph = types.data.data.find((t) => t.code === 'ph');
  const res = await call(`/api/v1/indicator-types/${ph.id}`, {
    token: adminToken,
    method: 'DELETE'
  });
  assert.equal(res.status, 409);
});

test('อัปโหลดรูป: PNG ผ่าน, ไฟล์ข้อความถูกปฏิเสธจาก magic bytes', async () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64, 1)
  ]);

  const okForm = new FormData();
  okForm.append('image', new Blob([png], { type: 'image/png' }), 'marker.png');
  const ok = await fetch(`${base}/api/v1/locations/${locationId}/image`, {
    method: 'POST',
    headers: { authorization: `Bearer ${memberA.token}` },
    body: okForm
  });
  const okBody = await ok.json();
  assert.equal(ok.status, 200, JSON.stringify(okBody));
  assert.equal(okBody.data.content_type, 'image/png');

  // a text file masquerading as jpeg via Content-Type must be rejected
  const badForm = new FormData();
  badForm.append(
    'image',
    new Blob([Buffer.from('<?php echo "not an image"; ?>')], { type: 'image/jpeg' }),
    'payload.jpg'
  );
  const bad = await fetch(`${base}/api/v1/locations/${locationId}/image`, {
    method: 'POST',
    headers: { authorization: `Bearer ${memberA.token}` },
    body: badForm
  });
  assert.equal(bad.status, 400);

  const served = await fetch(`${base}/api/v1/locations/${locationId}/image`, {
    headers: { authorization: `Bearer ${memberC.token}` }
  });
  assert.equal(served.status, 200);
  assert.equal(Buffer.from(await served.arrayBuffer()).length, png.length);
});

test('แก้ชื่อในโปรไฟล์ได้ แต่ส่ง team_id หรือ role มาเองไม่ได้', async () => {
  const ok = await call('/api/v1/auth/me', {
    token: memberC.token,
    method: 'PATCH',
    body: { first_name: 'มานพ', last_name: 'ใจดี' }
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.data.first_name, 'มานพ');
  assert.equal(ok.data.data.team.id, teamWang);

  for (const body of [{ team_id: teamPing }, { role: 'admin' }, { first_name: '' }]) {
    const bad = await call('/api/v1/auth/me', { token: memberC.token, method: 'PATCH', body });
    assert.equal(bad.status, 400, JSON.stringify(body));
  }

  const me = await call('/api/v1/auth/me', { token: memberC.token });
  assert.equal(me.data.data.team.id, teamWang);
  assert.equal(me.data.data.role, 'member');
});

test('รูปโปรไฟล์: อัปโหลด/ดู/ลบได้, ตรวจ magic bytes, admin ดูของคนอื่นได้', async () => {
  const bad = await upload('/api/v1/auth/me/avatar', memberC.token, Buffer.from('not an image'), 'image/png', 'x.png');
  assert.equal(bad.status, 400);

  const ok = await upload('/api/v1/auth/me/avatar', memberC.token, PNG, 'image/png', 'me.png');
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.match(ok.data.data.avatar_url, /^\/api\/v1\/auth\/me\/avatar\?v=\d+$/);

  const mine = await fetch(base + ok.data.data.avatar_url, {
    headers: { authorization: `Bearer ${memberC.token}` }
  });
  assert.equal(mine.status, 200);
  assert.equal(Buffer.from(await mine.arrayBuffer()).length, PNG.length);

  // another member's token gets that member's own (missing) avatar, never memberC's
  const other = await call('/api/v1/auth/me/avatar', { token: memberA.token });
  assert.equal(other.status, 404);

  const list = await call('/api/v1/users?q=มานพ', { token: adminToken });
  assert.equal(list.data.meta.total, 1);
  const adminUrl = list.data.data[0].avatar_url;
  assert.match(adminUrl, new RegExp(`^/api/v1/users/${memberC.id}/avatar\\?v=\\d+$`));
  const asAdmin = await fetch(base + adminUrl, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(asAdmin.status, 200);

  const asMember = await call(`/api/v1/users/${memberC.id}/avatar`, { token: memberA.token });
  assert.equal(asMember.status, 403);

  const removed = await call('/api/v1/auth/me/avatar', { token: memberC.token, method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.data.avatar_url, null);
  const gone = await call('/api/v1/auth/me/avatar', { token: memberC.token });
  assert.equal(gone.status, 404);
});

test('สมาชิกลบ location ไม่ได้ แต่ admin ลบได้', async () => {
  const asMember = await call(`/api/v1/locations/${locationId}`, {
    token: memberA.token,
    method: 'DELETE'
  });
  assert.equal(asMember.status, 403);

  const asAdmin = await call(`/api/v1/locations/${locationId}`, {
    token: adminToken,
    method: 'DELETE'
  });
  assert.equal(asAdmin.status, 204);

  const gone = await call(`/api/v1/locations/${locationId}`, { token: adminToken });
  assert.equal(gone.status, 404);
});

test('ไม่มี token -> 401', async () => {
  const res = await call('/api/v1/locations');
  assert.equal(res.status, 401);
});

test('member เรียก endpoint ของ admin -> 403', async () => {
  const res = await call('/api/v1/users', { token: memberA.token });
  assert.equal(res.status, 403);
});

test('บัญชีที่ถูกระงับใช้งานไม่ได้ -> 403', async () => {
  await call(`/api/v1/users/${memberB.id}`, {
    token: adminToken,
    method: 'PATCH',
    body: { is_active: false }
  });
  const res = await call('/api/v1/auth/me', { token: memberB.token });
  assert.equal(res.status, 403);
});
