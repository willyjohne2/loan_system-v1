import React, { useState } from 'react';
import { Button, Card } from './Shared';
import { loanService } from '../../api/api';
import { Send, X, MessageSquare, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const BulkCustomerSMSModal = ({ isOpen, onClose }) => {
  const [smsType, setSmsType] = useState('DEFAULTERS'); // DEFAULTERS, REPAID, NOTICE
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (smsType === 'NOTICE' && !message) {
      return alert('Please enter a message for the notice.');
    }

    const confirmMsg = smsType === 'DEFAULTERS' 
      ? 'Send payment reminders to all current defaulters?' 
      : smsType === 'REPAID' 
      ? 'Send encouragement messages to customers who have cleared their loans?' 
      : 'Send this notice to all customers?';

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await loanService.sendBulkSMS(smsType, message);
      alert(res.message || 'Bulk SMS sequence started successfully');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to send bulk SMS');
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { 
      id: 'DEFAULTERS', 
      label: 'Defaulters', 
      icon: AlertTriangle, 
      color: 'text-orange-600 dark:text-orange-400', 
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      description: 'Notify customers with overdue loans. Includes balance and accumulated interest.' 
    },
    { 
      id: 'REPAID', 
      label: 'Lead Nurturing', 
      icon: CheckCircle, 
      color: 'text-emerald-600 dark:text-emerald-400', 
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      description: 'Encourage customers who have fully repaid to apply for new loans.' 
    },
    { 
      id: 'NOTICE', 
      label: 'General Notice', 
      icon: Info, 
      color: 'text-blue-600 dark:text-blue-400', 
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      description: 'Send a custom broadcast message to all verified customers.' 
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="w-full max-w-lg animate-in fade-in zoom-in duration-200 bg-white dark:bg-slate-900">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Customer Communications</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => setSmsType(t.id)}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
                  smsType === t.id 
                    ? 'border-primary-600 ring-2 ring-primary-500/10 bg-primary-50 dark:bg-primary-900/20' 
                    : 'border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className={`p-2 rounded-lg ${t.bg} ${t.color}`}>
                  <t.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{t.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.description}</p>
                </div>
              </button>
            ))}
          </div>

          {smsType === 'NOTICE' && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Custom Message
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder="Type your announcement here..."
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button 
                className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700" 
                onClick={handleSend}
                disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send {smsType === 'NOTICE' ? 'Notice' : 'Reminders'}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BulkCustomerSMSModal;
