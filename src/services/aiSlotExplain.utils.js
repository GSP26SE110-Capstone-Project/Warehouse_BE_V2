/**
 * Shared prompt + fallback for slot recommendation explanations (Ollama / Gemini).
 */

const REASON_VI = {
  'Limited free capacity on bin': 'Bin còn ít chỗ trống nhưng vẫn đủ cho kiện này',
  'Matches tenant storage reservation': 'Bin nằm trong phạm vi zone/rack đã cấp cho tenant trên hợp đồng',
  'Shared bin available for tenant': 'Bin chia sẻ còn chỗ và tenant được phép sử dụng',
  'Same SKU stored in this zone': 'Cùng zone đã có SKU tương tự — gom hàng thuận tiện picking',
};

function translateReason(reason) {
  if (!reason || typeof reason !== 'string') return '';
  if (REASON_VI[reason]) return REASON_VI[reason];
  const freeVol = reason.match(/^(\d+)% free volume, (\d+) LPN slot\(s\) left$/);
  if (freeVol) {
    return `Bin còn ~${freeVol[1]}% volume trống và ${freeVol[2]} slot LPN`;
  }
  const rackMatch = reason.match(/^Rack type (\w+) matches LPN weight class$/);
  if (rackMatch) {
    return `Loại kệ ${rackMatch[1]} phù hợp trọng lượng kiện`;
  }
  const rackMismatch = reason.match(
    /^Rack type (\w+) does not match suggested (\w+)$/
  );
  if (rackMismatch) {
    return `Kệ ${rackMismatch[1]} (rule gợi ý ${rackMismatch[2]})`;
  }
  return reason;
}

export function compactExplainContext(context = {}) {
  const ruleReasons = (context.reasons ?? context.ruleReasons ?? []).slice(0, 4);
  const score = context.score ?? context.recommendationScore ?? null;

  return {
    lpnCode: context.lpnCode ?? null,
    zoneCode: context.zoneCode ?? null,
    rackCode: context.rackCode ?? null,
    binCode: context.binCode ?? null,
    levelNumber: context.levelNumber ?? null,
    score,
    modelVersion: context.modelVersion ?? 'slotting-v1-rule',
    ruleReasons,
    suggestedRackType: context.suggestedRackType ?? null,
  };
}

export function buildFallbackSlotExplanation(context = {}) {
  const facts = compactExplainContext(context);
  const lpnLabel = facts.lpnCode ? `Kiện ${facts.lpnCode}` : 'Kiện hàng';
  const locationParts = [
    facts.binCode && `bin ${facts.binCode}`,
    facts.zoneCode && `khu ${facts.zoneCode}`,
    facts.rackCode && `kệ ${facts.rackCode}`,
    facts.levelNumber != null && `tầng ${facts.levelNumber}`,
  ].filter(Boolean);
  const locationText = locationParts.length
    ? locationParts.join(', ')
    : 'vị trí do rule engine chọn';

  const scoreText =
    facts.score != null ? ` (điểm ~${Math.round(Number(facts.score) * 100)}%)` : '';

  const viReasons = facts.ruleReasons
    .map(translateReason)
    .filter(Boolean)
    .slice(0, 2);

  const reasonText =
    viReasons.length > 0
      ? viReasons.join('. ') + '.'
      : 'Bin đáp ứng dung lượng và phạm vi hợp đồng.';

  return `${lpnLabel} nên putaway vào ${locationText}${scoreText}. ${reasonText}`;
}

export function isExplanationTooShort(text) {
  const trimmed = (text ?? '').trim();
  if (trimmed.length < 40) return true;
  const sentences = trimmed.split(/[.!?…]+/).filter((s) => s.trim().length > 8);
  return sentences.length < 2;
}

/** Use LLM text when adequate; otherwise rule-based Vietnamese fallback. */
export function ensureSlotExplanation(llmText, context) {
  const trimmed = (llmText ?? '').trim();
  if (!trimmed || isExplanationTooShort(trimmed)) {
    return buildFallbackSlotExplanation(context);
  }
  return trimmed;
}

function formatFactsBlock(facts) {
  const lines = [
    facts.lpnCode && `- LPN: ${facts.lpnCode}`,
    facts.binCode && `- Bin gợi ý: ${facts.binCode}`,
    facts.zoneCode && `- Zone: ${facts.zoneCode}`,
    facts.rackCode && `- Rack: ${facts.rackCode}`,
    facts.levelNumber != null && `- Tầng kệ: ${facts.levelNumber}`,
    facts.score != null && `- Điểm rule engine: ${Math.round(Number(facts.score) * 100)}%`,
    facts.suggestedRackType && `- Loại kệ gợi ý: ${facts.suggestedRackType}`,
  ].filter(Boolean);

  const reasonLines = facts.ruleReasons.map(
    (r, i) => `  ${i + 1}. ${translateReason(r) || r}`
  );

  return (
    lines.join('\n') +
    (reasonLines.length ? `\n- Lý do rule engine:\n${reasonLines.join('\n')}` : '')
  );
}

export function buildSlotExplanationMessages(context) {
  const facts = compactExplainContext(context);

  const example =
    'Kiện ABC-LPN-01 nên đặt vào bin B-01 (khu Z-A, kệ R-01). ' +
    'Bin còn đủ volume trống và nằm trong zone tenant được cấp trên hợp đồng (điểm ~85%).';

  return [
    {
      role: 'system',
      content:
        'Bạn là trợ lý kho WMS. Viết giải thích putaway bằng tiếng Việt cho nhân viên kho. ' +
        'Chỉ dùng thông tin trong phần Facts; không bịa mã bin/zone/rack hay số liệu. ' +
        'Trả lời đúng 2–3 câu liền mạch (khoảng 1–2 dòng), không bullet, không markdown, không lặp lại nguyên Facts. ' +
        'Câu 1: LPN + vị trí gợi ý. Câu 2–3: vì sao chọn (dựa lý do rule engine). ' +
        `Ví dụ độ dài: "${example}"`,
    },
    {
      role: 'user',
      content:
        'Giải thích gợi ý putaway cho nhân viên kho dựa trên Facts sau:\n\n' +
        formatFactsBlock(facts),
    },
  ];
}
