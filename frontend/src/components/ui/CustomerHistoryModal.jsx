import React, { useEffect, useState } from 'react';
import { loanService } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Table } from '../ui/Shared';
import { X, TrendingUp, TrendingDown, Clock, CheckCircle, FileText, Wallet, User, AlertCircle, Calendar, Eye } from 'lucide-react';

const CustomerHistoryModal = ({ customer, isOpen, onClose, loanToVerify, onVerified }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [stats, setStats] = useState({
    totalBorrowed: 0,
    totalPaid: 0,
    activeCount: 0,
    lastPaymentDate: null
  });
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen && customer) {
      fetchHistory();
    }
  }, [isOpen, customer]);

  const handleVerify = async () => {
    if (!loanToVerify) return;
    
    // Determine target status based on role
    const userRole = user?.role?.toUpperCase() || user?.admin?.role?.toUpperCase();
    let targetStatus = 'VERIFIED'; // Default to manager level
    
    if (userRole === 'FIELD_OFFICER') {
        targetStatus = 'FIELD_VERIFIED';
    } else if (userRole === 'MANAGER' || userRole === 'ADMIN') {
        // If it's already manager verified, we might be re-verifying
        targetStatus = 'VERIFIED';
    }

    if (loanToVerify.status === targetStatus && (userRole === 'MANAGER' || userRole === 'ADMIN')) {
        if (!window.confirm("This loan is already verified. Do you want to re-verify? (This action will be logged)")) {
            return;
        }
    }

    setUpdating(true);
    try {
      await loanService.api.patch(`/loans/${loanToVerify.id}/`, { 
        status: targetStatus,
        status_change_reason: `Verified by ${user.full_name || 'Staff'} (${userRole})`
      });
      setSuccessMessage(
        userRole === 'FIELD_OFFICER'
          ? 'Loan has been submitted for manager review.'
          : (userRole === 'MANAGER' || userRole === 'ADMIN')
            ? 'Loan has been verified and pushed to finance for approval and disbursement.'
            : 'Loan status updated successfully.'
      );
      setVerificationSuccess(true);
      onVerified?.();
      setTimeout(() => {
        setVerificationSuccess(false);
        setSuccessMessage('');
        onClose();
      }, 2000);
    } catch (err) {
      alert("Verification failed: " + (err.response?.data?.error || err.message));
    } finally {
      setUpdating(false);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const [loanData, repaymentData] = await Promise.all([
        loanService.api.get('/loans/'),
        loanService.api.get('/repayments/')
      ]);

      const allLoans = loanData.data.results || loanData.data || [];
      const allRepayments = repaymentData.data.results || repaymentData.data || [];

      // Filter for this specific user
      const userLoans = allLoans.filter(l => {
        const userId = typeof l.user === 'object' ? l.user.id : l.user;
        return userId === customer.id;
      });
      
      const userRepayments = allRepayments.filter(r => {
          // Check if repayment is linked to one of these user's loans
          return userLoans.some(ul => ul.id === r.loan);
      });

      const parseVal = (v) => {
        const n = parseFloat(v);
        return isFinite(n) ? n : 0;
      };

      const totalBorrowed = userLoans.reduce((acc, l) => acc + parseVal(l.principal_amount), 0);
      const totalRepayable = userLoans.reduce((acc, l) => acc + parseVal(l.total_repayable_amount), 0);
      const totalPaid = userRepayments.reduce((acc, r) => acc + parseVal(r.amount_paid), 0);
      const activeCount = userLoans.filter(l => ['AWARDED', 'APPROVED', 'DISBURSED', 'ACTIVE', 'OVERDUE'].includes(l.status)).length;
      
      const lastPayment = userRepayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];

      setLoans(userLoans);
      setRepayments(userRepayments);
      setStats({
        totalBorrowed,
        totalRepayable,
        totalPaid,
        activeCount,
        lastPaymentDate: lastPayment ? lastPayment.payment_date : null
      });
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to load history trace. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 bg-white dark:bg-slate-900 border-none shadow-2xl">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{customer.full_name}</h3>
            <p className="text-xs text-slate-500 font-mono">Customer ID: {customer.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 text-slate-900 dark:text-slate-100">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                <p className="text-slate-500 text-sm animate-pulse">Retrieving financial history...</p>
             </div>
          ) : error ? (
            <div className="py-20 text-center space-y-4">
               <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 max-w-md mx-auto">
                 {error}
               </div>
               <Button onClick={fetchHistory}>Try Again</Button>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                  <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-2 font-black text-[10px] uppercase tracking-widest">
                    <Wallet className="w-3.5 h-3.5" />
                    Total Borrowed
                  </div>
                  <p className="text-xl font-black text-slate-900 dark:text-white">KES {stats.totalBorrowed.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-2 font-black text-[10px] uppercase tracking-widest">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Total Repaid
                  </div>
                  <p className="text-xl font-black text-slate-900 dark:text-white">KES {stats.totalPaid.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-900/50">
                  <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-2 font-black text-[10px] uppercase tracking-widest">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Remaining Debt
                  </div>
                  <p className="text-xl font-black text-slate-900 dark:text-white">KES {Math.max(0, stats.totalRepayable - stats.totalPaid).toLocaleString()}</p>
                </div>
                
                {/* Visual Identity Verification */}
                <div className="lg:col-span-2 space-y-2">
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1 flex items-center gap-2">
                    <User className="w-3 h-3" />
                    Identity Comparison (Photo vs ID Scan)
                  </span>
                  <div className="flex gap-3 h-[180px]">
                    {customer.profile?.profile_image ? (
                      <div 
                        className="h-full aspect-square rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all group relative bg-white"
                        onClick={() => setSelectedImage(customer.profile.profile_image.startsWith('http') ? customer.profile.profile_image : `${loanService.api.defaults.baseURL.replace('/api', '')}${customer.profile.profile_image}`)}
                        title="Click to expand Profile Image"
                      >
                          <img 
                            src={customer.profile.profile_image.startsWith('http') ? customer.profile.profile_image : `${loanService.api.defaults.baseURL.replace('/api', '')}${customer.profile.profile_image}`} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-6 h-6 text-white" />
                          </div>
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold">Live Photo</div>
                      </div>
                    ) : (
                      <div className="h-full aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed">
                          <User className="w-6 h-6" />
                          <span className="text-[8px] font-black mt-1">NO PHOTO</span>
                      </div>
                    )}
                    
                    {customer.profile?.national_id_image ? (
                      <div 
                        className="flex-1 h-full rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 relative group cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all bg-white"
                        onClick={() => setSelectedImage(customer.profile.national_id_image.startsWith('http') ? customer.profile.national_id_image : `${loanService.api.defaults.baseURL.replace('/api', '')}${customer.profile.national_id_image}`)}
                        title="Click to expand National ID"
                      >
                          <img 
                            src={customer.profile.national_id_image.startsWith('http') ? customer.profile.national_id_image : `${loanService.api.defaults.baseURL.replace('/api', '')}${customer.profile.national_id_image}`} 
                            alt="ID" 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <div className="flex flex-col items-center gap-1">
                                <Eye className="w-6 h-6 text-white" />
                                <span className="text-[10px] text-white font-bold uppercase tracking-wider bg-black/50 px-2 py-1 rounded">Compare ID Scan</span>
                            </div>
                          </div>
                          <div className="absolute bottom-1 right-1 bg-primary-600/80 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold">National ID Scan</div>
                      </div>
                    ) : (
                      <div className="flex-1 h-full rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200">
                        <AlertCircle className="w-6 h-6" />
                        <span className="text-[10px] font-bold">MISSING ID IMAGE</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Image Lightbox */}
              {selectedImage && (
                <div 
                  className="fixed inset-0 z-[1001] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
                  onClick={() => setSelectedImage(null)}
                >
                  <Button variant="ghost" className="absolute top-4 right-4 text-white hover:bg-white/10" onClick={() => setSelectedImage(null)}>
                    <X className="w-8 h-8" />
                  </Button>
                  <img src={selectedImage} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95" />
                </div>
              )}

              {/* Profile Deep Dive - Expanded with more details */}
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white px-1">
                  <User className="w-4 h-4 text-primary-600" />
                  Customer Verification Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-base">{customer.full_name}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">National ID No</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-base">{customer.profile?.national_id || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone & Email</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      {customer.phone}
                      {customer.email && <span className="block text-[11px] font-medium text-slate-500">{customer.email}</span>}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location Info</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {customer.profile?.branch || 'No Branch'} - {customer.profile?.town || 'No Town'}
                      <span className="block text-[10px] font-medium text-slate-500 italic">Village: {customer.profile?.village || 'N/A'}</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employment</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {customer.profile?.employment_status || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Income</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                      KES {Number(customer.profile?.monthly_income || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="md:col-span-2 lg:col-span-3 space-y-1 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address/Landmarks</span>
                    <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                      {customer.profile?.address || 'No detailed address provided.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lists */}
              <div className="space-y-8">
                <div>
                   <h4 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white mb-4">
                      <FileText className="w-4 h-4 text-primary-600" />
                      Loan Registry
                   </h4>
                   {loans.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm italic">
                         No loan applications found for this customer.
                      </div>
                   ) : (
                    <Table
                      headers={['Date', 'Product', 'Principal', 'Repayable', 'Status']}
                      data={loans}
                      renderRow={(loan) => (
                        <tr key={loan.id} className="text-sm border-b dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{new Date(loan.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4 font-medium uppercase text-[10px] text-slate-500">{loan.product_name}</td>
                          <td className="px-6 py-4 font-bold">KES {Number(loan.principal_amount).toLocaleString()}</td>
                          <td className="px-6 py-4 font-black text-indigo-600 dark:text-indigo-400">KES {Number(loan.total_repayable_amount).toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                              loan.status === 'AWARDED' || loan.status === 'DISBURSED' || loan.status === 'APPROVED' || loan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                              loan.status === 'REJECTED' || loan.status === 'OVERDUE' ? 'bg-rose-100 text-rose-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {loan.status}
                            </span>
                          </td>
                        </tr>
                      )}
                    />
                   )}
                </div>

                <div>
                   <h4 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white mb-4">
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                      Repayment Log
                   </h4>
                   {repayments.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm italic">
                         No payments recorded yet.
                      </div>
                   ) : (
                    <Table
                      headers={['Date', 'Amount', 'Reference', 'Mode']}
                      data={repayments}
                      renderRow={(rep) => (
                        <tr key={rep.id} className="text-sm border-b dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">{new Date(rep.payment_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 font-bold text-emerald-600">KES {Number(rep.amount_paid).toLocaleString()}</td>
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-500 uppercase">{rep.reference_code || 'N/A'}</td>
                          <td className="px-6 py-4 text-[10px] font-black uppercase tracking-tighter text-slate-500">{rep.payment_method}</td>
                        </tr>
                      )}
                    />
                   )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            {verificationSuccess ? (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-lg border border-emerald-100 dark:border-emerald-900/50 animate-in zoom-in duration-300">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold text-sm">Loan Verified Successfully!</span>
              </div>
            ) : loanToVerify && (
              <div className="flex items-center gap-3">
                 <div className="hidden sm:block">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Reviewing Loan</p>
                   <p className="text-sm font-bold text-indigo-600">KES {Number(loanToVerify.principal_amount).toLocaleString()}</p>
                 </div>
                 <Button
                  onClick={handleVerify}
                  disabled={updating}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl mt-4"
                >
                  {updating ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {getVerifyButtonLabel()}
                </Button>
              </div>
            )}
          </div>
          <Button onClick={onClose} variant="secondary" className="px-8">Close Trail</Button>
        </div>
      </Card>

      {/* Full-screen Image Viewer Overlay */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={selectedImage} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain border-4 border-white/10"
            />
            <button 
              className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(null);
                }}
            >
              <X className="w-8 h-8" />
            </button>
            <p className="absolute -bottom-8 left-0 right-0 text-center text-white/60 text-sm font-mono tracking-widest uppercase">
              Click anywhere to close preview
            </p>
          </div>
        </div>
      )}
      {verificationSuccess && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Success!</div>
            <div className="text-sm text-slate-700 dark:text-slate-300 text-center">
              {successMessage || 'Action completed successfully.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerHistoryModal;

