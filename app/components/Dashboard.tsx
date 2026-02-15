'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

interface DashboardData {
  pipeline: Record<string, number>;
  totalLeads: number;
  weeklyLeads: number;
  funding: {
    totalFunded: number;
    totalFees: number;
    totalCommission: number;
    steveSplit: number;
    joshSplit: number;
    dealCount: number;
  };
  outreach: {
    total: number;
    dms: number;
    responses: number;
    responseRate: string;
  };
  templates: any[];
  recentScrapes: any[];
}

const STAGES = ['new', 'qualified', 'outreach', 'call_booked', 'pre_app_sent', 'approved', 'denied'];
const STAGE_LABELS: Record<string, string> = {
  new: 'New', qualified: 'Qualified', outreach: 'Outreach',
  call_booked: 'Call Booked', pre_app_sent: 'Pre-App Sent',
  approved: 'Approved', denied: 'Denied'
};
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  qualified: 'bg-cyan-500/20 text-cyan-400',
  outreach: 'bg-yellow-500/20 text-yellow-400',
  call_booked: 'bg-purple-500/20 text-purple-400',
  pre_app_sent: 'bg-orange-500/20 text-orange-400',
  approved: 'bg-green-500/20 text-green-400',
  denied: 'bg-red-500/20 text-red-400'
};

function formatMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8" style={{ color: 'var(--t3)' }}>Loading dashboard...</div>;
  if (error) return <div className="p-8 text-red-400">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Funding Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total Funded" value={formatMoney(data.funding.totalFunded)} sub={`${data.funding.dealCount} deals`} />
        <StatCard label="Fee Pool" value={formatMoney(data.funding.totalFees)} sub="7 Figures fees" />
        <StatCard label="Our Commission" value={formatMoney(data.funding.totalCommission)} sub="20% of fees" />
        <StatCard label="Per Partner" value={formatMoney(data.funding.steveSplit)} sub="50/50 split" />
      </div>

      {/* Pipeline + Outreach */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* Pipeline */}
        <div className="rounded-xl p-4 md:p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          <h3 className="text-sm font-medium mb-3 md:mb-4" style={{ color: 'var(--t2)' }}>Pipeline ({data.totalLeads} leads)</h3>
          <div className="space-y-2">
            {STAGES.map(stage => (
              <div key={stage} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full ${STAGE_COLORS[stage]}`}>
                  {STAGE_LABELS[stage]}
                </span>
                <span className="text-sm font-mono" style={{ color: 'var(--t2)' }}>{data.pipeline[stage] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Outreach Stats */}
        <div className="rounded-xl p-4 md:p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          <h3 className="text-sm font-medium mb-3 md:mb-4" style={{ color: 'var(--t2)' }}>Outreach Performance</h3>
          <div className="space-y-3 md:space-y-4">
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--t3)' }}>Total Messages</span>
              <span className="font-mono">{data.outreach.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--t3)' }}>DMs Sent</span>
              <span className="font-mono">{data.outreach.dms}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--t3)' }}>Responses</span>
              <span className="font-mono">{data.outreach.responses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--t3)' }}>Response Rate</span>
              <span className="font-mono" style={{ color: 'var(--accent)' }}>{data.outreach.responseRate}%</span>
            </div>
          </div>

          {/* Template Performance */}
          {data.templates.length > 0 && (
            <div className="mt-4 md:mt-6 pt-3 md:pt-4" style={{ borderTop: '1px solid var(--bd)' }}>
              <h4 className="text-xs font-medium mb-3" style={{ color: 'var(--t3)' }}>Template A/B/C</h4>
              {data.templates.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-1.5">
                  <span className="text-xs md:text-sm" style={{ color: 'var(--t2)' }}>{t.variant} — {t.name}</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--t3)' }}>
                    {t.times_sent} sent · {t.reply_rate}% reply
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly + Scrape Activity */}
      <div className="rounded-xl p-4 md:p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--t2)' }}>Recent Activity</h3>
        <p className="text-sm" style={{ color: 'var(--t3)' }}>
          <span className="font-mono" style={{ color: 'var(--t1)' }}>{data.weeklyLeads}</span> leads scraped this week
          {data.recentScrapes.length > 0 && (
            <> · Last batch: {data.recentScrapes[0].leads_new} new from &quot;{data.recentScrapes[0].niche}&quot;</>
          )}
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl p-3 md:p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--t3)' }}>{label}</p>
      <p className="text-lg md:text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-[10px] md:text-xs mt-1" style={{ color: 'var(--t4)' }}>{sub}</p>
    </div>
  );
}
