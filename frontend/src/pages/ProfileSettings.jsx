import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Button } from '../components/ui/Shared';
import { User, Mail, Shield, Smartphone, Lock, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import TwoFactorSetupModal from '../components/ui/TwoFactorSetupModal';
import DisableTwoFactorModal from '../components/ui/DisableTwoFactorModal';

const ProfileSettings = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  
  const is2FAEnabled = user?.admin?.is_two_factor_enabled || user?.is_two_factor_enabled;
  const userName = user?.admin?.full_name || user?.full_name || user?.name || 'User';
  const userEmail = user?.admin?.email || user?.email || '';
  const userPhone = user?.admin?.phone || user?.phone || 'Not provided';
  const userRole = user?.role || 'Staff';

  const [formData, setFormData] = useState({
    name: userName,
    phone: userPhone,
    email: userEmail,
  });

  const handleSave = () => {
    // In a real app, this would call an API
    alert('Settings saved successfully (Simulation)');
    setIsEditing(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Account Settings</h2>
          <p className="text-sm text-slate-500">Manage your profile information and security preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Profile Card */}
        <Card className="lg:col-span-1 h-fit flex flex-col items-center p-8">
          <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 dark:bg-primary-900/40 dark:text-primary-400 mb-4">
            <User className="w-12 h-12" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{userName}</h3>
          <p className="text-sm font-medium text-primary-600 mb-6 uppercase tracking-wider">{userRole.replace('_', ' ')}</p>
          
          <div className="w-full space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
             <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{userEmail}</span>
             </div>
             <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Shield className="w-4 h-4" />
                <span className="text-sm uppercase">{userRole} Access Control</span>
             </div>
          </div>
        </Card>

        {/* Right Column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-8">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Basic Information</h3>
               {!isEditing ? (
                 <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit Details</Button>
               ) : (
                 <div className="flex gap-2">
                   <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                   <Button onClick={handleSave}>Save Changes</Button>
                 </div>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                 <input 
                   disabled={!isEditing}
                   className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                   value={formData.name}
                   onChange={(e) => setFormData({...formData, name: e.target.value})}
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                 <input 
                   disabled 
                   className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 cursor-not-allowed"
                   value={formData.email}
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                 <div className="relative">
                   <Smartphone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                   <input 
                     disabled={!isEditing}
                     className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-200 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                     value={formData.phone}
                     onChange={(e) => setFormData({...formData, phone: e.target.value})}
                   />
                 </div>
               </div>
            </div>
          </Card>

          <Card className="p-8 border-t-4 border-t-amber-500">
             <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                Security & Verification
             </h3>
             <div className="space-y-6">
                <div className={`flex items-center justify-between p-4 rounded-xl border ${
                  is2FAEnabled 
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' 
                    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
                }`}>
                   <div className="flex items-center gap-4">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                         {is2FAEnabled ? (
                           <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                         ) : (
                           <Shield className="w-5 h-5 text-amber-600" />
                         )}
                      </div>
                      <div>
                         <p className={`text-sm font-bold uppercase tracking-tighter ${
                           is2FAEnabled ? 'text-emerald-900 dark:text-emerald-400' : 'text-amber-900 dark:text-amber-400'
                         }`}>
                           Two-Factor Auth: {is2FAEnabled ? 'ACTIVE' : 'INACTIVE'}
                         </p>
                         <p className={`text-xs ${
                           is2FAEnabled ? 'text-emerald-800 dark:text-emerald-500/80' : 'text-amber-800 dark:text-amber-500/80'
                         }`}>
                           {is2FAEnabled 
                             ? 'Your account is protected with TOTP verification' 
                             : 'Enhance your account security with an Authenticator App'
                           }
                         </p>
                      </div>
                   </div>
                   {is2FAEnabled ? (
                     <Button 
                       size="sm" 
                       variant="outline"
                       onClick={() => setShow2FADisable(true)} 
                       className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                     >
                       Disable
                     </Button>
                   ) : (
                     <Button 
                       size="sm" 
                       onClick={() => setShow2FASetup(true)} 
                       className="bg-amber-600 hover:bg-amber-700 border-none px-6"
                     >
                       Enable
                     </Button>
                   )}
                </div>

                <div className="flex items-center justify-between py-4 border-t border-slate-100 dark:border-slate-800">
                   <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Change Password</p>
                      <p className="text-xs text-slate-500">Last changed 3 months ago</p>
                   </div>
                   <Button variant="outline" size="sm">Update</Button>
                </div>
             </div>
          </Card>

          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
             <AlertCircle className="w-5 h-5 text-slate-400 shrink-0" />
             <p className="text-xs text-slate-500 italic">
                Sensitive account details (Role, Permissions) are managed by the System SuperAdmin. 
                Contact IT if you believe your access level is incorrect.
             </p>
          </div>
        </div>
      </div>

      <TwoFactorSetupModal 
        isOpen={show2FASetup} 
        onClose={() => setShow2FASetup(false)} 
        onStatusChange={(enabled) => updateUser({ is_two_factor_enabled: enabled })}
      />

      <DisableTwoFactorModal 
        isOpen={show2FADisable} 
        onClose={() => setShow2FADisable(false)} 
        onStatusChange={(enabled) => updateUser({ is_two_factor_enabled: enabled })}
      />
    </div>
  );
};

export default ProfileSettings;
