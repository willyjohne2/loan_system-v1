import React, { useState } from 'react';
import { loanService } from '../../api/api';
import { Button, Card } from './Shared';
import { ShieldAlert, X } from 'lucide-react';

const DisableTwoFactorModal = ({ isOpen, onClose, onStatusChange }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDisable = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await loanService.disable2FA({ code });
      if (onStatusChange) onStatusChange(false);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
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

        <div className="p-8 space-y-6 text-center">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-rose-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Disable Two-Factor Auth?</h3>
            <p className="text-sm text-slate-500 mt-1">
              For security reasons, please enter your verification code to disable 2FA.
            </p>
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
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button 
                onClick={handleDisable} 
                disabled={code.length !== 6 || loading} 
                className="flex-1 bg-rose-600 hover:bg-rose-700 border-none"
            >
              {loading ? 'Disabling...' : 'Confirm Disable'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DisableTwoFactorModal;
