import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'

import pool from './src/config/db.js'
import dotenv from 'dotenv'
dotenv.config();
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './src/config/swagger.js';


const app = express()
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`)
})

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Swagger Docs: http://${HOST}:${PORT}/api-docs`);
  });
  
  server.on('error', (err) => {
    console.error('HTTP server error:', err);
  });// Keep an explicit strong reference for runtimes that aggressively clean up unreferenced handles.
  globalThis.__smartWarehouseServer = server;