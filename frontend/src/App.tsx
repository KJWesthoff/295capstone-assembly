import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './App.css';
import ApiScanner from './components/ApiScanner';
import Report from './components/Report';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const queryClient = new QueryClient();

// TypeScript declaration for global window property
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__: import("@tanstack/query-core").QueryClient;
  }
}

// Make QueryClient available globally for devtools
window.__TANSTACK_QUERY_CLIENT__ = queryClient;

// Main authenticated app content
function AuthenticatedApp() {
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [appName, setAppName] = useState('REST Assured');
  const { user, logout } = useAuth();

  const getHeadingClass = (name: string) => {
    switch(name) {
      case 'REST Assured': return 'title-heading rest-assured';
      case 'SecureFlow': return 'title-heading secureflow';
      case 'Endpoint Sentinels': return 'title-heading endpoint-sentinels';
      case 'Digital Defenders': return 'title-heading digital-defenders';
      default: return 'title-heading';
    }
  };

  const handleScanStarted = (scanId: string) => {
    setCurrentScanId(scanId);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="title-section">
            <h1 className={getHeadingClass(appName)}>{appName}</h1>
            <select 
              className="app-name-selector"
              value={appName} 
              onChange={(e) => setAppName(e.target.value)}
            >
              <option value="REST Assured">REST Assured</option>
              <option value="SecureFlow">SecureFlow</option>
              <option value="Endpoint Sentinels">Endpoint Sentinels</option>
              <option value="Digital Defenders">Digital Defenders</option>
            </select>
          </div>
          <div className="user-section">
            <span className="welcome-text">
              Welcome, {user?.username} {user?.is_admin && '(Admin)'}
            </span>
            <button onClick={logout} className="logout-button">
              Logout
            </button>
          </div>
          <p>Analyze your API for security vulnerabilities</p>
        </div>
      </header>
      <main className="App-main">
        <ApiScanner onScanStarted={handleScanStarted} />
        {currentScanId && <Report scanId={currentScanId} />}
      </main>
    </div>
  );
}

// Main App component with authentication logic
function AppContent() {
  const { isAuthenticated, login, loading } = useAuth();

  if (loading) {
    return (
      <div className="App">
        <div className="loading-container">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={login} />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
        <ReactQueryDevtools initialIsOpen={false} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
