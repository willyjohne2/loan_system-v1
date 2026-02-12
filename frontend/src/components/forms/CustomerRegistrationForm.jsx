import React, { useState, useEffect } from 'react';
import { loanService } from '../../api/api';
import { Button, Card } from '../ui/Shared';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  CreditCard,
  AlertCircle,
  Search,
  AlertTriangle,
  Camera,
  Upload,
  X
} from 'lucide-react';

const CustomerRegistrationForm = ({ onSuccess, onApplyLoan }) => {
  const [step, setStep] = useState(0); // Start at 0 for search
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [hasOutstanding, setHasOutstanding] = useState(false);
  const [existingUserId, setExistingUserId] = useState(null);
  const [error, setError] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [loanProducts, setLoanProducts] = useState([]);
  const [outstandingLoanDetails, setOutstandingLoanDetails] = useState(null);

  const regions = [
    'Mwea East', 'Mwea West', 'Kirinyaga Central', 'Kirinyaga East (Gichugu)', 
    'Kirinyaga West (Ndiao)', 'Kerugoya Town', 'Sagana', 'Kutus', 'Kagio', 'Wang\'uru'
  ];

  const counties = ['Kirinyaga'];
  
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    full_name: '',
    phone: '',
    email: '',
    
    // Step 2: User Details (Profile)
    national_id: '',
    date_of_birth: '',
    region: '',
    county: 'Kirinyaga',
    town: '',
    village: '',
    address: '',
    
    // Step 3: Salary & Income
    employment_status: 'EMPLOYED',
    monthly_income: '',

    // Step 4: Verification Images
    profile_image: null,
    national_id_image: null,
    agreed_to_terms: false,
  });

  const [profilePreview, setProfilePreview] = useState(null);
  const [idPreview, setIdPreview] = useState(null);

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      const file = files[0];
      setFormData(prev => ({ ...prev, [name]: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        if (name === 'profile_image') setProfilePreview(reader.result);
        if (name === 'national_id_image') setIdPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    setError('');
    try {
      const resp = await loanService.api.get(`/users/check/?q=${searchQuery}`);
      const data = resp.data;
      
      if (data.found) {
        setIsExistingUser(true);
        setExistingUserId(data.user.id);
        setHasOutstanding(data.has_outstanding_loan);
        setOutstandingLoanDetails(data.outstanding_loan);
        
        // Pre-fill form
        setFormData({
          ...formData,
          full_name: data.user.full_name,
          phone: data.user.phone,
          email: data.user.email || '',
          national_id: data.user.profile?.national_id || '',
          date_of_birth: data.user.profile?.date_of_birth || '',
          region: data.user.profile?.region || '',
          county: data.user.profile?.county || '',
          town: data.user.profile?.town || '',
          village: data.user.profile?.village || '',
          address: data.user.profile?.address || '',
          employment_status: data.user.profile?.employment_status || 'EMPLOYED',
          monthly_income: data.user.profile?.monthly_income || '',
        });
        
        setStep(1); // Go to verification/edit step
      } else {
        setIsExistingUser(false);
        setExistingUserId(null);
        setHasOutstanding(false);
        setError('No record found. Proceed to fresh registration.');
        setTimeout(() => {
          setFormData({ ...formData, national_id: searchQuery.length > 5 ? searchQuery : '', phone: searchQuery.length <= 10 ? searchQuery : '' });
          setStep(1);
        }, 1500);
      }
    } catch (error) {
      console.error('Customer lookup error:', error);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchLoanProducts = async () => {
      try {
        const data = await loanService.getLoanProducts?.();
        // Fallback if loanService.getLoanProducts doesn't exist yet
        setLoanProducts(data?.results || data || []);
      } catch (err) {
        console.error('Failed to fetch loan products:', err);
      }
    };
    fetchLoanProducts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const nextStep = () => {
    // Basic validation for each step
    if (step === 1 && (!formData.full_name || !formData.phone)) {
      setError('Please fill in name and phone');
      return;
    }
    if (step === 2 && (!formData.national_id || !formData.region || !formData.county || !formData.town)) {
      setError('Please fill in essential residential details');
      return;
    }
    setError('');
    setStep(prev => prev + 1);
  };
  const prevStep = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = new FormData();
      data.append('full_name', formData.full_name);
      data.append('phone', formData.phone);
      if (formData.email) data.append('email', formData.email);
      
      // Profile Details
      data.append('national_id', formData.national_id);
      if (formData.date_of_birth) data.append('date_of_birth', formData.date_of_birth);
      data.append('region', formData.region);
      data.append('county', formData.county);
      data.append('town', formData.town);
      data.append('village', formData.village);
      data.append('address', formData.address);
      data.append('employment_status', formData.employment_status);
      if (formData.monthly_income) data.append('monthly_income', formData.monthly_income);

      if (formData.profile_image instanceof File) {
        data.append('profile_image', formData.profile_image);
      }
      if (formData.national_id_image instanceof File) {
        data.append('national_id_image', formData.national_id_image);
      }

      let userRes;
      if (isExistingUser && existingUserId) {
        userRes = await loanService.api.patch(`/users/${existingUserId}/`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        userRes = await loanService.api.post('/users/', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setRegisteredUser(userRes.data);
      setIsFinished(true);
    } catch (err) {
      let errorMessage = 'Failed to process registration';
      
      if (err?.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else {
          // Handle DRF field errors
          const fieldErrors = Object.entries(err.response.data)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`)
            .join(' | ');
          if (fieldErrors) errorMessage = fieldErrors;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error('Registration/Update failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="max-w-md mx-auto py-10">
            <h2 className="text-xl font-bold text-gray-800 mb-2 text-center flex items-center justify-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              Customer Lookup
            </h2>
            <p className="text-gray-600 mb-6 text-center text-sm">
              Search by National ID or Phone Number to check history.
            </p>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="ID or Phone..."
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-medium"
              >
                {loading ? '...' : <Search className="w-5 h-5" />}
              </button>
            </div>
            {error && (
              <div className={`mt-4 p-3 rounded-lg text-sm text-center ${error.includes('No record') ? 'bg-yellow-50 text-yellow-800 border border-yellow-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                {error}
              </div>
            )}
            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <button
                onClick={() => {
                  setError('');
                  setStep(1);
                  setIsExistingUser(false);
                }}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                Skip & Register New Customer →
              </button>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            {isExistingUser && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3 mb-4 animate-in fade-in slide-in-from-top-2">
                <div className="text-xs text-blue-800">
                  <span className="font-bold block text-sm">Customer Record Found!</span>
                  You can update their profile below or jump straight to loan application.
                </div>
                <Button 
                  size="sm" 
                  onClick={() => onApplyLoan?.({ id: existingUserId, full_name: formData.full_name })}
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 whitespace-nowrap shadow-sm"
                >
                  <CreditCard className="w-3 h-3" />
                  Apply Loan Directly
                </Button>
              </div>
            )}
            <h4 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              Basic Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Full Name</label>
                <input 
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  readOnly={isExistingUser}
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 ${isExistingUser ? 'bg-slate-50 cursor-not-allowed opacity-75' : ''}`}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Phone Number</label>
                <input 
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="+2547..."
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Email Address (Optional)</label>
                <input 
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="john@example.com"
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h4 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2 border-b pb-2">
              <MapPin className="w-5 h-5 text-primary-600" />
              Residential Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">National ID</label>
                <input 
                  name="national_id"
                  value={formData.national_id}
                  onChange={handleChange}
                  readOnly={isExistingUser}
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 ${isExistingUser ? 'bg-slate-50 cursor-not-allowed opacity-75' : ''}`}
                  placeholder="12345678"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Date of Birth</label>
                <input 
                  name="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Region/Constituency</label>
                <select 
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 bg-white"
                >
                  <option value="">Select Region...</option>
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">County</label>
                <select 
                  name="county"
                  value={formData.county}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 bg-slate-50 cursor-not-allowed"
                >
                  {counties.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Nearest Town</label>
                <input 
                  name="town"
                  value={formData.town}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="e.g. Ruiru"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Village/Estate</label>
                <input 
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="e.g. Sunrise Estate"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Detailed Address/Landmarks</label>
                <textarea 
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="Street, House No, Landmark"
                  rows="2"
                />
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              Salary & Income
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Employment Status</label>
                <select 
                  name="employment_status"
                  value={formData.employment_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="EMPLOYED">Employed</option>
                  <option value="SELF_EMPLOYED">Self Employed</option>
                  <option value="UNEMPLOYED">Unemployed</option>
                  <option value="STUDENT">Student</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Monthly Income (KES)</label>
                <input 
                  name="monthly_income"
                  type="number"
                  value={formData.monthly_income}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="50000"
                />
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h4 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2 border-b pb-2">
              <Camera className="w-5 h-5 text-primary-600" />
              Documents & Verification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Image */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Profile Image (Passport Size)</label>
                <div className="relative group">
                  <div className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${profilePreview ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-blue-400'} ${isExistingUser ? 'cursor-not-allowed opacity-80' : ''}`}>
                    {profilePreview ? (
                      <img src={profilePreview} alt="Profile Preview" className="h-full w-full object-cover rounded-lg" />
                    ) : (
                      <div className="text-center p-4">
                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
                        <span className="mt-2 block text-xs text-gray-600">Click to upload or drag and drop</span>
                      </div>
                    )}
                    {!isExistingUser && (
                      <input 
                        type="file" 
                        name="profile_image"
                        onChange={handleFileChange}
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    )}
                  </div>
                  {profilePreview && !isExistingUser && (
                    <button 
                      onClick={() => { setFormData(p => ({...p, profile_image: null})); setProfilePreview(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* National ID Image */}
              <div className="space-y-2">
                <label className="text-sm font-medium">National ID Front View</label>
                <div className="relative group">
                  <div className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${idPreview ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-blue-400'} ${isExistingUser ? 'cursor-not-allowed opacity-80' : ''}`}>
                    {idPreview ? (
                      <img src={idPreview} alt="ID Preview" className="h-full w-full object-cover rounded-lg" />
                    ) : (
                      <div className="text-center p-4">
                        <Camera className="mx-auto h-8 w-8 text-gray-400" />
                        <span className="mt-2 block text-xs text-gray-600">Upload ID Photo</span>
                      </div>
                    )}
                    {!isExistingUser && (
                      <input 
                        type="file" 
                        name="national_id_image"
                        onChange={handleFileChange}
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    )}
                  </div>
                  {idPreview && !isExistingUser && (
                    <button 
                      onClick={() => { setFormData(p => ({...p, national_id_image: null})); setIdPreview(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 italic text-center">
              {isExistingUser 
                ? "Identity documents and profile images are locked for verification security."
                : "Clear images help in faster verification and loan approval."
              }
            </p>
          </div>
        );
      case 5:
        return (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold">Review & Complete</h4>
            <p className="text-slate-500 max-w-xs mx-auto">
              Please review the registration for <strong>{formData.full_name}</strong>.
            </p>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-left text-sm space-y-3 max-w-sm mx-auto">
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-500">Phone:</span>
                <span className="font-medium">{formData.phone}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-500">ID Number:</span>
                <span className="font-medium">{formData.national_id}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-500">Profile Photo:</span>
                <span className={formData.profile_image ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                  {formData.profile_image ? '✓ Provided' : '⚠ Missing'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ID Photo:</span>
                <span className={formData.national_id_image ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                  {formData.national_id_image ? '✓ Provided' : '⚠ Missing'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 mt-6">
              <input 
                type="checkbox" 
                id="agreed_to_terms" 
                name="agreed_to_terms"
                checked={formData.agreed_to_terms}
                onChange={(e) => setFormData(prev => ({...prev, agreed_to_terms: e.target.checked}))}
                className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                required
              />
              <label htmlFor="agreed_to_terms" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                I confirm that I have verified the original documents and the customer agrees to the <span className="text-primary-600 dark:text-primary-400 font-bold underline">Management Policies</span>.
              </label>
            </div>

            <p className="text-xs text-gray-400 mt-2">
              Once registered, you can start a loan application for this customer.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search Result Warning */}
      {step > 0 && hasOutstanding && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Active Application / Loan Found</p>
            <div className="space-y-1">
              {['UNVERIFIED', 'VERIFIED', 'PENDING', 'AWARDED'].includes(outstandingLoanDetails?.status) ? (
                <p>
                  You have a pending loan application for <span className="font-semibold text-primary-700">KES {Number(outstandingLoanDetails?.principal_amount).toLocaleString()}</span> currently in <span className="font-semibold uppercase px-1.5 py-0.5 bg-amber-100 rounded text-amber-700 text-xs">{outstandingLoanDetails?.status}</span> state.
                </p>
              ) : (
                <p>
                  You have a loan of <span className="font-semibold text-primary-700">KES {Number(outstandingLoanDetails?.principal_amount).toLocaleString()}</span>. 
                  {Number(outstandingLoanDetails?.remaining_balance) < Number(outstandingLoanDetails?.total_repayable_amount) && (
                    <span> Current loan balance: <span className="font-semibold text-emerald-700">KES {Number(outstandingLoanDetails?.remaining_balance).toLocaleString()}</span>.</span>
                  )}
                  {outstandingLoanDetails?.status === 'OVERDUE' && (
                    <span className="text-red-600 font-bold ml-1">STATUS: OVERDUE</span>
                  )}
                </p>
              )}
            </div>
            <p className="mt-2 text-xs opacity-75 italic text-slate-600">
              Personal details can be updated below, but new applications are restricted until the current one is closed or rejected.
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar - Hidden on step 0 */}
      {step > 0 && (
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div 
                key={s} 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= s ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s}
              </div>
            ))}
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-600 transition-all duration-300" 
              style={{ width: `${(step - 1) * 25}%` }}
            />
          </div>
        </div>
      )}

      {error && !error.includes('No record') && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <Card className="p-6">
        {isFinished ? (
          <div className="text-center py-10 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-4">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900 border-none">Success!</h3>
              <p className="text-slate-500">
                Customer <strong>{registeredUser?.full_name}</strong> has been successfully {isExistingUser ? 'updated' : 'registered'}.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              {(!hasOutstanding || outstandingLoanDetails?.status === 'REJECTED') && (
                <Button 
                  onClick={() => onApplyLoan?.(registeredUser)}
                  className="bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center gap-2 px-8"
                >
                  <CreditCard className="w-4 h-4" />
                  Apply for a Loan Now
                </Button>
              )}
              <Button 
                variant="secondary" 
                onClick={() => onSuccess?.()}
                className="px-8"
              >
                {hasOutstanding ? 'Close' : 'Finish & Close'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {renderStep()}

            {step > 0 && (
              <div className="mt-8 flex justify-between items-center border-t pt-6">
                <Button 
                  variant="secondary" 
                  onClick={step === 1 ? () => setStep(0) : prevStep}
                  disabled={loading}
                >
                  {step === 1 ? 'Back to Lookup' : 'Previous'}
                </Button>
                
                <Button 
                  onClick={step === 5 ? handleSubmit : nextStep}
                  disabled={loading || (step === 5 && !formData.agreed_to_terms)}
                  className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white"
                >
                  {loading ? 'Submitting...' : step === 5 ? (isExistingUser ? 'Update Information' : 'Register Customer') : 'Next Step'}
                  {step < 5 && <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default CustomerRegistrationForm;
