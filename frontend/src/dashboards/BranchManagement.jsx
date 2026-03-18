import React, { useState, useEffect } from 'react';
import { loanService } from '../api/api';
import { Card, Button, Input, Badge } from '../components/ui/Shared';
import { 
  Building2, 
  Plus, 
  MapPin, 
  Phone, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Search,
  Users,
  Wallet,
  Building,
  ArrowRight
} from 'lucide-react';
import { clsx } from 'clsx';

const BranchManagement = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    contact_phone: '',
    is_active: true
  });

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const data = await loanService.getBranches();
      // data might be wrapped in a pagination object { results: [], count: 0 }
      setBranches(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      console.error("Failed to fetch branches", err);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenModal = (branch = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        location: branch.location || '',
        contact_phone: branch.contact_phone || '',
        is_active: branch.is_active
      });
    } else {
      setEditingBranch(null);
      setFormData({
        name: '',
        location: '',
        contact_phone: '',
        is_active: true
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await loanService.updateBranch(editingBranch.id, formData);
      } else {
        await loanService.createBranch(formData);
      }
      setShowModal(false);
      fetchBranches();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save branch");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this branch? It must not have any associated records.")) return;
    try {
      await loanService.deleteBranch(id);
      fetchBranches();
    } catch (err) {
      alert(err.response?.data?.[0] || "Failed to delete branch");
    }
  };

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary-600" />
            Branch Management
          </h1>
          <p className="text-slate-500 text-sm font-medium">Configure operational units and regional headquarters</p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => handleOpenModal()}
          className="shadow-lg shadow-primary-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Branch
        </Button>
      </div>

      <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-4">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search branches..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <Badge variant="outline" className="hidden sm:flex">
             {branches.length} Registered Units
           </Badge>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              <Building className="w-12 h-12 mx-auto mb-4 animate-pulse opacity-20" />
              Loading system entities...
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              No branches found matching your search.
            </div>
          ) : (
            filteredBranches.map(branch => (
              <div key={branch.id} className="p-4 sm:p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={clsx(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                      branch.is_active ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600" : "bg-slate-100 text-slate-400"
                    )}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-slate-800 dark:text-white text-lg">{branch.name}</h3>
                        {!branch.is_active && (
                          <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 py-0.5">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {branch.location || 'No location set'}</span>
                        <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {branch.contact_phone || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:border-l sm:border-slate-100 sm:dark:border-slate-800 sm:pl-6">
                    <div className="grid grid-cols-3 gap-2 mr-2">
                       <div className="text-center px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Staff</p>
                          <p className="font-black text-slate-700 dark:text-slate-200">{branch.admin_count}</p>
                       </div>
                       <div className="text-center px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Users</p>
                          <p className="font-black text-slate-700 dark:text-slate-200">{branch.customer_count}</p>
                       </div>
                       <div className="text-center px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Loans</p>
                          <p className="font-black text-slate-700 dark:text-slate-200">{branch.loan_count}</p>
                       </div>
                    </div>

                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleOpenModal(branch)}
                        className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all active:scale-95"
                        title="Edit Branch"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                         onClick={() => handleDelete(branch.id)}
                         className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-95"
                         title="Delete Branch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                {editingBranch ? <Edit2 className="w-5 h-5 text-primary-600" /> : <Plus className="w-6 h-6 text-primary-600" />}
                {editingBranch ? 'Edit Branch' : 'Register New Branch'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Branch Name</label>
                <Input 
                  required
                  placeholder="e.g., Nairobi Central"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-slate-50 dark:bg-slate-900 border-none ring-1 ring-slate-200 dark:ring-slate-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Physical Location</label>
                <textarea 
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-lg text-sm min-h-[80px] focus:ring-2 focus:ring-primary-500/50 transition-all text-slate-800 dark:text-white"
                  placeholder="Street name, Building, Town..."
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Contact Phone</label>
                <Input 
                  placeholder="e.g., +254 7XX XXX XXX"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                  className="bg-slate-50 dark:bg-slate-900 border-none ring-1 ring-slate-200 dark:ring-slate-700"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <input 
                  type="checkbox"
                  id="is_active"
                  className="w-5 h-5 rounded-md border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                />
                <label htmlFor="is_active" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Branch is operational and active
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex-1 shadow-lg shadow-primary-500/20"
                >
                  {editingBranch ? 'Update Record' : 'Create Branch'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BranchManagement;
