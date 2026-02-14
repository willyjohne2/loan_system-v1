import React, { useState, useEffect } from 'react';
import { loanService } from '../api/api';
import { ShieldOff, CheckCircle, XCircle, Clock, Search, AlertTriangle, UserMinus } from 'lucide-react';
import { Card, Button, Badge, Table } from '../components/ui/Shared';

const AdminDeactivations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchRequests(1, true);
  }, []);

  const fetchRequests = async (pageNum = 1, isReset = false) => {
    try {
      setLoading(true);
      const data = await loanService.getDeactivationRequests({ page: pageNum, page_size: 10 });
      
      setHasMore(!!data.next);
      if (isReset) {
        setRequests(data.results || []);
      } else {
        setRequests(prev => [...prev, ...(data.results || [])]);
      }
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
      setPage(1);
      fetchRequests(1, true);
      alert(`Request ${status.toLowerCase()} successfully.`);
    } catch (err) {
      console.error(`Failed to ${status} request:`, err);
      alert(err.response?.data?.error || "Action failed.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldOff className="w-6 h-6 text-red-600" />
              Account Deactivation Requests
            </h3>
            <p className="text-sm text-slate-500">Security-sensitive requests submitted by Branch Managers</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setPage(1); fetchRequests(1, true); }}>Refresh List</Button>
        </div>

        <Table
          headers={['Target Officer', 'Requested By', 'Justification', 'Status', 'Actions']}
          data={requests}
          maxHeight="max-h-[500px]"
          renderRow={(req) => (
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
          )}
        />

        {hasMore && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center mt-4">
            <Button 
              variant="secondary" 
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchRequests(nextPage);
              }}
              disabled={loading}
              className="px-8 font-black uppercase tracking-widest text-xs"
            >
              {loading ? 'Processing...' : 'Load More Requests'}
            </Button>
          </div>
        )}
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
