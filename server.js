import dotenv from 'dotenv';

dotenv.config();

import app from './src/app.js';
import swaggerSpec from './src/config/swagger.js';

const PORT = Number(process.env.PORT) || 3000;
const pathCount = Object.keys(swaggerSpec.paths || {}).length;
const HOST = process.env.HOST || 'localhost';

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Swagger Docs: http://127.0.0.1:${PORT}/api-docs (${pathCount} paths)`);
  console.log(`OpenAPI JSON: http://127.0.0.1:${PORT}/api-docs.json`);
  console.log(`API base: http://127.0.0.1:${PORT}/api`);
});

server.on('error', (err) => {
  console.error('HTTP server error:', err);
});

globalThis.__smartWarehouseServer = server;
