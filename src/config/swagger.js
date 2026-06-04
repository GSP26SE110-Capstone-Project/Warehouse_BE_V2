import baseSpec from '../docs/openapi.js';

function stripTrailingSlash(url) {
  return url?.replace(/\/$/, '') || '';
}

/** Public base URL (no path) for OpenAPI servers[]. */
export function resolvePublicBaseUrl(req) {
  const fromEnv =
    stripTrailingSlash(process.env.API_PUBLIC_URL) ||
    stripTrailingSlash(process.env.RENDER_EXTERNAL_URL);
  if (fromEnv) return fromEnv;

  if (req?.get('host')) {
    return `${req.protocol}://${req.get('host')}`;
  }

  const port = process.env.PORT || 3000;
  return `http://127.0.0.1:${port}`;
}

/** OpenAPI spec with servers[] pointing at the current deploy (or local). */
export function getSwaggerSpec(req) {
  const baseUrl = resolvePublicBaseUrl(req);
  const localPort = process.env.PORT || 3000;
  const localUrl = `http://127.0.0.1:${localPort}`;
  const isDeployed =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RENDER_EXTERNAL_URL) ||
    Boolean(process.env.API_PUBLIC_URL);

  const servers = isDeployed
    ? [
        { url: baseUrl, description: 'Deployed server (current host)' },
        { url: localUrl, description: 'Local development' },
      ]
    : [
        { url: localUrl, description: 'Local development (Windows: không dùng localhost:3000)' },
      ];

  return { ...baseSpec, servers };
}

export default baseSpec;
