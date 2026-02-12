import React, { useState, useEffect } from 'react';
import { loanService } from '../api/api';
import { ShieldOff, CheckCircle, XCircle, Clock, Search, AlertTriangle, UserMinus } from 'lucide-react';
import { Card, Button, Badge } from '../components/ui/Shared';

const AdminDeactivations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await loanService.getDeactivationRequests();
      setRequests(data.results || data);
    } catch (err) {
      console.error("Failed to fetch deactivation requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, req, status) => {
    if (status === 'APPROVED') {
       if (!window.confirm(`Are you sure you want to deactivate ${req.officer_name}? They will be immediately logged out.`)) {
         return;
       }
    }
    
    setProcessingId(id);
    try {
      await loanService.updateDeactivationRequest(id, { status });
      fetchRequests();
      alert(`Request ${status.toLowerCase()} successfully.`);
    } catch (err) {
      console.error(`Failed to ${status} request:`, err);
      alert(err.response?.data?.error || "Action failed.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && requests.length === 0) return <div className="p-12 text-center">Loading requests...</div>;

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldOff className="w-6 h-6 text-red-600" />
              Account Deactivation Requests
            </h3>
            <p className="text-sm text-slate-500">Security-sensitive requests submitted by Regional Managers</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests}>Refresh List</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Target Officer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Requested By</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Justification</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.length > 0 ? (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{req.officer_name}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{req.officer_email}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700 dark:text-slate-300">{req.requested_by_name}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(req.created_at).toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm italic">"{req.reason}"</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={
                        req.status === 'PENDING' ? 'warning' :
                        req.status === 'APPROVED' ? 'danger' : 'success'
                      }>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                          <button 
                            disabled={processingId === req.id}
                            onClick={() => handleAction(req.id, req, 'REJECTED')}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 rounded-lg transition-colors"
                            title="Reject Request"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleAction(req.id, req, 'APPROVED')}
                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-red-100"
                            title="Approve & Deactivate"
                          >
                            <ShieldOff className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Finalized</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 italic">No deactivation requests found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6 bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30">
        <div className="flex gap-4">
          <AlertTriangle className="w-8 h-8 text-red-600 shrink-0" />
          <div>
            <h4 className="font-bold text-red-900 dark:text-red-400">Policy Reminder</h4>
            <p className="text-sm text-red-800 dark:text-red-300 mt-1">
              Approving a deactivation request will immediately lock the officer's account and invalidate all active sessions. 
              This action is logged in the audit trail of the regional manager and the approving administrator.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminDeactivations;
