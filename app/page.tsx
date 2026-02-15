'use client';

import { useState } from 'react';
import Dashboard from './components/Dashboard';
import CRM from './components/CRM';
import Templates from './components/Templates';
import Deals from './components/Deals';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'crm', label: 'CRM', icon: '👥' },
  { id: 'templates', label: 'Templates', icon: '✉️' },
  { id: 'deals', label: 'Deals', icon: '💰' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm font-bold">
            LE
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Lead Engine</h1>
            <p className="text-[10px] text-gray-500">Sync Lead Digital</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
          Connected to Neon
        </div>
      </header>

      {/* Tab Nav */}
      <nav className="bg-gray-900/50 border-b border-gray-800 px-6">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'crm' && <CRM />}
        {activeTab === 'templates' && <Templates />}
        {activeTab === 'deals' && <Deals />}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900/30 border-t border-gray-800 px-6 py-3 text-center text-xs text-gray-600">
        Sync Lead Digital × 7 Figures Funding
      </footer>
    </div>
  );
}
