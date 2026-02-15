'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

interface Lead {
  id: number;
  full_name: string;
  username: string;
  source: string;
  niche: string;
  lead_score: number;
  created_at: string;
  email: string;
  phone: string;
  platform: string;
  profile_url: string;
  bio: string;
  location: string;
  followers: number;
  affiliate_type: string;
  stage: string;
  has_responded: boolean;
  notes: string;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function leadsToCSV(leads: Lead[]): string {
  const headers = ['Name', 'Handle', 'Email', 'Phone', 'Platform', 'Profile URL', 'Bio', 'Location', 'Followers', 'Niche', 'Source', 'Score', 'Stage', 'Date Scraped'];
  const rows = leads.map(l => [
    l.full_name || '',
    l.username || '',
    l.email || '',
    l.phone || '',
    l.platform || '',
    l.profile_url || '',
    (l.bio || '').replace(/"/g, '""'),
    l.location || '',
    l.followers?.toString() || '',
    l.niche?.replace(/_/g, ' ') || '',
    l.source?.replace(/_/g, ' ') || '',
    l.lead_score?.toString() || '0',
    l.stage || '',
    l.created_at ? new Date(l.created_at).toLocaleDateString() : '',
  ]);
  const csvRows = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(','));
  return csvRows.join('\n');
}

export { leadsToCSV, downloadFile };

export default function Vault() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeads({ limit: '10000' })
      .then(data => setLeads(data.leads))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    downloadFile(leadsToCSV(leads), `lead-vault-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const exportJSON = () => {
    downloadFile(JSON.stringify(leads, null, 2), `lead-vault-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  if (loading) return <div className="p-8" style={{ color: 'var(--t3)' }}>Loading vault...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--t2)' }}>{leads.length} leads in vault</p>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Export CSV
          </button>
          <button
            onClick={exportJSON}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--bg3)', color: 'var(--t2)', border: '1px solid var(--bd2)' }}
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Handle</th>
              <th>Source</th>
              <th>Niche</th>
              <th>Score</th>
              <th>Date Scraped</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--t3)' }}>No leads in vault.</td></tr>
            ) : leads.map(lead => (
              <tr key={lead.id}>
                <td className="text-sm">{lead.full_name || '—'}</td>
                <td className="text-sm" style={{ color: 'var(--t2)' }}>{lead.username ? `@${lead.username}` : '—'}</td>
                <td className="text-xs" style={{ color: 'var(--t3)' }}>{lead.source?.replace(/_/g, ' ') || '—'}</td>
                <td className="text-xs" style={{ color: 'var(--t2)' }}>{lead.niche?.replace(/_/g, ' ') || '—'}</td>
                <td>
                  <span className={`text-xs font-mono ${lead.lead_score >= 70 ? 'text-green-400' : lead.lead_score >= 40 ? 'text-yellow-400' : ''}`} style={lead.lead_score < 40 ? { color: 'var(--t3)' } : undefined}>
                    {lead.lead_score}
                  </span>
                </td>
                <td className="text-xs" style={{ color: 'var(--t3)' }}>{new Date(lead.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
