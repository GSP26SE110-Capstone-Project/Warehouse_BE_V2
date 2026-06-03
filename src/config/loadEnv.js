import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = join(projectRoot, '.env');

if (existsSync(envPath)) {
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    console.error('[env] Failed to load .env:', result.error.message);
  }
} else {
  console.warn(`[env] .env not found at ${envPath}`);
}
