import AppError from '../utils/AppError.js';
import { getGeminiConfig } from '../config/gemini.js';
import { getOllamaConfig } from '../config/ollama.js';
import { explainSlotRecommendation as explainViaGemini } from './gemini.service.js';
import { explainSlotRecommendation as explainViaOllama } from './ollama.service.js';

const VALID_PROVIDERS = ['gemini', 'ollama'];

/**
 * Resolve provider for dedicated explain APIs. No cross-provider fallback.
 */
export function requireLlmProvider(override) {
  const raw = (override || '').toString().trim().toLowerCase();
  if (!raw || !VALID_PROVIDERS.includes(raw)) {
    throw new AppError(
      'llmProvider is required and must be "gemini" or "ollama"',
      400,
      'VALIDATION_ERROR'
    );
  }
  return raw;
}

export function assertProviderConfigured(provider) {
  if (provider === 'gemini' && !getGeminiConfig().enabled) {
    throw new AppError(
      'Gemini is not configured. Set GEMINI_API_KEY in .env (Google AI Studio key, usually starts with AIza)',
      503,
      'GEMINI_UNAVAILABLE'
    );
  }
  if (provider === 'ollama' && !getOllamaConfig().enabled) {
    throw new AppError(
      'Ollama is disabled. Set OLLAMA_ENABLED=true and run ollama serve',
      503,
      'OLLAMA_DISABLED'
    );
  }
}

/**
 * Explain slot recommendation using exactly one provider (no auto / no fallback).
 */
export async function explainSlotRecommendationStrict(context, { provider }) {
  const chosen = requireLlmProvider(provider);
  assertProviderConfigured(chosen);

  if (chosen === 'gemini') {
    return explainViaGemini(context);
  }
  return explainViaOllama(context);
}
