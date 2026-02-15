import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query, count, niche } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    // Call Anthropic API with web_search tool
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `Search Google for Instagram profiles matching the query. Extract and return ONLY a JSON array of profiles: [{handle, name, bio, url, followers, email}]. No other text. Return up to ${count || 10} results. If you cannot find exact data for a field, use null. The handle should NOT include the @ symbol.`,
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
            content: `Search for: ${query}\n\nFind up to ${count || 10} Instagram profiles. Return ONLY a JSON array.`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errBody);
      return NextResponse.json({ error: `Anthropic API error: ${anthropicRes.status}` }, { status: 500 });
    }

    const anthropicData = await anthropicRes.json();

    // Extract JSON from Claude's response
    let profiles: any[] = [];
    for (const block of anthropicData.content || []) {
      if (block.type === 'text') {
        const text = block.text;
        // Try to extract JSON array from the text
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            profiles = JSON.parse(jsonMatch[0]);
          } catch {
            // If parsing fails, continue to next block
          }
        }
      }
    }

    if (!Array.isArray(profiles)) {
      profiles = [];
    }

    // Check for duplicates and insert new leads
    let newCount = 0;
    let dupCount = 0;
    const insertedLeads: any[] = [];

    for (const profile of profiles) {
      const handle = (profile.handle || profile.username || '').replace(/^@/, '').trim().toLowerCase();
      if (!handle) continue;

      // Check for existing lead with same username (case-insensitive)
      const existing = await sql(
        'SELECT id FROM leads WHERE LOWER(username) = $1',
        [handle]
      );

      if (existing.length > 0) {
        dupCount++;
        continue;
      }

      // Insert new lead
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

    // Log scrape batch
    await sql(`
      INSERT INTO scrape_batches (source, niche, search_query, leads_found, leads_new, leads_duplicate)
      VALUES ('instagram_google', $1, $2, $3, $4, $5)
    `, [niche || 'other', query, profiles.length, newCount, dupCount]);

    return NextResponse.json({
      leads: insertedLeads,
      total: profiles.length,
      new: newCount,
      duplicates: dupCount,
    });
  } catch (error) {
    console.error('POST /api/scrape error:', error);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
