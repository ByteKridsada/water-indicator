import { apiClient } from './client.js';

// payload: { email, password, first_name, last_name }
export async function register(payload) {
  const { data } = await apiClient.post('/auth/register', payload);
  return data.data;
}

export async function login(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data.data;
}

// Public: emails of up to 3 active admins, for the "forgot password" page. Resolves to string[].
export async function fetchAdminContacts() {
  const { data } = await apiClient.get('/auth/admin-contacts');
  return data.data.emails;
}

export async function fetchMe() {
  const { data } = await apiClient.get('/auth/me');
  return data.data;
}

export async function updateMe(payload) {
  const { data } = await apiClient.patch('/auth/me', payload);
  return data.data;
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await apiClient.post('/auth/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function deleteAvatar() {
  const { data } = await apiClient.delete('/auth/me/avatar');
  return data.data;
}

// The server returns avatar URLs as full paths ("/api/v1/..."); apiClient already
// prefixes its baseURL, so strip that part before requesting. Like location images,
// avatars need the bearer token, so they come back as a blob and an object URL.
export async function fetchImageObjectUrl(avatarUrl) {
  const path = avatarUrl.replace(/^\/api\/v1/, '');
  const response = await apiClient.get(path, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
}

export async function changePassword(currentPassword, newPassword) {
  await apiClient.post('/auth/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
