import dotenv from 'dotenv';
import app from './src/app.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || 'localhost';

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Swagger Docs: http://${HOST}:${PORT}/api-docs`);
  console.log(`API base: http://${HOST}:${PORT}/api`);
});

server.on('error', (err) => {
  console.error('HTTP server error:', err);
});

globalThis.__smartWarehouseServer = server;
