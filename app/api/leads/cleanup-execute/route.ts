import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function buildCleanupQuery(body: any): { where: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (body.maxFollowers && body.maxFollowers > 0) {
    conditions.push(`followers > $${idx++}`);
    params.push(body.maxFollowers);
  }

  if (body.minFollowers && body.minFollowers > 0) {
    conditions.push(`followers IS NOT NULL AND followers < $${idx++}`);
    params.push(body.minFollowers);
  }

  if (body.keywords && body.keywords.length > 0) {
    const kwConditions = body.keywords.map((kw: string) => {
      const p1 = idx++;
      const p2 = idx++;
      params.push(`%${kw.trim().toLowerCase()}%`, `%${kw.trim().toLowerCase()}%`);
      return `(LOWER(COALESCE(full_name, '')) LIKE $${p1} OR LOWER(COALESCE(bio, '')) LIKE $${p2})`;
    });
    conditions.push(`(${kwConditions.join(' OR ')})`);
  }

  if (body.noUsername) {
    conditions.push(`(username IS NULL OR username = '')`);
  }

  if (body.noBio) {
    conditions.push(`(bio IS NULL OR bio = '')`);
  }

  if (conditions.length === 0) {
    return { where: 'WHERE FALSE', params: [] };
  }

  return { where: `WHERE ${conditions.join(' OR ')}`, params };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { where, params } = buildCleanupQuery(body);

    // Get IDs first to clean up outreach_logs
    const leads = await sql(`SELECT id FROM leads ${where}`, params);
    const ids = leads.map((l: any) => l.id);

    if (ids.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    // Delete related outreach_logs first
    await sql('DELETE FROM outreach_logs WHERE lead_id = ANY($1)', [ids]);
    const result = await sql('DELETE FROM leads WHERE id = ANY($1) RETURNING id', [ids]);

    return NextResponse.json({ deleted: result.length });
  } catch (error) {
    console.error('POST /api/leads/cleanup-execute error:', error);
    return NextResponse.json({ error: 'Cleanup execute failed' }, { status: 500 });
  }
}
