import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { loanService } from '../../api/api';
import { Button, Card } from './Shared';
import { ShieldCheck, ShieldAlert, X, Copy, CheckCircle2 } from 'lucide-react';

const TwoFactorSetupModal = ({ isOpen, onClose, onStatusChange }) => {
  const [step, setStep] = useState(1); // 1: Info, 2: Setup, 3: Verify, 4: Success
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCode('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loanService.enable2FA();
      setSetupData(data);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initiate 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await loanService.verifyEnable2FA({ code });
      setStep(4);
      if (onStatusChange) onStatusChange(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="w-full max-w-md overflow-hidden relative animate-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <div className="p-8">
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-10 h-10 text-primary-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Secure Your Account</h3>
                <p className="text-sm text-slate-500 mt-2">
                  Add an extra layer of security to your account by enabling Two-Factor Authentication using an authenticator app like Google Authenticator or Authy.
                </p>
              </div>
              <Button onClick={startSetup} className="w-full py-3" disabled={loading}>
                {loading ? 'Starting...' : 'Get Started'}
              </Button>
            </div>
          )}

          {step === 2 && setupData && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Setup Authenticator</h3>
                <p className="text-xs text-slate-500 mt-1">Scan the QR code below using your app</p>
              </div>

              <div className="flex justify-center p-4 bg-white rounded-xl border-2 border-slate-100">
                <QRCodeSVG value={setupData.otpauth_url} size={180} />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Can't scan? Enter manually:</p>
                <div className="flex items-center justify-between font-mono text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{setupData.secret}</span>
                  <button onClick={copyToClipboard} className="text-primary-600 hover:text-primary-700 p-1">
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button onClick={() => setStep(3)} className="w-full">Next Step</Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
                <Smartphone className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verify Code</h3>
                <p className="text-sm text-slate-500 mt-1">Enter the 6-digit code displayed in your app</p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                  {error}
                </div>
              )}

              <input
                type="text"
                maxLength="6"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-2xl font-bold tracking-[0.5em] text-center focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="000000"
              />

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button onClick={handleVerify} disabled={code.length !== 6 || loading} className="flex-2">
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-6 py-4">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Security Enabled!</h3>
                <p className="text-sm text-slate-500 mt-2">
                  Two-Factor Authentication is now active. You will be asked for a code every time you sign in.
                </p>
              </div>
              <Button onClick={onClose} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 border-none">
                Done
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TwoFactorSetupModal;
