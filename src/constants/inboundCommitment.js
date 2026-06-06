/** Số cái còn lại tối thiểu để tenant admin có thể đóng cam kết dòng (hoặc 1% cam kết). */
export const COMMITMENT_TAIL_CLOSE_MIN = 5;

export function computeTailCloseThreshold(committedPieces) {
  const committed = Number(committedPieces ?? 0);
  return Math.max(COMMITMENT_TAIL_CLOSE_MIN, Math.round(committed * 0.01));
}

export function effectiveCommittedPieces(committedPieces, writtenOffPieces = 0) {
  return Math.max(0, Number(committedPieces ?? 0) - Number(writtenOffPieces ?? 0));
}

export function enrichCommitmentLineUsage({
  committedPieces,
  writtenOffPieces = 0,
  usedPieces = 0,
}) {
  const effective = effectiveCommittedPieces(committedPieces, writtenOffPieces);
  const used = Number(usedPieces ?? 0);
  const remainingPieces = Math.max(0, effective - used);
  const overagePieces = Math.max(0, used - effective);
  const tailCloseThreshold = computeTailCloseThreshold(committedPieces);

  return {
    committedPieces: Number(committedPieces ?? 0),
    writtenOffPieces: Number(writtenOffPieces ?? 0),
    effectiveCommittedPieces: effective,
    usedPieces: used,
    remainingPieces,
    overagePieces,
    isTailRemaining: remainingPieces > 0 && remainingPieces <= tailCloseThreshold,
    canCloseLine: remainingPieces > 0 && remainingPieces <= tailCloseThreshold,
    tailCloseThreshold,
  };
}

export function buildCommitmentOverageWarnings(productLines = []) {
  return productLines
    .filter((line) => !line.uncommitted && Number(line.overagePieces ?? 0) > 0)
    .map((line) => ({
      code: 'COMMITMENT_OVERAGE',
      productKind: line.productKind,
      size: line.size ?? null,
      effectiveCommittedPieces: line.effectiveCommittedPieces,
      usedPieces: line.usedPieces,
      overagePieces: line.overagePieces,
      message:
        `Tồn vượt cam kết ${line.overagePieces} cái cho ${line.productKind}` +
        `${line.size ? ` size ${line.size}` : ''} ` +
        `(hiệu lực ${line.effectiveCommittedPieces} cái, đang ${line.usedPieces} cái).`,
    }));
}
