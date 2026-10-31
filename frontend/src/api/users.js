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
