import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  FileBox, 
  History, 
  Hourglass,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';
import { Card, Table, Button } from '../../components/ui/Shared';
import { loanService } from '../../api/api';
import toast from 'react-hot-toast';

const FinanceReports = () => {
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);

  const reports = [
    { id: 'trial_balance', label: 'Trial Balance', icon: ClipboardList },
    { id: 'cashbook', label: 'Cashbook', icon: FileBox },
    { id: 'collection_log', label: 'Collection Log', icon: History },
    { id: 'aging_report', label: 'Aging Report', icon: Hourglass },
  ];

  const fetchReport = async (reportId) => {
    setLoading(true);
    setActiveReport(reportId);
    try {
      const analytics = await loanService.getFinancialAnalytics();
      setReportData(analytics[reportId] || []);
    } catch (err) {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const formatKES = (val) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Financial Reports</h2>
        <p className="text-sm text-slate-500 mt-1">Audit and reconciliation tools</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {reports.map((report) => (
          <button 
            key={report.id}
            onClick={() => fetchReport(report.id)}
            className={`p-6 rounded-xl border transition-all text-left flex flex-col gap-4 group ${
              activeReport === report.id 
                ? 'bg-primary-50 border-primary-500' 
                : 'bg-white border-slate-200 hover:border-primary-300'
            }`}
          >
            <div className={`p-3 rounded-lg w-fit transition-colors ${
              activeReport === report.id 
                ? 'bg-primary-600 text-white' 
                : 'bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-600'
            }`}>
              <report.icon className="w-6 h-6" />
            </div>
            <div>
              <p className={`font-bold ${activeReport === report.id ? 'text-primary-900' : 'text-slate-900'}`}>
                {report.label}
              </p>
              <p className="text-xs text-slate-500 mt-1">View financial details</p>
            </div>
          </button>
        ))}
      </div>

      {activeReport && (
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">{activeReport.replace('_', ' ')}</h3>
            <Button variant="secondary" className="px-3 py-1 text-xs flex items-center gap-2">
              <FileText className="w-3 h-3" />
              Export PDF
            </Button>
          </div>
          
          {activeReport === 'aging_report' ? (
            <Table
              headers={['Customer', 'Principal', 'Days Overdue', 'Balance', 'Status']}
              data={reportData}
              renderRow={(row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                  <td className="px-6 py-4 text-slate-600">{formatKES(row.principal)}</td>
                  <td className="px-6 py-4 text-rose-600 font-bold">{row.days_overdue} days</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{formatKES(row.balance)}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">OVERDUE</span>
                  </td>
                </tr>
              )}
            />
          ) : activeReport === 'collection_log' ? (
            <Table
              headers={['Date', 'Customer', 'Reference', 'Amount', 'Method']}
              data={reportData}
              renderRow={(row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-500">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{row.customer}</td>
                  <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">{row.reference}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">{formatKES(row.amount)}</td>
                  <td className="px-6 py-4 text-slate-500">{row.method}</td>
                </tr>
              )}
            />
          ) : (
            <Table
              headers={['Ledger Item', 'Debit (KES)', 'Credit (KES)', 'Balance (KES)']}
              data={reportData}
              renderRow={(row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{row.item}</td>
                  <td className="px-6 py-4 text-rose-600 font-mono">{row.debit > 0 ? formatKES(row.debit) : '-'}</td>
                  <td className="px-6 py-4 text-emerald-600 font-mono">{row.credit > 0 ? formatKES(row.credit) : '-'}</td>
                  <td className="px-6 py-4 font-bold text-slate-900 font-mono">{formatKES(row.balance)}</td>
                </tr>
              )}
            />
          )}

          {reportData.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <div className="p-4 bg-slate-50 rounded-full">
                <FileBox className="w-12 h-12 text-slate-300" />
              </div>
              <div>
                <p className="font-bold text-slate-900">No report data found</p>
                <p className="text-sm text-slate-500 mt-1">Try refreshing or adjusting your search criteria</p>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default FinanceReports;
