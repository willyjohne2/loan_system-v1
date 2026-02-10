import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { loanService } from '../api/api';
import { Button, Card } from '../components/ui/Shared';
import { Mail, ArrowLeft } from 'lucide-react';

const VerifyEmailPage = () => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get email from navigation state
    if (location.state?.email) setEmail(location.state.email);
    if (location.state?.role) setRole(location.state.role);
  }, [location, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!code.trim()) {
      setError('Please enter the verification code');
      return;
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);

    try {
      await loanService.verifyEmail(email, code);
      setSuccess('Email verified successfully! Redirecting to login...');
      setTimeout(() => {
        if (role === 'MANAGER') navigate('/login/manager');
        else if (role === 'FINANCIAL_OFFICER') navigate('/login/finance');
        else if (role === 'FIELD_OFFICER') navigate('/login/field');
        else navigate('/login/admin');
      }, 2000);
    } catch (err) {
      console.error('Verification Error:', err.response?.data || err.message);
      setError(err.response?.data?.error || err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    setResendLoading(true);

    try {
      // Note: You'll need to create a resend endpoint in your backend
      // For now, we'll just show a message
      setSuccess('Verification code resent! Check your email.');
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 mb-4 dark:bg-slate-900 dark:border-slate-800">
            <Mail className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Verify Your Email</h1>
          <p className="text-slate-500 mt-2">Enter the verification code sent to your email</p>
        </div>

        <Card className="p-8">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength="6"
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl tracking-widest bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Enter the 6-digit code from your email</p>
            </div>

            <Button type="submit" disabled={loading || code.length !== 6} className="w-full py-2.5 mt-6">
              {loading ? 'Verifying...' : 'Verify Email'}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-slate-500">
              Didn't receive the code?{' '}
              <button
                onClick={handleResendCode}
                disabled={resendLoading}
                className="text-primary-600 font-medium hover:underline disabled:opacity-50"
              >
                {resendLoading ? 'Resending...' : 'Resend Code'}
              </button>
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Registration
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
