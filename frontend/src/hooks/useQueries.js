import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loanService, branchService } from '../api/api';
import { useAuth } from '../context/AuthContext';

// ── LOANS ──────────────────────────────────────────────────────
export const useLoans = (params = {}) => useQuery({
  queryKey: ['loans', params],
  queryFn: () => loanService.getLoans(params),
  staleTime: 1000 * 30, // 30 seconds
  refetchInterval: 30000, // 30 seconds
});

// Specialized High-Priority Hooks
export const useManagerQueue = (params = {}) => useQuery({
  queryKey: ['manager-queue', params],
  queryFn: () => loanService.getLoans({ ...params, ordering: 'created_at' }),
  staleTime: 1000 * 5,
  refetchInterval: 5000, // 5 seconds for Managers
});

export const useDisbursementQueue = (params = {}) => useQuery({
  queryKey: ['disbursement-queue', params],
  queryFn: () => loanService.getLoans({ ...params, status: 'APPROVED', ordering: 'created_at' }),
  staleTime: 1000 * 5,
  refetchInterval: 5000, // 5 seconds for Finance
});

// ── CUSTOMERS ──────────────────────────────────────────────────
export const useCustomers = (params = {}) => useQuery({
  queryKey: ['customers', params],
  queryFn: () => loanService.getCustomers(params),
  staleTime: 1000 * 60,
  refetchInterval: 60000,
});

// ── REPAYMENTS ─────────────────────────────────────────────────
export const useRepayments = (params = {}) => useQuery({
  queryKey: ['repayments', params],
  queryFn: () => loanService.getRepayments(params),
  staleTime: 1000 * 30,
  refetchInterval: 30000,
});

// ── CAPITAL BALANCE ────────────────────────────────────────────
export const useCapitalBalance = () => {
  const { user, activeRole } = useAuth();
  const allowed =
    user?.is_owner ||
    user?.is_super_admin ||
    activeRole === 'SUPER_ADMIN' ||
    activeRole === 'FINANCIAL_OFFICER';

  return useQuery({
    queryKey: ['capital-balance'],
    queryFn: () => loanService.api.get('/capital/balance/').then(r => r.data),
    staleTime: 1000 * 30,
    enabled: !!allowed,
  });
};

// ── FINANCIAL ANALYTICS ────────────────────────────────────────
export const useFinancialAnalytics = () => useQuery({
  queryKey: ['financial-analytics'],
  queryFn: () => loanService.getFinancialAnalytics(),
  staleTime: 1000 * 60 * 2,
});

export const useOwnerAnalytics = () => useQuery({
  queryKey: ['owner-analytics'],
  queryFn: () => loanService.api.get('/owner/analytics/')
      .then(r => r.data),
  staleTime: 1000 * 60 * 5,
  enabled: true,
});

// ── SECURITY LOGS ──────────────────────────────────────────────
export const useTeamSecurityAlerts = () => useQuery({
  queryKey: ['team-security-alerts'],
  queryFn: () => loanService.api.get('/team-security-alerts/').then(r => r.data),
  staleTime: 1000 * 30,
  refetchInterval: 30000, // Frequent checks for security
});

export const useSecurityLogs = (params = {}) => {
  const { enabled, ...queryParams } = params;
  return useQuery({
    queryKey: ['security-logs', queryParams],
    queryFn: () => loanService.getSecurityLogs(queryParams),
    staleTime: 1000 * 60,
    enabled: enabled !== false,
  });
};

// ── AUDIT LOGS ─────────────────────────────────────────────────
export const useAuditLogs = (params = {}) => useQuery({
  queryKey: ['audit-logs', params],
  queryFn: () => loanService.getAuditLogs(params),
  staleTime: 1000 * 60,
});

// ── ADMINS ─────────────────────────────────────────────────────
export const useAdmins = (params = {}) => useQuery({
  queryKey: ['admins', params],
  queryFn: () => loanService.getAllAdmins(params),
  staleTime: 1000 * 60 * 5,
});

// ── BRANCHES ───────────────────────────────────────────────────
export const useBranches = () => useQuery({
  queryKey: ['branches'],
  queryFn: () => branchService.getBranches(),
  staleTime: 1000 * 60 * 5,
});

// ── LOAN PRODUCTS ──────────────────────────────────────────────
export const useLoanProducts = () => useQuery({
  queryKey: ['loan-products'],
  queryFn: () => loanService.getLoanProducts(),
  staleTime: 1000 * 60 * 5,
});

// ── SMS LOGS ───────────────────────────────────────────────────
export const useSMSLogs = (params = {}) => useQuery({
  queryKey: ['sms-logs', params],
  queryFn: () => loanService.getSMSLogs(params),
  staleTime: 1000 * 60,
});

// ── SECURITY THREATS ───────────────────────────────────────────
export const useSecurityThreats = () => useQuery({
  queryKey: ['security-threats'],
  queryFn: () => loanService.api.get('/security-threats/').then(r => r.data),
  staleTime: 1000 * 60,
});

// ── UNMATCHED REPAYMENTS ───────────────────────────────────────
export const useUnmatchedRepayments = () => useQuery({
  queryKey: ['unmatched-repayments'],
  queryFn: () => loanService.api.get('/repayments/unmatched/').then(r => r.data),
  staleTime: 1000 * 15,   // 15 seconds — finance officer monitors this live
});

// ── SYSTEM HEALTH ──────────────────────────────────────────────
export const useSystemHealth = () => useQuery({
  queryKey: ['system-health'],
  queryFn: () => loanService.getSystemHealth(),
  staleTime: 1000 * 30, // 30 seconds
  refetchInterval: 1000 * 60, // Poll every minute
});

// ── INVALIDATION HELPER ────────────────────────────────────────
// Use this after mutations (disburse, approve, register customer etc.)
// to force a fresh fetch of affected data
export const useInvalidate = () => {
  const queryClient = useQueryClient();
  return {
    invalidateLoans: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['manager-queue'] });
    },
    invalidateCustomers: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
    invalidateRepayments: () => queryClient.invalidateQueries({ queryKey: ['repayments'] }),
    invalidateCapital: () => queryClient.invalidateQueries({ queryKey: ['capital-balance'] }),
    invalidateAnalytics: () => queryClient.invalidateQueries({ queryKey: ['financial-analytics'] }),
    invalidateAdmins: () => queryClient.invalidateQueries({ queryKey: ['admins'] }),
    invalidateBranches: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
    invalidateSecurityThreats: () => queryClient.invalidateQueries({ queryKey: ['security-threats'] }),
    invalidateLoanProducts: () => queryClient.invalidateQueries({ queryKey: ['loan-products'] }),
    invalidateSecureSettings: () => queryClient.invalidateQueries({ queryKey: ['secure-settings'] }),
    invalidateOwnership: () => queryClient.invalidateQueries({ queryKey: ['ownership'] }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
};

/**
 * Polling hook for background notifications
 */
export const useBackgroundPolling = (user, activeRole) => {
  const isPrivileged = user?.is_owner || user?.is_super_admin || activeRole === 'SUPER_ADMIN';
  const isFinance = activeRole === 'FINANCIAL_OFFICER' || activeRole === 'SUPER_ADMIN' || user?.is_owner;

  const notificationCount = useQuery({
    queryKey: ['staff-notifications', 'unread-count'],
    queryFn: async () => {
      const res = await loanService.api.get('/staff-notifications/');
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data.filter(n => !n.is_read).length : 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const securityThreats = useQuery({
    queryKey: ['security-threats', 'summary'],
    queryFn: async () => {
      const res = await loanService.api.get('/security-threats/');
      return res.data?.summary?.total_threats || 0;
    },
    enabled: !!isPrivileged,
    refetchInterval: 60000,
    staleTime: 30000
  });

  const unmatchedRepayments = useQuery({
    queryKey: ['repayments', 'unmatched-count'],
    queryFn: async () => {
      const lastCheck = localStorage.getItem('last_repayment_check') || new Date().toISOString();
      const res = await loanService.api.get(`/repayments/unmatched/?since=${lastCheck}`);
      return res.data?.new_count || 0;
    },
    enabled: !!isFinance,
    refetchInterval: 30000,
    staleTime: 15000
  });

  return {
    threatCount: securityThreats.data || 0,
    newRepaymentCount: unmatchedRepayments.data || 0,
    unreadNotifications: notificationCount.data || 0
  };
};

export const useCapital = useCapitalBalance; // Alias
export const useFieldOfficers = () => useQuery({
  queryKey: ['field-officers'],
  queryFn: () => loanService.getFieldOfficers(),
  staleTime: 1000 * 60 * 5,
});

// ── OWNERSHIP ──────────────────────────────────────────────────
export const useOwnership = () => useQuery({
  queryKey: ['ownership'],
  queryFn: () => loanService.getOwnership(),
  staleTime: 1000 * 30, // Ownership changes are rare
});

// ── SECURE SETTINGS ────────────────────────────────────────────
export const useSecureSettings = () => useQuery({
  queryKey: ['secure-settings'],
  queryFn: () => loanService.getSecureSettings(),
  staleTime: 1000 * 60 * 5,
});
