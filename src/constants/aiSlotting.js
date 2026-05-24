export const AI_SLOTTING_MODEL_VERSION = 'slotting-v1-rule';

export const SLOT_SCORE_WEIGHTS = Object.freeze({
  freeCapacity: 0.35,
  tenantReservationMatch: 0.25,
  sameSkuCluster: 0.2,
  rackTypeMatch: 0.2,
});

export const SLOT_CANDIDATE_LIMIT = 200;
export const SLOT_TOP_ALTERNATIVES = 5;

/** Ollama model for Vietnamese ops explanations (override via OLLAMA_MODEL). */
export const OLLAMA_DEFAULT_MODEL = 'llama3.2:3b';
