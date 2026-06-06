import './src/config/loadEnv.js';

import app from './src/app.js';
import swaggerSpec from './src/config/swagger.js';
import { startBillingCron } from './src/jobs/billingJobs.js';

const PORT = Number(process.env.PORT) || 3000;
const pathCount = Object.keys(swaggerSpec.paths || {}).length;
const HOST = process.env.HOST || 'localhost';

const geminiKeySet = Boolean(process.env.GEMINI_API_KEY?.trim());

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Gemini API key loaded: ${geminiKeySet ? 'yes' : 'no (set GEMINI_API_KEY in .env)'}`);
  console.log(`Swagger Docs: http://127.0.0.1:${PORT}/api-docs (${pathCount} paths)`);
  console.log(`OpenAPI JSON: http://127.0.0.1:${PORT}/api-docs.json`);
  console.log(`API base: http://127.0.0.1:${PORT}/api`);
  startBillingCron();
});

server.on('error', (err) => {
  console.error('HTTP server error:', err);
});

globalThis.__smartWarehouseServer = server;
