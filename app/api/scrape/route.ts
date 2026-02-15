import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { NICHE_QUERIES } from '@/lib/scrape-queries';

// Cost per token for claude-sonnet-4-20250514
const INPUT_COST_PER_1K = 0.003;
const OUTPUT_COST_PER_1K = 0.015;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_1K / 1000) + (outputTokens * OUTPUT_COST_PER_1K / 1000);
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
      system: `Search Google for Instagram profiles matching the query. Extract and return ONLY a JSON array of profiles: [{handle, name, bio, url, followers, email}]. No other text. Return up to ${count} results. If you cannot find exact data for a field, use null. The handle should NOT include the @ symbol.`,
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
          content: `Search for: ${query}\n\nFind up to ${count} Instagram profiles. Return ONLY a JSON array.`,
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
      INSERT INTO leads (full_name, username, platform, profile_url, bio, email, followers, niche, source, lead_score)
      VALUES ($1, $2, 'instagram', $3, $4, $5, $6, $7, 'instagram_google', 0)
      RETURNING *
    `, [
      profile.name || null,
      handle,
      profile.url || `https://instagram.com/${handle}`,
      profile.bio || null,
      profile.email || null,
      profile.followers ? parseInt(String(profile.followers).replace(/[^0-9]/g, '')) || null : null,
      niche || 'other',
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
    } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

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

        const { newCount, dupCount, insertedLeads } = await dedupAndInsert(profiles, niche || 'other');
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
          found: profiles.length,
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
