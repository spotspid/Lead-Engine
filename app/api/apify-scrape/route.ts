import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query, count, niche } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const token = process.env.APIFY_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'APIFY_TOKEN not configured' }, { status: 500 });
    }

    const actor = 'apify~instagram-profile-scraper';
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: query,
          resultsLimit: count || 10,
          searchType: 'user',
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Apify API error:', res.status, errText.slice(0, 300));
      return NextResponse.json(
        { error: `Apify API error: ${res.status}` },
        { status: 500 }
      );
    }

    const results = await res.json();
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('POST /api/apify-scrape error:', error);
    return NextResponse.json({ error: error.message || 'Apify scrape failed' }, { status: 500 });
  }
}
