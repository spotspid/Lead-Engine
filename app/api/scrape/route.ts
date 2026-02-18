import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { NICHE_QUERIES } from '@/lib/scrape-queries';

// Allow up to 5 minutes for multi-query scrapes (Vercel Pro needed for >60s; Hobby caps at 60s)
export const maxDuration = 300;

// Cost per token for claude-sonnet-4-20250514
const INPUT_COST_PER_1K = 0.003;
const OUTPUT_COST_PER_1K = 0.015;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_1K / 1000) + (outputTokens * OUTPUT_COST_PER_1K / 1000);
}

// Delay between API calls to stay under 30K input tokens/minute rate limit.
// Each web_search call uses ~10-15K input tokens, so 35s keeps us safely under the cap.
const INTER_QUERY_DELAY_MS = 35_000;
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Pre-filter keywords — a profile must mention at least one to be kept */
const PRE_FILTER_KEYWORDS = [
  'coach', 'founder', 'course', 'community', 'skool', 'creator',
  'entrepreneur', 'startup', 'business', 'agency', 'ecom', 'fitness',
  'mentor', 'educator',
];

/** Drop profiles whose combined text doesn't mention any pre-filter keyword */
function preFilterProfiles(profiles: any[]): any[] {
  const before = profiles.length;
  const passed = profiles.filter(p => {
    const text = [
      p.handle || p.username || '',
      p.name || '',
      p.bio || p.qualified_reason || '',
    ].join(' ').toLowerCase();
    return PRE_FILTER_KEYWORDS.some(kw => text.includes(kw));
  });
  const dropped = before - passed.length;
  if (dropped > 0) {
    console.log(`[pre-filter] Dropped ${dropped} of ${before} profiles (no qualifying keywords)`);
  }
  return passed;
}

/** Format follower count like "3.2M", "150K", or "800" */
function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface FilterConfig {
  minFollowers: number;
  maxFollowers: number;
  excludeKeywords: string[];
  excludeVerified: boolean;
}

/** Apply filters to a single profile. Returns null if it passes, or a reason string if filtered. */
function filterProfile(profile: any, filters: FilterConfig): string | null {
  const handle = (profile.handle || profile.username || '').replace(/^@/, '').trim().toLowerCase();
  const name = (profile.name || '').toLowerCase();
  const bio = (profile.bio || '').toLowerCase();
  const rawFollowers = profile.followers
    ? parseInt(String(profile.followers).replace(/[^0-9]/g, '')) || 0
    : 0;

  // Follower range check
  if (rawFollowers > 0 && rawFollowers < filters.minFollowers) {
    return `${formatFollowers(rawFollowers)} followers below ${formatFollowers(filters.minFollowers)} min`;
  }
  if (rawFollowers > 0 && rawFollowers > filters.maxFollowers) {
    return `${formatFollowers(rawFollowers)} followers exceeds ${formatFollowers(filters.maxFollowers)} max`;
  }

  // Verified check
  if (filters.excludeVerified && profile.verified) {
    return `verified account`;
  }

  // Keyword exclusion — check handle, name, and bio
  for (const kw of filters.excludeKeywords) {
    const kwLower = kw.toLowerCase().trim();
    if (!kwLower) continue;
    if (handle.includes(kwLower) || name.includes(kwLower) || bio.includes(kwLower)) {
      return `matches exclude keyword: ${kw.trim()}`;
    }
  }

  return null; // passes filters
}

/** Call Anthropic API once with a single query, return profiles + usage */
async function callClaude(apiKey: string, query: string, count: number) {
  const requestBody = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are a lead scoring assistant for an affiliate marketing business targeting people who need business funding. Search Google for Instagram profiles matching the query. From each search result, only use the title, url, and snippet — ignore all other metadata.

Score each Instagram profile below. Return ONLY a JSON array, no explanation, no markdown.

Scoring criteria:
- US-based: +20 points
- Follower count 500–100k sweet spot: +20 points
- Bio contains funding/business keywords (startup, founder, course, community, skool): +20 points
- Email in bio: +15 points
- Active entrepreneur (not celebrity, not brand page): +15 points
- Posts regularly: +10 points

Disqualify entirely (return score: 0) if:
- Outside the US
- Celebrity or major brand account
- In blackout industries: transportation, insurance, residential real estate investment

Return format — JSON array only:
[{"handle":"username","name":"Full Name","bio":"their bio snippet","url":"https://www.instagram.com/username","followers":0,"email":null,"score":72,"qualified_reason":"skool owner, 12k followers, US-based"}]

Return up to ${count} results. Only include profiles with score > 0.`,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Search for: ${query}\n\nReturn up to ${count} scored Instagram profiles as a JSON array.`,
      },
    ],
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  // First attempt
  let res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: requestBody,
  });

  // If rate limited, wait and retry once
  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    const waitSec = retryAfter ? Math.min(parseInt(retryAfter) || 60, 120) : 60;
    console.log(`Rate limited (429). Waiting ${waitSec}s before retry...`);
    await sleep(waitSec * 1000);
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: requestBody,
    });
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();

  // Extract usage
  const usage = data.usage || { input_tokens: 0, output_tokens: 0 };

  // Extract JSON profiles from response
  let profiles: any[] = [];
  for (const block of data.content || []) {
    if (block.type === 'text') {
      const jsonMatch = block.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          profiles = JSON.parse(jsonMatch[0]);
          break;
        } catch {
          // continue to next block
        }
      }
    }
  }

  if (!Array.isArray(profiles)) profiles = [];

  return { profiles, usage };
}

/** Dedup profiles against DB, insert new ones, return counts */
async function dedupAndInsert(profiles: any[], niche: string) {
  let newCount = 0;
  let dupCount = 0;
  const insertedLeads: any[] = [];

  for (const profile of profiles) {
    const handle = (profile.handle || profile.username || '').replace(/^@/, '').trim().toLowerCase();
    if (!handle) continue;

    const existing = await sql(
      'SELECT id FROM leads WHERE LOWER(username) = $1',
      [handle]
    );

    if (existing.length > 0) {
      dupCount++;
      continue;
    }

    const result = await sql(`
      INSERT INTO leads (full_name, username, platform, profile_url, bio, email, followers, niche, source, lead_score, notes)
      VALUES ($1, $2, 'instagram', $3, $4, $5, $6, $7, 'instagram_google', 0, $8)
      RETURNING *
    `, [
      profile.name || null,
      handle,
      profile.url || `https://instagram.com/${handle}`,
      profile.bio || null,
      profile.email || null,
      profile.followers ? parseInt(String(profile.followers).replace(/[^0-9]/g, '')) || null : null,
      niche || 'other',
      profile.qualified_reason || null,
    ]);

    insertedLeads.push(result[0]);
    newCount++;
  }

  return { newCount, dupCount, insertedLeads };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,          // custom query override (optional)
      niche,          // niche key
      target_leads = 10,
      cost_limit = 0.25,
      auto_rotate = true,
      min_followers = 500,
      max_followers = 100000,
      exclude_keywords = [],
      exclude_verified = true,
    } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    // Build filter config
    const filters: FilterConfig = {
      minFollowers: min_followers,
      maxFollowers: max_followers,
      excludeKeywords: Array.isArray(exclude_keywords) ? exclude_keywords : [],
      excludeVerified: exclude_verified,
    };

    // Build query list
    let queries: string[] = [];
    if (query) {
      // Custom query — single run, no rotation
      queries = [query];
    } else if (auto_rotate && niche && NICHE_QUERIES[niche]) {
      // Get previously used queries for this niche
      const usedRows = await sql(
        `SELECT DISTINCT search_query FROM scrape_batches WHERE niche = $1 ORDER BY search_query`,
        [niche]
      );
      const usedSet = new Set(usedRows.map((r: any) => r.search_query));
      const allQueries = NICHE_QUERIES[niche];

      // Unused first, then oldest used
      const unused = allQueries.filter(q => !usedSet.has(q));
      const used = allQueries.filter(q => usedSet.has(q));
      queries = [...unused, ...used];
    } else if (niche && NICHE_QUERIES[niche]) {
      queries = [NICHE_QUERIES[niche][0]];
    } else {
      return NextResponse.json({ error: 'No query or valid niche provided' }, { status: 400 });
    }

    // Loop through queries until target met or cost exceeded
    let totalNew = 0;
    let totalDup = 0;
    let totalFound = 0;
    let totalFiltered = 0;
    let totalCost = 0;
    let queriesRun = 0;
    const allLeads: any[] = [];
    const queryResults: any[] = []; // per-query breakdown for the UI

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      if (totalNew >= target_leads) break;
      if (totalCost >= cost_limit) break;

      // ── RATE LIMIT FIX: wait between calls to stay under 30K tokens/minute ──
      if (i > 0) {
        console.log(`Waiting ${INTER_QUERY_DELAY_MS / 1000}s before next query to avoid rate limit...`);
        await sleep(INTER_QUERY_DELAY_MS);
      }

      queriesRun++;

      try {
        const { profiles: rawProfiles, usage } = await callClaude(apiKey, q, target_leads - totalNew);
        const callCost = estimateCost(usage.input_tokens || 0, usage.output_tokens || 0);
        totalCost += callCost;

        // Pre-filter: drop profiles that lack qualifying keywords
        const profiles = preFilterProfiles(rawProfiles);

        // Apply filters BEFORE inserting
        const passed: any[] = [];
        const filtered: { handle: string; reason: string }[] = [];

        for (const p of profiles) {
          const reason = filterProfile(p, filters);
          const handle = (p.handle || p.username || '').replace(/^@/, '').trim().toLowerCase();
          if (reason) {
            filtered.push({ handle: handle || '(unknown)', reason });
            totalFiltered++;
          } else {
            passed.push(p);
          }
        }

        const { newCount, dupCount, insertedLeads } = await dedupAndInsert(passed, niche || 'other');
        totalNew += newCount;
        totalDup += dupCount;
        totalFound += profiles.length;
        allLeads.push(...insertedLeads);

        // Log this individual query to scrape_batches
        await sql(`
          INSERT INTO scrape_batches (source, niche, search_query, leads_found, leads_new, leads_duplicate, cost_estimate)
          VALUES ('instagram_google', $1, $2, $3, $4, $5, $6)
        `, [niche || 'other', q, profiles.length, newCount, dupCount, callCost]);

        queryResults.push({
          query: q,
          query_index: queriesRun,
          raw_count: profiles.length,
          filtered_out: filtered.length,
          filtered_details: filtered,
          passed_count: passed.length,
          new: newCount,
          duplicates: dupCount,
          cost: callCost,
          input_tokens: usage.input_tokens || 0,
          output_tokens: usage.output_tokens || 0,
          leads: insertedLeads,
        });

        // Check cost limit after this call
        if (totalCost >= cost_limit) {
          queryResults[queryResults.length - 1].stopped_reason = 'cost_limit';
          break;
        }
      } catch (err: any) {
        queryResults.push({
          query: q,
          query_index: queriesRun,
          error: err.message,
        });
        // Don't break on individual query error — try next query
      }
    }

    // Determine stop reason
    let stop_reason = 'target_reached';
    if (totalNew < target_leads) {
      if (totalCost >= cost_limit) {
        stop_reason = 'cost_limit';
      } else {
        stop_reason = 'queries_exhausted';
      }
    }

    return NextResponse.json({
      leads: allLeads,
      total_found: totalFound,
      total_new: totalNew,
      total_duplicates: totalDup,
      total_filtered: totalFiltered,
      queries_run: queriesRun,
      queries_available: queries.length,
      estimated_cost: Math.round(totalCost * 10000) / 10000,
      cost_limit,
      target_leads,
      stop_reason,
      query_results: queryResults,
    });
  } catch (error: any) {
    console.error('POST /api/scrape error:', error);
    return NextResponse.json({ error: error.message || 'Scrape failed' }, { status: 500 });
  }
}
