import axios from 'axios';
import { API_BASE_URL } from '../constants/appConstants';
import { invalidateReportPdfs } from '../utils/reportPdfCache';

// "Too many requests" (HTTP 429): the server is limiting how often this
// device can call it. A popup (RateLimitDialog, mounted in App) explains it
// with a countdown instead of leaving pages empty.
export const RATE_LIMIT_EVENT = 'ppl:rate-limit';
const waitSeconds = (headers = {}) => Number(headers['retry-after'] || headers['ratelimit-reset']);
const waitText = (headers = {}) => {
  const seconds = waitSeconds(headers);
  if (!Number.isFinite(seconds) || seconds <= 0) return 'a few minutes';
  if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? 'about a minute' : `about ${minutes} minutes`;
};
export const rateLimitMessage = (error) => {
  const serverText = String(error?.response?.data?.message || '');
  // Login / OTP limits already say what was limited; the general one does not.
  const what = /otp|login|verification|attempt/i.test(serverText) ? serverText.replace(/,? ?please try again.*$/i, '.') : 'Too many requests from this device right now.';
  return `${what} Please wait ${waitText(error?.response?.headers)} and try again.`;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Reference data every screen asks for (branches, doctors, agents, lab
// profile, signatures, message templates) is fetched once and reused for a
// minute; requests made at the same moment share one network call. Any
// save / edit / delete clears it, so a change shows up immediately.
const SHARED_GET = /^\/(branches|doctors|agents|setup\/lab-profile|setup\/signatures|notify\/templates)(\/?$|\?)/;
const SHARED_TTL_MS = 60 * 1000;
const sharedGets = new Map();
export const clearSharedGets = () => sharedGets.clear();
const rawGet = apiClient.get.bind(apiClient);
apiClient.get = (url, config = {}) => {
  if (!SHARED_GET.test(String(url)) || config.responseType || config.signal) return rawGet(url, config);
  const key = `${url}|${JSON.stringify(config.params || {})}|${localStorage.getItem('ppl_token') || ''}`;
  const hit = sharedGets.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise.then((response) => ({ ...response, data: structuredClone(response.data) }));
  const promise = rawGet(url, config);
  sharedGets.set(key, { promise, expires: Date.now() + SHARED_TTL_MS });
  promise.catch(() => sharedGets.delete(key));
  return promise.then((response) => ({ ...response, data: structuredClone(response.data) }));
};

// Request Interceptor: Attach token if exists
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ppl_token');
    if (token && !String(config.url || '').startsWith('/patient/') && !config.headers.Authorization) {
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
    if (!['get', 'head', 'options'].includes(response.config.method?.toLowerCase())) { invalidateReportPdfs(); clearSharedGets(); }
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
    if (error.response?.status === 429) {
      const message = rateLimitMessage(error);
      error.message = message;
      error.response.data = { ...(typeof error.response.data === 'object' && error.response.data ? error.response.data : {}), success: false, message };
      const seconds = waitSeconds(error.response.headers);
      const retryAt = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
      window.dispatchEvent(new CustomEvent(RATE_LIMIT_EVENT, { detail: { message, retryAt } }));
      return Promise.reject(error);
    }
    if (error.response && error.response.status === 401) {
      // Patient authentication has its own session and login screen.
      // Incorrect birth years and OTPs should stay on the patient form.
      const requestPath = String(error.config?.url || '');
      if (requestPath.startsWith('/patient/')) {
        if (!requestPath.startsWith('/patient/auth/')) {
          sessionStorage.removeItem('ppl_patient_token');
          sessionStorage.removeItem('ppl_patient_phone');
          const patientPath = ['/patient/report', '/reports'].includes(window.location.pathname)
            ? `${window.location.pathname}${window.location.search}` : '/patient/report';
          window.location.href = patientPath;
        }
        return Promise.reject(error);
      }
      invalidateReportPdfs();
      clearSharedGets();
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
