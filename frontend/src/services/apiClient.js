import axios from 'axios';
import { API_BASE_URL } from '../constants/appConstants';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach token if exists
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ppl_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch auth errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // PDF requests return blobs, including JSON errors. Decode them so a
    // page-space validation message reaches download/print and preview UIs.
    const data = error.response?.data;
    if (typeof Blob !== 'undefined' && data instanceof Blob && /application\/json/i.test(error.response.headers?.['content-type'] || data.type)) {
      try {
        const details = JSON.parse(await data.text());
        error.response.data = details;
        if (details.message) error.message = details.message;
      } catch { /* Preserve the original error if the payload isn't JSON. */ }
    }
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('ppl_token');
      localStorage.removeItem('ppl_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
