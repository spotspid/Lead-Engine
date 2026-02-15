import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const batches = await sql(`
      SELECT * FROM scrape_batches ORDER BY created_at DESC LIMIT 50
    `);
    return NextResponse.json(batches);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch scrape batches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await sql(`
      INSERT INTO scrape_batches (source, niche, search_query, leads_found, leads_new, leads_duplicate, cost_estimate)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      body.source || 'instagram_google',
      body.niche || null,
      body.search_query || null,
      body.leads_found || 0,
      body.leads_new || 0,
      body.leads_duplicate || 0,
      body.cost_estimate || null
    ]);
    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to log scrape batch' }, { status: 500 });
  }
}
