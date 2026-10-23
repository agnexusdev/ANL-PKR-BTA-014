import {
  AnalysisSnapshot,
  ConditionClass,
  DrainageCondition,
  MarkovMatrix4x4,
  MarkovYearRow,
  MultiYearScheduleItem,
  PriorityRank,
  RoadRuas,
  RoadSegment,
  SDIBreakdown,
  SegmentEvaluation,
  TreatmentType,
  UnitCostConfig,
} from '../types/jalan';

export const DEFAULT_MARKOV_MATRIX: MarkovMatrix4x4 = [
  [0.82, 0.14, 0.04, 0.00],
  [0.00, 0.78, 0.18, 0.04],
  [0.00, 0.00, 0.75, 0.25],
  [0.00, 0.00, 0.00, 1.00],
];

export const DEFAULT_UNIT_COSTS: UnitCostConfig = {
  baikPerKm: 50_000_000,
  sedangPerKm: 350_000_000,
  rusakRinganPerKm: 1_200_000_000,
  rusakBeratPerKm: 3_500_000_000,
};

/**
 * Formats a distance in meters into standard Indonesian Bina Marga stationing (STA) format.
 * e.g. 0 -> "0+000", 325 -> "0+325", 1250 -> "1+250"
 */
export function formatSta(meters: number): string {
  const safeMeters = Math.max(0, Math.round(meters));
  const km = Math.floor(safeMeters / 1000);
  const rem = safeMeters % 1000;
  return `${km}+${String(rem).padStart(3, '0')}`;
}

/**
 * Formats a start and end meter range as a stationing label.
 * e.g. (0, 100) -> "0+000 - 0+100"
 */
export function formatStaRange(staStartM: number, staEndM: number): string {
  return `${formatSta(staStartM)} - ${formatSta(staEndM)}`;
}

/**
 * Formats Rupiah values cleanly with tabular discipline.
 */
export function formatRupiah(amount: number, compact = false): string {
  const rounded = Math.round(amount);
  if (compact) {
    const abs = Math.abs(rounded);
    const sign = rounded < 0 ? '-' : '';
    if (abs >= 1_000_000_000) {
      return `${sign}Rp ${(abs / 1_000_000_000).toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} M`;
    }
    if (abs >= 1_000_000) {
      return `${sign}Rp ${(abs / 1_000_000).toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} Jt`;
    }
  }
  return `Rp ${rounded.toLocaleString('id-ID')}`;
}

/**
 * Deterministic 4-Step Surface Distress Index (SDI) Calculation
 * Implements exact Bina Marga SDI specification:
 * - Step 1 (SDI_1 — Luas Retak %): 0% -> 0; < 10% -> 5; 10%-30% -> 20; > 30% -> 40.
 * - Step 2 (SDI_2 — Lebar Retak mm): If > 3 mm, SDI_2 = SDI_1 * 2; otherwise SDI_2 = SDI_1.
 * - Step 3 (SDI_3 — Jumlah Lubang normalized to 100m): Lubang_100m = (Jumlah_Lubang / Panjang_Segmen_Meter) * 100.
 *   If 0 -> SDI_2; < 10 -> SDI_2 + 15; 10-50 -> SDI_2 + 75; > 50 -> SDI_2 + 225.
 * - Step 4 (SDI_4 — Kedalaman Rutting cm): If 0 -> SDI_3; < 1 cm -> SDI_3 + 2.5; 1-3 cm -> SDI_3 + 10; > 3 cm -> SDI_3 + 20.
 * - Condition Class: SDI < 50 = Baik; 50 <= SDI < 100 = Sedang; 100 <= SDI < 150 = Rusak Ringan; SDI >= 150 = Rusak Berat.
 */
export function calculateSDI(params: {
  crackAreaPct: number;
  crackWidthMm: number;
  potholeCount: number;
  ruttingDepthCm: number;
  segmentLengthM: number;
}): SDIBreakdown {
  const crackArea = Math.max(0, Math.min(100, Number(params.crackAreaPct) || 0));
  const crackWidth = Math.max(0, Number(params.crackWidthMm) || 0);
  const potholes = Math.max(0, Number(params.potholeCount) || 0);
  const rutting = Math.max(0, Number(params.ruttingDepthCm) || 0);
  const lengthM = Math.max(1, Number(params.segmentLengthM) || 100);

  // Step 1: Luas Retak (%)
  let sdi1 = 0;
  if (crackArea === 0) {
    sdi1 = 0;
  } else if (crackArea < 10) {
    sdi1 = 5;
  } else if (crackArea <= 30) {
    sdi1 = 20;
  } else {
    sdi1 = 40;
  }

  // Step 2: Rata-rata Lebar Retak (mm)
  const sdi2 = crackWidth > 3 ? sdi1 * 2 : sdi1;

  // Step 3: Jumlah Lubang normalized to 100m
  const potholesPer100m = (potholes / lengthM) * 100;
  let sdi3 = sdi2;
  if (potholesPer100m === 0) {
    sdi3 = sdi2;
  } else if (potholesPer100m < 10) {
    sdi3 = sdi2 + 15;
  } else if (potholesPer100m <= 50) {
    sdi3 = sdi2 + 75;
  } else {
    sdi3 = sdi2 + 225;
  }

  // Step 4: Kedalaman Alur / Rutting (cm)
  let sdi4 = sdi3;
  if (rutting === 0) {
    sdi4 = sdi3;
  } else if (rutting < 1) {
    sdi4 = sdi3 + 2.5;
  } else if (rutting <= 3) {
    sdi4 = sdi3 + 10;
  } else {
    sdi4 = sdi3 + 20;
  }

  const finalSdi = Number(sdi4.toFixed(2));
  const condition = classifyConditionBySDI(finalSdi);

  return {
    sdi1,
    sdi2,
    potholesPer100m: Number(potholesPer100m.toFixed(2)),
    sdi3,
    sdi4: finalSdi,
    finalSdi,
    condition,
  };
}

export function classifyConditionBySDI(sdi: number): ConditionClass {
  if (sdi < 50) return 'Baik';
  if (sdi < 100) return 'Sedang';
  if (sdi < 150) return 'Rusak Ringan';
  return 'Rusak Berat';
}

/**
 * Automatically splits a road between staStartM and staEndM into 100m segments
 * plus the exact remainder segment (e.g., 325m -> 100m, 100m, 100m, 25m).
 */
export function generateSegmentsForRuas(
  ruasId: string,
  staStartM: number,
  staEndM: number
): RoadSegment[] {
  const start = Math.max(0, Math.round(staStartM));
  const end = Math.max(start + 1, Math.round(staEndM));
  const segments: RoadSegment[] = [];

  let cursor = start;
  let index = 1;
  while (cursor < end) {
    const nextCursor = Math.min(cursor + 100, end);
    const lengthM = nextCursor - cursor;
    segments.push({
      id: `${ruasId}-SEG-${String(index).padStart(2, '0')}`,
      ruasId,
      segmentIndex: index,
      staStartM: cursor,
      staEndM: nextCursor,
      staLabel: formatStaRange(cursor, nextCursor),
      lengthM,
      crackAreaPct: 0,
      crackWidthMm: 0,
      potholeCount: 0,
      ruttingDepthCm: 0,
      lhrVehiclesPerDay: 1500,
      heavyVehiclePct: 12,
      drainageCondition: 'Baik',
      pavementAgeYears: 3,
      iriValueMPerKm: 3.2,
      notes: '',
      photos: [],
      verified: false,
    });
    cursor = nextCursor;
    index++;
  }

  return segments;
}

/**
 * Validates that a 4x4 Markov Transition Matrix has valid probabilities in [0, 1]
 * and each row sums to 1.00 (within 0.005 floating point tolerance).
 */
export function validateMarkovMatrix(matrix: MarkovMatrix4x4): {
  valid: boolean;
  rowSums: [number, number, number, number];
  invalidRows: number[];
} {
  const rowSums: [number, number, number, number] = [0, 0, 0, 0];
  const invalidRows: number[] = [];

  for (let r = 0; r < 4; r++) {
    let sum = 0;
    let hasNegativeOrGtOne = false;
    for (let c = 0; c < 4; c++) {
      const val = Number(matrix[r][c]);
      if (Number.isNaN(val) || val < 0 || val > 1) {
        hasNegativeOrGtOne = true;
      }
      sum += val;
    }
    const roundedSum = Number(sum.toFixed(4));
    rowSums[r] = roundedSum;
    if (hasNegativeOrGtOne || Math.abs(roundedSum - 1.0) > 0.005) {
      invalidRows.push(r);
    }
  }

  return {
    valid: invalidRows.length === 0,
    rowSums,
    invalidRows,
  };
}

/**
 * Maps condition class to standard engineering treatment, priority rank, and unit cost.
 */
export function getTreatmentSpec(
  condition: ConditionClass,
  unitCosts: UnitCostConfig
): {
  treatment: TreatmentType;
  priorityRank: PriorityRank;
  unitCostPerKm: number;
} {
  switch (condition) {
    case 'Baik':
      return {
        treatment: 'Pemeliharaan Rutin',
        priorityRank: 'P4',
        unitCostPerKm: unitCosts.baikPerKm,
      };
    case 'Sedang':
      return {
        treatment: 'Pemeliharaan Berkala',
        priorityRank: 'P3',
        unitCostPerKm: unitCosts.sedangPerKm,
      };
    case 'Rusak Ringan':
      return {
        treatment: 'Rehabilitasi Mayor',
        priorityRank: 'P2',
        unitCostPerKm: unitCosts.rusakRinganPerKm,
      };
    case 'Rusak Berat':
      return {
        treatment: 'Rekonstruksi Struktur',
        priorityRank: 'P1',
        unitCostPerKm: unitCosts.rusakBeratPerKm,
      };
  }
}

/**
 * Evaluates a single road segment for SDI, treatment, exact cost, and early warning alerts.
 */
export function evaluateSegment(
  segment: RoadSegment,
  widthM: number,
  unitCosts: UnitCostConfig
): SegmentEvaluation {
  const sdiBreakdown = calculateSDI({
    crackAreaPct: segment.crackAreaPct,
    crackWidthMm: segment.crackWidthMm,
    potholeCount: segment.potholeCount,
    ruttingDepthCm: segment.ruttingDepthCm,
    segmentLengthM: segment.lengthM,
  });

  const { treatment, priorityRank, unitCostPerKm } = getTreatmentSpec(
    sdiBreakdown.condition,
    unitCosts
  );

  // Exact segment cost = (Panjang_Segmen_Meter / 1000) * Harga_Satuan_Per_Km
  const estimatedCostRp = Math.round((segment.lengthM / 1000) * unitCostPerKm);
  const areaM2 = Number((segment.lengthM * widthM).toFixed(2));

  // Composite priority score for tie-breaking within priority class (SDI + Traffic + Drainage)
  const drainagePenalty =
    segment.drainageCondition === 'Buruk'
      ? 25
      : segment.drainageCondition === 'Sedang'
      ? 10
      : 0;
  const trafficFactor = (segment.heavyVehiclePct / 100) * 30 + (segment.lhrVehiclesPerDay / 5000) * 15;
  const compositePriorityScore = Number(
    (sdiBreakdown.finalSdi + drainagePenalty + trafficFactor).toFixed(2)
  );

  // Early Warning System rules
  const warningReasons: string[] = [];
  if (sdiBreakdown.finalSdi >= 150) {
    warningReasons.push(
      `Skor SDI Kritis (${sdiBreakdown.finalSdi}) melampaui ambang kerusakan struktural berat (≥ 150).`
    );
  } else if (sdiBreakdown.finalSdi >= 100) {
    warningReasons.push(
      `Skor SDI Tinggi (${sdiBreakdown.finalSdi}) telah melewati ambang intervensi rehabilitasi (≥ 100).`
    );
  }
  if (segment.drainageCondition === 'Buruk' && segment.heavyVehiclePct >= 15) {
    warningReasons.push(
      `Kombinasi drainase buruk dan beban kendaraan berat tinggi (${segment.heavyVehiclePct}%) mempercepat keruntuhan lapis pondasi.`
    );
  }
  if (sdiBreakdown.potholesPer100m >= 10) {
    warningReasons.push(
      `Densitas lubang tinggi (${sdiBreakdown.potholesPer100m} titik/100m) membahayakan keselamatan pengguna jalan.`
    );
  }
  if (segment.ruttingDepthCm > 3) {
    warningReasons.push(
      `Kedalaman alur roda (${segment.ruttingDepthCm} cm) berpotensi memicu hydroplaning saat hujan.`
    );
  }

  return {
    segmentId: segment.id,
    segmentIndex: segment.segmentIndex,
    staLabel: segment.staLabel,
    lengthM: segment.lengthM,
    areaM2,
    sdiBreakdown,
    condition: sdiBreakdown.condition,
    priorityRank,
    compositePriorityScore,
    treatment,
    unitCostPerKm,
    estimatedCostRp,
    drainageCondition: segment.drainageCondition,
    lhrVehiclesPerDay: segment.lhrVehiclesPerDay,
    heavyVehiclePct: segment.heavyVehiclePct,
    iriValueMPerKm: segment.iriValueMPerKm,
    isEarlyWarning: warningReasons.length > 0,
    warningReasons,
  };
}

/**
 * Multiplies a 1x4 state row vector by a 4x4 transition matrix P.
 */
export function multiplyVectorByMatrix(
  alpha: [number, number, number, number],
  matrix: MarkovMatrix4x4
): [number, number, number, number] {
  const next: [number, number, number, number] = [0, 0, 0, 0];
  for (let col = 0; col < 4; col++) {
    let sum = 0;
    for (let row = 0; row < 4; row++) {
      sum += alpha[row] * matrix[row][col];
    }
    next[col] = sum;
  }
  // Normalize to prevent floating point drift
  const total = next[0] + next[1] + next[2] + next[3];
  if (total > 0) {
    return [next[0] / total, next[1] / total, next[2] / total, next[3] / total];
  }
  return next;
}

/**
 * Length-Weighted Markov Chain Projection: alpha(t) = alpha(0) * P^t
 * Initial state vector alpha(0) is weighted strictly by actual segment length in meters.
 */
export function calculateMarkovProjection(
  segments: RoadSegment[],
  matrix: MarkovMatrix4x4,
  baseYear = 2026,
  horizonYears = 5
): MarkovYearRow[] {
  const totalLengthM = segments.reduce((acc, s) => acc + s.lengthM, 0);
  const safeTotalLengthM = Math.max(1, totalLengthM);

  const lengthByState: Record<ConditionClass, number> = {
    Baik: 0,
    Sedang: 0,
    'Rusak Ringan': 0,
    'Rusak Berat': 0,
  };

  for (const seg of segments) {
    const { condition } = calculateSDI({
      crackAreaPct: seg.crackAreaPct,
      crackWidthMm: seg.crackWidthMm,
      potholeCount: seg.potholeCount,
      ruttingDepthCm: seg.ruttingDepthCm,
      segmentLengthM: seg.lengthM,
    });
    lengthByState[condition] += seg.lengthM;
  }

  let currentAlpha: [number, number, number, number] = [
    lengthByState.Baik / safeTotalLengthM,
    lengthByState.Sedang / safeTotalLengthM,
    lengthByState['Rusak Ringan'] / safeTotalLengthM,
    lengthByState['Rusak Berat'] / safeTotalLengthM,
  ];

  const rows: MarkovYearRow[] = [];

  for (let t = 0; t <= horizonYears; t++) {
    const pBaik = Number((currentAlpha[0] * 100).toFixed(2));
    const pSedang = Number((currentAlpha[1] * 100).toFixed(2));
    const pRusakRingan = Number((currentAlpha[2] * 100).toFixed(2));
    const pRusakBerat = Number((currentAlpha[3] * 100).toFixed(2));

    const lBaik = Number((currentAlpha[0] * totalLengthM).toFixed(2));
    const lSedang = Number((currentAlpha[1] * totalLengthM).toFixed(2));
    const lRusakRingan = Number((currentAlpha[2] * totalLengthM).toFixed(2));
    const lRusakBerat = Number((currentAlpha[3] * totalLengthM).toFixed(2));

    rows.push({
      yearOffset: t,
      calendarYear: baseYear + t,
      proportions: {
        Baik: pBaik,
        Sedang: pSedang,
        'Rusak Ringan': pRusakRingan,
        'Rusak Berat': pRusakBerat,
      },
      lengthsM: {
        Baik: lBaik,
        Sedang: lSedang,
        'Rusak Ringan': lRusakRingan,
        'Rusak Berat': lRusakBerat,
      },
      stabilityIndexPct: Number(((currentAlpha[0] + currentAlpha[1]) * 100).toFixed(2)),
    });

    currentAlpha = multiplyVectorByMatrix(currentAlpha, matrix);
  }

  return rows;
}

/**
 * Calculates Pearson Correlation Coefficient (r) between segment SDI scores and IRI values.
 */
export function calculatePearsonCorrelation(segments: RoadSegment[]): number {
  if (segments.length < 2) return 1.0;

  const xs = segments.map(
    (s) =>
      calculateSDI({
        crackAreaPct: s.crackAreaPct,
        crackWidthMm: s.crackWidthMm,
        potholeCount: s.potholeCount,
        ruttingDepthCm: s.ruttingDepthCm,
        segmentLengthM: s.lengthM,
      }).finalSdi
  );
  const ys = segments.map((s) => s.iriValueMPerKm);

  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  if (denom === 0) return 0;
  return Number((num / denom).toFixed(3));
}

/**
 * Builds a 5-year budget & implementation schedule based on segment evaluations and Markov projections.
 */
export function buildMultiYearSchedule(
  evaluations: SegmentEvaluation[],
  markovProjections: MarkovYearRow[],
  unitCosts: UnitCostConfig,
  baseYear = 2026
): MultiYearScheduleItem[] {
  const totalLengthKm = evaluations.reduce((acc, e) => acc + e.lengthM, 0) / 1000;

  const p1Cost = evaluations
    .filter((e) => e.priorityRank === 'P1')
    .reduce((acc, e) => acc + e.estimatedCostRp, 0);
  const p2Cost = evaluations
    .filter((e) => e.priorityRank === 'P2')
    .reduce((acc, e) => acc + e.estimatedCostRp, 0);
  const p3Cost = evaluations
    .filter((e) => e.priorityRank === 'P3')
    .reduce((acc, e) => acc + e.estimatedCostRp, 0);
  const p4Cost = evaluations
    .filter((e) => e.priorityRank === 'P4')
    .reduce((acc, e) => acc + e.estimatedCostRp, 0);

  const annualFullRoutineRp = Math.round(totalLengthKm * unitCosts.baikPerKm);

  // Year 1: Immediate P1 (Rekonstruksi) + P2 (Rehabilitasi) + baseline P4 routine
  // Year 2: P3 (Pemeliharaan Berkala) + routine on treated segments
  // Year 3: Preventive periodic sealing on transitioning segments + routine
  // Year 4: Routine maintenance + spot leveling
  // Year 5: Periodic surface renewal + routine maintenance
  const schedule: MultiYearScheduleItem[] = [
    {
      yearIndex: 1,
      calendarYear: baseYear,
      focusDescription: 'Penanganan Darurat P1 (Rekonstruksi) & P2 (Rehabilitasi Mayor)',
      routineCostRp: p4Cost,
      periodicCostRp: 0,
      rehabReconstructionCostRp: p1Cost + p2Cost,
      totalYearCostRp: p1Cost + p2Cost + p4Cost,
      targetStabilityPct: Math.min(100, Number((markovProjections[0]?.stabilityIndexPct + 35).toFixed(1))),
    },
    {
      yearIndex: 2,
      calendarYear: baseYear + 1,
      focusDescription: 'Pemeliharaan Berkala Segmen P3 & Pemeliharaan Rutin Koridor',
      routineCostRp: Math.round(annualFullRoutineRp * 0.8),
      periodicCostRp: p3Cost,
      rehabReconstructionCostRp: 0,
      totalYearCostRp: Math.round(annualFullRoutineRp * 0.8) + p3Cost,
      targetStabilityPct: 96.5,
    },
    {
      yearIndex: 3,
      calendarYear: baseYear + 2,
      focusDescription: 'Pemeliharaan Rutin Komprehensif & Penutupan Retak Preventif',
      routineCostRp: annualFullRoutineRp,
      periodicCostRp: Math.round(totalLengthKm * unitCosts.sedangPerKm * 0.15),
      rehabReconstructionCostRp: 0,
      totalYearCostRp:
        annualFullRoutineRp + Math.round(totalLengthKm * unitCosts.sedangPerKm * 0.15),
      targetStabilityPct: 94.0,
    },
    {
      yearIndex: 4,
      calendarYear: baseYear + 3,
      focusDescription: 'Pemeliharaan Rutin Kondisi Mantap & Normalisasi Drainase Berkala',
      routineCostRp: annualFullRoutineRp,
      periodicCostRp: Math.round(totalLengthKm * unitCosts.sedangPerKm * 0.1),
      rehabReconstructionCostRp: 0,
      totalYearCostRp:
        annualFullRoutineRp + Math.round(totalLengthKm * unitCosts.sedangPerKm * 0.1),
      targetStabilityPct: 92.5,
    },
    {
      yearIndex: 5,
      calendarYear: baseYear + 4,
      focusDescription: 'Pelapisan Ulang Berkala (Overlay Fungsional) & Pemeliharaan Rutin',
      routineCostRp: annualFullRoutineRp,
      periodicCostRp: Math.round(totalLengthKm * unitCosts.sedangPerKm * 0.35),
      rehabReconstructionCostRp: 0,
      totalYearCostRp:
        annualFullRoutineRp + Math.round(totalLengthKm * unitCosts.sedangPerKm * 0.35),
      targetStabilityPct: 95.0,
    },
  ];

  return schedule;
}

/**
 * Generates a complete, immutable AnalysisSnapshot from a RoadRuas, MarkovMatrix, and UnitCostConfig.
 */
export function buildAnalysisSnapshot(params: {
  id: string;
  revision: number;
  ruas: RoadRuas;
  baseYear: number;
  horizonYears: number;
  markovMatrix: MarkovMatrix4x4;
  unitCosts: UnitCostConfig;
  createdAt?: string;
}): AnalysisSnapshot {
  const { id, revision, ruas, baseYear, horizonYears, markovMatrix, unitCosts } = params;
  const frozenSegments: RoadSegment[] = JSON.parse(JSON.stringify(ruas.segments));

  const segmentEvaluations = frozenSegments.map((seg) =>
    evaluateSegment(seg, ruas.widthM, unitCosts)
  );

  const totalAnalyzedLengthM = segmentEvaluations.reduce((acc, e) => acc + e.lengthM, 0);
  const safeTotalLength = Math.max(1, totalAnalyzedLengthM);

  const weightedSdiSum = segmentEvaluations.reduce(
    (acc, e) => acc + e.sdiBreakdown.finalSdi * e.lengthM,
    0
  );
  const weightedAvgSdi = Number((weightedSdiSum / safeTotalLength).toFixed(2));
  const overallCondition = classifyConditionBySDI(weightedAvgSdi);

  const markovProjections = calculateMarkovProjection(
    frozenSegments,
    markovMatrix,
    baseYear,
    horizonYears
  );

  const multiYearSchedule = buildMultiYearSchedule(
    segmentEvaluations,
    markovProjections,
    unitCosts,
    baseYear
  );

  const immediateTreatmentCostRp = segmentEvaluations.reduce(
    (acc, e) => acc + e.estimatedCostRp,
    0
  );
  const totalFiveYearBudgetRp = multiYearSchedule.reduce(
    (acc, item) => acc + item.totalYearCostRp,
    0
  );

  const pearsonCorrelationIri = calculatePearsonCorrelation(frozenSegments);

  return {
    id,
    revision,
    ruasId: ruas.id,
    ruasCode: ruas.code,
    ruasName: ruas.name,
    widthM: ruas.widthM,
    baseYear,
    horizonYears,
    createdAt: params.createdAt || new Date().toISOString(),
    surveyorName: ruas.surveyorName,
    markovMatrix: JSON.parse(JSON.stringify(markovMatrix)),
    unitCosts: { ...unitCosts },
    totalAnalyzedLengthM,
    weightedAvgSdi,
    overallCondition,
    pearsonCorrelationIri,
    stabilityYear0Pct: markovProjections[0]?.stabilityIndexPct ?? 0,
    stabilityYear5Pct: markovProjections[horizonYears]?.stabilityIndexPct ?? 0,
    immediateTreatmentCostRp,
    totalFiveYearBudgetRp,
    segmentEvaluations,
    markovProjections,
    multiYearSchedule,
    frozenSegments,
  };
}
