import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tc_token');
      localStorage.removeItem('tc_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
