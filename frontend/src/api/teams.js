import { apiClient } from './client.js';

export async function listTeams() {
  const { data } = await apiClient.get('/teams');
  return data.data;
}

export async function createTeam(teamName) {
  const { data } = await apiClient.post('/teams', { team_name: teamName });
  return data.data;
}

export async function renameTeam(id, teamName) {
  const { data } = await apiClient.patch(`/teams/${id}`, { team_name: teamName });
  return data.data;
}

export async function deleteTeam(id) {
  await apiClient.delete(`/teams/${id}`);
}
