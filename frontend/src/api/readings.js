import { apiClient } from './client.js';

export async function fetchReadings(locationId, { indicatorTypeId, from, to } = {}) {
  const params = {};
  if (indicatorTypeId) params.indicator_type_id = indicatorTypeId;
  if (from) params.from = from;
  if (to) params.to = to;
  const { data } = await apiClient.get(`/locations/${locationId}/readings`, { params });
  return data.data;
}

export async function createReading(locationId, payload) {
  const { data } = await apiClient.post(`/locations/${locationId}/readings`, payload);
  return data.data;
}

export async function deleteReading(id) {
  await apiClient.delete(`/readings/${id}`);
}
