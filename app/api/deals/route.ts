import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const deals = await sql(`
      SELECT d.*, l.full_name as lead_name, l.username as lead_username
      FROM funding_deals d
      LEFT JOIN leads l ON d.lead_id = l.id
      ORDER BY d.created_at DESC
    `);
    return NextResponse.json(deals);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const fundedAmount = parseFloat(body.funded_amount) || 0;
    const feePercentage = parseFloat(body.fee_percentage) || 8;
    const commissionRate = parseFloat(body.commission_rate) || 20;

    const feeAmount = fundedAmount * (feePercentage / 100);
    const commissionAmount = feeAmount * (commissionRate / 100);
    const splitAmount = commissionAmount / 2;

    const result = await sql(`
      INSERT INTO funding_deals (
        lead_id, client_name, funded_amount, fee_percentage, fee_amount,
        commission_rate, commission_amount, steve_split, josh_split,
        status, funded_at, seven_figures_rep, portal_reference, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      body.lead_id || null,
      body.client_name || null,
      fundedAmount,
      feePercentage,
      feeAmount,
      commissionRate,
      commissionAmount,
      splitAmount,
      splitAmount,
      body.status || 'pending',
      body.funded_at || null,
      body.seven_figures_rep || 'Max Firth',
      body.portal_reference || null,
      body.notes || null
    ]);

    // Update lead stage to approved if linked
    if (body.lead_id) {
      await sql(`UPDATE leads SET stage = 'approved' WHERE id = $1`, [body.lead_id]);
    }

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('POST /api/deals error:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}
