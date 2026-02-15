import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');
    const sentBy = searchParams.get('sent_by');
    const limit = parseInt(searchParams.get('limit') || '50');

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (leadId) {
      conditions.push(`o.lead_id = $${paramIndex++}`);
      params.push(leadId);
    }
    if (sentBy) {
      conditions.push(`o.sent_by = $${paramIndex++}`);
      params.push(sentBy);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const logs = await sql(`
      SELECT o.*, l.full_name as lead_name, l.username as lead_username, t.name as template_name
      FROM outreach_logs o
      LEFT JOIN leads l ON o.lead_id = l.id
      LEFT JOIN dm_templates t ON o.template_id = t.id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ${limit}
    `, params);

    return NextResponse.json(logs);
  } catch (error) {
    console.error('GET /api/outreach error:', error);
    return NextResponse.json({ error: 'Failed to fetch outreach logs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = await sql(`
      INSERT INTO outreach_logs (lead_id, type, template_id, message_sent, sent_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      body.lead_id,
      body.type || 'dm',
      body.template_id || null,
      body.message_sent || null,
      body.sent_by || null
    ]);

    // Update lead's last_contacted_at and stage if still 'new' or 'qualified'
    await sql(`
      UPDATE leads
      SET last_contacted_at = NOW(),
          stage = CASE WHEN stage IN ('new', 'qualified') THEN 'outreach' ELSE stage END
      WHERE id = $1
    `, [body.lead_id]);

    // If template was used, increment times_sent
    if (body.template_id) {
      await sql(`
        UPDATE dm_templates SET times_sent = times_sent + 1 WHERE id = $1
      `, [body.template_id]);
    }

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('POST /api/outreach error:', error);
    return NextResponse.json({ error: 'Failed to create outreach log' }, { status: 500 });
  }
}
