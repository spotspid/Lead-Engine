'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api-client';

const NICHE_PRESETS: Record<string, string> = {
  skool_owners: 'site:instagram.com "skool" "community" "owner" OR "founder"',
  course_creators: 'site:instagram.com "course creator" OR "online course" "students"',
  biz_coaches: 'site:instagram.com "business coach" OR "biz coach" "helping" OR "DM me"',
  fitness: 'site:instagram.com "fitness coach" OR "personal trainer" "online coaching"',
  ecommerce: 'site:instagram.com "ecommerce" OR "shopify" "store owner" OR "brand"',
  real_estate: 'site:instagram.com "real estate investor" OR "realtor" "deals" OR "properties"',
  agency_owners: 'site:instagram.com "agency owner" OR "marketing agency" "founder"',
  small_biz: 'site:instagram.com "small business" "owner" OR "founder" "local"',
  trades: 'site:instagram.com "contractor" OR "electrician" OR "plumber" "business"',
  manufacturing: 'site:instagram.com "manufacturer" OR "manufacturing" "founder" OR "CEO"',
};

const NICHE_LABELS: Record<string, string> = {
  skool_owners: 'Skool Owners',
  course_creators: 'Course Creators',
  biz_coaches: 'Biz Coaches',
  fitness: 'Fitness',
  ecommerce: 'Ecom',
  real_estate: 'Real Estate',
  agency_owners: 'Agency Owners',
  small_biz: 'Small Biz',
  trades: 'Trades',
  manufacturing: 'Manufacturing',
};

export default function Scraper() {
  const [mode, setMode] = useState<'google' | 'apify'>('google');
  const [niche, setNiche] = useState('skool_owners');
  const [customQuery, setCustomQuery] = useState('');
  const [resultCount, setResultCount] = useState(10);
  const [scraping, setScraping] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [apifyToken, setApifyToken] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('apify-token') || '';
    return '';
  });
  const [apifyActor, setApifyActor] = useState('apify/instagram-profile-scraper');
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 50);
  };

  const query = customQuery || NICHE_PRESETS[niche] || '';

  const handleGoogleScrape = async () => {
    if (!query) { addLog('ERROR: No query set'); return; }
    setScraping(true);
    setLogs([]);
    addLog(`Starting Google Search scrape...`);
    addLog(`Niche: ${NICHE_LABELS[niche] || niche}`);
    addLog(`Query: ${query}`);
    addLog(`Requesting ${resultCount} results...`);

    try {
      const result = await api.scrape({ query, count: resultCount, niche });
      addLog(`Search complete.`);
      addLog(`Found: ${result.total} profiles`);
      addLog(`New leads saved: ${result.new}`);
      addLog(`Duplicates skipped: ${result.duplicates}`);
      if (result.leads?.length > 0) {
        addLog(`---`);
        result.leads.forEach((l: any) => {
          addLog(`+ @${l.username}${l.full_name ? ` (${l.full_name})` : ''}`);
        });
      }
      addLog(`Done.`);
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    }
    setScraping(false);
  };

  const handleApifyScrape = async () => {
    if (!apifyToken) { addLog('ERROR: Apify token not set'); return; }
    if (!query) { addLog('ERROR: No query set'); return; }

    // Save token
    localStorage.setItem('apify-token', apifyToken);

    setScraping(true);
    setLogs([]);
    addLog(`Starting Apify scrape...`);
    addLog(`Actor: ${apifyActor}`);
    addLog(`Query: ${query}`);
    addLog(`Requesting ${resultCount} results...`);

    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${apifyActor}/run-sync-get-dataset-items?token=${apifyToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            search: query,
            resultsLimit: resultCount,
            searchType: 'user',
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        addLog(`ERROR: Apify returned ${res.status}: ${errText.slice(0, 200)}`);
        setScraping(false);
        return;
      }

      const results = await res.json();
      addLog(`Apify returned ${results.length} results`);

      // Check for duplicates and save new leads
      let newCount = 0;
      let dupCount = 0;
      const leadsToSave: any[] = [];

      // Fetch existing leads for dup check
      const existingData = await api.getLeads({ limit: '10000' });
      const existingUsernames = new Set(
        (existingData.leads || []).map((l: any) => (l.username || '').toLowerCase())
      );

      for (const r of results) {
        const handle = (r.username || r.profileName || '').replace(/^@/, '').trim().toLowerCase();
        if (!handle) continue;

        if (existingUsernames.has(handle)) {
          dupCount++;
          addLog(`  SKIP (dup): @${handle}`);
          continue;
        }

        existingUsernames.add(handle);
        leadsToSave.push({
          full_name: r.fullName || r.name || null,
          username: handle,
          platform: 'instagram',
          profile_url: r.url || r.profileUrl || `https://instagram.com/${handle}`,
          bio: r.biography || r.bio || null,
          email: r.email || null,
          followers: r.followersCount || r.followers || null,
          niche: niche || 'other',
          source: 'instagram_google',
          lead_score: 0,
        });
        newCount++;
        addLog(`  + @${handle}${r.fullName ? ` (${r.fullName})` : ''}`);
      }

      // Batch save new leads
      if (leadsToSave.length > 0) {
        await api.createLeads(leadsToSave);
      }

      // Log scrape batch
      await api.logScrapeBatch({
        source: 'instagram_google',
        niche: niche || 'other',
        search_query: query,
        leads_found: results.length,
        leads_new: newCount,
        leads_duplicate: dupCount,
      });

      addLog(`---`);
      addLog(`New leads saved: ${newCount}`);
      addLog(`Duplicates skipped: ${dupCount}`);
      addLog(`Done.`);
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    }
    setScraping(false);
  };

  const inputStyle = { background: 'var(--bg3)', border: '1px solid var(--bd2)', color: 'var(--t1)' };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('google')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: mode === 'google' ? 'var(--accent)' : 'var(--bg3)',
            color: mode === 'google' ? 'white' : 'var(--t2)',
          }}
        >
          Google Search
        </button>
        <button
          onClick={() => setMode('apify')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: mode === 'apify' ? 'var(--accent)' : 'var(--bg3)',
            color: mode === 'apify' ? 'white' : 'var(--t2)',
          }}
        >
          Apify
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Config Panel */}
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          {mode === 'apify' && (
            <>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Apify API Token</label>
                <input
                  type="password"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={inputStyle}
                  value={apifyToken}
                  onChange={(e) => setApifyToken(e.target.value)}
                  placeholder="apify_api_..."
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Actor</label>
                <input
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={inputStyle}
                  value={apifyActor}
                  onChange={(e) => setApifyActor(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Niche Preset</label>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
              value={niche}
              onChange={(e) => { setNiche(e.target.value); setCustomQuery(''); }}
            >
              {Object.entries(NICHE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Custom Query Override</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Leave empty to use preset query"
            />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Query Preview</label>
            <p className="text-xs font-mono p-2 rounded-lg break-all" style={{ background: 'var(--bg3)', color: 'var(--t3)' }}>
              {query}
            </p>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Result Count</label>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
              value={resultCount}
              onChange={(e) => setResultCount(parseInt(e.target.value))}
            >
              {[10, 20, 30, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            onClick={mode === 'google' ? handleGoogleScrape : handleApifyScrape}
            disabled={scraping}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors text-white disabled:opacity-50"
            style={{ background: scraping ? 'var(--bg4)' : 'var(--accent)' }}
          >
            {scraping ? 'Scraping...' : 'Scrape'}
          </button>
        </div>

        {/* Log Output */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--t2)' }}>Console Output</h3>
          <div
            ref={logRef}
            className="rounded-lg p-3 h-80 overflow-y-auto font-mono text-xs space-y-1"
            style={{ background: 'var(--bg)', color: 'var(--t3)' }}
          >
            {logs.length === 0 ? (
              <p style={{ color: 'var(--t4)' }}>Ready. Select a niche and click Scrape.</p>
            ) : logs.map((line, i) => (
              <div key={i} style={{ color: line.includes('ERROR') ? '#ef4444' : line.startsWith('[') && line.includes('+') ? 'var(--accent)' : 'var(--t3)' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
