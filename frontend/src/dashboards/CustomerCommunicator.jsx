import React, { useState, useEffect } from 'react';
import { Card, Button, Table } from '../components/ui/Shared';
import { loanService } from '../api/api';
import { MessageSquare, Calendar, Phone, User, Tag, Search, Send, Bell } from 'lucide-react';
import BulkCustomerSMSModal from '../components/ui/BulkCustomerSMSModal';
import { useDebounce } from '../hooks/useDebounce';

const CustomerCommunicator = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    useEffect(() => {
        setPage(1);
        fetchLogs(1, true);
    }, [debouncedSearch]);

    const fetchLogs = async (pageNum = 1, isReset = false) => {
        try {
            setLoading(true);
            const params = { page: pageNum, page_size: 10 };
            if (debouncedSearch) params.search = debouncedSearch;
            
            const data = await loanService.getSMSLogs(params);
            
            setHasMore(!!data.next);
            if (isReset) {
                setLogs(data.results || []);
            } else {
                setLogs(prev => [...prev, ...(data.results || [])]);
            }
        } catch (err) {
            console.error('Error fetching SMS logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'DEFAULTER': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'REPAID': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'NOTICE': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'AUTO': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Communication</h2>
                    <p className="text-slate-500 dark:text-slate-400">History of all SMS messages sent to customers</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-full md:w-64 text-sm"
                        />
                    </div>
                    <Button 
                        onClick={() => setIsBulkModalOpen(true)}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-xs"
                    >
                        <Send className="w-4 h-4" />
                        Send Batch SMS
                    </Button>
                </div>
            </div>

            <Card className="overflow-hidden">
                <Table
                  headers={['Recipient', 'Type', 'Message', 'Date/Time']}
                  data={logs}
                  maxHeight="max-h-[500px]"
                  renderRow={(log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <User className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">{log.recipient_name || 'Customer'}</p>
                                    <p className="text-xs text-slate-500">{log.recipient_phone}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getTypeColor(log.type)}`}>
                                {log.type}
                            </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs md:max-w-md">
                            <div className="flex items-start gap-2">
                                <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 md:line-clamp-none">
                                    {log.message}
                                </p>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Calendar className="w-3 h-3" />
                                {new Date(log.created_at).toLocaleString()}
                            </div>
                        </td>
                    </tr>
                  )}
                />

                {hasMore && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center bg-white dark:bg-slate-900">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const nextPage = page + 1;
                        setPage(nextPage);
                        fetchLogs(nextPage);
                      }}
                      disabled={loading}
                      className="px-8 font-black uppercase tracking-widest text-xs"
                    >
                      {loading ? 'Processing...' : 'Load More Logs'}
                    </Button>
                  </div>
                )}
            </Card>

            <BulkCustomerSMSModal 
                isOpen={isBulkModalOpen} 
                onClose={() => {
                    setIsBulkModalOpen(false);
                    fetchLogs(1, true); // Refresh logs
                }} 
            />
        </div>
    );
};

export default CustomerCommunicator;
