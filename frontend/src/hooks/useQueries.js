import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loanService, branchService } from '../api/api';
import { useAuth } from '../context/AuthContext';

// ── LOANS ──────────────────────────────────────────────────────
export const useLoans = (params = {}) => useQuery({
  queryKey: ['loans', params],
  queryFn: () => loanService.getLoans(params),
  staleTime: 1000 * 60 * 2,
});

// ── CUSTOMERS ──────────────────────────────────────────────────
export const useCustomers = (params = {}) => useQuery({
  queryKey: ['customers', params],
  queryFn: () => loanService.getCustomers(params),
  staleTime: 1000 * 60 * 2,
});

// ── REPAYMENTS ─────────────────────────────────────────────────
export const useRepayments = (params = {}) => useQuery({
  queryKey: ['repayments', params],
  queryFn: () => loanService.getRepayments(params),
  staleTime: 1000 * 60 * 2,
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

// ── SECURITY LOGS ──────────────────────────────────────────────
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

// ── INVALIDATION HELPER ────────────────────────────────────────
// Use this after mutations (disburse, approve, register customer etc.)
// to force a fresh fetch of affected data
export const useInvalidate = () => {
  const queryClient = useQueryClient();
  return {
    invalidateLoans: () => queryClient.invalidateQueries({ queryKey: ['loans'] }),
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
    newRepaymentCount: unmatchedRepayments.data || 0
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
