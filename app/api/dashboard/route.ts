import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Pipeline stage counts
    const stageCounts = await sql(`
      SELECT stage, COUNT(*) as count
      FROM leads
      WHERE is_archived = false
      GROUP BY stage
    `);

    // Total leads
    const totalLeads = await sql(`SELECT COUNT(*) as total FROM leads WHERE is_archived = false`);

    // Funding totals
    const fundingStats = await sql(`
      SELECT
        COALESCE(SUM(funded_amount), 0) as total_funded,
        COALESCE(SUM(fee_amount), 0) as total_fees,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(steve_split), 0) as steve_total,
        COALESCE(SUM(josh_split), 0) as josh_total,
        COUNT(*) as deal_count
      FROM funding_deals
      WHERE status != 'denied'
    `);

    // Outreach stats
    const outreachStats = await sql(`
      SELECT
        COUNT(*) as total_outreach,
        COUNT(CASE WHEN type = 'dm' THEN 1 END) as total_dms,
        COUNT(CASE WHEN responded_at IS NOT NULL THEN 1 END) as total_responses
      FROM outreach_logs
    `);

    // Template performance
    const templateStats = await sql(`
      SELECT name, variant, times_sent, times_replied, times_converted,
        CASE WHEN times_sent > 0 THEN ROUND((times_replied::decimal / times_sent) * 100, 1) ELSE 0 END as reply_rate
      FROM dm_templates
      WHERE is_active = true
      ORDER BY variant
    `);

    // Recent scrape batches
    const recentScrapes = await sql(`
      SELECT * FROM scrape_batches ORDER BY created_at DESC LIMIT 5
    `);

    // Leads scraped this week
    const weeklyLeads = await sql(`
      SELECT COUNT(*) as count FROM leads
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    return NextResponse.json({
      pipeline: Object.fromEntries(stageCounts.map((s: any) => [s.stage, parseInt(s.count)])),
      totalLeads: parseInt(totalLeads[0].total),
      weeklyLeads: parseInt(weeklyLeads[0].count),
      funding: {
        totalFunded: parseFloat(fundingStats[0].total_funded),
        totalFees: parseFloat(fundingStats[0].total_fees),
        totalCommission: parseFloat(fundingStats[0].total_commission),
        steveSplit: parseFloat(fundingStats[0].steve_total),
        joshSplit: parseFloat(fundingStats[0].josh_total),
        dealCount: parseInt(fundingStats[0].deal_count)
      },
      outreach: {
        total: parseInt(outreachStats[0].total_outreach),
        dms: parseInt(outreachStats[0].total_dms),
        responses: parseInt(outreachStats[0].total_responses),
        responseRate: outreachStats[0].total_outreach > 0
          ? ((outreachStats[0].total_responses / outreachStats[0].total_outreach) * 100).toFixed(1)
          : '0.0'
      },
      templates: templateStats,
      recentScrapes
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
