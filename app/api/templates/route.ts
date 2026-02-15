import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const templates = await sql(`
      SELECT *,
        CASE WHEN times_sent > 0 THEN ROUND((times_replied::decimal / times_sent) * 100, 1) ELSE 0 END as reply_rate,
        CASE WHEN times_sent > 0 THEN ROUND((times_converted::decimal / times_sent) * 100, 1) ELSE 0 END as conversion_rate
      FROM dm_templates
      ORDER BY variant ASC
    `);
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await sql(`
      INSERT INTO dm_templates (name, variant, subject, body, target_niche, target_affiliate_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      body.name,
      body.variant || 'A',
      body.subject || null,
      body.body,
      body.target_niche || null,
      body.target_affiliate_type || 'sub_affiliate'
    ]);
    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    const result = await sql(`
      UPDATE dm_templates
      SET name = COALESCE($2, name),
          variant = COALESCE($3, variant),
          subject = COALESCE($4, subject),
          body = COALESCE($5, body),
          target_niche = COALESCE($6, target_niche),
          target_affiliate_type = COALESCE($7, target_affiliate_type),
          is_active = COALESCE($8, is_active),
          times_replied = COALESCE($9, times_replied),
          times_converted = COALESCE($10, times_converted)
      WHERE id = $1
      RETURNING *
    `, [
      body.id,
      body.name || null,
      body.variant || null,
      body.subject || null,
      body.body || null,
      body.target_niche || null,
      body.target_affiliate_type || null,
      body.is_active !== undefined ? body.is_active : null,
      body.times_replied !== undefined ? body.times_replied : null,
      body.times_converted !== undefined ? body.times_converted : null
    ]);

    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}
