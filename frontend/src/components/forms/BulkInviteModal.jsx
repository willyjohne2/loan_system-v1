import React, { useState } from 'react';
import { X, Mail, Shield, Plus, Trash2, Loader2, MapPin } from 'lucide-react';
import { loanService } from '../../api/api';
import { Button, Card } from '../ui/Shared';

const BulkInviteModal = ({ isOpen, onClose, defaultRole = 'FIELD_OFFICER', branches = [] }) => {
  const [role, setRole] = useState(defaultRole);
  const [branch, setBranch] = useState('');
  const [emails, setEmails] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync role state with prop when modal opens/changes
  React.useEffect(() => {
    if (isOpen) {
      setRole(defaultRole);
    }
  }, [isOpen, defaultRole]);

  if (!isOpen) return null;

  const handleAddEmail = () => {
    if (emails.length < 5) {
      setEmails([...emails, '']);
    }
  };

  const handleRemoveEmail = (index) => {
    const newEmails = emails.filter((_, i) => i !== index);
    setEmails(newEmails.length ? newEmails : ['']);
  };

  const handleEmailChange = (index, value) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const validEmails = emails.filter(email => email.trim() !== '');
    if (validEmails.length === 0) {
      setError('Please enter at least one email address.');
      return;
    }

    if (role === 'MANAGER' && !branch) {
      setError('Please select a branch for the manager(s).');
      return;
    }

    setLoading(true);
    try {
      await loanService.inviteAdmin({
        emails: validEmails,
        role,
        branch: role === 'MANAGER' ? branch : null
      });
      alert('Invitations sent successfully!');
      onClose();
      setEmails(['']);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invitations.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
        >
          <X className="w-6 h-6 text-slate-400" />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">Bulk System Invitation</h3>
          <p className="text-slate-500 text-sm">Send secure registration links to multiple associates</p>
        </div>

        {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</label>
              <select 
                className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="FINANCIAL_OFFICER">Finance Officer</option>
                <option value="FIELD_OFFICER">Field Officer</option>
              </select>
            </div>

            {role === 'MANAGER' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Branch</label>
                <select 
                  className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white text-sm"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  required
                >
                  <option value="">Select...</option>
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Addresses ({emails.length}/5)</label>
                {emails.length < 5 && (
                    <button 
                        type="button" 
                        onClick={handleAddEmail}
                        className="text-xs text-primary-600 font-bold hover:text-primary-700 flex items-center gap-1"
                    >
                        <Plus className="w-3 h-3" /> Add More
                    </button>
                )}
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                {emails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                        <div className="relative flex-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input 
                                type="email"
                                placeholder={`associates${index + 1}@company.com`}
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500"
                                value={email}
                                onChange={(e) => handleEmailChange(index, e.target.value)}
                                required
                            />
                        </div>
                        {emails.length > 1 && (
                            <button 
                                type="button"
                                onClick={() => handleRemoveEmail(index)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <Button 
                type="button" 
                variant="secondary" 
                className="flex-1"
                onClick={onClose}
                disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Send Invites
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default BulkInviteModal;
