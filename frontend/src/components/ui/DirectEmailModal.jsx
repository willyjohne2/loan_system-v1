import React, { useState } from 'react';
import { Mail, Send, X, ChevronDown } from 'lucide-react';
import { Button } from './Shared';
import { loanService } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

const DirectEmailModal = ({ targets, isOpen, onClose, bulk = false, targetGroup = null }) => {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(targetGroup || 'specific');

  if (!isOpen) return null;

  const recipientGroups = [
    { value: 'all_staff', label: 'All Staff' },
    { value: 'managers', label: 'All Managers' },
    { value: 'field_officers', label: 'All Field Officers' },
    { value: 'finance_officers', label: 'All Finance Officers' },
    ...(user?.is_owner || user?.is_super_admin ? [
      { value: 'super_admins', label: 'Super Admins' }
    ] : []),
    ...(user?.is_owner ? [
      { value: 'all_owners', label: 'All Owners' }
    ] : []),
    { value: 'specific', label: 'Specific Person' },
  ];

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const payload = {
        subject: subject.trim() || undefined,
        message: message.trim()
      };

      if (selectedGroup !== 'specific') {
        payload.target_group = selectedGroup.toUpperCase();
      } else if (targetGroup) {
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

  const isGroupDisabled = !!targetGroup;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Send Email</h3>
              <p className="text-xs text-slate-500">Official Communication Hub</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-4 text-left">
          {!isGroupDisabled && (
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5 text-left">Recipient Group</label>
                <div className="relative">
                    <select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-primary-500/50 outline-none appearance-none cursor-pointer transition-all"
                    >
                        {recipientGroups.map(group => (
                            <option key={group.value} value={group.value}>{group.label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
            </div>
          )}

          {selectedGroup === 'specific' && (
             <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Recipient Details</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {bulk ? `${targets.length} Selected Recipients` : (targets?.full_name || targets?.name || 'Unknown Recipient')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{bulk ? 'Direct Bulk Mailing' : (targets?.email || 'N/A')}</p>
                </div>
             </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 px-0.5">Subject (Optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="System Notification - Azariah Credit"
              className="w-full p-3 text-sm border-2 border-slate-100 dark:border-slate-700 rounded-xl dark:bg-slate-800 focus:border-primary-500/50 outline-none transition-all placeholder:text-slate-400 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 px-0.5">Message Body</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your official notification here..."
              className="w-full h-40 p-3 text-sm border-2 border-slate-100 dark:border-slate-700 rounded-xl dark:bg-slate-800 focus:border-primary-500/50 outline-none resize-none transition-all placeholder:text-slate-400 dark:text-white"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={sending} className="font-bold border-2 border-slate-200 dark:border-slate-700">Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()} className="flex items-center gap-2 font-bold px-6">
            {sending ? 'Sending...' : (
              <>
                <Send className="w-4 h-4" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DirectEmailModal;
