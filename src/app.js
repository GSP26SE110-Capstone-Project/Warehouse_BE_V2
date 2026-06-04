import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec, { getSwaggerSpec } from './config/swagger.js';
import apiRoutes from './routes/index.js';
import asyncHandler from './middleware/asyncHandler.js';
import * as payosController from './controllers/payos.controller.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Render / reverse proxy — req.protocol = https khi có X-Forwarded-Proto
app.set('trust proxy', 1);

app.use(cors());

/** PayOS webhook — đăng ký trước bodyParser; PayOS gọi POST khi confirm + khi thanh toán. */
app.get('/api/payos/webhook', asyncHandler(payosController.webhookPing));
app.post(
  '/api/payos/webhook',
  express.json({ limit: '1mb' }),
  asyncHandler(payosController.webhook)
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: 'Smart Warehouse API',
    docs: '/api-docs',
    openApiJson: '/api-docs.json',
    api: '/api',
    endpoints: Object.keys(swaggerSpec.paths || {}).length,
  });
});

// Raw OpenAPI JSON (Swagger UI loads from here — avoids stale/partial inline spec)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(getSwaggerSpec(req));
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    customSiteTitle: 'Smart Warehouse API',
    swaggerOptions: {
      url: '/api-docs.json',
      persistAuthorization: true,
    },
  })
);
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
