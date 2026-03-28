import React, { useState } from 'react';
import { 
  UploadCloud, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Table
} from 'lucide-react';

const StatementUpload = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [summary, setSummary] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage(null);
    setSummary(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/repayments/upload-statement/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Statement processed successfully!' });
        setSummary(data);
        setFile(null);
        // Reset file input
        e.target.reset();
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white ">Upload M-Pesa Statement</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Upload CSV statements to reconcile repayments automatically.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <form onSubmit={handleUpload} className="p-8">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-12 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".csv"
              className="absolute inset-0 opacity-0 cursor-pointer"
              required
            />
            <UploadCloud className="h-12 w-12 text-gray-400 mb-4" />
            <div className="text-center">
              <span className="text-blue-600 font-medium">Click to upload</span>
              <span className="text-gray-500 dark:text-gray-400 "> or drag and drop</span>
              <p className="text-xs text-gray-400 mt-2">CSV files only from Safaricom Portal</p>
            </div>
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center">
                <Table className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm font-medium text-blue-700">{file.name}</span>
              </div>
              <span className="text-xs text-blue-500">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={!file || loading}
              className={`flex items-center px-6 py-2.5 rounded-lg font-medium transition-all ${
                !file || loading 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Processing Statement...
                </>
              ) : (
                'Process Statement'
              )}
            </button>
          </div>
        </form>

        {message && (
          <div className={`p-4 border-t ${message.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center">
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              )}
              <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {message.text}
              </p>
            </div>
          </div>
        )}
      </div>

      {summary && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Processed</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white ">{summary.matched + summary.unmatched}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-green-500 uppercase font-semibold">Matched (Auto)</p>
            <p className="text-2xl font-bold text-green-600">{summary.matched}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-amber-500 uppercase font-semibold">Unmatched</p>
            <p className="text-2xl font-bold text-amber-600">{summary.unmatched}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs text-red-500 uppercase font-semibold">Duplicates/Errors</p>
            <p className="text-2xl font-bold text-red-600">{summary.duplicates || 0}</p>
          </div>
        </div>
      )}

      <div className="mt-12 bg-indigo-50 rounded-xl p-6 border border-indigo-100">
        <h3 className="text-indigo-900 font-bold mb-2">Instructions</h3>
        <ul className="text-sm text-indigo-700 space-y-2 list-disc pl-5">
          <li>Download your Paybill/BuyGoods statement from Safaricom M-Pesa Portal.</li>
          <li>Ensure the file is in <strong>CSV</strong> format.</li>
          <li>Statements with Receipt No, Completion Time, and Details are supported.</li>
          <li>Identified loans will be credited automatically; others will go to the 'Unmatched' queue.</li>
        </ul>
      </div>
    </div>
  );
};

export default StatementUpload;
