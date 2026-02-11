import React, { useState, useEffect } from 'react';
import { Card, Button } from '../components/ui/Shared';
import { loanService } from '../api/api';
import { MessageSquare, Calendar, Phone, User, Tag, Search, Send } from 'lucide-react';
import BulkCustomerSMSModal from '../components/ui/BulkCustomerSMSModal';

const AdminSMSLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const data = await loanService.getSMSLogs();
            // Handle both DRF paginated and direct array responses
            const logsData = data?.results ? data.results : (Array.isArray(data) ? data : []);
            setLogs(logsData);
        } catch (err) {
            console.error('Error fetching SMS logs:', err);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const logsArray = Array.isArray(logs) ? logs : [];

    const filteredLogs = logsArray.filter(log => {
        const nameMatch = (log.recipient_name || 'Customer').toLowerCase().includes(searchTerm.toLowerCase());
        const phoneMatch = (log.recipient_phone || '').includes(searchTerm);
        const msgMatch = (log.message || '').toLowerCase().includes(searchTerm.toLowerCase());
        return nameMatch || phoneMatch || msgMatch;
    });

    const getTypeColor = (type) => {
        switch (type) {
            case 'DEFAULTER': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'REPAID': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'NOTICE': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'AUTO': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Communication Logs</h2>
                    <p className="text-slate-500 dark:text-slate-400">History of all SMS messages sent to customers</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-full md:w-64"
                        />
                    </div>
                    <Button 
                        onClick={() => setIsBulkModalOpen(true)}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700"
                    >
                        <Send className="w-4 h-4" />
                        New Message
                    </Button>
                </div>
            </div>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recipient</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Message</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date/Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {filteredLogs.length > 0 ? filteredLogs.map((log) => (
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
                            )) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                        No communication logs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <BulkCustomerSMSModal 
                isOpen={isBulkModalOpen} 
                onClose={() => {
                    setIsBulkModalOpen(false);
                    fetchLogs(); // Refresh logs after potentially sending new ones
                }} 
            />
        </div>
    );
};

export default AdminSMSLogs;
