'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { NICHE_QUERIES, APIFY_QUERIES, NICHE_LABELS } from '@/lib/scrape-queries';

const DEFAULT_EXCLUDE = 'official, games, media, news, magazine, podcast, network, clothing, apparel, records, music, memes, quotes';

interface Filters {
  minFollowers: number;
  maxFollowers: number;
  excludeKeywords: string;
  excludeVerified: boolean;
}

const DEFAULT_FILTERS: Filters = {
  minFollowers: 500,
  maxFollowers: 100000,
  excludeKeywords: DEFAULT_EXCLUDE,
  excludeVerified: true,
};

function loadFilters(): Filters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem('le-scrape-filters');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_FILTERS, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_FILTERS;
}

function saveFilters(f: Filters) {
  try {
    localStorage.setItem('le-scrape-filters', JSON.stringify(f));
  } catch { /* ignore */ }
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function Scraper() {
  const [mode, setMode] = useState<'google' | 'apify'>('google');
  const [niche, setNiche] = useState('skool_owners');
  const [customQuery, setCustomQuery] = useState('');
  const [targetLeads, setTargetLeads] = useState(10);
  const [costLimit, setCostLimit] = useState(0.25);
  const [autoRotate, setAutoRotate] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Query rotation state
  const [queryIndex, setQueryIndex] = useState(0);
  const [usedQueries, setUsedQueries] = useState<Set<string>>(new Set());

  // Filter state (persisted to localStorage)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const logRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load filters from localStorage on mount
  useEffect(() => {
    setFilters(loadFilters());
  }, []);

  // Save filters whenever they change (skip initial default)
  const filtersLoaded = useRef(false);
  useEffect(() => {
    if (!filtersLoaded.current) {
      filtersLoaded.current = true;
      return;
    }
    saveFilters(filters);
  }, [filters]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Pick the right query list based on mode
  const activeQueryMap = mode === 'google' ? NICHE_QUERIES : APIFY_QUERIES;
  const nicheQueries = activeQueryMap[niche] || [];
  const totalQueries = nicheQueries.length;

  // Parse exclude keywords into array
  const excludeKeywordsArray = filters.excludeKeywords
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  // Load used queries for current niche
  const loadUsedQueries = useCallback(async () => {
    try {
      const batches = await api.getScrapeBatches();
      const usedForNiche = new Set<string>(
        batches
          .filter((b: any) => b.niche === niche)
          .map((b: any) => b.search_query)
      );
      setUsedQueries(usedForNiche);

      const firstUnused = nicheQueries.findIndex(q => !usedForNiche.has(q));
      setQueryIndex(firstUnused >= 0 ? firstUnused : 0);
    } catch {
      setUsedQueries(new Set());
      setQueryIndex(0);
    }
  }, [niche, nicheQueries]);

  useEffect(() => {
    loadUsedQueries();
  }, [niche, mode, loadUsedQueries]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 50);
  };

  const unusedCount = nicheQueries.filter(q => !usedQueries.has(q)).length;
  const allExhausted = unusedCount === 0 && totalQueries > 0;

  const advanceQuery = () => {
    setQueryIndex(prev => (prev + 1) % totalQueries);
  };

  const resetRotation = async () => {
    setUsedQueries(new Set());
    setQueryIndex(0);
    addLog(`Rotation reset for ${NICHE_LABELS[niche]}. All ${totalQueries} queries available.`);
  };

  /** Client-side filter for Apify results */
  function applyClientFilter(handle: string, name: string, bio: string, followers: number | null): string | null {
    // Follower range
    if (followers && followers > 0 && followers < filters.minFollowers) {
      return `${formatFollowers(followers)} followers below ${formatFollowers(filters.minFollowers)} min`;
    }
    if (followers && followers > 0 && followers > filters.maxFollowers) {
      return `${formatFollowers(followers)} followers exceeds ${formatFollowers(filters.maxFollowers)} max`;
    }
    // Keyword exclusion
    const handleLow = handle.toLowerCase();
    const nameLow = name.toLowerCase();
    const bioLow = bio.toLowerCase();
    for (const kw of excludeKeywordsArray) {
      const kwLow = kw.toLowerCase();
      if (handleLow.includes(kwLow) || nameLow.includes(kwLow) || bioLow.includes(kwLow)) {
        return `matches exclude keyword: ${kw}`;
      }
    }
    // Verified check — Apify results have isVerified field
    // (handled inline in the loop below)
    return null;
  }

  // ─── GOOGLE SEARCH HANDLER ───
  const handleGoogleScrape = async () => {
    setScraping(true);
    setLogs([]);

    const isCustom = !!customQuery;
    addLog(`🔄 Starting Google Search scrape...`);
    addLog(`Niche: ${NICHE_LABELS[niche] || niche}`);
    addLog(`Target: ${targetLeads} new leads | Cost limit: $${costLimit.toFixed(2)}`);
    addLog(`Filters: ${filters.minFollowers.toLocaleString()}-${filters.maxFollowers.toLocaleString()} followers | ${excludeKeywordsArray.length} exclude keywords | Verified: ${filters.excludeVerified ? 'excluded' : 'included'}`);
    if (isCustom) {
      addLog(`Custom query: ${customQuery}`);
    } else {
      addLog(`Auto-rotate: ${autoRotate ? 'ON' : 'OFF'} | ${unusedCount} of ${totalQueries} queries unused`);
    }
    addLog(`---`);
    addLog(`📡 Searching via Serper → preFilter → Claude scoring... (5-15 seconds)`);

    const slowTimer = setTimeout(() => {
      addLog(`⏳ Still working... Claude is scoring the results`);
    }, 20000);

    try {
      const result = await api.scrape({
        query: isCustom ? customQuery : undefined,
        niche,
        target_leads: targetLeads,
        cost_limit: costLimit,
        auto_rotate: isCustom ? false : autoRotate,
        min_followers: filters.minFollowers,
        max_followers: filters.maxFollowers,
        exclude_keywords: excludeKeywordsArray,
        exclude_verified: filters.excludeVerified,
      });

      clearTimeout(slowTimer);

      // Render per-query results
      for (const qr of result.query_results || []) {
        if (qr.error) {
          addLog(`ERROR on query ${qr.query_index}: ${qr.error}`);
          continue;
        }
        const shortQuery = qr.query.length > 60 ? qr.query.slice(0, 57) + '...' : qr.query;
        addLog(`🔄 Query ${qr.query_index} of ${result.queries_available}: ${shortQuery}`);
        if (qr.serper_raw !== undefined) {
          addLog(`🔎 Serper: ${qr.serper_raw} raw → ${qr.serper_after_prefilter} after preFilter`);
        }
        addLog(`📡 Claude scored ${qr.raw_count} leads, applying filters...`);

        // Show filtered-out details
        if (qr.filtered_details && qr.filtered_details.length > 0) {
          for (const f of qr.filtered_details) {
            addLog(`  ⛔ Skipped @${f.handle} — ${f.reason}`);
          }
        }

        if (qr.filtered_out > 0) {
          addLog(`✅ ${qr.passed_count} leads passed filters (${qr.filtered_out} filtered out)`);
        }

        addLog(`✅ ${qr.new} new leads, ${qr.duplicates} duplicates skipped — ${Math.min(result.total_new, targetLeads)} of ${targetLeads} target`);
        addLog(`💰 Query cost: $${qr.cost.toFixed(4)} (${qr.input_tokens} in / ${qr.output_tokens} out)`);

        if (qr.leads?.length > 0) {
          for (const l of qr.leads) {
            addLog(`  + @${l.username}${l.full_name ? ` (${l.full_name})` : ''}`);
          }
        }
      }

      addLog(`---`);
      const emoji = result.stop_reason === 'target_reached' ? '🏁' :
                     result.stop_reason === 'cost_limit' ? '⚠️' : '📋';
      const reason = result.stop_reason === 'target_reached' ? 'Target reached!' :
                     result.stop_reason === 'cost_limit' ? `Cost limit hit ($${result.estimated_cost.toFixed(4)} of $${costLimit.toFixed(2)})` :
                     `All queries used — got ${result.total_new} of ${targetLeads} target`;
      addLog(`${emoji} ${reason}`);
      if (result.total_filtered > 0) {
        addLog(`🔍 ${result.total_filtered} total leads filtered out across all queries`);
      }
      addLog(`✅ Done! ${result.total_new} new leads from ${result.queries_run} queries. Total cost: $${result.estimated_cost.toFixed(4)}`);

      loadUsedQueries();
    } catch (e: any) {
      clearTimeout(slowTimer);
      addLog(`ERROR: ${e.message}`);
    }
    setScraping(false);
  };

  // ─── APIFY HANDLER (server-side token) ───
  const handleApifyScrape = async () => {
    const apifyQuery = customQuery || nicheQueries[queryIndex] || '';
    if (!apifyQuery) { addLog('ERROR: No query set'); return; }

    setScraping(true);
    setLogs([]);
    addLog(`🔄 Starting Apify Instagram scrape...`);
    addLog(`Query: ${apifyQuery}`);
    addLog(`Requesting ${targetLeads} results...`);
    addLog(`Filters: ${filters.minFollowers.toLocaleString()}-${filters.maxFollowers.toLocaleString()} followers | ${excludeKeywordsArray.length} exclude keywords | Verified: ${filters.excludeVerified ? 'excluded' : 'included'}`);
    addLog(`📡 Waiting for Apify results... (this can take 15-30 seconds)`);

    const slowTimer = setTimeout(() => {
      addLog(`⏳ Still working... Apify can take up to 2 minutes for larger batches`);
    }, 30000);

    try {
      const results = await api.apifyScrape({
        query: apifyQuery,
        count: targetLeads,
        niche,
      });

      clearTimeout(slowTimer);

      if (!Array.isArray(results)) {
        addLog(`ERROR: ${results.error || 'Unexpected response from server'}`);
        setScraping(false);
        return;
      }

      addLog(`📡 Got ${results.length} raw results, applying filters...`);

      let newCount = 0;
      let dupCount = 0;
      let filteredCount = 0;
      const leadsToSave: any[] = [];

      const existingData = await api.getLeads({ limit: '10000' });
      const existingUsernames = new Set(
        (existingData.leads || []).map((l: any) => (l.username || '').toLowerCase())
      );

      for (const r of results) {
        const handle = (r.username || r.profileName || '').replace(/^@/, '').trim().toLowerCase();
        if (!handle) continue;

        const name = r.fullName || r.name || '';
        const bio = r.biography || r.bio || '';
        const followerCount = r.followersCount || r.followers || null;

        // Check verified
        if (filters.excludeVerified && (r.verified || r.isVerified)) {
          addLog(`  ⛔ Skipped @${handle} — verified account`);
          filteredCount++;
          continue;
        }

        // Apply client-side filters
        const filterReason = applyClientFilter(handle, name, bio, followerCount);
        if (filterReason) {
          addLog(`  ⛔ Skipped @${handle} — ${filterReason}`);
          filteredCount++;
          continue;
        }

        if (existingUsernames.has(handle)) {
          dupCount++;
          addLog(`  SKIP (dup): @${handle}`);
          continue;
        }

        existingUsernames.add(handle);
        leadsToSave.push({
          full_name: name || null,
          username: handle,
          platform: 'instagram',
          profile_url: r.url || r.profileUrl || `https://instagram.com/${handle}`,
          bio: bio || null,
          email: r.email || null,
          followers: followerCount || null,
          niche: niche || 'other',
          source: 'instagram_apify',
          lead_score: 0,
        });
        newCount++;
        addLog(`  + @${handle}${name ? ` (${name})` : ''}`);
      }

      if (filteredCount > 0) {
        addLog(`✅ ${results.length - filteredCount} leads passed filters (${filteredCount} filtered out)`);
      }

      if (leadsToSave.length > 0) {
        addLog(`💾 Saving ${leadsToSave.length} new leads to database...`);
        await api.createLeads(leadsToSave);
      }

      await api.logScrapeBatch({
        source: 'instagram_apify',
        niche: niche || 'other',
        search_query: apifyQuery,
        leads_found: results.length,
        leads_new: newCount,
        leads_duplicate: dupCount,
      });

      addLog(`---`);
      addLog(`✅ Done! ${newCount} new leads saved, ${dupCount} duplicates skipped, ${filteredCount} filtered out`);
      addLog(`💰 Apify credits used — check your Apify dashboard for exact cost.`);

      loadUsedQueries();
    } catch (e: any) {
      clearTimeout(slowTimer);
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
          className="px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 md:flex-none"
          style={{
            background: mode === 'google' ? 'var(--accent)' : 'var(--bg3)',
            color: mode === 'google' ? 'white' : 'var(--t2)',
          }}
        >
          Google Search
        </button>
        <button
          onClick={() => setMode('apify')}
          className="px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 md:flex-none"
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
        <div className="rounded-xl p-4 md:p-5 space-y-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          {/* Niche Dropdown */}
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

          {/* Query Rotation Indicator (both modes, when no custom query) */}
          {!customQuery && (
            <div className="rounded-lg p-3" style={{ background: 'var(--bg3)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--t2)' }}>
                  {mode === 'google' ? 'Google' : 'Apify'} Query {queryIndex + 1} of {totalQueries}
                </span>
                <span className="text-xs" style={{ color: allExhausted ? '#f59e0b' : 'var(--accent)' }}>
                  {allExhausted ? 'All used' : `${unusedCount} unused`}
                </span>
              </div>
              <p className="text-xs font-mono break-all mb-2" style={{ color: 'var(--t4)' }}>
                {nicheQueries[queryIndex] || '—'}
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={advanceQuery}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ background: 'var(--bg4)', color: 'var(--t2)' }}
                >
                  Next Query
                </button>
                <button
                  onClick={resetRotation}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ background: 'var(--bg4)', color: 'var(--t2)' }}
                >
                  Reset Rotation
                </button>
                {mode === 'google' && (
                  <label className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: 'var(--t3)' }}>
                    <input
                      type="checkbox"
                      checked={autoRotate}
                      onChange={(e) => setAutoRotate(e.target.checked)}
                    />
                    Auto-Rotate
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ─── FILTERS SECTION ─── */}
          <div className="rounded-lg p-3 space-y-3" style={{ background: 'var(--bg3)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--t2)' }}>Filters</span>
              <span className="text-xs hidden sm:inline" style={{ color: 'var(--t4)' }}>Skip irrelevant accounts</span>
            </div>

            {/* Follower Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--t4)' }}>Min Followers</label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded px-2 py-1.5 text-xs"
                  style={inputStyle}
                  value={filters.minFollowers}
                  onChange={(e) => updateFilter('minFollowers', Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
              <div>
                <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--t4)' }}>Max Followers</label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded px-2 py-1.5 text-xs"
                  style={inputStyle}
                  value={filters.maxFollowers}
                  onChange={(e) => updateFilter('maxFollowers', Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>

            {/* Exclude Keywords */}
            <div>
              <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--t4)' }}>Exclude Keywords (comma-separated)</label>
              <input
                className="w-full rounded px-2 py-1.5 text-xs"
                style={inputStyle}
                value={filters.excludeKeywords}
                onChange={(e) => updateFilter('excludeKeywords', e.target.value)}
                placeholder="official, games, media, news..."
              />
            </div>

            {/* Exclude Verified Toggle */}
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--t3)' }}>
              <input
                type="checkbox"
                checked={filters.excludeVerified}
                onChange={(e) => updateFilter('excludeVerified', e.target.checked)}
              />
              Exclude verified accounts
              <span className="text-[10px] hidden sm:inline" style={{ color: 'var(--t4)' }}>(too big to cold DM)</span>
            </label>
          </div>

          {/* Custom Query Override */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Custom Query Override</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder={mode === 'google' ? 'Leave empty to use preset rotation' : 'Simple keywords (e.g. "fitness coach")'}
            />
          </div>

          {/* Target Leads + Cost Limit row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Target New Leads</label>
              <input
                type="number"
                min="1"
                max="200"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
                value={targetLeads}
                onChange={(e) => setTargetLeads(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            {mode === 'google' && (
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--t3)' }}>Cost Limit ($)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.05"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={inputStyle}
                  value={costLimit}
                  onChange={(e) => setCostLimit(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                />
              </div>
            )}
          </div>

          {/* Scrape Button with spinner */}
          <button
            onClick={mode === 'google' ? handleGoogleScrape : handleApifyScrape}
            disabled={scraping}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: scraping ? 'var(--bg4)' : 'var(--accent)' }}
          >
            {scraping && <span className="scrape-spinner" />}
            {scraping ? 'Scraping...' : `Scrape ${targetLeads} Leads`}
          </button>
        </div>

        {/* Log Output */}
        <div className="rounded-xl p-4 md:p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--t2)' }}>Console Output</h3>
            {scraping && (
              <span className="scrape-pulse text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg3)', color: 'var(--accent)' }}>
                LIVE
              </span>
            )}
          </div>
          <div
            ref={logRef}
            className="rounded-lg p-3 h-64 md:h-96 overflow-y-auto font-mono text-xs space-y-0.5"
            style={{ background: 'var(--bg)', color: 'var(--t3)' }}
          >
            {logs.length === 0 ? (
              <p style={{ color: 'var(--t4)' }}>Ready. Select a niche and click Scrape.</p>
            ) : logs.map((line, i) => {
              const isWaiting = scraping && i === logs.length - 1 && (line.includes('Waiting') || line.includes('Calling'));
              return (
                <div key={i} style={{
                  color: line.includes('ERROR') ? '#ef4444' :
                         line.startsWith('🏁') ? 'var(--accent)' :
                         line.startsWith('⚠️') ? '#f59e0b' :
                         line.startsWith('✅') ? 'var(--accent)' :
                         line.startsWith('🔄') ? 'var(--t2)' :
                         line.startsWith('💰') ? '#a78bfa' :
                         line.startsWith('💾') ? '#a78bfa' :
                         line.startsWith('📡') ? 'var(--t2)' :
                         line.startsWith('⏳') ? '#f59e0b' :
                         line.startsWith('🔍') ? 'var(--t2)' :
                         line.includes('⛔') ? '#f97316' :
                         line.startsWith('  +') ? 'var(--accent)' :
                         'var(--t3)'
                }}>
                  {line}{isWaiting && <span className="scrape-dots" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
