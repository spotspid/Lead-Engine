import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const niche = searchParams.get('niche');
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    const archived = searchParams.get('archived') === 'true';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortDir = searchParams.get('sortDir') || 'DESC';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const conditions: string[] = [`is_archived = ${archived}`];
    const params: any[] = [];
    let paramIndex = 1;

    if (stage) {
      conditions.push(`stage = $${paramIndex++}`);
      params.push(stage);
    }
    if (niche) {
      conditions.push(`niche = $${paramIndex++}`);
      params.push(niche);
    }
    if (source) {
      conditions.push(`source = $${paramIndex++}`);
      params.push(source);
    }
    if (search) {
      conditions.push(`(LOWER(full_name) LIKE $${paramIndex} OR LOWER(username) LIKE $${paramIndex} OR LOWER(bio) LIKE $${paramIndex})`);
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    const allowedSorts = ['created_at', 'lead_score', 'full_name', 'followers', 'stage_changed_at'];
    const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
    const safeDir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const leads = await sql(
      `SELECT * FROM leads ${where} ORDER BY ${safeSort} ${safeDir} LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const countResult = await sql(
      `SELECT COUNT(*) as total FROM leads ${where}`,
      params
    );

    return NextResponse.json({
      leads,
      total: parseInt(countResult[0].total),
      limit,
      offset
    });
  } catch (error) {
    console.error('GET /api/leads error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support single lead or batch insert
    const leads = Array.isArray(body) ? body : [body];
    const inserted = [];

    for (const lead of leads) {
      const result = await sql(`
        INSERT INTO leads (full_name, username, platform, profile_url, bio, email, phone, location, followers, niche, source, affiliate_type, lead_score, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        lead.full_name || null,
        lead.username || null,
        lead.platform || 'instagram',
        lead.profile_url || null,
        lead.bio || null,
        lead.email || null,
        lead.phone || null,
        lead.location || null,
        lead.followers || null,
        lead.niche || 'other',
        lead.source || 'manual',
        lead.affiliate_type || 'direct_client',
        lead.lead_score || 0,
        lead.notes || null
      ]);
      inserted.push(result[0]);
    }

    return NextResponse.json({ inserted, count: inserted.length }, { status: 201 });
  } catch (error) {
    console.error('POST /api/leads error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
