'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';

const STAGES = ['new', 'qualified', 'outreach', 'call_booked', 'pre_app_sent', 'approved', 'denied'] as const;
const STAGE_LABELS: Record<string, string> = {
  new: 'New', qualified: 'Qualified', outreach: 'Outreach',
  call_booked: 'Call Booked', pre_app_sent: 'Pre-App Sent',
  approved: 'Approved', denied: 'Denied'
};
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  qualified: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  outreach: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  call_booked: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  pre_app_sent: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  denied: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const NICHES = ['skool_owners', 'course_creators', 'biz_coaches', 'fitness', 'ecommerce', 'real_estate', 'agency_owners', 'small_biz', 'trades', 'manufacturing', 'other'];

interface Lead {
  id: number;
  full_name: string;
  username: string;
  platform: string;
  profile_url: string;
  bio: string;
  email: string;
  phone: string;
  location: string;
  followers: number;
  niche: string;
  source: string;
  affiliate_type: string;
  lead_score: number;
  stage: string;
  has_responded: boolean;
  notes: string;
  last_contacted_at: string;
  created_at: string;
}

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ stage: '', niche: '', search: '' });
  const [selected, setSelected] = useState<Lead | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.stage) params.stage = filters.stage;
      if (filters.niche) params.niche = filters.niche;
      if (filters.search) params.search = filters.search;
      const data = await api.getLeads(params);
      setLeads(data.leads);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateStage = async (id: number, stage: string) => {
    await api.updateLead(id, { stage });
    fetchLeads();
    if (selected?.id === id) setSelected({ ...selected, stage });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search leads..."
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500 w-64"
          value={filters.search}
          onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none"
          value={filters.stage}
          onChange={(e) => setFilters(f => ({ ...f, stage: e.target.value }))}
        >
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <select
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none"
          value={filters.niche}
          onChange={(e) => setFilters(f => ({ ...f, niche: e.target.value }))}
        >
          <option value="">All Niches</option>
          {NICHES.map(n => <option key={n} value={n}>{n.replace(/_/g, ' ')}</option>)}
        </select>
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Add Lead
        </button>
        <span className="text-xs text-gray-500">{total} leads</span>
      </div>

      {/* Lead Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Name / Handle</th>
              <th>Niche</th>
              <th>Score</th>
              <th>Stage</th>
              <th>Followers</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-gray-500 py-8">Loading...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-500 py-8">No leads yet. Start scraping or add manually.</td></tr>
            ) : leads.map(lead => (
              <tr
                key={lead.id}
                className="cursor-pointer"
                onClick={() => setSelected(lead)}
              >
                <td>
                  <div className="font-medium text-sm">{lead.full_name || '—'}</div>
                  <div className="text-xs text-gray-500">
                    {lead.username ? `@${lead.username}` : ''}
                    {lead.profile_url && (
                      <a
                        href={lead.profile_url}
                        target="_blank"
                        rel="noopener"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-2 text-blue-400 hover:text-blue-300"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                </td>
                <td className="text-xs text-gray-400">{lead.niche?.replace(/_/g, ' ') || '—'}</td>
                <td>
                  <span className={`text-xs font-mono ${lead.lead_score >= 70 ? 'text-green-400' : lead.lead_score >= 40 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {lead.lead_score}
                  </span>
                </td>
                <td>
                  <select
                    className={`text-xs px-2 py-1 rounded-full border ${STAGE_COLORS[lead.stage]} bg-transparent cursor-pointer`}
                    value={lead.stage}
                    onChange={(e) => { e.stopPropagation(); updateStage(lead.id, e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </td>
                <td className="text-xs text-gray-400 font-mono">{lead.followers?.toLocaleString() || '—'}</td>
                <td className="text-xs text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lead Detail Sidebar */}
      {selected && (
        <LeadDetail
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={fetchLeads}
          onStageChange={updateStage}
        />
      )}

      {/* Add Lead Modal */}
      {showAdd && (
        <AddLeadModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchLeads(); }}
        />
      )}
    </div>
  );
}

function LeadDetail({ lead, onClose, onUpdate, onStageChange }: {
  lead: Lead;
  onClose: () => void;
  onUpdate: () => void;
  onStageChange: (id: number, stage: string) => void;
}) {
  const [outreachLogs, setOutreachLogs] = useState<any[]>([]);
  const [dmText, setDmText] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    api.getOutreach({ lead_id: String(lead.id) }).then(setOutreachLogs);
    api.getTemplates().then(setTemplates);
  }, [lead.id]);

  const sendDM = async (templateId?: number) => {
    const message = dmText || (templateId ? templates.find((t: any) => t.id === templateId)?.body : '');
    if (!message) return;
    await api.logOutreach({
      lead_id: lead.id,
      type: 'dm',
      template_id: templateId || null,
      message_sent: message.replace('{name}', lead.full_name || lead.username || ''),
      sent_by: 'steve'
    });
    setDmText('');
    api.getOutreach({ lead_id: String(lead.id) }).then(setOutreachLogs);
    onUpdate();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={onClose}>
      <div className="w-full max-w-lg bg-gray-900 border-l border-gray-800 overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-semibold">{lead.full_name || lead.username || 'Unknown'}</h2>
            {lead.username && <p className="text-sm text-gray-400">@{lead.username}</p>}
            {lead.profile_url && (
              <a href={lead.profile_url} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:text-blue-300">
                View Profile ↗
              </a>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl">✕</button>
        </div>

        {lead.bio && <p className="text-sm text-gray-400 mb-4 bg-gray-800 rounded-lg p-3">{lead.bio}</p>}

        <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
          <div><span className="text-gray-500">Score:</span> <span className="font-mono">{lead.lead_score}</span></div>
          <div><span className="text-gray-500">Followers:</span> <span className="font-mono">{lead.followers?.toLocaleString() || '—'}</span></div>
          <div><span className="text-gray-500">Niche:</span> {lead.niche?.replace(/_/g, ' ')}</div>
          <div><span className="text-gray-500">Source:</span> {lead.source?.replace(/_/g, ' ')}</div>
          {lead.email && <div className="col-span-2"><span className="text-gray-500">Email:</span> {lead.email}</div>}
          {lead.location && <div className="col-span-2"><span className="text-gray-500">Location:</span> {lead.location}</div>}
        </div>

        {/* Stage Selector */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-2">Pipeline Stage</p>
          <div className="flex flex-wrap gap-2">
            {STAGES.map(s => (
              <button
                key={s}
                onClick={() => onStageChange(lead.id, s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  lead.stage === s ? STAGE_COLORS[s] : 'border-gray-700 text-gray-500 hover:text-gray-300'
                }`}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Quick DM */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-2">Log Outreach</p>
          <div className="space-y-2">
            {templates.filter((t: any) => t.is_active).map((t: any) => (
              <button
                key={t.id}
                onClick={() => sendDM(t.id)}
                className="w-full text-left text-xs bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg p-3 transition-colors"
              >
                <span className="text-gray-300 font-medium">{t.variant} — {t.name}</span>
                <p className="text-gray-500 mt-1 line-clamp-2">{t.body}</p>
              </button>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Or type custom message..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                value={dmText}
                onChange={(e) => setDmText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendDM()}
              />
              <button onClick={() => sendDM()} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-sm transition-colors">Send</button>
            </div>
          </div>
        </div>

        {/* Outreach History */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Outreach History ({outreachLogs.length})</p>
          <div className="space-y-2">
            {outreachLogs.length === 0 ? (
              <p className="text-xs text-gray-600">No outreach yet</p>
            ) : outreachLogs.map((log: any) => (
              <div key={log.id} className="bg-gray-800 rounded-lg p-3 text-xs">
                <div className="flex justify-between text-gray-500 mb-1">
                  <span className="uppercase">{log.type}</span>
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <p className="text-gray-300">{log.message_sent}</p>
                {log.template_name && <p className="text-gray-600 mt-1">via {log.template_name}</p>}
                {log.sent_by && <p className="text-gray-600">by {log.sent_by}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    full_name: '', username: '', profile_url: '', bio: '',
    email: '', phone: '', location: '', followers: '',
    niche: 'other', source: 'manual', affiliate_type: 'direct_client', notes: ''
  });

  const handleSubmit = async () => {
    await api.createLead({
      ...form,
      followers: form.followers ? parseInt(form.followers) : null
    });
    onAdded();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Add Lead</h2>
        <div className="space-y-3">
          <input placeholder="Full Name" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} />
          <input placeholder="Instagram Handle" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} />
          <input placeholder="Profile URL" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.profile_url} onChange={e => setForm(f => ({...f, profile_url: e.target.value}))} />
          <textarea placeholder="Bio" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" rows={2} value={form.bio} onChange={e => setForm(f => ({...f, bio: e.target.value}))} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Email" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
            <input placeholder="Followers" type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.followers} onChange={e => setForm(f => ({...f, followers: e.target.value}))} />
          </div>
          <input placeholder="Location" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} />
          <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.niche} onChange={e => setForm(f => ({...f, niche: e.target.value}))}>
            {NICHES.map(n => <option key={n} value={n}>{n.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.affiliate_type} onChange={e => setForm(f => ({...f, affiliate_type: e.target.value}))}>
            <option value="direct_client">Direct Client (needs funding)</option>
            <option value="sub_affiliate">Sub-Affiliate (partner)</option>
          </select>
          <textarea placeholder="Notes" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-sm transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg text-sm font-medium transition-colors">Add Lead</button>
        </div>
      </div>
    </div>
  );
}

const STAGES_ARRAY = STAGES;
