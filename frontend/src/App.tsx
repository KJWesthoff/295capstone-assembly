import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './App.css';
import ApiScanner from './components/ApiScanner';
import Report from './components/Report';

const queryClient = new QueryClient();

function App() {
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [appName, setAppName] = useState('REST Assured');

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
    <QueryClientProvider client={queryClient}>
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
            <p>Analyze your API for security vulnerabilities</p>
          </div>
        </header>
        <main className="App-main">
          <ApiScanner onScanStarted={handleScanStarted} />
          {currentScanId && <Report scanId={currentScanId} />}
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
