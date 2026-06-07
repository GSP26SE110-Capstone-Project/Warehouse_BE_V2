// Sử dụng pg (node-postgres)
import pg from 'pg';
const { Pool } = pg;

/** Cloud DB (Render, Supabase, …) cần SSL; localhost/Docker thì không. */
function sslForDatabaseUrl(connectionString) {
  if (!connectionString) return undefined;
  try {
    const { hostname, searchParams } = new URL(connectionString);
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'postgres';
    const sslRequired =
      searchParams.get('sslmode') === 'require' || hostname.endsWith('.render.com');
    if (!isLocal || sslRequired) {
      return { rejectUnauthorized: false };
    }
  } catch {
    // ignore malformed URL
  }
  return undefined;
}

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: sslForDatabaseUrl(process.env.DATABASE_URL),
    }
  : {
      // Local dev: dùng biến POSTGRES_* và mặc định host localhost
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST || 'localhost',
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
      port: Number(process.env.POSTGRES_PORT || 5432),
    };

const pool = new Pool(poolConfig);

// Function để test connection với retry
async function testConnection(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('Database connected successfully:', result.rows[0]);
      return true;
    } catch (err) {
      console.log(`Database connection attempt ${i + 1}/${retries} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('Database connection error after all retries:', err);
        return false;
      }
    }
  }
}

// Test connection với retry
testConnection();

export default pool;