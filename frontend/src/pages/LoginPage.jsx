import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../api/api';
import { Button, Card } from '../components/ui/Shared';
import { Lock, Mail, User, ShieldCheck } from 'lucide-react';

const LoginPage = () => {
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
      console.log(`[LoginPage] Attempting login for email: ${email}`);
      const res = await loanService.login(email, password);
      
      console.log('[LoginPage] Login response:', res);
      console.log('[LoginPage] Response role:', res.role);

      login(res);
      
      // Navigate to correct dashboard based on role returned from backend
      if (res.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (res.role === 'MANAGER') {
        navigate('/manager/dashboard');
      } else if (res.role === 'FINANCIAL_OFFICER') {
        navigate('/finance/dashboard');
      } else if (res.role === 'FIELD_OFFICER') {
        navigate('/field/dashboard');
      } else {
        setError('Unauthorized role');
      }
    } catch (err) {
      console.error('[LoginPage] Login error:', err);
      const message = err.response?.data?.error || err.message || 'Login failed. Please try again.';
      setError(message);
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome Back</h1>
          <p className="text-slate-500 mt-2">Sign in to the Azariah Credit Ltd system</p>
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
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
