export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  const enabled =
    process.env.GEMINI_ENABLED !== 'false' && process.env.GEMINI_ENABLED !== '0';
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

  return {
    apiKey,
    model,
    enabled: enabled && apiKey.length > 0,
    timeoutMs,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  };
}
