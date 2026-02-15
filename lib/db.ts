import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function sql(query: string, params?: any[]) {
  const result = await pool.query(query, params);
  return result.rows;
}
