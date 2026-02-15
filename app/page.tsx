'use client';

import { useState } from 'react';
import { useTheme } from './components/ThemeProvider';
import Dashboard from './components/Dashboard';
import CRM from './components/CRM';
import Scraper from './components/Scraper';
import Templates from './components/Templates';
import Deals from './components/Deals';
import Vault from './components/Vault';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'crm', label: 'CRM', icon: '👥' },
  { id: 'scraper', label: 'Scraper', icon: '🔍' },
  { id: 'templates', label: 'Templates', icon: '✉️' },
  { id: 'deals', label: 'Deals', icon: '💰' },
  { id: 'vault', label: 'Vault', icon: '🗄️' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-3 flex items-center justify-between" style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--bd)' }}>
        <div className="flex items-center gap-3">
          <img src="/sld-logo.png" alt="SLD" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          <div>
            <h1 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--t1)' }}>Lead Engine</h1>
            <p className="text-[10px]" style={{ color: 'var(--t4)' }}>Sync Lead Digital</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggle}
            className="text-lg cursor-pointer transition-transform hover:scale-110"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--t4)' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }}></span>
            Connected to Neon
          </div>
        </div>
      </header>

      {/* Tab Nav */}
      <nav className="px-6" style={{ background: 'color-mix(in srgb, var(--bg2) 50%, transparent)', borderBottom: '1px solid var(--bd)' }}>
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-3 text-sm font-medium transition-colors relative"
              style={{ color: activeTab === tab.id ? 'var(--t1)' : 'var(--t4)' }}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'var(--accent)' }} />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'crm' && <CRM />}
        {activeTab === 'scraper' && <Scraper />}
        {activeTab === 'templates' && <Templates />}
        {activeTab === 'deals' && <Deals />}
        {activeTab === 'vault' && <Vault />}
      </main>

      {/* Footer */}
      <footer className="px-6 py-3 text-center text-xs" style={{ background: 'color-mix(in srgb, var(--bg2) 30%, transparent)', borderTop: '1px solid var(--bd)', color: 'var(--t4)' }}>
        Sync Lead Digital × 7 Figures Funding
      </footer>
    </div>
  );
}
