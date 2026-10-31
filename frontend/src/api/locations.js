import { apiClient } from './client.js';

export async function listLocations({ teamId, metaData1, q, bbox, include, page = 1, limit = 100 } = {}) {
  const params = { page, limit };
  if (teamId) params.team_id = teamId;
  if (metaData1) params.meta_data_1 = metaData1;
  if (q) params.q = q;
  if (bbox) params.bbox = bbox;
  if (include) params.include = include;
  const { data } = await apiClient.get('/locations', { params });
  return data;
}

export async function fetchLocation(id) {
  const { data } = await apiClient.get(`/locations/${id}`);
  return data.data;
}

export async function createLocation(payload) {
  const { data } = await apiClient.post('/locations', payload);
  return data.data;
}

export async function updateLocation(id, payload) {
  const { data } = await apiClient.patch(`/locations/${id}`, payload);
  return data.data;
}

export async function deleteLocation(id) {
  await apiClient.delete(`/locations/${id}`);
}

export async function uploadLocationImage(id, file) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await apiClient.post(`/locations/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function deleteLocationImage(id) {
  await apiClient.delete(`/locations/${id}/image`);
}

// the image endpoint checks auth on the server, so <img src> alone won't carry the
// bearer token — fetch it as a blob through apiClient and hand back an object URL.
export async function fetchLocationImageUrl(id) {
  const response = await apiClient.get(`/locations/${id}/image`, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
}
