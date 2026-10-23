export type ConditionClass = 'Baik' | 'Sedang' | 'Rusak Ringan' | 'Rusak Berat';

export type DrainageCondition = 'Baik' | 'Sedang' | 'Buruk';

export type DirectionTag = 'Arah Normal' | 'Arah Sebaliknya' | 'Potongan Melintang';

export type PriorityRank = 'P1' | 'P2' | 'P3' | 'P4';

export type TreatmentType =
  | 'Pemeliharaan Rutin'
  | 'Pemeliharaan Berkala'
  | 'Rehabilitasi Mayor'
  | 'Rekonstruksi Struktur';

export type ViewRoute =
  | 'ruas'
  | 'input'
  | 'kelengkapan'
  | 'analisis'
  | 'hasil'
  | 'simulasi'
  | 'laporan';

export interface PhotoEvidence {
  id: string;
  url: string;
  caption: string;
  direction: DirectionTag;
  capturedAt: string;
}

export interface RoadSegment {
  id: string;
  ruasId: string;
  segmentIndex: number;
  staStartM: number;
  staEndM: number;
  staLabel: string; // e.g. "0+000 - 0+100"
  lengthM: number;
  // Core 4 SDI measurements
  crackAreaPct: number; // 0 - 100 %
  crackWidthMm: number; // mm
  potholeCount: number; // titik
  ruttingDepthCm: number; // cm
  // Supporting Technical & LHR Data
  lhrVehiclesPerDay: number;
  heavyVehiclePct: number;
  drainageCondition: DrainageCondition;
  pavementAgeYears: number;
  iriValueMPerKm: number;
  notes: string;
  photos: PhotoEvidence[];
  verified: boolean;
  verifiedAt?: string;
}

export interface RoadRuas {
  id: string;
  code: string; // e.g. "RN-01"
  name: string; // e.g. "Ruas Naibonat – Nunkurus"
  staStartM: number;
  staEndM: number;
  widthM: number;
  surveyPeriod: string; // e.g. "2026"
  surveyorName: string;
  createdAt: string;
  segments: RoadSegment[];
}

export type MarkovMatrix4x4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number]
];

export interface UnitCostConfig {
  baikPerKm: number;
  sedangPerKm: number;
  rusakRinganPerKm: number;
  rusakBeratPerKm: number;
}

export interface SDIBreakdown {
  sdi1: number;
  sdi2: number;
  potholesPer100m: number;
  sdi3: number;
  sdi4: number;
  finalSdi: number;
  condition: ConditionClass;
}

export interface MarkovYearRow {
  yearOffset: number;
  calendarYear: number;
  proportions: {
    Baik: number;
    Sedang: number;
    'Rusak Ringan': number;
    'Rusak Berat': number;
  };
  lengthsM: {
    Baik: number;
    Sedang: number;
    'Rusak Ringan': number;
    'Rusak Berat': number;
  };
  stabilityIndexPct: number; // Baik + Sedang %
}

export interface SegmentEvaluation {
  segmentId: string;
  segmentIndex: number;
  staLabel: string;
  lengthM: number;
  areaM2: number;
  sdiBreakdown: SDIBreakdown;
  condition: ConditionClass;
  priorityRank: PriorityRank;
  compositePriorityScore: number;
  treatment: TreatmentType;
  unitCostPerKm: number;
  estimatedCostRp: number;
  drainageCondition: DrainageCondition;
  lhrVehiclesPerDay: number;
  heavyVehiclePct: number;
  iriValueMPerKm: number;
  isEarlyWarning: boolean;
  warningReasons: string[];
}

export interface MultiYearScheduleItem {
  yearIndex: number;
  calendarYear: number;
  focusDescription: string;
  routineCostRp: number;
  periodicCostRp: number;
  rehabReconstructionCostRp: number;
  totalYearCostRp: number;
  targetStabilityPct: number;
}

export interface AnalysisSnapshot {
  id: string; // e.g. "ANL-2026-001"
  revision: number;
  ruasId: string;
  ruasCode: string;
  ruasName: string;
  widthM: number;
  baseYear: number;
  horizonYears: number;
  createdAt: string;
  surveyorName: string;
  markovMatrix: MarkovMatrix4x4;
  unitCosts: UnitCostConfig;
  totalAnalyzedLengthM: number;
  weightedAvgSdi: number;
  overallCondition: ConditionClass;
  pearsonCorrelationIri: number;
  stabilityYear0Pct: number;
  stabilityYear5Pct: number;
  immediateTreatmentCostRp: number;
  totalFiveYearBudgetRp: number;
  segmentEvaluations: SegmentEvaluation[];
  markovProjections: MarkovYearRow[];
  multiYearSchedule: MultiYearScheduleItem[];
  frozenSegments: RoadSegment[];
}

export interface SavedScenario {
  id: string;
  name: string;
  ruasId: string;
  baselineAnalysisId: string;
  createdAt: string;
  unitCosts: UnitCostConfig;
  budgetCapRp: number;
  markovMatrix: MarkovMatrix4x4;
  scenarioImmediateCostRp: number;
  scenarioFiveYearCostRp: number;
  costDeltaRp: number;
  scenarioYear5StabilityPct: number;
  stabilityDeltaPct: number;
}

export interface JalanBetaStoreState {
  ruasList: RoadRuas[];
  activeRuasId: string;
  activeSegmentId: string;
  activeAnalysisId: string;
  analysisHistory: AnalysisSnapshot[];
  savedScenarios: SavedScenario[];
  defaultMarkovMatrix: MarkovMatrix4x4;
  defaultUnitCosts: UnitCostConfig;
}
