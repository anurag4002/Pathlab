import apiClient from './apiClient';

export const requestOtp = async (phone) => {
  const response = await apiClient.post('/patient/auth/request-otp', { phone });
  return response.data;
};

export const verifyOtp = async (phone, otp) => {
  const response = await apiClient.post('/patient/auth/verify-otp', { phone, otp });
  if (response.data.success && response.data.data.token) {
    sessionStorage.setItem('ppl_patient_token', response.data.data.token);
    sessionStorage.setItem('ppl_patient_phone', response.data.data.phone);
  }
  return response.data;
};

export const getPatientReports = async () => {
  const token = sessionStorage.getItem('ppl_patient_token');
  const response = await apiClient.get('/patient/reports', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
};

export const downloadPatientReport = async (reportId, filename = 'report.pdf') => {
  const token = sessionStorage.getItem('ppl_patient_token');
  const response = await apiClient.get(`/patient/reports/${reportId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseType: 'blob'
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const patientLogout = () => {
  sessionStorage.removeItem('ppl_patient_token');
  sessionStorage.removeItem('ppl_patient_phone');
};

const patientAuthHeaders = () => {
  const token = sessionStorage.getItem('ppl_patient_token');
  return { Authorization: `Bearer ${token}` };
};

// Self-registration after OTP verification (new numbers).
export const registerPatientProfile = async (profile) => {
  const response = await apiClient.post('/patient/register', profile, {
    headers: patientAuthHeaders()
  });
  return response.data;
};

// Bookable catalog (active tests + packages, no PHI).
export const getBookingCatalog = async () => {
  const response = await apiClient.get('/patient/catalog', {
    headers: patientAuthHeaders()
  });
  return response.data;
};

// Booking inquiries (pay at lab — no online payment exists here).
export const createBookingInquiry = async (payload) => {
  const response = await apiClient.post('/patient/inquiries', payload, {
    headers: patientAuthHeaders()
  });
  return response.data;
};

export const getMyBookingInquiries = async () => {
  const response = await apiClient.get('/patient/inquiries', {
    headers: patientAuthHeaders()
  });
  return response.data;
};
