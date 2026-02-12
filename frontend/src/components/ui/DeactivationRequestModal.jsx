import React, { useState } from 'react';
import { X, AlertTriangle, ShieldOff } from 'lucide-react';
import { Button, Card } from './Shared';

const DeactivationRequestModal = ({ isOpen, onClose, officer, onSubmit, loading }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !officer) return null;

  const getWordCount = (str) => {
    return str.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (getWordCount(reason) < 10) {
      setError('Please provide a more detailed reason (at least 10 words).');
      return;
    }
    setError('');
    onSubmit(officer.id, reason);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Deactivation Request</h3>
              <p className="text-sm text-slate-500">Security audit required for account suspension</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/50 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-400">
              <p className="font-semibold">Important Policy Notice:</p>
              <p className="mt-1">Suspending <b>{officer.full_name}</b>'s account requires administrative approval. The officer will remain active until the request is reviewed.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Justification for Deactivation (10 Words Min)
            </label>
            <textarea
              autoFocus
              className={`w-full h-32 p-4 rounded-xl border dark:bg-slate-900 dark:text-white text-sm outline-none transition-all ${
                error ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500'
              }`}
              placeholder="Explain why this account should be deactivated. Include specific incidents or policy violations..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
            <div className="flex justify-between items-center">
              <p className={`text-xs ${getWordCount(reason) < 10 ? 'text-slate-400' : 'text-emerald-600 font-medium'}`}>
                {getWordCount(reason)}/10 words
              </p>
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="danger" 
              className="flex-1"
              loading={loading}
            >
              Submit Request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default DeactivationRequestModal;
