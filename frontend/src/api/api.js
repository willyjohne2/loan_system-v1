import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 15000, // 15 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const savedUser = localStorage.getItem('loan_user');
  
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      const { access } = parsed;
      if (access) {
        config.headers.Authorization = `Bearer ${access}`;
      }
    } catch (e) {
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request! Clearing local storage and redirecting to login...');
      localStorage.removeItem('loan_user');
      // Only redirect if we're not already on a login page to avoid loops
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const loanService = {
  login: async (credentials) => {
    const res = await api.post('/auth/login/', credentials);
    return res.data;
  },
  verify2FA: async (data) => {
    const res = await api.post('/auth/2fa/verify/', data);
    return res.data;
  },
  enable2FA: async () => {
    const res = await api.post('/auth/2fa/enable/');
    return res.data;
  },
  verifyEnable2FA: async (data) => {
    const res = await api.post('/auth/2fa/verify-enable/', data);
    return res.data;
  },
  disable2FA: async (data) => {
    const res = await api.post('/auth/2fa/disable/', data);
    return res.data;
  },
  getManagers: async (params) => {
    const res = await api.get('/admins/', { params: { ...params, role: 'MANAGER' } });
    return res.data;
  },
  updateAdmin: async (id, data) => {
    const res = await api.patch(`/admins/${id}/`, data);
    return res.data;
  },
  getOfficers: async (params) => {
    const res = await api.get('/admins/', { params: { ...params, role: 'FIELD_OFFICER' } });
    return res.data;
  },
  getFieldOfficers: async (params) => {
    const res = await api.get('/admins/', { params: { ...params, role: 'FIELD_OFFICER' } });
    return res.data;
  },
  getFinanceOfficers: async (params) => {
    const res = await api.get('/admins/', { params: { ...params, role: 'FINANCIAL_OFFICER' } });
    return res.data;
  },
  getLoans: async (params) => {
    const res = await api.get('/loans/', { params });
    return res.data;
  },
  getLoanProducts: async (params) => {
    const res = await api.get('/loan-products/', { params });
    return res.data;
  },
  updateLoanProduct: async (id, data) => {
    const res = await api.patch(`/loan-products/${id}/`, data);
    return res.data;
  },
  updateLoan: async (id, data) => {
    const res = await api.patch(`/loans/${id}/`, data);
    return res.data;
  },
  getCustomers: async (params) => {
    const res = await api.get('/users/', { params });
    return res.data;
  },
  getAuditLogs: async (params) => {
    const res = await api.get('/audit-logs/', { params });
    return res.data;
  },
  updateCustomer: async (id, data) => {
    const res = await api.patch(`/users/${id}/`, data);
    return res.data;
  },
  deleteCustomer: async (id) => {
    const res = await api.delete(`/users/${id}/`);
    return res.data;
  },
  getRepayments: async () => {
    const res = await api.get('/repayments/');
    return res.data;
  },
  createRepayment: async (data) => {
    const res = await api.post('/repayments/', data);
    return res.data;
  },
  initiateMpesaRepayment: async (data) => {
    const res = await api.post('/payments/mpesa/', data);
    return res.data;
  },
  getAuditLogs: async (params = {}) => {
    const res = await api.get('/audit-logs/', { params });
    return res.data;
  },
  getFinancialAnalytics: async () => {
    const res = await api.get('/finance/analytics/');
    return res.data;
  },
  sendDirectSMS: async (data) => {
    const res = await api.post('/loans/direct-sms/', data);
    return res.data;
  },
  getDeactivationRequests: async () => {
    const res = await api.get('/deactivation-requests/');
    return res.data;
  },
  createDeactivationRequest: async (data) => {
    const res = await api.post('/deactivation-requests/', data);
    return res.data;
  },
  updateDeactivationRequest: async (id, data) => {
    const res = await api.patch(`/deactivation-requests/${id}/`, data);
    return res.data;
  },
  getLoanProducts: async () => {
    const res = await api.get('/loan-products/');
    return res.data;
  },
  getAdminProfile: async (id) => {
    const res = await api.get(`/admins/${id}/`);
    return res.data;
  },
  getAllAdmins: async () => {
    const res = await api.get('/admins/');
    return res.data;
  },
  getSettings: async () => {
    const res = await api.get('/settings/');
    return res.data;
  },
  inviteAdmin: async (data) => {
    const res = await api.post('/admins/invite/', data);
    return res.data;
  },
  updateSettings: async (settings) => {
    const res = await api.post('/settings/', settings);
    return res.data;
  },
  register: async (full_name, email, phone, role, password, invitation_token = null, branch = null) => {
    const res = await api.post('/auth/register/', { 
      full_name, 
      email, 
      phone, 
      role, 
      password,
      invitation_token,
      branch
    });
    return res.data;
  },
  verifyEmail: async (email, code) => {
    const res = await api.post('/auth/verify-email/', { email, code });
    return res.data;
  },
  deleteAdmin: async (admin_id) => {
    const res = await api.delete(`/admins/${admin_id}/delete/`);
    return res.data;
  },
  sendBulkSMS: async (type = 'DEFAULTERS', message = '') => {
    const res = await api.post('/loans/bulk-sms-defaulters/', { type, message });
    return res.data;
  },
  getSMSLogs: async () => {
    const res = await api.get('/sms-logs/');
    return res.data;
  },
  getAnalytics: async (branch = '') => {
    const res = await api.get(`/loans/analytics/?branch=${branch}`);
    return res.data;
  },
  api // Export raw axios instance for custom calls
};

export default api;
