import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await sql('SELECT * FROM leads WHERE id = $1', [id]);
    if (result.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build dynamic SET clause from provided fields
    const allowedFields = [
      'full_name', 'username', 'platform', 'profile_url', 'bio',
      'email', 'phone', 'location', 'followers', 'niche', 'source',
      'affiliate_type', 'lead_score', 'stage', 'has_email', 'has_responded',
      'is_duplicate', 'is_archived', 'notes', 'last_contacted_at'
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex++}`);
        values.push(body[field]);
      }
    }

    // Track stage changes
    if (body.stage) {
      setClauses.push(`stage_changed_at = NOW()`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = await sql(
      `UPDATE leads SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('PUT /api/leads/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Delete related outreach_logs first (in case no CASCADE)
    await sql('DELETE FROM outreach_logs WHERE lead_id = $1', [id]);
    const result = await sql('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);
    if (result.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deleted: parseInt(id) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
