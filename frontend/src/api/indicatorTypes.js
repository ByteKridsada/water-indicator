import { apiClient } from './client.js';

export async function listIndicatorTypes() {
  const { data } = await apiClient.get('/indicator-types');
  return data.data;
}

export async function createIndicatorType(payload) {
  const { data } = await apiClient.post('/indicator-types', payload);
  return data.data;
}

export async function deleteIndicatorType(id) {
  await apiClient.delete(`/indicator-types/${id}`);
}
