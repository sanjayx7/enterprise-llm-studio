import React, { useState } from 'react';
import { LayoutDashboard, Database, Sliders, Activity, Cpu, Menu } from 'lucide-react';
import Dashboard from './components/Dashboard';
import DatasetManager from './components/DatasetManager';
import Trainer from './components/Trainer';
import StatusMonitor from './components/StatusMonitor';

import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={handleTabClick} />;
      case 'datasets':
        return <DatasetManager />;
      case 'trainer':
        return <Trainer setActiveTab={handleTabClick} setSelectedJobId={setSelectedJobId} />;
      case 'jobs':
        return <StatusMonitor selectedJobId={selectedJobId} setSelectedJobId={setSelectedJobId} />;
      default:
        return <Dashboard setActiveTab={handleTabClick} />;
    }
  };

  return (
    <div className="app-container">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <button className="menu-toggle-btn" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="mobile-logo">
          <Cpu size={20} color="var(--primary)" />
          <span>LLM Studio</span>
        </div>
        <div style={{ width: 24 }}></div> {/* Layout spacer */}
      </header>

      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <Cpu size={24} color="var(--primary)" />
          <h1>LLM Studio</h1>
        </div>
        
        <ul className="sidebar-menu">
          <li className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <button onClick={() => handleTabClick('dashboard')}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
          </li>
          <li className={`sidebar-item ${activeTab === 'datasets' ? 'active' : ''}`}>
            <button onClick={() => handleTabClick('datasets')}>
              <Database size={18} />
              <span>Datasets</span>
            </button>
          </li>
          <li className={`sidebar-item ${activeTab === 'trainer' ? 'active' : ''}`}>
            <button onClick={() => handleTabClick('trainer')}>
              <Sliders size={18} />
              <span>Training Studio</span>
            </button>
          </li>
          <li className={`sidebar-item ${activeTab === 'jobs' ? 'active' : ''}`}>
            <button onClick={() => handleTabClick('jobs')}>
              <Activity size={18} />
              <span>Job Monitor</span>
            </button>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div>Enterprise v1.0</div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}
