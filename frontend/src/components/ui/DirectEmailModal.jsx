import React, { useState } from 'react';
import { Mail, Send, X } from 'lucide-react';
import { Button } from './Shared';
import { loanService } from '../../api/api';

const DirectEmailModal = ({ targets, isOpen, onClose, bulk = false, targetGroup = null }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const payload = {
        subject: subject.trim() || undefined,
        message: message.trim()
      };

      if (targetGroup) {
        payload.target_group = targetGroup;
      } else {
        payload.target_ids = Array.isArray(targets) ? targets.map(t => t.id) : [targets.id];
      }

      await loanService.sendEmailNotification(payload);
      alert('Email(s) sent successfully');
      onClose();
    } catch (err) {
      alert('Failed to send email: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };

  const targetName = targetGroup === 'STAFF' 
    ? 'All System Staff'
    : bulk 
      ? `${targets.length} Recipients` 
      : targets?.full_name || targets?.name || 'Recipient';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Send Email</h3>
              <p className="text-xs text-slate-500">To: {targetName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Subject (Optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Notification from Azariah Credit"
              className="w-full p-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Message Body</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your official notification here..."
              className="w-full h-40 p-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
            />
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            Note: Emails are sent via the official system relay and are logged for security.
          </p>
        </div>

        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()} className="flex items-center gap-2">
            {sending ? 'Sending...' : (
              <>
                <Send className="w-4 h-4" />
                Send Notification
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DirectEmailModal;
