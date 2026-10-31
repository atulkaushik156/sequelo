import axios from 'axios';

const api = axios.create({
  // Falls back to '' in production, pointing to the same Render domain
  baseURL: import.meta.env.VITE_BACKEND_URL || '', 
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;