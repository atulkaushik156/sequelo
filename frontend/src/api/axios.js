import axios from 'axios';

const api = axios.create({
  baseURL: '/', 
  withCredentials: true, // Sends the secure session_id cookie
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if it's a 401 error AND ensure the request wasn't the login route itself
    if (error.response?.status === 401 && !error.config.url.includes('/api/auth/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;