import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Table, Button, Card, Badge } from '../components/ui/Shared';
import { UserPlus, Mail, Phone, CheckCircle, Edit, MapPin, XCircle, Save, Loader2 } from 'lucide-react';

const AdminManagers = () => {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingManager, setEditingManager] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    region: ''
  });

  const regions = ['Nairobi', 'Central', 'Coast', 'Eastern', 'North Eastern', 'Nyanza', 'Rift Valley', 'Western'];

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    try {
      const data = await loanService.getManagers();
      const managersList = data.results || data || [];
      setManagers(managersList);
      setError('');
    } catch (err) {
      console.error('[AdminManagers] Error fetching managers:', err);
      setError(`Failed to load managers: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (manager) => {
    setEditingManager(manager);
    setFormData({
      full_name: manager.full_name || '',
      email: manager.email || '',
      phone: manager.phone || '',
      region: manager.region || ''
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await loanService.updateAdmin(editingManager.id, formData);
      setEditingManager(null);
      fetchManagers();
    } catch (err) {
      alert('Failed to update manager: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Loading managers...</div>

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Regional Managers</h3>
          <p className="text-sm text-slate-500">Manage and oversee all regional administrators.</p>
        </div>
        <Button className="flex items-center">
          <UserPlus className="w-4 h-4 mr-2" />
          Register Manager
        </Button>
      </div>

      {managers.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p>No managers registered yet</p>
        </div>
      ) : (
        <Table
          headers={['Name', 'Contact', 'Region', 'Status', 'Actions']}
          data={managers}
          renderRow={(manager) => (
            <tr key={manager.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold mr-3">
                    {manager.full_name?.[0] || 'M'}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{manager.full_name}</p>
                    <p className="text-xs text-slate-500">{manager.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col space-y-1 text-xs text-slate-500">
                  <span className="flex items-center"><Mail className="w-3 h-3 mr-1" /> {manager.email}</span>
                  <span className="flex items-center"><Phone className="w-3 h-3 mr-1" /> {manager.phone || '-'}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center text-slate-600 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
                  <span className="text-sm font-medium">{manager.region || 'Unassigned'}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <Badge variant={manager.is_verified ? 'success' : 'warning'}>
                  {manager.is_verified ? 'Verified' : 'Pending'}
                </Badge>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="flex items-center p-2"
                    onClick={() => startEdit(manager)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    className="flex items-center p-2"
                    onClick={() => {
                        if(confirm('Are you sure you want to delete this manager?')) {
                            loanService.deleteAdmin(manager.id).then(() => fetchManagers());
                        }
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          )}
        />
      )}

      {/* Edit Manager Modal */}
      {editingManager && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setEditingManager(null)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              <XCircle className="w-6 h-6 text-slate-400" />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Edit className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">Update Manager Profile</h3>
              <p className="text-slate-500 text-sm">Modify account details and regional assignment</p>
            </div>

            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Full Name</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Phone Number</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Regional Assignment</label>
                <select 
                  className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
                  value={formData.region}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                >
                  <option value="">Select a region...</option>
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  type="button" 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => setEditingManager(null)}
                >
                  Cancel
                </Button>
                <Button 
                  disabled={saving}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminManagers;
