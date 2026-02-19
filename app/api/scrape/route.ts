import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { NICHE_QUERIES } from '@/lib/scrape-queries';

// Allow up to 5 minutes for multi-query scrapes (Vercel Pro needed for >60s; Hobby caps at 60s)
export const maxDuration = 300;

// Cost per token for claude-sonnet-4-20250514 (scoring only — no web_search)
const INPUT_COST_PER_1K = 0.003;
const OUTPUT_COST_PER_1K = 0.015;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_1K / 1000) + (outputTokens * OUTPUT_COST_PER_1K / 1000);
}

// Delay between API calls — much shorter now since Serper + scoring uses ~2-3K tokens, not ~56K
const INTER_QUERY_DELAY_MS = 5_000;
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Pre-filter keywords — a Claude-scored profile must mention at least one to be kept */
const PRE_FILTER_KEYWORDS = [
  'coach', 'founder', 'course', 'community', 'skool', 'creator',
  'entrepreneur', 'startup', 'business', 'agency', 'ecom', 'fitness',
  'mentor', 'educator',
];

/** Celebrity / mega-account exclusion keywords — if ANY appear, drop the profile */
const CELEBRITY_KEYWORDS = [
  'author', 'speaker', 'keynote', 'bestseller', 'best-seller',
  'millionaire', 'billionaire', 'new york times', 'nyt', 'forbes',
  'shark tank', 'ted talk', 'tedx', 'as seen on', 'verified',
  'grammy', 'emmy', 'oscar', 'billboard', 'platinum',
];

/** Drop scored profiles whose combined text doesn't mention any pre-filter keyword,
 *  OR whose text contains celebrity / mega-account keywords */
function preFilterScoredProfiles(profiles: any[]): any[] {
  const before = profiles.length;
  const passed = profiles.filter(p => {
    const text = [
      p.handle || p.username || '',
      p.name || '',
      p.bio || p.qualified_reason || '',
    ].join(' ').toLowerCase();

    // Must have at least one qualifying keyword
    if (!PRE_FILTER_KEYWORDS.some(kw => text.includes(kw))) return false;

    // Must NOT have any celebrity exclusion keywords
    if (CELEBRITY_KEYWORDS.some(kw => text.includes(kw))) {
      console.log(`[pre-filter] Dropped celebrity/mega: ${p.handle || p.username || '(unknown)'} — matched "${CELEBRITY_KEYWORDS.find(kw => text.includes(kw))}"`);
      return false;
    }

    return true;
  });
  const dropped = before - passed.length;
  if (dropped > 0) {
    console.log(`[pre-filter] Dropped ${dropped} of ${before} scored profiles (no qualifying keywords or celebrity match)`);
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

// ─── SERPER.DEV GOOGLE SEARCH (replaces Anthropic web_search) ───

interface SerperResult {
  title: string;
  url: string;
  snippet: string;
}

/** Search Google via Serper.dev API */
async function searchSerper(query: string, num: number = 10): Promise<SerperResult[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num }),
  });

  if (!res.ok) {
    throw new Error(`Serper API error ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
  }

  const data = await res.json();
  return data.organic?.map((item: any) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
  })) || [];
}

/** Pre-filter Serper results — remove junk domains, thin snippets, dupes */
function preFilterSerperResults(results: SerperResult[]): SerperResult[] {
  const junkDomains = [
    'youtube.com/watch', 'tiktok.com/@', 'twitter.com/', 'x.com/',
    'facebook.com/groups', 'reddit.com/r/', 'pinterest.com',
    'amazon.com', 'wikipedia.org', 'news.ycombinator.com',
    'linkedin.com/company', 'yelp.com', 'bbb.org',
  ];

  const seen = new Set<string>();

  return results.filter(r => {
    // Remove results from non-profile / junk domains
    if (junkDomains.some(d => r.url.toLowerCase().includes(d))) return false;

    // Remove results with no useful snippet
    if (!r.snippet || r.snippet.length < 20) return false;

    // Dedupe by normalized URL
    const normalized = r.url.toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '');
    if (seen.has(normalized)) return false;
    seen.add(normalized);

    return true;
  });
}

/** Score pre-filtered Serper results with Claude (scoring only — zero searching, no tools) */
async function scoreWithClaude(apiKey: string, results: SerperResult[], niche: string, count: number) {
  const resultsText = results.map((r, i) =>
    `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`
  ).join('\n\n');

  const requestBody = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    // NO tools — no web_search. Scoring only.
    messages: [{
      role: 'user',
      content: `You are a lead scoring assistant for an affiliate marketing business targeting people who need business funding. Score these Google search results as potential leads.

Niche: ${niche.replace(/_/g, ' ')}

Scoring criteria:
- US-based: +20 points
- Follower count 500–100k sweet spot: +20 points  (100k–200k still acceptable but reduce by 10 pts)
- Bio contains funding/business keywords (startup, founder, course, community, skool): +20 points
- Email in bio: +15 points
- Active entrepreneur (not celebrity, not brand page): +15 points
- Posts regularly: +10 points

Disqualify entirely (return score: 0) if ANY of these apply:
- Outside the US
- Followers above 200,000 — these are celebrity / mega accounts, not small-biz leads
- Celebrity bio keywords: "author", "speaker", "keynote", "bestseller", "millionaire", "billionaire", "forbes", "shark tank", "ted talk", "as seen on", "new york times"
- Major brand or corporate account (Nike, Gymshark, etc.)
- In blackout industries: transportation, insurance, residential real estate investment
- Brand/company accounts (no individual person behind it)
- Meme pages, quote pages, motivation repost pages
- Podcast or media accounts
- Music artists, rappers, entertainers
- Tax preparers, CPAs, or financial advisors who don't run communities

Return format — JSON array only:
[{"handle":"username","name":"Full Name","bio":"their bio snippet","url":"the URL from results","followers":0,"email":null,"score":72,"qualified_reason":"skool owner, 12k followers, US-based"}]

Return up to ${count} results. Only include profiles with score > 0.
Return ONLY the JSON array, no other text.

Search results:
${resultsText}`,
    }],
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
      max_followers = 500000,
      exclude_keywords = [],
      exclude_verified = true,
    } = body;

    // Use ANTHROPIC_SCRAPER_KEY to avoid collision with Claude Code's own ANTHROPIC_API_KEY
    const apiKey = process.env.ANTHROPIC_SCRAPER_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_SCRAPER_KEY not configured in .env.local' }, { status: 500 });
    }
    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({ error: 'SERPER_API_KEY not configured' }, { status: 500 });
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

      // Short delay between queries (Serper is fast, but avoid hammering)
      if (i > 0) {
        console.log(`Waiting ${INTER_QUERY_DELAY_MS / 1000}s before next query...`);
        await sleep(INTER_QUERY_DELAY_MS);
      }

      queriesRun++;

      try {
        // Step 1: Search via Serper (replaces Anthropic web_search)
        const serperResults = await searchSerper(q, 10);
        const serperRaw = serperResults.length;

        // Step 2: Pre-filter junk domains, thin snippets, dupes
        const preFiltered = preFilterSerperResults(serperResults);

        // Step 3: Score with Claude (scoring only — no tools, no searching)
        const { profiles: rawProfiles, usage } = await scoreWithClaude(
          apiKey, preFiltered, niche || 'other', target_leads - totalNew
        );
        const callCost = estimateCost(usage.input_tokens || 0, usage.output_tokens || 0);
        totalCost += callCost;

        // Step 4: Keyword pre-filter on Claude's scored output
        const profiles = preFilterScoredProfiles(rawProfiles);

        // Apply hard follower ceiling (safety net) + user filters BEFORE inserting
        const HARD_FOLLOWER_CEILING = 200_000;
        const passed: any[] = [];
        const filtered: { handle: string; reason: string }[] = [];

        for (const p of profiles) {
          const handle = (p.handle || p.username || '').replace(/^@/, '').trim().toLowerCase();

          // Hard ceiling — no profile above 200k regardless of user settings
          const rawFollowers = p.followers
            ? parseInt(String(p.followers).replace(/[^0-9]/g, '')) || 0
            : 0;
          if (rawFollowers > HARD_FOLLOWER_CEILING) {
            console.log(`[hard-ceiling] Blocked ${handle}: ${formatFollowers(rawFollowers)} followers exceeds 200k ceiling`);
            filtered.push({ handle: handle || '(unknown)', reason: `${formatFollowers(rawFollowers)} followers exceeds hard 200k ceiling` });
            totalFiltered++;
            continue;
          }

          const reason = filterProfile(p, filters);
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
          serper_raw: serperRaw,
          serper_after_prefilter: preFiltered.length,
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
