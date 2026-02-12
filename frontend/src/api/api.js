import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
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
    return Promise.reject(error);
  }
);

export const loanService = {
  getManagers: async () => {
    const res = await api.get('/admins/?role=MANAGER');
    return res.data;
  },
  updateAdmin: async (id, data) => {
    const res = await api.patch(`/admins/${id}/`, data);
    return res.data;
  },
  getOfficers: async () => {
    const res = await api.get('/admins/?role=FIELD_OFFICER');
    return res.data;
  },
  getFieldOfficers: async () => {
    const res = await api.get('/admins/?role=FIELD_OFFICER');
    return res.data;
  },
  getFinanceOfficers: async () => {
    const res = await api.get('/admins/?role=FINANCIAL_OFFICER');
    return res.data;
  },
  getLoans: async () => {
    const res = await api.get('/loans/');
    return res.data;
  },
  updateLoan: async (id, data) => {
    const res = await api.patch(`/loans/${id}/`, data);
    return res.data;
  },
  getCustomers: async () => {
    const res = await api.get('/users/');
    return res.data;
  },
  updateCustomer: async (id, data) => {
    const res = await api.patch(`/users/${id}/`, data);
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
  getAuditLogs: async () => {
    const res = await api.get('/audit-logs/');
    return res.data;
  },
  getLoanProducts: async () => {
    const res = await api.get('/loan-products/');
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
  login: async (email, password) => {
    const res = await api.post('/auth/login/', { email, password });
    return res.data;
  },
  register: async (full_name, email, phone, role, password, invitation_token = null) => {
    const res = await api.post('/auth/register/', { 
      full_name, 
      email, 
      phone, 
      role, 
      password,
      invitation_token
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
  api // Export raw axios instance for custom calls
};

export default api;
