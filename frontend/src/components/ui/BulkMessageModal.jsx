import React, { useState } from 'react';
import { Button, Card } from './Shared';
import { Send, X, MessageSquare, Mail } from 'lucide-react';

const BulkMessageModal = ({ isOpen, onClose }) => {
  const [type, setType] = useState('sms');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="w-full max-w-lg animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Send Bulk Communication</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4">
            <button
              onClick={() => setType('sms')}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                type === 'sms' 
                  ? 'border-primary-600 bg-primary-50 text-primary-600 dark:bg-primary-900/20' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="font-semibold">Bulk SMS</span>
            </button>
            <button
              onClick={() => setType('email')}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                type === 'email' 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span className="font-semibold">Bulk Email</span>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Message Content
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              placeholder={`Enter the message to send to all field officers via ${type.toUpperCase()}...`}
            />
            <p className="mt-2 text-xs text-slate-500 italic">
              * This message will be sent to all active field officers in your branch.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button className="flex-1 flex items-center justify-center gap-2" onClick={() => {
              alert('Message sent successfully!');
              onClose();
            }}>
              <Send className="w-4 h-4" />
              Send Now
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BulkMessageModal;
