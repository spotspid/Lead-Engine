'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export default function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fetch = () => {
    setLoading(true);
    api.getTemplates().then(setTemplates).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const save = async (data: any) => {
    if (data.id) {
      await api.updateTemplate(data);
    } else {
      await api.createTemplate(data);
    }
    setEditing(null);
    setShowAdd(false);
    fetch();
  };

  if (loading) return <div className="p-8" style={{ color: 'var(--t3)' }}>Loading templates...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--t2)' }}>{templates.length} templates</p>
        <button
          onClick={() => setShowAdd(true)}
          className="text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--accent)' }}
        >
          + New Template
        </button>
      </div>

      <div className="grid gap-4">
        {templates.map((t: any) => (
          <div key={t.id} className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs font-mono px-2 py-0.5 rounded mr-2" style={{ color: 'var(--t3)', background: 'var(--bg3)' }}>
                  {t.variant}
                </span>
                <span className="font-medium">{t.name}</span>
                {!t.is_active && <span className="ml-2 text-xs text-red-400">(inactive)</span>}
              </div>
              <button
                onClick={() => setEditing(t)}
                className="text-xs" style={{ color: 'var(--t3)' }}
              >
                Edit
              </button>
            </div>

            <p className="text-sm rounded-lg p-3 mb-4 whitespace-pre-wrap" style={{ color: 'var(--t2)', background: 'var(--bg3)' }}>{t.body}</p>

            <div className="flex gap-6 text-xs" style={{ color: 'var(--t3)' }}>
              <span>Sent: <span className="font-mono" style={{ color: 'var(--t2)' }}>{t.times_sent}</span></span>
              <span>Replied: <span className="font-mono" style={{ color: 'var(--t2)' }}>{t.times_replied}</span></span>
              <span>Converted: <span className="font-mono" style={{ color: 'var(--t2)' }}>{t.times_converted}</span></span>
              <span>Reply Rate: <span className={`font-mono ${parseFloat(t.reply_rate) > 10 ? 'text-green-400' : ''}`} style={parseFloat(t.reply_rate) <= 10 ? { color: 'var(--t2)' } : undefined}>{t.reply_rate}%</span></span>
              <span>Conv Rate: <span className={`font-mono ${parseFloat(t.conversion_rate) > 5 ? 'text-green-400' : ''}`} style={parseFloat(t.conversion_rate) <= 5 ? { color: 'var(--t2)' } : undefined}>{t.conversion_rate}%</span></span>
            </div>

            {t.target_niche && (
              <p className="text-xs mt-2" style={{ color: 'var(--t4)' }}>Target: {t.target_niche.replace(/_/g, ' ')} · {t.target_affiliate_type?.replace(/_/g, ' ')}</p>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {(showAdd || editing) && (
        <TemplateForm
          template={editing}
          onSave={save}
          onClose={() => { setEditing(null); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function TemplateForm({ template, onSave, onClose }: {
  template: any;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    id: template?.id || null,
    name: template?.name || '',
    variant: template?.variant || 'A',
    body: template?.body || '',
    target_niche: template?.target_niche || '',
    target_affiliate_type: template?.target_affiliate_type || 'sub_affiliate',
    is_active: template?.is_active ?? true,
  });

  const inputStyle = { background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--t1)' };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{template ? 'Edit' : 'New'} Template</h2>
        <div className="space-y-3">
          <div className="flex gap-3">
            <select className="rounded-lg px-3 py-2 text-sm w-20" style={inputStyle} value={form.variant} onChange={e => setForm(f => ({...f, variant: e.target.value}))}>
              {['A','B','C','D','E'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input placeholder="Template Name" className="flex-1 rounded-lg px-3 py-2 text-sm" style={inputStyle} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </div>
          <textarea
            placeholder="Message body. Use {name} for personalization."
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={inputStyle}
            rows={5}
            value={form.body}
            onChange={e => setForm(f => ({...f, body: e.target.value}))}
          />
          <p className="text-xs" style={{ color: 'var(--t4)' }}>Variables: {'{name}'} = lead&apos;s name/handle</p>
          {template && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} />
              Active
            </label>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm transition-colors" style={{ background: 'var(--bg3)', color: 'var(--t1)' }}>Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors text-white" style={{ background: 'var(--accent)' }}>Save</button>
        </div>
      </div>
    </div>
  );
}
