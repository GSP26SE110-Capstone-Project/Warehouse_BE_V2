import AppError from '../utils/AppError.js';
import { getGeminiConfig } from '../config/gemini.js';
import { buildSlotExplanationMessages, ensureSlotExplanation } from './aiSlotExplain.utils.js';

function messagesToGeminiRequest(messages) {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const user = messages.find((m) => m.role === 'user')?.content ?? '';
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: user }] }],
  };
}

/**
 * Ping Gemini API — does not throw; for health endpoint.
 */
export async function checkGeminiHealth() {
  const { apiKey, model, enabled, baseUrl } = getGeminiConfig();

  if (!enabled) {
    return {
      reachable: false,
      enabled: false,
      model,
      message: apiKey
        ? 'Gemini disabled (set GEMINI_ENABLED=true)'
        : 'Gemini API key not set (GEMINI_API_KEY)',
    };
  }

  const keyHint =
    apiKey.startsWith('AIza') ? 'AI Studio key detected' : 'Key should start with AIza (Google AI Studio)';

  try {
    const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        reachable: false,
        enabled: true,
        model,
        keyHint,
        message: `Gemini generateContent HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    await res.json();
    return {
      reachable: true,
      enabled: true,
      model,
      keyHint,
      message: 'Gemini is ready',
    };
  } catch (err) {
    return {
      reachable: false,
      enabled: true,
      model,
      keyHint,
      message: err.message || 'Cannot reach Gemini API',
    };
  }
}

export async function generateGeminiContent({ messages, model: modelOverride } = {}) {
  const config = getGeminiConfig();

  if (!config.enabled) {
    throw new AppError(
      'Gemini is disabled or GEMINI_API_KEY is missing',
      503,
      'GEMINI_UNAVAILABLE'
    );
  }

  const model = modelOverride || config.model;
  const url = `${config.baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  const body = {
    ...messagesToGeminiRequest(messages),
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 256,
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (err) {
    throw new AppError(
      `Cannot reach Gemini API (${err.message})`,
      503,
      'GEMINI_UNAVAILABLE'
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AppError(
      `Gemini generateContent failed (HTTP ${res.status}): ${text.slice(0, 300)}`,
      503,
      'GEMINI_UNAVAILABLE'
    );
  }

  const data = await res.json();
  const content =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || '';

  if (!content) {
    throw new AppError('Gemini returned an empty response', 503, 'GEMINI_UNAVAILABLE');
  }

  return { content, model };
}

export async function explainSlotRecommendation(context) {
  const messages = buildSlotExplanationMessages(context);
  const result = await generateGeminiContent({ messages });

  return {
    explanation: ensureSlotExplanation(result.content, context),
    llmModel: result.model,
    llmProvider: 'gemini',
  };
}
