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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchLeads = () => {
    setLoading(true);
    api.getLeads({ limit: '10000' })
      .then(data => setLeads(data.leads))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeads(); }, []);

  const exportCSV = () => {
    downloadFile(leadsToCSV(leads), `lead-vault-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const exportJSON = () => {
    downloadFile(JSON.stringify(leads, null, 2), `lead-vault-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    try {
      await api.bulkDeleteLeads(ids);
      setLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
      showToast(`Deleted ${ids.length} leads`);
      setSelectedIds(new Set());
    } catch { showToast('Bulk delete failed'); }
    setConfirmDelete(false);
  };

  if (loading) return <div className="p-8" style={{ color: 'var(--t3)' }}>Loading vault...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--t2)' }}>{leads.length} leads in vault</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCleanup(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--bg3)', color: '#f97316', border: '1px solid var(--bd2)' }}
          >
            Cleanup
          </button>
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
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={leads.length > 0 && selectedIds.size === leads.length}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                />
              </th>
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
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--t3)' }}>No leads in vault.</td></tr>
            ) : leads.map(lead => (
              <tr key={lead.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                    className="cursor-pointer"
                  />
                </td>
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

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-xl z-40"
          style={{ background: 'color-mix(in srgb, var(--bg2) 90%, transparent)', border: '1px solid var(--bd)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--t1)' }}>{selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: '#ef4444', color: 'white' }}
          >
            Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--bg3)', color: 'var(--t2)' }}
          >
            Deselect All
          </button>
        </div>
      )}

      {/* Confirm Bulk Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirmDelete(false)}>
          <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--t1)' }}>Delete {selectedIds.size} leads?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--t3)' }}>Permanently delete {selectedIds.size} leads? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg text-sm transition-colors" style={{ background: 'var(--bg3)', color: 'var(--t1)' }}>Cancel</button>
              <button onClick={bulkDelete} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors text-white" style={{ background: '#ef4444' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Modal */}
      {showCleanup && (
        <CleanupModal
          onClose={() => setShowCleanup(false)}
          onDone={(count) => { showToast(`Deleted ${count} leads`); fetchLeads(); setShowCleanup(false); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="le-toast" style={{ background: 'var(--bg3)', color: 'var(--t1)', border: '1px solid var(--bd)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function CleanupModal({ onClose, onDone }: { onClose: () => void; onDone: (count: number) => void }) {
  const [maxFollowers, setMaxFollowers] = useState(100000);
  const [minFollowers, setMinFollowers] = useState(0);
  const [keywords, setKeywords] = useState('');
  const [noUsername, setNoUsername] = useState(false);
  const [noBio, setNoBio] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const inputStyle = { background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--t1)' };

  const buildPayload = () => ({
    maxFollowers: maxFollowers > 0 ? maxFollowers : undefined,
    minFollowers: minFollowers > 0 ? minFollowers : undefined,
    keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
    noUsername: noUsername || undefined,
    noBio: noBio || undefined,
  });

  const runPreview = async () => {
    setLoading(true);
    try {
      const result = await api.cleanupPreview(buildPayload());
      setPreview(result.leads);
      setPreviewCount(result.count);
    } catch { setPreview([]); setPreviewCount(0); }
    setLoading(false);
  };

  const runDelete = async () => {
    setLoading(true);
    try {
      const result = await api.cleanupExecute(buildPayload());
      onDone(result.deleted);
    } catch { setLoading(false); }
    setConfirmDelete(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--t1)' }}>Cleanup Leads</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--t4)' }}>Find and remove leads that don{"'"}t match your ICP</p>

        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Delete followers above</label>
              <input type="number" min="0" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} value={maxFollowers} onChange={e => setMaxFollowers(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Delete followers below</label>
              <input type="number" min="0" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} value={minFollowers} onChange={e => setMinFollowers(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Delete matching keywords (name or bio, comma-separated)</label>
            <input className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="official, brand, media..." />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--t3)' }}>
              <input type="checkbox" checked={noUsername} onChange={e => setNoUsername(e.target.checked)} />
              No username
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--t3)' }}>
              <input type="checkbox" checked={noBio} onChange={e => setNoBio(e.target.checked)} />
              No bio
            </label>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            onClick={runPreview}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--bg3)', color: 'var(--t1)', border: '1px solid var(--bd2)' }}
          >
            {loading ? 'Scanning...' : 'Preview'}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={!preview || previewCount === 0 || loading}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors text-white disabled:opacity-40"
            style={{ background: '#ef4444' }}
          >
            Delete All Matched ({previewCount})
          </button>
        </div>

        {/* Preview Results */}
        {preview !== null && (
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--t3)' }}>{previewCount} leads match criteria{previewCount > 500 ? ' (showing first 500)' : ''}</p>
            {previewCount === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: 'var(--t4)' }}>No leads match these filters.</p>
            ) : (
              <div className="rounded-lg overflow-y-auto max-h-60" style={{ background: 'var(--bg3)' }}>
                <table>
                  <thead>
                    <tr>
                      <th className="text-[10px]">Name / Handle</th>
                      <th className="text-[10px]">Followers</th>
                      <th className="text-[10px]">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((l: any) => (
                      <tr key={l.id}>
                        <td className="text-xs">
                          <div>{l.full_name || '—'}</div>
                          <div style={{ color: 'var(--t4)' }}>{l.username ? `@${l.username}` : '—'}</div>
                        </td>
                        <td className="text-xs font-mono" style={{ color: 'var(--t2)' }}>{l.followers?.toLocaleString() || '—'}</td>
                        <td className="text-xs" style={{ color: '#f97316' }}>{l.reasons?.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Confirm cleanup delete */}
        {confirmDelete && (
          <div className="mt-4 rounded-lg p-4" style={{ background: 'var(--bg)', border: '1px solid #ef4444' }}>
            <p className="text-sm mb-3" style={{ color: 'var(--t1)' }}>Permanently delete {previewCount} leads? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg text-sm transition-colors" style={{ background: 'var(--bg3)', color: 'var(--t1)' }}>Cancel</button>
              <button onClick={runDelete} disabled={loading} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors text-white" style={{ background: '#ef4444' }}>
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}

        <button onClick={onClose} className="w-full mt-4 py-2 rounded-lg text-sm transition-colors" style={{ background: 'var(--bg3)', color: 'var(--t3)' }}>Close</button>
      </div>
    </div>
  );
}
