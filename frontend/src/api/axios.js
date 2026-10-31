import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Changed to relative path
  withCredentials: true, // Crucial: Sends the secure session_id cookie to FastAPI
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if it's a 401 Unauthorized error AND ensure we aren't already on the login page
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;