/**
 * Ollama local LLM (optional layer for natural-language explanations).
 * Default: http://127.0.0.1:11434, model llama3.2:3b
 */
export function getOllamaConfig() {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(
    /\/$/,
    ''
  );

  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 60000);

  return {
    baseUrl,
    model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
    enabled: process.env.OLLAMA_ENABLED !== 'false',
    timeoutMs: Math.min(Math.max(Number.isFinite(timeoutMs) ? timeoutMs : 60000, 5000), 120000),
  };
}
