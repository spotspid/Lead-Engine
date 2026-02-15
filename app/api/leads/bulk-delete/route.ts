import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    // Delete related outreach_logs first (in case no CASCADE)
    await sql('DELETE FROM outreach_logs WHERE lead_id = ANY($1)', [ids]);
    const result = await sql('DELETE FROM leads WHERE id = ANY($1) RETURNING id', [ids]);

    return NextResponse.json({ success: true, deleted: result.length });
  } catch (error) {
    console.error('POST /api/leads/bulk-delete error:', error);
    return NextResponse.json({ error: 'Bulk delete failed' }, { status: 500 });
  }
}
