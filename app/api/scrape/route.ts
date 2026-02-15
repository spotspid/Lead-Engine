import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { NICHE_QUERIES } from '@/lib/scrape-queries';

// Cost per token for claude-sonnet-4-20250514
const INPUT_COST_PER_1K = 0.003;
const OUTPUT_COST_PER_1K = 0.015;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_1K / 1000) + (outputTokens * OUTPUT_COST_PER_1K / 1000);
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
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a lead qualification specialist for a business funding affiliate company. I need you to search Google and find Instagram profiles of REAL, INDIVIDUAL business owners or community leaders who match the query.

QUALIFICATION CRITERIA — only return profiles that meet ALL of these:
1. Must be a REAL PERSON, not a brand page, company account, podcast, meme page, or media outlet
2. Must show signs of running a business, community, course, or coaching program (look for words like: founder, owner, coach, mentor, community, students, members, helping, teaching, program, course)
3. Must appear to be a small-to-mid-size operator — NOT a celebrity, mega-influencer, or platform founder (skip anyone who is clearly famous or has millions of followers)
4. Must be US-based or English-speaking market
5. Must look like someone who would realistically respond to a cold DM

DISQUALIFY immediately:
- Platform founders (Skool founders, Teachable founders, etc.)
- Celebrities and mega-influencers (1M+ followers)
- Brand/company accounts (no individual person behind it)
- Meme pages, quote pages, motivation repost pages
- Podcast or media accounts
- Music artists, rappers, entertainers
- Spiritual healers, astrologers (unless they run a business coaching program)
- Accounts with under 200 followers (likely inactive or fake)
- Tax preparers, CPAs, or financial advisors who don't run communities (they're individual service providers, not our ICP)

For each QUALIFIED profile, return this JSON array:
[{"handle": "username", "name": "Full Name", "bio": "their bio or description from search results", "url": "https://www.instagram.com/username", "followers": estimated_number_or_0, "email": "if visible or null", "qualified_reason": "brief reason why this person fits — e.g. 'Runs Skool community for ecommerce entrepreneurs'"}]

IMPORTANT:
- Quality over quantity. I would rather get 5 excellent leads than 15 garbage ones.
- If you can only find 3 qualified profiles, return 3. Do NOT pad with unqualified ones.
- The qualified_reason field helps my team prioritize who to DM first.
- Return ONLY the JSON array, no other text. Return up to ${count} results.`,
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
          content: `Search for: ${query}\n\nFind up to ${count} Instagram profiles of individual business owners. Return ONLY a JSON array.`,
        },
      ],
    }),
  });

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

    for (const q of queries) {
      if (totalNew >= target_leads) break;
      if (totalCost >= cost_limit) break;

      queriesRun++;

      try {
        const { profiles, usage } = await callClaude(apiKey, q, target_leads - totalNew);
        const callCost = estimateCost(usage.input_tokens || 0, usage.output_tokens || 0);
        totalCost += callCost;

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
