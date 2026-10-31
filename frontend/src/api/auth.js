import { apiClient } from './client.js';

export async function register(email, password) {
  const { data } = await apiClient.post('/auth/register', { email, password });
  return data.data;
}

export async function login(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data.data;
}

export async function fetchMe() {
  const { data } = await apiClient.get('/auth/me');
  return data.data;
}

export async function updateMe(payload) {
  const { data } = await apiClient.patch('/auth/me', payload);
  return data.data;
}

export async function changePassword(currentPassword, newPassword) {
  await apiClient.post('/auth/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
