import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../api/api';
import { Button, Card } from '../components/ui/Shared';
import { Lock, Mail, User, ShieldCheck } from 'lucide-react';

const LoginPage = ({ role = 'ADMIN' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log(`[LoginPage] Attempting login for role: ${role}`);
      console.log(`[LoginPage] Email: ${email}`);
      const res = await loanService.login(email, password);
      
      console.log('[LoginPage] Login response:', res);
      console.log('[LoginPage] Response role:', res.role);
      console.log('[LoginPage] Expected role:', role);
      console.log('[LoginPage] Access token:', res.access ? 'Present' : 'MISSING');

      if (res.role !== role) {
        console.warn(`[LoginPage] Role mismatch: ${res.role} !== ${role}`);
        setError(`This account is not a ${role.replace('_', ' ')}.`);
        setLoading(false);
        return;
      }

      console.log('[LoginPage] Role matched, logging in user');
      login(res);
      
      // Verify token was saved
      const saved = localStorage.getItem('loan_user');
      console.log('[LoginPage] Token saved to localStorage:', saved ? 'YES' : 'NO');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('[LoginPage] Saved token preview:', parsed.access?.substring(0, 20) + '...');
      }

      // Navigate to correct dashboard based on role
      if (role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (role === 'MANAGER') {
        navigate('/manager/dashboard');
      } else if (role === 'FINANCIAL_OFFICER') {
        navigate('/finance/dashboard');
      } else if (role === 'FIELD_OFFICER') {
        navigate('/field/dashboard');
      }
    } catch (err) {
      console.error('[LoginPage] Login error:', err);
      console.error('[LoginPage] Error response:', err.response?.data);
      const message = err.response?.data?.error || err.message || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const roleColors = {
    ADMIN: 'text-primary-600',
    MANAGER: 'text-emerald-600',
    FINANCIAL_OFFICER: 'text-indigo-600',
    FIELD_OFFICER: 'text-orange-600'
  };

  const roleLabels = {
    ADMIN: 'Administrator',
    MANAGER: 'Regional Manager',
    FINANCIAL_OFFICER: 'Finance Officer',
    FIELD_OFFICER: 'Field Officer'
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 mb-4 dark:bg-slate-900 dark:border-slate-800">
            <ShieldCheck className={`w-8 h-8 ${roleColors[role]}`} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome Back</h1>
          <p className="text-slate-500 mt-2">Sign in to the <span className={`font-semibold ${roleColors[role]}`}>{roleLabels[role]}</span> portal</p>
        </div>

        <Card className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  placeholder="admin@azariah.com"
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-3" variant={role === 'MANAGER' ? 'secondary' : 'primary'} disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          {role === 'ADMIN' && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary-600 font-medium hover:underline">Create an account</Link>
            </p>
          )}
        </Card>

        <div className="mt-6 p-4 bg-white rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">Login as different role:</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/login/admin"
              className={`text-center px-3 py-2 rounded-md text-sm font-medium transition ${role === 'ADMIN' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
            >
              Admin
            </Link>
            <Link
              to="/login/manager"
              className={`text-center px-3 py-2 rounded-md text-sm font-medium transition ${role === 'MANAGER' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
            >
              Manager
            </Link>
            <Link
              to="/login/finance"
              className={`text-center px-3 py-2 rounded-md text-sm font-medium transition ${role === 'FINANCIAL_OFFICER' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
            >
              Finance Officer
            </Link>
            <Link
              to="/login/field"
              className={`text-center px-3 py-2 rounded-md text-sm font-medium transition ${role === 'FIELD_OFFICER' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
            >
              Field Officer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
