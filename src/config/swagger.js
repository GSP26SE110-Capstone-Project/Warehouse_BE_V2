import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Smart Warehouse API",
      version: "1.0.0",
      description: "API documentation for NextGen Warehouse backend",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local development server",
      },
    ],
    tags: [
      { name: "System", description: "Health and system endpoints" },
      { name: "Warehouse", description: "Warehouse structure — warehouses" },
      { name: "Zone", description: "Warehouse structure — zones" },
      { name: "Rack", description: "Warehouse structure — racks" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
