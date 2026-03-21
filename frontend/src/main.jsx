import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx'
import './index.css'

// Logic to clear old session data for existing users during the hierarchy migration
(function() {
  const MIGRATION_VERSION = 'v1.1'; // Increment this whenever permissions or storage keys change
  const currentVersion = localStorage.getItem('system_version');
  
  if (currentVersion !== MIGRATION_VERSION) {
    // We only clear the token and user to force a fresh login with new claims
    localStorage.removeItem('token');
    localStorage.removeItem('admin_user');
    localStorage.setItem('system_version', MIGRATION_VERSION);
    console.log('[System] Permission version mismatch. Cache purged.');
  }
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,        // 2 minutes — data is fresh, no refetch
      gcTime: 1000 * 60 * 10,          // 10 minutes — keep in memory after unmount
      retry: 1,                         // retry failed requests once only
      refetchOnWindowFocus: false,      // don't refetch just because user switches tabs
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
