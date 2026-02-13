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
  X,
  UserPlus
} from 'lucide-react';

const CustomerRegistrationForm = ({ onSuccess, onApplyLoan, onCancel, initialCustomer }) => {
  // Try to load saved draft from sessionStorage
  const savedDraft = JSON.parse(sessionStorage.getItem('registration_draft') || 'null');
  
  const [step, setStep] = useState(() => {
    if (savedDraft && (!initialCustomer || savedDraft.existingUserId === initialCustomer.id)) {
      return savedDraft.step;
    }
    return initialCustomer ? 1 : 0;
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(() => {
    if (savedDraft && (!initialCustomer || savedDraft.existingUserId === initialCustomer.id)) {
      return savedDraft.isExistingUser;
    }
    return !!initialCustomer;
  });
  const [hasOutstanding, setHasOutstanding] = useState(false);
  const [existingUserId, setExistingUserId] = useState(() => {
    if (savedDraft && (!initialCustomer || savedDraft.existingUserId === initialCustomer.id)) {
      return savedDraft.existingUserId;
    }
    return initialCustomer?.id || null;
  });
  const [error, setError] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [loanProducts, setLoanProducts] = useState([]);
  const [outstandingLoanDetails, setOutstandingLoanDetails] = useState(null);

  const branches = [
    'Kagio', 'Embu', 'Thika', 'Naivasha'
  ];
  
  const [formData, setFormData] = useState(() => {
    // 1. If we have a draft and it is relevant (either new registration or same customer)
    if (savedDraft?.formData && (!initialCustomer || savedDraft.existingUserId === initialCustomer.id)) {
      return {
        ...savedDraft.formData,
        profile_image: null,
        national_id_image: null
      };
    }

    // 2. Otherwise use initial customer data if provided
    if (initialCustomer) {
      return {
        full_name: initialCustomer.full_name || '',
        phone: initialCustomer.phone || '',
        email: initialCustomer.email || '',
        national_id: initialCustomer.profile?.national_id || '',
        date_of_birth: initialCustomer.profile?.date_of_birth || '',
        branch: initialCustomer.profile?.branch || 'Kagio',
        town: initialCustomer.profile?.town || '',
        village: initialCustomer.profile?.village || '',
        address: initialCustomer.profile?.address || '',
        employment_status: initialCustomer.profile?.employment_status || 'EMPLOYED',
        monthly_income: initialCustomer.profile?.monthly_income || '',
        guarantors: initialCustomer.guarantors?.length > 0 ? initialCustomer.guarantors : [{ full_name: '', national_id: '', phone: '' }],
        profile_image: null,
        national_id_image: null,
        agreed_to_terms: true,
      };
    }
    
    // 3. Fallback to default empty form
    return {
      full_name: '',
      phone: '',
      email: '',
      national_id: '',
      date_of_birth: '',
      branch: 'Kagio',
      town: '',
      village: '',
      address: '',
      employment_status: 'EMPLOYED',
      monthly_income: '',
      guarantors: [{ full_name: '', national_id: '', phone: '' }],
      profile_image: null,
      national_id_image: null,
      agreed_to_terms: false,
    };
  });

  // Persist to sessionStorage on changes
  useEffect(() => {
    // Only save if not finished
    if (!isFinished) {
      const draft = {
        step,
        isExistingUser,
        existingUserId,
        formData: {
          ...formData,
          profile_image: null, // Files can't be saved in sessionStorage
          national_id_image: null
        }
      };
      sessionStorage.setItem('registration_draft', JSON.stringify(draft));
    }
  }, [step, formData, isExistingUser, existingUserId, isFinished]);

  const clearDraft = () => {
    sessionStorage.removeItem('registration_draft');
  };

  const handleCancelClick = () => {
    const hasData = formData.full_name || formData.phone || formData.national_id;
    if (hasData && !isFinished) {
      if (window.confirm("You have unsaved changes. Are you sure you want to exit? This will clear your current progress.")) {
        clearDraft();
        onCancel?.();
      }
    } else {
      clearDraft();
      onCancel?.();
    }
  };

  const steps = [
    { id: 0, label: 'Lookup' },
    { id: 1, label: 'Personal Details' },
    { id: 2, label: 'Residence Details' },
    { id: 3, label: 'Income Status' },
    { id: 4, label: 'Image Uploads' },
    { id: 5, label: 'Guarantors' },
    { id: 6, label: 'Review' }
  ];

  const [profilePreview, setProfilePreview] = useState(initialCustomer?.profile?.profile_image || null);
  const [idPreview, setIdPreview] = useState(initialCustomer?.profile?.national_id_image || null);

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    const file = files && files[0];
    
    setError(''); 
    
    if (file) {
      // Basic Validation (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`File too large: ${file.name} is too big. Max 5MB.`);
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError("Please select an image file (PNG, JPG, etc).");
        return;
      }

      setFormData(prev => ({ ...prev, [name]: file }));
      
      const reader = new FileReader();
      reader.onloadend = () => {
        if (name === 'profile_image') setProfilePreview(reader.result);
        if (name === 'national_id_image') setIdPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGuarantorChange = (index, field, value) => {
    const newGuarantors = [...formData.guarantors];
    newGuarantors[index][field] = value;
    setFormData(prev => ({ ...prev, guarantors: newGuarantors }));
  };

  const addGuarantor = () => {
    if (formData.guarantors.length < 3) {
      setFormData(prev => ({
        ...prev,
        guarantors: [...prev.guarantors, { full_name: '', national_id: '', phone: '' }]
      }));
    }
  };

  const removeGuarantor = (index) => {
    if (formData.guarantors.length > 1) {
      const newGuarantors = formData.guarantors.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, guarantors: newGuarantors }));
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
        
        // Update Previews
        if (data.user.profile?.profile_image) {
          setProfilePreview(data.user.profile.profile_image);
        } else {
          setProfilePreview(null);
        }
        
        if (data.user.profile?.national_id_image) {
          setIdPreview(data.user.profile.national_id_image);
        } else {
          setIdPreview(null);
        }
        
        // Pre-fill form
        setFormData({
          ...formData,
          full_name: data.user.full_name,
          phone: data.user.phone,
          email: data.user.email || '',
          national_id: data.user.profile?.national_id || '',
          date_of_birth: data.user.profile?.date_of_birth || '',
          branch: data.user.profile?.branch || '',

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
      setError('Required: Please fill in Full Name and Phone Number');
      return;
    }
    if (step === 2 && (!formData.national_id || !formData.date_of_birth || !formData.branch || !formData.town)) {
      setError('Required: National ID, Date of Birth, Branch and Town are mandatory');
      return;
    }
    if (step === 3 && (!formData.employment_status || !formData.monthly_income)) {
      setError('Required: Please provide Employment Status and Monthly Income');
      return;
    }
    if (step === 4 && !isExistingUser && (!formData.profile_image || !formData.national_id_image)) {
      setError('Required: Please upload both the Profile Image and ID Photo before proceeding.');
      return;
    }
    if (step === 5) {
      const validGuarantors = formData.guarantors.filter(g => g.full_name && g.phone && g.national_id);
      if (validGuarantors.length === 0) {
        setError('Required: Please provide at least one complete guarantor (Name, ID, and Phone)');
        return;
      }
    }
    setError('');
    setStep(prev => prev + 1);
  };
  const prevStep = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    // Safety check for images during fresh registration
    if (!isExistingUser && (!formData.profile_image || !formData.national_id_image)) {
        setError('Submission blocked: Profile and ID images are mandatory for new registration.');
        setStep(4);
        return;
    }

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
      data.append('branch', formData.branch);
      data.append('town', formData.town);
      data.append('village', formData.village);
      data.append('address', formData.address);
      data.append('employment_status', formData.employment_status);
      if (formData.monthly_income) data.append('monthly_income', formData.monthly_income);
      
      // Guarantors
      data.append('guarantors', JSON.stringify(formData.guarantors.filter(g => g.full_name && g.phone)));

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
            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center px-2">
              <button
                onClick={handleCancelClick}
                className="text-slate-500 hover:text-slate-800 font-medium text-sm flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
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
                <label className="text-sm font-medium">Branch</label>
                <select 
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 bg-white"
                >
                  <option value="">Select Branch...</option>
                  {branches.map(r => <option key={r} value={r}>{r}</option>)}
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
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="border-b pb-3">
              <h4 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary-600" />
                Documents & Verification
              </h4>
              <p className="text-sm text-slate-500 mt-1">Please provide clear photos for faster application processing.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Profile Image */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  Profile Photo (Passport Size)
                </label>
                <div className="relative group">
                  <label htmlFor="profile_image_input" className="cursor-pointer block transition-transform active:scale-[0.98]">
                    <div 
                      className={`w-full h-56 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all overflow-hidden relative shadow-sm ${
                        profilePreview ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50/80 bg-slate-50'
                      }`}
                    >
                      {profilePreview ? (
                        <div className="relative w-full h-full">
                          <img 
                            src={profilePreview.startsWith('http') || profilePreview.startsWith('data:') ? profilePreview : `${loanService.api.defaults.baseURL.replace('/api', '')}${profilePreview}`} 
                            alt="Profile Preview" 
                            className="h-full w-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                            <Upload className="w-8 h-8" />
                            <p className="text-xs font-bold uppercase tracking-wider">Change Photo</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-6 flex flex-col items-center">
                          <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="h-7 w-7 text-primary-500" />
                          </div>
                          <span className="block text-sm font-bold text-slate-700 mb-1">Upload Profile Photo</span>
                          <span className="text-[11px] text-slate-500">JPG, PNG up to 5MB</span>
                        </div>
                      )}
                    </div>
                  </label>
                  <input 
                    type="file" 
                    id="profile_image_input"
                    name="profile_image"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                    disabled={isExistingUser}
                  />
                  
                  {/* Filename Footer */}
                  {formData.profile_image instanceof File && (
                    <div className="mt-2 flex items-center justify-between px-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-[11px] text-slate-600 font-medium truncate">{formData.profile_image.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{(formData.profile_image.size / (1024 * 1024)).toFixed(1)}MB</span>
                    </div>
                  )}

                  {profilePreview && !isExistingUser && (
                    <button 
                      type="button"
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation();
                        setFormData(p => ({...p, profile_image: null})); 
                        setProfilePreview(null); 
                      }}
                      className="absolute -top-2 -right-2 bg-white text-rose-500 p-1.5 rounded-full shadow-md z-[60] border border-rose-100 hover:bg-rose-50 hover:text-rose-600 active:scale-90 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* National ID Image */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  National ID (Front View)
                </label>
                <div className="relative group">
                  <label htmlFor="national_id_image_input" className="cursor-pointer block transition-transform active:scale-[0.98]">
                    <div 
                      className={`w-full h-56 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all overflow-hidden relative shadow-sm ${
                        idPreview ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50/80 bg-slate-50'
                      }`}
                    >
                      {idPreview ? (
                        <div className="relative w-full h-full">
                          <img 
                            src={idPreview.startsWith('http') || idPreview.startsWith('data:') ? idPreview : `${loanService.api.defaults.baseURL.replace('/api', '')}${idPreview}`} 
                            alt="ID Preview" 
                            className="h-full w-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                            <Upload className="w-8 h-8" />
                            <p className="text-xs font-bold uppercase tracking-wider">Change ID Photo</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-6 flex flex-col items-center">
                          <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Camera className="h-7 w-7 text-primary-500" />
                          </div>
                          <span className="block text-sm font-bold text-slate-700 mb-1">Upload ID Side</span>
                          <span className="text-[11px] text-slate-500">JPG, PNG up to 5MB</span>
                        </div>
                      )}
                    </div>
                  </label>
                  <input 
                    type="file" 
                    id="national_id_image_input"
                    name="national_id_image"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                    disabled={isExistingUser}
                  />

                  {/* Filename Footer */}
                  {formData.national_id_image instanceof File && (
                    <div className="mt-2 flex items-center justify-between px-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-[11px] text-slate-600 font-medium truncate">{formData.national_id_image.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{(formData.national_id_image.size / (1024 * 1024)).toFixed(1)}MB</span>
                    </div>
                  )}

                  {idPreview && !isExistingUser && (
                    <button 
                      type="button"
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation();
                        setFormData(p => ({...p, national_id_image: null})); 
                        setIdPreview(null); 
                      }}
                      className="absolute -top-2 -right-2 bg-white text-rose-500 p-1.5 rounded-full shadow-md z-[60] border border-rose-100 hover:bg-rose-50 hover:text-rose-600 active:scale-90 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 leading-relaxed">
                <p className="font-semibold mb-1">Verification Tips:</p>
                <ul className="list-disc list-inside space-y-1 opacity-80">
                  <li>Ensure the text on your ID is clearly visible</li>
                  <li>Avoid glare or reflections on the ID surface</li>
                  <li>Profile photo should show your full face clearly</li>
                </ul>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 italic text-center mt-4">
              {isExistingUser 
                ? "Identity documents and profile images are locked for verification security."
                : "Clear images help in faster verification and loan approval."
              }
            </p>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-600" />
                Guarantors Information
              </h4>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {formData.guarantors.length}/3
              </span>
            </div>

            <p className="text-sm text-slate-600">
              Please provide details for 1 to 3 guarantors. At least one is mandatory.
            </p>

            <div className="space-y-6">
              {formData.guarantors.map((guarantor, index) => (
                <div key={index} className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-800/50 relative group">
                  {formData.guarantors.length > 1 && (
                    <button 
                      onClick={() => removeGuarantor(index)}
                      className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Remove Guarantor"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                      <input 
                        value={guarantor.full_name}
                        onChange={(e) => handleGuarantorChange(index, 'full_name', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-900"
                        placeholder="Guarantor Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">National ID</label>
                      <input 
                        value={guarantor.national_id}
                        onChange={(e) => handleGuarantorChange(index, 'national_id', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-900"
                        placeholder="ID Number"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number</label>
                      <input 
                        value={guarantor.phone}
                        onChange={(e) => handleGuarantorChange(index, 'phone', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-900"
                        placeholder="07..."
                      />
                    </div>
                  </div>
                </div>
              ))}

              {formData.guarantors.length < 3 && (
                <button 
                  onClick={addGuarantor}
                  className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-primary-500 hover:text-primary-600 transition-all flex items-center justify-center gap-2 font-medium bg-white"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Another Guarantor
                </button>
              )}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="text-center py-4 space-y-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-bold">Review & Complete</h4>
              <p className="text-slate-500 max-w-xs mx-auto">
                Final check for <strong>{formData.full_name}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left text-sm max-w-2xl mx-auto">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border">
                <h5 className="font-bold text-xs uppercase text-slate-400 mb-2">Personal & Documents</h5>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-gray-500">Phone:</span>
                  <span className="font-medium">{formData.phone}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-gray-500">ID Number:</span>
                  <span className="font-medium">{formData.national_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Photos:</span>
                  <span className="text-emerald-600 font-medium">✓ Uploaded</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border">
                <h5 className="font-bold text-xs uppercase text-slate-400 mb-2">Guarantors ({formData.guarantors.length})</h5>
                {formData.guarantors.map((g, i) => (
                  <div key={i} className="flex justify-between border-b border-slate-200 last:border-0 pb-1">
                    <span className="text-gray-500 truncate mr-2">{g.full_name || 'Unnamed'}:</span>
                    <span className="font-medium">{g.phone || 'No phone'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="max-w-md mx-auto pt-4">
              <label className="flex items-start gap-3 cursor-pointer group text-left p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                <input 
                  type="checkbox" 
                  checked={formData.agreed_to_terms}
                  onChange={(e) => setFormData(p => ({...p, agreed_to_terms: e.target.checked}))}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  I certify that all information provided is accurate and all documents are genuine. I understand that false information will lead to automatic rejection.
                </span>
              </label>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-2">
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

      {/* Progress Bar & Step Labels */}
      {!isFinished && (
        <div className="mb-8 px-2">
          <div className="flex justify-between mb-4">
            {steps.map((s) => (
              <div key={s.id} className="flex flex-col items-center flex-1">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 z-10 ${
                    step === s.id 
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow-lg' 
                      : step > s.id 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {step > s.id ? <CheckCircle2 className="w-5 h-5" /> : s.id + 1}
                </div>
                <span className={`mt-2 text-[10px] font-bold uppercase tracking-tighter text-center hidden sm:block ${
                  step === s.id ? 'text-primary-600' : 'text-slate-400'
                }`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <div className="relative h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="absolute h-full bg-primary-500 transition-all duration-500 ease-out"
              style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && !isFinished && !error.includes('No record') && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <Card className="p-6 overflow-hidden relative">
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
                  onClick={() => {
                    clearDraft();
                    onApplyLoan?.(registeredUser);
                  }}
                  className="bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center gap-2 px-8"
                >
                  <CreditCard className="w-4 h-4" />
                  Apply for a Loan Now
                </Button>
              )}
              <Button 
                variant="secondary" 
                onClick={() => {
                  clearDraft();
                  onSuccess?.();
                }}
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
                  onClick={() => {
                    if (step === 1 && (formData.full_name || formData.phone)) {
                      if (window.confirm("Go back to lookup? Your current progress for this customer will be reset.")) {
                        setStep(0);
                      }
                    } else if (step === 1) {
                      setStep(0);
                    } else {
                      prevStep();
                    }
                  }}
                  disabled={loading}
                >
                  {step === 1 ? 'Back to Lookup' : 'Previous'}
                </Button>
                
                <Button 
                  onClick={step === 6 ? handleSubmit : nextStep}
                  disabled={loading || (step === 6 && !formData.agreed_to_terms)}
                  className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white"
                >
                  {loading ? 'Submitting...' : step === 6 ? (isExistingUser ? 'Update Information' : 'Register Customer') : 'Next Step'}
                  {step < 6 && <ChevronRight className="w-4 h-4" />}
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
