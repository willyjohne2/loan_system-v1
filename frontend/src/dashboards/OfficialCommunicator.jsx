import React, { useState, useEffect } from 'react';
import { Card, Button, Table } from '../components/ui/Shared';
import { loanService } from '../api/api';
import { Mail, Calendar, User, Search, Send, Bell, Eye, X } from 'lucide-react';
import DirectEmailModal from '../components/ui/DirectEmailModal';
import useDebounce from '../hooks/useDebounce';

const EmailDetailModal = ({ isOpen, onClose, log }) => {
    if (!isOpen || !log) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Email Details</h3>
                            <p className="text-xs text-slate-500">Sent on {new Date(log.created_at).toLocaleString()}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <p className="text-slate-400 mb-1">From (Sender)</p>
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{log.sender_name || 'System'}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <p className="text-slate-400 mb-1">To (Recipient)</p>
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{log.recipient_name} ({log.recipient_email})</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Subject</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{log.subject}</p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Message Body</p>
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                            {log.message?.includes('<html>') || log.message?.includes('<p>') ? (
                                <div 
                                    className="prose prose-sm dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: log.message }} 
                                />
                            ) : (
                                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                    {log.message}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
                    <Button onClick={onClose} variant="primary" className="px-8 bg-slate-900 dark:bg-white dark:text-slate-900">
                        Close Preview
                    </Button>
                </div>
            </div>
        </div>
    );
};

const OfficialCommunicator = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
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
            
            const data = await loanService.getEmailLogs(params);
            
            setHasMore(!!data.next);
            if (isReset) {
                setLogs(data.results || []);
            } else {
                setLogs(prev => [...prev, ...(data.results || [])]);
            }
        } catch (err) {
            console.error('Error fetching Email logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const stripHtml = (html) => {
        if (!html) return "";
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    const getPreviewText = (text) => {
        if (!text) return "";
        const cleanText = text.includes('<') ? stripHtml(text) : text;
        const words = cleanText.trim().split(/\s+/);
        if (words.length <= 10) return cleanText;
        return words.slice(0, 10).join(" ") + "...";
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Official Communication</h2>
                    <p className="text-slate-500 dark:text-slate-400">History of all emails sent to staff members</p>
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
                        variant="primary"
                        onClick={() => setIsSystemModalOpen(true)}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-xs"
                    >
                        <Send className="w-4 h-4" />
                        Send System Email
                    </Button>
                </div>
            </div>

            <Card className="overflow-hidden">
                <Table
                  headers={['Sender', 'Recipient', 'Subject', 'Message', 'Date/Time', 'Action']}
                  data={logs}
                  maxHeight="max-h-[500px]"
                  renderRow={(log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{log.sender_name || 'System'}</p>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <User className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">{log.recipient_name || 'Staff'}</p>
                                    <p className="text-xs text-slate-500">{log.recipient_email}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{log.subject}</p>
                        </td>
                        <td className="px-6 py-4 max-w-[200px]">
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                {getPreviewText(log.message)}
                            </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Calendar className="w-3 h-3" />
                                {new Date(log.created_at).toLocaleString()}
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedLog(log)}
                                className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                            >
                                <Eye className="w-4 h-4" />
                                Details
                            </Button>
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

            <EmailDetailModal 
                isOpen={!!selectedLog} 
                onClose={() => setSelectedLog(null)} 
                log={selectedLog} 
            />

            <DirectEmailModal
                isOpen={isSystemModalOpen}
                onClose={() => {
                    setIsSystemModalOpen(false);
                    fetchLogs(1, true); // Refresh
                }}
                bulk={true}
                targetGroup="STAFF"
            />
        </div>
    );
};

export default OfficialCommunicator;
