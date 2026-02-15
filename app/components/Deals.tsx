'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

function formatMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function Deals() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchDeals = () => {
    setLoading(true);
    api.getDeals().then(setDeals).finally(() => setLoading(false));
  };

  useEffect(() => { fetchDeals(); }, []);

  const totals = deals.reduce((acc, d) => ({
    funded: acc.funded + parseFloat(d.funded_amount || 0),
    commission: acc.commission + parseFloat(d.commission_amount || 0),
    steve: acc.steve + parseFloat(d.steve_split || 0),
    josh: acc.josh + parseFloat(d.josh_split || 0),
  }), { funded: 0, commission: 0, steve: 0, josh: 0 });

  if (loading) return <div className="p-8" style={{ color: 'var(--t3)' }}>Loading deals...</div>;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>Total Funded</p>
          <p className="text-xl font-semibold">{formatMoney(totals.funded)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>Commission</p>
          <p className="text-xl font-semibold" style={{ color: 'var(--accent)' }}>{formatMoney(totals.commission)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>Steve&apos;s Split</p>
          <p className="text-xl font-semibold">{formatMoney(totals.steve)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>Josh&apos;s Split</p>
          <p className="text-xl font-semibold">{formatMoney(totals.josh)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--t2)' }}>{deals.length} deals</p>
        <button
          onClick={() => setShowAdd(true)}
          className="text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--accent)' }}
        >
          + Log Deal
        </button>
      </div>

      {/* Deals Table */}
      <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Funded</th>
              <th>Fee (8%)</th>
              <th>Commission</th>
              <th>Per Partner</th>
              <th>Status</th>
              <th>Payout Date</th>
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--t3)' }}>No deals yet. First one is coming.</td></tr>
            ) : deals.map((d: any) => (
              <tr key={d.id}>
                <td>
                  <div className="text-sm font-medium">{d.client_name || d.lead_name || '—'}</div>
                  {d.lead_username && <div className="text-xs" style={{ color: 'var(--t3)' }}>@{d.lead_username}</div>}
                </td>
                <td className="font-mono text-sm">{formatMoney(parseFloat(d.funded_amount))}</td>
                <td className="font-mono text-sm" style={{ color: 'var(--t2)' }}>{formatMoney(parseFloat(d.fee_amount))}</td>
                <td className="font-mono text-sm" style={{ color: 'var(--accent)' }}>{formatMoney(parseFloat(d.commission_amount))}</td>
                <td className="font-mono text-sm">{formatMoney(parseFloat(d.steve_split))}</td>
                <td>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    d.status === 'paid_out' ? 'bg-green-500/20 text-green-400' :
                    d.status === 'fee_collected' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {d.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="text-xs" style={{ color: 'var(--t3)' }}>{d.payout_date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <AddDealModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); fetchDeals(); }} />}
    </div>
  );
}

function AddDealModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    client_name: '',
    funded_amount: '',
    fee_percentage: '8',
    commission_rate: '20',
    notes: ''
  });

  const funded = parseFloat(form.funded_amount) || 0;
  const feeAmt = funded * (parseFloat(form.fee_percentage) / 100);
  const commAmt = feeAmt * (parseFloat(form.commission_rate) / 100);
  const split = commAmt / 2;

  const handleSubmit = async () => {
    await api.createDeal(form);
    onAdded();
  };

  const inputStyle = { background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--t1)' };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Log New Deal</h2>
        <div className="space-y-3">
          <input placeholder="Client Name" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} value={form.client_name} onChange={e => setForm(f => ({...f, client_name: e.target.value}))} />
          <input placeholder="Funded Amount ($)" type="number" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} value={form.funded_amount} onChange={e => setForm(f => ({...f, funded_amount: e.target.value}))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: 'var(--t3)' }}>Fee %</label>
              <input type="number" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} value={form.fee_percentage} onChange={e => setForm(f => ({...f, fee_percentage: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--t3)' }}>Commission %</label>
              <input type="number" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} value={form.commission_rate} onChange={e => setForm(f => ({...f, commission_rate: e.target.value}))} />
            </div>
          </div>

          {funded > 0 && (
            <div className="rounded-lg p-3 text-sm space-y-1" style={{ background: 'var(--bg3)' }}>
              <div className="flex justify-between"><span style={{ color: 'var(--t3)' }}>Fee:</span> <span className="font-mono">{formatMoney(feeAmt)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--t3)' }}>Commission:</span> <span className="font-mono" style={{ color: 'var(--accent)' }}>{formatMoney(commAmt)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--t3)' }}>Per partner:</span> <span className="font-mono">{formatMoney(split)}</span></div>
            </div>
          )}

          <textarea placeholder="Notes" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm transition-colors" style={{ background: 'var(--bg3)', color: 'var(--t1)' }}>Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors text-white" style={{ background: 'var(--accent)' }}>Log Deal</button>
        </div>
      </div>
    </div>
  );
}
