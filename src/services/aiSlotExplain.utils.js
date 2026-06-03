/**
 * Shared prompt for slot recommendation explanations (Ollama / Gemini).
 */
export function buildSlotExplanationMessages(context) {
  const facts = {
    lpnCode: context.lpnCode ?? null,
    zoneCode: context.zoneCode ?? null,
    rackCode: context.rackCode ?? null,
    binCode: context.binCode ?? null,
    recommendedZoneId: context.recommendedZoneId ?? null,
    recommendedRackId: context.recommendedRackId ?? null,
    recommendedBinId: context.recommendedBinId ?? null,
    score: context.score ?? context.recommendationScore ?? null,
    ruleModelVersion: context.modelVersion ?? 'slotting-v1-rule',
    ruleReasons: context.reasons ?? context.ruleReasons ?? [],
    featureSnapshot: context.featureSnapshot ?? null,
    suggestedRackType: context.suggestedRackType ?? null,
    alternatives: context.alternatives ?? null,
  };

  return [
    {
      role: 'system',
      content:
        'Bạn là trợ lý kho WMS. Chỉ dựa trên JSON facts được cung cấp; không được bịa bin, zone hay số liệu. ' +
        'Trả lời tiếng Việt, 2–4 câu ngắn, dễ hiểu cho nhân viên putaway. ' +
        'Nêu zone/rack/bin được gợi ý (mã nếu có) và 1–2 lý do chính từ ruleReasons.',
    },
    {
      role: 'user',
      content: `Giải thích gợi ý putaway cho nhân viên kho:\n${JSON.stringify(facts, null, 2)}`,
    },
  ];
}
