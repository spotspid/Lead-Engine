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

  if (loading) return <div className="p-8 text-gray-500">Loading templates...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">{templates.length} templates</p>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Template
        </button>
      </div>

      <div className="grid gap-4">
        {templates.map((t: any) => (
          <div key={t.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded mr-2">
                  {t.variant}
                </span>
                <span className="font-medium">{t.name}</span>
                {!t.is_active && <span className="ml-2 text-xs text-red-400">(inactive)</span>}
              </div>
              <button
                onClick={() => setEditing(t)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Edit
              </button>
            </div>

            <p className="text-sm text-gray-400 bg-gray-800 rounded-lg p-3 mb-4 whitespace-pre-wrap">{t.body}</p>

            <div className="flex gap-6 text-xs text-gray-500">
              <span>Sent: <span className="text-gray-300 font-mono">{t.times_sent}</span></span>
              <span>Replied: <span className="text-gray-300 font-mono">{t.times_replied}</span></span>
              <span>Converted: <span className="text-gray-300 font-mono">{t.times_converted}</span></span>
              <span>Reply Rate: <span className={`font-mono ${parseFloat(t.reply_rate) > 10 ? 'text-green-400' : 'text-gray-300'}`}>{t.reply_rate}%</span></span>
              <span>Conv Rate: <span className={`font-mono ${parseFloat(t.conversion_rate) > 5 ? 'text-green-400' : 'text-gray-300'}`}>{t.conversion_rate}%</span></span>
            </div>

            {t.target_niche && (
              <p className="text-xs text-gray-600 mt-2">Target: {t.target_niche.replace(/_/g, ' ')} · {t.target_affiliate_type?.replace(/_/g, ' ')}</p>
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{template ? 'Edit' : 'New'} Template</h2>
        <div className="space-y-3">
          <div className="flex gap-3">
            <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-20" value={form.variant} onChange={e => setForm(f => ({...f, variant: e.target.value}))}>
              {['A','B','C','D','E'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input placeholder="Template Name" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </div>
          <textarea
            placeholder="Message body. Use {name} for personalization."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            rows={5}
            value={form.body}
            onChange={e => setForm(f => ({...f, body: e.target.value}))}
          />
          <p className="text-xs text-gray-600">Variables: {'{name}'} = lead&apos;s name/handle</p>
          {template && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} />
              Active
            </label>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-sm transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}
