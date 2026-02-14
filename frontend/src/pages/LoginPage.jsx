import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../api/api';
import { Button, Card } from '../components/ui/Shared';
import { Lock, Mail, User, ShieldCheck } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [adminId, setAdminId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDashboardRedirect = (role) => {
    if (role === 'ADMIN') {
      navigate('/admin/dashboard');
    } else if (role === 'MANAGER') {
      navigate('/manager/dashboard');
    } else if (role === 'FINANCIAL_OFFICER') {
      navigate('/finance/dashboard');
    } else if (role === 'FIELD_OFFICER') {
      navigate('/field/dashboard');
    } else {
      setError('Unauthorized role');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log(`[LoginPage] Attempting login for email: ${email}`);
      const res = await loanService.login({ email, password });
      
      console.log('[LoginPage] Login response:', res);
      
      if (res.two_factor_required) {
        setRequires2FA(true);
        setAdminId(res.id);
        setLoading(false);
        return;
      }

      login(res);
      handleDashboardRedirect(res.role);
    } catch (err) {
      console.error('[LoginPage] Login error:', err);
      const message = err.response?.data?.error || err.message || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await loanService.verify2FA({
        id: adminId,
        code: otpCode
      });
      
      login(res);
      handleDashboardRedirect(res.role);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid 2FA code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 mb-4 dark:bg-slate-900 dark:border-slate-800">
            <ShieldCheck className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {requires2FA ? 'Two-Factor Authentication' : 'Welcome Back'}
          </h1>
          <p className="text-slate-500 mt-2">
            {requires2FA ? 'Enter the 6-digit code from your app' : 'Sign in to the Azariah Credit Ltd system'}
          </p>
        </div>

        <Card className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {!requires2FA ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="name@azariacredit.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                  <Link to="/forgot-password" size="sm" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full py-3" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handle2FAVerify} className="space-y-6">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                  <strong>Notice:</strong> Open your authenticator app (like Google Authenticator) on your mobile device to view your 6-digit security code.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Enter 6-digit Code</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength="6"
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl text-3xl font-bold tracking-[0.1em] text-center focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white transition-all autofill:bg-white dark:autofill:bg-slate-800"
                    placeholder="000000"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full py-3" disabled={loading || otpCode.length !== 6}>
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </Button>
                <button 
                  type="button"
                  onClick={() => setRequires2FA(false)}
                  className="text-sm text-slate-500 hover:text-slate-700 underline"
                >
                  Back to login
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
