import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log('API Base URL:', api.defaults.baseURL);

api.interceptors.request.use((config) => {
  const savedUser = localStorage.getItem('loan_user');
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      const { access } = parsed;
      if (access) {
        config.headers.Authorization = `Bearer ${access}`;
      }
    } catch (e) {}
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return Promise.reject({
        ...error,
        response: {
          data: { error: 'Request timed out. Please try again.' }
        }
      });
    }
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('loan_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const branchService = {
  getBranches: async (params = {}) => {
    const res = await api.get('/branches/', { params });
    return res.data;
  },
  createBranch: async (data) => {
    const res = await api.post('/branches/', data);
    return res.data;
  },
  updateBranch: async (id, data) => {
    const res = await api.patch(`/branches/${id}/`, data);
    return res.data;
  },
  deleteBranch: async (id) => {
    const res = await api.delete(`/branches/${id}/`);
    return res.data;
  }
};

export const loanService = {
  api: api,
  login: async (credentials) => {
    const res = await api.post('/auth/login/', credentials);
    return res.data;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout/');
    } catch (e) {
      // Silent fail — always clear local state
    }
  },
  verify2FA: async (data) => {
    const res = await api.post('/auth/2fa/verify/', data);
    return res.data;
  },
  getLoans: async (params = {}) => {
    const res = await api.get('/loans/', { params: { limit: 20, ...params } });
    return res.data;
  },
  getManagerQueue: async (params = {}) => {
    // We map 'tab' to 'status' because the backend filters on status
    const queryParams = { ...params };
    if (queryParams.tab) {
      if (queryParams.tab === 'QUEUE') {
        queryParams.status = 'UNVERIFIED,PENDING,FIELD_VERIFIED'; 
        queryParams.ordering = 'created_at'; // Make Review Queue Oldest First
      } else {
        queryParams.status = queryParams.tab;
        queryParams.ordering = '-created_at';
      }
      delete queryParams.tab;
    }
    const res = await api.get('/loans/', { params: { limit: 20, ...queryParams } });
    return res.data;
  },
  getCustomers: async (params = {}) => {
    const res = await api.get('/users/', { params: { limit: 20, ...params } });
    return res.data;
  },
  getRepayments: async (params = {}) => {
    const res = await api.get('/repayments/', { params: { limit: 20, ...params } });
    return res.data;
  },
  getFinancialAnalytics: async () => {
    const res = await api.get('/finance/analytics/');
    return res.data;
  },
  getSettings: async () => {
    const res = await api.get('/settings/');
    return res.data;
  },
  getSecureSettings: async (group = '') => {
    const res = await api.get('/settings/secure/', { params: { group } });
    return Array.isArray(res.data) ? res.data : (res.data?.results || res.data || []);
  },
  updateSecureSetting: async (key, value, group) => {
    const res = await api.post('/settings/secure/', { key, encrypted_value: value, setting_group: group });
    return res.data;
  },
  getSystemHealth: async () => {
    const res = await api.get('/health/');
    return res.data;
  },
  revealSecureSetting: async (key) => {
    const res = await api.post(`/settings/secure/${key}/reveal/`);
    return res.data;
  },
  scheduleMaintenance: async (data) => {
    await api.post('/settings/secure/', { key: 'maintenance_schedule_time', encrypted_value: data.time, setting_group: 'SECURITY' });
    const res = await api.post('/settings/secure/', { key: 'maintenance_mode_active', encrypted_value: data.active ? 'true' : 'false', setting_group: 'SECURITY' });
    return res.data;
  },
  getSecurityLogs: async (params = {}) => {
    const res = await api.get('/security-logs/', { params });
    return res.data;
  },
  getAuditLogs: async (params = {}) => {
    const res = await api.get('/owner-audit/', { params });
    return res.data;
  },
  getOwnerAuditLogs: async (params = {}) => {
    const res = await api.get('/owner-audit/', { params });
    return res.data;
  },
  getEmailLogs: async (params = {}) => {
    const res = await api.get('/notifications/email-logs/', { params });
    return res.data;
  },
  getOwnership: async () => {
    const res = await api.get('/ownership/');
    return res.data;
  },
  toggleGodMode: async (data) => {
    const res = await api.post('/auth/god-mode/toggle/', data);
    return res.data;
  },
  getAllAdmins: async () => {
    const res = await api.get('/admins/');
    return res.data;
  },
  getManagers: async (params = {}) => {
    const res = await api.get('/admins/', { params: { ...params, role: 'ADMIN' } });
    return res.data;
  },
  getFinanceOfficers: async (params = {}) => {
    const res = await api.get('/admins/', { params: { ...params, role: 'FINANCIAL_OFFICER' } });
    return res.data;
  },
  getFieldOfficers: async (params = {}) => {
    const res = await api.get('/admins/', { params: { ...params, role: 'FIELD_OFFICER' } });
    return res.data;
  },
  updateAdmin: async (id, data) => {
    const res = await api.patch(`/admins/${id}/`, data);
    return res.data;
  },
  getAdminProfile: async (id) => {
    const res = await api.get(`/admins/${id}/`);
    return res.data;
  },
  getAnalytics: async (branch = '') => {
    const res = await api.get('/finance/analytics/', { params: { branch } });
    return res.data;
  },
  updateLoan: async (id, data) => {
    const res = await api.patch(`/loans/${id}/`, data);
    return res.data;
  },
  inviteAdmin: async (data) => {
    const res = await api.post('/admins/invite/', data);
    return res.data;
  },
  getAdmins: async (params = {}) => {
    const res = await api.get('/admins/', { params });
    return res.data;
  },
  // Loan Products
  getLoanProducts: async () => {
    const res = await api.get('/loan-products/');
    return res.data;
  },
  createLoanProduct: async (data) => {
    const res = await api.post('/loan-products/', data);
    return res.data;
  },
  updateLoanProduct: async (id, data) => {
    const res = await api.patch(`/loan-products/${id}/`, data);
    return res.data;
  },
  deleteLoanProduct: async (id) => {
    const res = await api.delete(`/loan-products/${id}/`);
    return res.data;
  },
  getSMSLogs: async (params = {}) => {
    const res = await api.get('/sms-logs/', { params });
    return res.data;
  },
  register: async (fullName, email, phone, role, password, token, branch) => {
    const res = await api.post('/auth/register/', {
      full_name: fullName,
      email,
      phone,
      role,
      password,
      invitation_token: token,
      branch
    });
    return res.data;
  },
  verifyEmail: async (email, code) => {
    const res = await api.post('/auth/verify-email/', { email, code });
    return res.data;
  },
  createDeactivationRequest: async (data) => {
    const res = await api.post('/deactivation-requests/', data);
    return res.data;
  },
  getDeactivationRequests: async (params = {}) => {
    const res = await api.get('/deactivation-requests/', { params });
    return res.data;
  },
  updateDeactivationRequest: async (id, data) => {
    const res = await api.patch(`/deactivation-requests/${id}/`, data);
    return res.data;
  },
  sendEmailNotification: async (data) => {
    const res = await api.post('/notifications/send-email/', data);
    return res.data;
  },
  sendBulkSMS: async (data) => {
    const res = await api.post('/loans/bulk-sms-defaulters/', data);
    return res.data;
  },
  sendDirectSMS: async (data) => {
    const res = await api.post('/loans/direct-sms/', data);
    return res.data;
  },
  exportData: async (params = {}) => {
    const res = await api.get('/export/', { 
      params,
      responseType: 'blob'
    });
    return res.data;
  },
  // Mapping branch methods into loanService for backward compatibility with old components
  getBranches: branchService.getBranches,
  createBranch: branchService.createBranch,
  updateBranch: branchService.updateBranch,
  deleteBranch: branchService.deleteBranch
};
