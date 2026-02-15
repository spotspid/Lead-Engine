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

    const leads = await sql(
      `SELECT id, full_name, username, followers, bio FROM leads ${where} ORDER BY created_at DESC LIMIT 500`,
      params
    );

    // Tag each lead with the reason for matching
    const tagged = leads.map((l: any) => {
      const reasons: string[] = [];
      if (body.maxFollowers && l.followers > body.maxFollowers) reasons.push(`followers > ${body.maxFollowers.toLocaleString()}`);
      if (body.minFollowers && l.followers !== null && l.followers < body.minFollowers) reasons.push(`followers < ${body.minFollowers.toLocaleString()}`);
      if (body.keywords) {
        for (const kw of body.keywords) {
          const kwLow = kw.trim().toLowerCase();
          if ((l.full_name || '').toLowerCase().includes(kwLow) || (l.bio || '').toLowerCase().includes(kwLow)) {
            reasons.push(`keyword: "${kw.trim()}"`);
          }
        }
      }
      if (body.noUsername && (!l.username || l.username === '')) reasons.push('no username');
      if (body.noBio && (!l.bio || l.bio === '')) reasons.push('no bio');
      return { ...l, reasons };
    });

    return NextResponse.json({ leads: tagged, count: tagged.length });
  } catch (error) {
    console.error('POST /api/leads/cleanup-preview error:', error);
    return NextResponse.json({ error: 'Cleanup preview failed' }, { status: 500 });
  }
}

export { buildCleanupQuery };
