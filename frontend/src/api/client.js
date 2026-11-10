import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
// Axios is a JS HTTP client library — the rough equivalent of URLSession, but closer in spirit to Alamofire
export const apiClient = axios.create({ baseURL });

apiClient.interceptors.request.use((requestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

// server error shape is always { error: { code, message } } — normalize it here
// so callers can read err.message without checking response shape every time.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 on a request that carried a token means the session expired or the account
    // was disabled; a 401 without one is just a failed login and must not log anyone out.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:expired'));
    }
    const serverMessage = error.response?.data?.error?.message;
    if (serverMessage) {
      error.message = serverMessage;
      error.code = error.response.data.error.code;
    }
    return Promise.reject(error);
  }
);
