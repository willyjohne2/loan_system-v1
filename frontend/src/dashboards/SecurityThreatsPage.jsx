import React, { useEffect, useState, useMemo } from 'react';
import { loanService } from '../api/api';
import { useSecurityThreats, useInvalidate } from '../hooks/useQueries';
import { Card, Button, Table, Badge, StatCard } from '../components/ui/Shared';
import { 
  ShieldAlert, 
  XCircle, 
  Monitor, 
  Lock, 
  Search, 
  Filter, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Unlock,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';

const SecurityThreatsPage = () => {
    const { data: threatData, isLoading: loading, dataUpdatedAt } = useSecurityThreats();
    const { invalidateSecurityThreats } = useInvalidate();

    const lastUpdated = useMemo(() => {
        if (!dataUpdatedAt) return 0;
        return Math.floor((Date.now() - dataUpdatedAt) / 1000);
    }, [dataUpdatedAt]);

    const data = threatData;
    
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const handleUnlock = async (id) => {
        if (!window.confirm("Are you sure you want to unlock this account?")) return;
        try {
            await loanService.api.post(`/admins/${id}/unsuspend/`);
            toast.success("Account unlocked successfully");
            invalidateSecurityThreats();
        } catch (e) {
            toast.error("Failed to unlock account");
        }
    };

    const getThreatType = (action) => {
        const a = (action || '').toLowerCase();
        if (a.includes('failed login') || a.includes('invalid credentials')) return 'Failed Login';
        if (a.includes('new device')) return 'New Device';
        if (a.includes('ip mismatch')) return 'IP Mismatch';
        if (a.includes('lockout') || a.includes('locked out')) return 'Lockout';
        if (a.includes('password reset')) return 'Password Reset';
        return 'Other';
    };

    const getThreatStyles = (type) => {
        switch (type) {
            case 'Failed Login':   return "border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20";
            case 'New Device':     return "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20";
            case 'IP Mismatch':    return "border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950/20";
            case 'Lockout':        return "border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20";
            case 'Password Reset': return "border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20";
            default:               return "border-l-4 border-slate-300 bg-white dark:bg-slate-900";
        }
    };

    const getBadgeStyles = (type) => {
        switch (type) {
            case 'Failed Login':   return "bg-red-600 text-white";
            case 'New Device':     return "bg-blue-600 text-white";
            case 'IP Mismatch':    return "bg-purple-600 text-white";
            case 'Lockout':        return "bg-orange-500 text-white";
            case 'Password Reset': return "bg-yellow-500 text-white";
            default:               return "bg-slate-600 text-white";
        }
    };

    const processedEvents = useMemo(() => {
        if (!data?.threat_events) return [];
        let result = [...data.threat_events];

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(e => 
                (e.action || '').toLowerCase().includes(q) ||
                (e.admin_name || '').toLowerCase().includes(q) ||
                (e.admin_email || '').toLowerCase().includes(q)
            );
        }

        if (filterType !== 'ALL') {
            result = result.filter(e => getThreatType(e.action) === filterType);
        }

        if (dateFrom) {
            const start = new Date(dateFrom);
            start.setHours(0,0,0,0);
            result = result.filter(e => new Date(e.created_at) >= start);
        }
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23,59,59,999);
            result = result.filter(e => new Date(e.created_at) <= end);
        }

        return result;
    }, [data, search, filterType, dateFrom, dateTo]);

    if (loading && !data) return <div className="p-12 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-red-600 mb-4" /><p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Initializing Security Shield...</p></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-red-600" />
                        Security Threat Intelligence
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Real-time monitoring of system vulnerabilities and unauthorized access attempts.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => invalidateSecurityThreats()} disabled={loading} className="gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        Sync Shield
                    </Button>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                        Shield Status: Active
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    label="Total Threats" 
                    value={data?.summary?.total_threats || 0} 
                    icon={ShieldAlert} 
                    variant="danger" 
                />
                <StatCard 
                    label="Failed Logins" 
                    value={data?.summary?.failed_logins || 0} 
                    icon={XCircle} 
                    variant="warning" 
                />
                <StatCard 
                    label="New Device Logins" 
                    value={data?.summary?.new_device_logins || 0} 
                    icon={Monitor} 
                    variant="info" 
                />
                <StatCard 
                    label="Locked Accounts" 
                    value={data?.summary?.locked_accounts || 0} 
                    icon={Lock} 
                    variant="danger" 
                />
            </div>

            {/* Locked Accounts Section */}
            {data?.locked_accounts?.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-600 animate-pulse">
                        <AlertTriangle className="w-5 h-5" />
                        <h3 className="font-black uppercase tracking-wider text-sm">⚠ Currently Locked Accounts</h3>
                    </div>
                    <Card className="p-0 overflow-hidden border-red-200 dark:border-red-900/30">
                        <Table 
                            headers={['Name', 'Email', 'Role', 'Failed Attempts', 'Locked Until', 'Action']}
                            data={data.locked_accounts}
                            renderRow={(admin) => (
                                <tr key={admin.id} className="bg-red-50/30 dark:bg-red-950/10 border-b border-red-100 dark:border-red-900/20">
                                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{admin.full_name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{admin.email}</td>
                                    <td className="px-6 py-4">
                                        <Badge variant="secondary" className="text-[10px]">{admin.role}</Badge>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-black text-red-600">{admin.failed_login_attempts}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                                            <Clock className="w-3 h-3" />
                                            Unlocks {formatDistanceToNow(new Date(admin.lockout_until), { addSuffix: true })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button 
                                            size="sm" 
                                            variant="danger" 
                                            className="h-8 gap-2"
                                            onClick={() => handleUnlock(admin.id)}
                                        >
                                            <Unlock className="w-3 h-3" /> Unlock
                                        </Button>
                                    </td>
                                </tr>
                            )}
                        />
                    </Card>
                </div>
            )}

            {/* Threat Events Section */}
            <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4">
                   <div className="relative flex-1 min-w-[240px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search action or user..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500/20"
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select 
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-transparent border-none text-[10px] font-black uppercase focus:ring-0 outline-none cursor-pointer"
                        >
                            <option value="ALL">ALL THREAT TYPES</option>
                            <option value="Failed Login">Failed Login</option>
                            <option value="New Device">New Device</option>
                            <option value="IP Mismatch">IP Mismatch</option>
                            <option value="Lockout">Lockout</option>
                            <option value="Password Reset">Password Reset</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-700">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent border-none text-[10px] font-bold py-0.5" title="From Date" />
                        <span className="text-slate-300">|</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent border-none text-[10px] font-bold py-0.5" title="To Date" />
                    </div>

                    <div className="ml-auto flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase italic">
                        <Clock className="w-3 h-3" />
                        Last updated: {lastUpdated}s ago
                    </div>
                </div>

                <Card className="p-0 overflow-hidden border-none shadow-xl dark:bg-slate-900">
                    {processedEvents.length === 0 ? (
                        <div className="p-20 text-center space-y-4">
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-10 h-10 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">All Clear</h3>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto">No security threats detected in the currently selected parameters.</p>
                        </div>
                    ) : (
                        <Table 
                            headers={['Event', 'User', 'IP Address', 'Threat Type', 'Date & Time']}
                            data={processedEvents}
                            initialCount={10}
                            renderRow={(event) => {
                                const type = getThreatType(event.action);
                                return (
                                    <tr key={event.id} className={`${getThreatStyles(type)} transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0`}>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{event.action}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{event.admin_name || 'SYSTEM'}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{event.admin_email || 'CORE ENGINE'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-[11px] font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
                                                {event.ip_address || '127.0.0.1'}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`${getBadgeStyles(type)} text-[11px] font-bold uppercase px-3 py-1 rounded-full whitespace-nowrap shadow-sm`}>
                                                {type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">{format(new Date(event.created_at), 'dd MMM yyyy')}</p>
                                                <p className="text-[10px] text-slate-400 font-mono italic">{format(new Date(event.created_at), 'HH:mm:ss')}</p>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }}
                        />
                    )}
                </Card>
            </div>
        </div>
    );
};

export default SecurityThreatsPage;