import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import apiRoutes from './routes/index.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(cors());
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
  res.send(swaggerSpec);
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
