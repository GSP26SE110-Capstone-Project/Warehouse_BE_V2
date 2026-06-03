import AppError from '../utils/AppError.js';
import { getOllamaConfig } from '../config/ollama.js';
import { buildSlotExplanationMessages } from './aiSlotExplain.utils.js';

export { buildSlotExplanationMessages };

function modelNameMatches(availableName, targetModel) {
  if (!availableName || !targetModel) return false;
  return (
    availableName === targetModel ||
    availableName.startsWith(`${targetModel}:`) ||
    availableName.startsWith(`${targetModel}-`)
  );
}

/**
 * Ping Ollama — does not throw; for health endpoint.
 */
export async function checkOllamaHealth() {
  const { baseUrl, model, enabled } = getOllamaConfig();

  if (!enabled) {
    return {
      reachable: false,
      enabled: false,
      baseUrl,
      model,
      message: 'Ollama disabled (set OLLAMA_ENABLED=true to enable)',
    };
  }

  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return {
        reachable: false,
        enabled: true,
        baseUrl,
        model,
        message: `Ollama responded with HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const models = (data.models || []).map((m) => m.name || m.model).filter(Boolean);
    const modelAvailable = models.some((name) => modelNameMatches(name, model));

    return {
      reachable: true,
      enabled: true,
      baseUrl,
      model,
      models,
      modelAvailable,
      message: modelAvailable
        ? 'Ollama is ready'
        : `Model "${model}" not found. Run: ollama pull ${model}`,
    };
  } catch (err) {
    return {
      reachable: false,
      enabled: true,
      baseUrl,
      model,
      message: err.cause?.message || err.message || 'Cannot connect to Ollama',
    };
  }
}

/**
 * POST /api/chat — non-streaming.
 */
export async function generateChat({ messages, model: modelOverride } = {}) {
  const config = getOllamaConfig();

  if (!config.enabled) {
    throw new AppError('Ollama is disabled (OLLAMA_ENABLED=false)', 503, 'OLLAMA_DISABLED');
  }

  const body = {
    model: modelOverride || config.model,
    messages,
    stream: false,
    options: {
      temperature: 0.25,
      num_predict: 320,
    },
  };

  let res;
  try {
    res = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (err) {
    throw new AppError(
      `Cannot reach Ollama at ${config.baseUrl}. Is \`ollama serve\` running? (${err.message})`,
      503,
      'OLLAMA_UNAVAILABLE'
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AppError(
      `Ollama chat failed (HTTP ${res.status}): ${text.slice(0, 300)}`,
      503,
      'OLLAMA_UNAVAILABLE'
    );
  }

  const data = await res.json();
  const content = data.message?.content?.trim() || '';

  if (!content) {
    throw new AppError('Ollama returned an empty response', 503, 'OLLAMA_UNAVAILABLE');
  }

  return {
    content,
    model: data.model || body.model,
    totalDurationNs: data.total_duration ?? null,
  };
}

/**
 * Natural-language explanation (Llama via Ollama). Does not change bin selection.
 */
export async function explainSlotRecommendation(context) {
  const messages = buildSlotExplanationMessages(context);
  const result = await generateChat({ messages });
  const config = getOllamaConfig();

  return {
    explanation: result.content,
    llmModel: result.model,
    llmProvider: 'ollama',
    ollamaBaseUrl: config.baseUrl,
    totalDurationNs: result.totalDurationNs,
  };
}
