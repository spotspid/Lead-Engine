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

    // Use instagram-scraper (supports keyword search) not instagram-profile-scraper (requires usernames)
    const actor = 'apify~instagram-scraper';
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: query,
          searchType: 'user',
          searchLimit: count || 10,
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Apify error:', res.status, errText);
      return NextResponse.json(
        { error: `Apify API error ${res.status}: ${errText.slice(0, 500)}` },
        { status: 500 }
      );
    }

    const rawResults = await res.json();

    // Log first result for debugging field names
    if (Array.isArray(rawResults) && rawResults.length > 0) {
      console.log('Apify first raw result keys:', Object.keys(rawResults[0]));
      console.log('Apify first raw result sample:', JSON.stringify(rawResults[0]).slice(0, 500));
    }

    // Normalize results — field names vary between Apify actors
    const normalized = (Array.isArray(rawResults) ? rawResults : []).map((r: any) => {
      const username = r?.username || r?.login || r?.handle || r?.profileName || '';
      const bio = r?.biography || r?.bio || r?.description || '';

      // Try to extract email from bio
      const emailMatch = bio.match(/[\w.+-]+@[\w-]+\.[\w.]+/);

      return {
        username,
        fullName: r?.fullName || r?.full_name || r?.name || '',
        biography: bio,
        followersCount: r?.followersCount || r?.followers || r?.followerCount || null,
        verified: r?.verified || r?.isVerified || r?.is_verified || false,
        url: r?.url || r?.profileUrl || r?.profile_url || (username ? `https://www.instagram.com/${username}` : ''),
        email: r?.email || (emailMatch ? emailMatch[0] : null),
        profilePicUrl: r?.profilePicUrl || r?.profilePicture || r?.avatar || null,
      };
    });

    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error('POST /api/apify-scrape error:', error);
    return NextResponse.json({ error: error.message || 'Apify scrape failed' }, { status: 500 });
  }
}
