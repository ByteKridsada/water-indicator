import { apiClient } from './client.js';

export async function listUsers({ teamId, unassigned, q, page = 1, limit = 50 } = {}) {
  const params = { page, limit };
  if (teamId) params.team_id = teamId;
  if (unassigned !== undefined) params.unassigned = String(unassigned);
  if (q) params.q = q;
  const { data } = await apiClient.get('/users', { params });
  return data;
}

export async function updateUser(id, payload) {
  const { data } = await apiClient.patch(`/users/${id}`, payload);
  return data.data;
}

// Fetch every page of users (the API caps limit at 100) and return one flat array.
export async function listAllUsers({ unassigned, q } = {}) {
  const limit = 100;
  const all = [];
  for (let page = 1; ; page += 1) {
    const body = await listUsers({ unassigned, q, page, limit });
    const rows = body.data ?? [];
    all.push(...rows);
    if (rows.length === 0 || all.length >= (body.meta?.total ?? 0)) break;
  }
  return all;
}

// Admin-only: issue a temporary password for someone who forgot theirs.
// The server returns the plaintext once; keep it in component state only and never store it.
export async function resetUserPassword(id) {
  const { data } = await apiClient.post(`/users/${id}/reset-password`);
  return data.data.temporary_password;
}
