import {
  ConditionClass,
  JalanBetaStoreState,
  RoadRuas,
  RoadSegment,
  SavedScenario,
} from '../types/jalan';
import {
  buildAnalysisSnapshot,
  calculateSDI,
  DEFAULT_MARKOV_MATRIX,
  DEFAULT_UNIT_COSTS,
} from '../utils/calculations';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Clean helper that creates a properly encoded road surface SVG diagram data URL
 * using XML entity escaping + encodeURIComponent(svgString).
 */
export function createRoadSvgDataUrl(
  staLabel: string,
  condition: string,
  detailText: string
): string {
  const normalizedCondition: ConditionClass =
    condition === 'Baik' ||
    condition === 'Sedang' ||
    condition === 'Rusak Ringan' ||
    condition === 'Rusak Berat'
      ? condition
      : 'Sedang';

  return createRoadDistressSvgDataUrl({
    staLabel,
    condition: normalizedCondition,
    caption: detailText,
    crackPct:
      normalizedCondition === 'Rusak Berat'
        ? 38
        : normalizedCondition === 'Rusak Ringan'
        ? 24
        : normalizedCondition === 'Sedang'
        ? 16
        : 4,
    potholes:
      normalizedCondition === 'Rusak Berat'
        ? 5
        : normalizedCondition === 'Rusak Ringan'
        ? 14
        : normalizedCondition === 'Sedang'
        ? 3
        : 0,
    ruttingCm:
      normalizedCondition === 'Rusak Berat'
        ? 3.6
        : normalizedCondition === 'Rusak Ringan'
        ? 2.4
        : normalizedCondition === 'Sedang'
        ? 1.4
        : 0.6,
  });
}

/**
 * Generates a high-contrast engineering SVG illustration of road surface distress
 * as a data URL so thumbnails, lightboxes, and A4 PDF reports always render crisply offline.
 */
export function createRoadDistressSvgDataUrl(params: {
  staLabel: string;
  condition: ConditionClass;
  caption: string;
  crackPct: number;
  potholes: number;
  ruttingCm: number;
}): string {
  const { staLabel, condition, caption, crackPct, potholes, ruttingCm } = params;

  const badgeColors: Record<ConditionClass, { bg: string; stroke: string; text: string }> = {
    Baik: { bg: '#ECFDF5', stroke: '#A7F3D0', text: '#065F46' },
    Sedang: { bg: '#FFFBEB', stroke: '#FDE68A', text: '#92400E' },
    'Rusak Ringan': { bg: '#FFF7ED', stroke: '#FED7AA', text: '#9A3412' },
    'Rusak Berat': { bg: '#FFF1F2', stroke: '#FECDD3', text: '#9F1239' },
  };

  const c = badgeColors[condition] || badgeColors.Sedang;
  const safeSta = escapeXml(staLabel);
  const safeCaption = escapeXml(caption);
  const safeCondition = escapeXml(condition);
  const safeDetail = escapeXml(
    `Retak: ${crackPct}% | Lubang: ${potholes} ttk | Rutting: ${ruttingCm} cm`
  );

  // Distress visual overlays based on severity
  const crackPaths =
    crackPct > 25
      ? `<path d="M160 110 L195 145 L175 185 L210 225 M195 145 L245 155 L270 195 M175 185 L140 205 M360 120 L390 160 L370 210 L415 245 M390 160 L435 175" stroke="#111827" stroke-width="2.5" fill="none" stroke-linecap="round"/>
         <path d="M220 130 L260 170 L235 220 M310 140 L345 190 L325 240" stroke="#1F2937" stroke-width="2" fill="none" stroke-dasharray="4 2"/>`
      : crackPct >= 10
      ? `<path d="M185 125 L210 175 L195 225 M380 140 L400 195" stroke="#1F2937" stroke-width="2" fill="none" stroke-linecap="round"/>`
      : crackPct > 0
      ? `<path d="M205 150 L215 190" stroke="#374151" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
      : '';

  const potholeShapes =
    potholes >= 8
      ? `<ellipse cx="235" cy="185" rx="28" ry="16" fill="#18181B" stroke="#52525B" stroke-width="2"/>
         <ellipse cx="232" cy="183" rx="18" ry="9" fill="#27272A"/>
         <ellipse cx="375" cy="210" rx="34" ry="19" fill="#18181B" stroke="#52525B" stroke-width="2"/>
         <ellipse cx="310" cy="150" rx="20" ry="11" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>`
      : potholes > 0
      ? `<ellipse cx="250" cy="190" rx="22" ry="12" fill="#1F2937" stroke="#6B7280" stroke-width="1.5"/>`
      : '';

  const ruttingTracks =
    ruttingCm >= 1.5
      ? `<path d="M165 95 L110 265" stroke="#090D16" stroke-width="${Math.min(18, ruttingCm * 4)}" stroke-opacity="0.32" stroke-linecap="round"/>
         <path d="M435 95 L490 265" stroke="#090D16" stroke-width="${Math.min(18, ruttingCm * 4)}" stroke-opacity="0.32" stroke-linecap="round"/>`
      : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E2E8F0"/>
        <stop offset="100%" stop-color="#F1F5F9"/>
      </linearGradient>
      <linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#475569"/>
        <stop offset="100%" stop-color="#334155"/>
      </linearGradient>
    </defs>
    <rect width="600" height="100" fill="url(#sky)"/>
    <polygon points="0,100 600,100 600,360 0,360" fill="#CBD5E1"/>
    <polygon points="0,100 180,100 65,275 0,275" fill="#94A3B8"/>
    <polygon points="420,100 600,100 600,275 535,275" fill="#94A3B8"/>
    <polygon points="160,95 440,95 540,275 60,275" fill="url(#asphalt)"/>
    <line x1="172" y1="95" x2="82" y2="275" stroke="#F8FAFC" stroke-width="3" stroke-opacity="0.8"/>
    <line x1="428" y1="95" x2="518" y2="275" stroke="#F8FAFC" stroke-width="3" stroke-opacity="0.8"/>
    <line x1="300" y1="98" x2="300" y2="272" stroke="#FBBF24" stroke-width="4" stroke-dasharray="18 14"/>
    ${ruttingTracks}
    ${crackPaths}
    ${potholeShapes}
    <rect x="0" y="275" width="600" height="85" fill="#172B2A"/>
    <text x="20" y="305" fill="#FFFFFF" font-family="monospace" font-size="15" font-weight="bold">STA ${safeSta}</text>
    <text x="20" y="328" fill="#A7F3D0" font-family="sans-serif" font-size="12">${safeCaption}</text>
    <text x="20" y="347" fill="#94A3B8" font-family="monospace" font-size="11">${safeDetail}</text>
    <rect x="440" y="292" width="140" height="32" rx="16" fill="${c.bg}" stroke="${c.stroke}" stroke-width="1.5"/>
    <text x="510" y="313" fill="${c.text}" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">${safeCondition}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createInitialStoreState(): JalanBetaStoreState {
  const ruasId = 'RUAS-RN-01';

  const initialRuas: RoadRuas = {
    id: ruasId,
    code: 'RN-01',
    name: 'Ruas Naibonat – Nunkurus',
    staStartM: 0,
    staEndM: 325,
    widthM: 6.0,
    surveyPeriod: '2026',
    surveyorName: 'Tim Teknis Bina Marga',
    createdAt: '2026-10-15T08:30:00.000Z',
    segments: [
      {
        id: 'RN-01-SEG-01',
        ruasId,
        segmentIndex: 1,
        staStartM: 0,
        staEndM: 100,
        staLabel: '0+000 - 0+100',
        lengthM: 100,
        // SDI: crack 4% (<10% -> 5), width 1.5mm (<=3 -> 5), potholes 0 (-> 5), rutting 0.6cm (<1 -> 7.5) => SDI 7.5 (Baik)
        crackAreaPct: 4,
        crackWidthMm: 1.5,
        potholeCount: 0,
        ruttingDepthCm: 0.6,
        lhrVehiclesPerDay: 1850,
        heavyVehiclePct: 11,
        drainageCondition: 'Baik',
        pavementAgeYears: 2,
        iriValueMPerKm: 2.8,
        notes:
          'Permukaan lapis aus AC-WC dalam kondisi mantap. Teridentifikasi retak rambut minor pada tepi bahu kiri sepanjang 4 m, saluran drainase pasangan batu berfungsi optimal.',
        photos: [
          {
            id: 'PHOTO-RN01-S1-A',
            url: createRoadDistressSvgDataUrl({
              staLabel: '0+000 - 0+100',
              condition: 'Baik',
              caption: 'Visual Lapis Permukaan AC-WC STA 0+050 (Arah Nunkurus)',
              crackPct: 4,
              potholes: 0,
              ruttingCm: 0.6,
            }),
            caption: 'Kondisi perkerasan mantap pada STA 0+050 dengan marka jalan jelas',
            direction: 'Arah Normal',
            capturedAt: '2026-10-15 09:10 WITA',
          },
        ],
        verified: true,
        verifiedAt: '2026-10-15T09:15:00.000Z',
      },
      {
        id: 'RN-01-SEG-02',
        ruasId,
        segmentIndex: 2,
        staStartM: 100,
        staEndM: 200,
        staLabel: '0+100 - 0+200',
        lengthM: 100,
        // SDI: crack 16% (10-30% -> 20), width 3.8mm (>3 -> 40), potholes 3 (3/100m <10 -> 55), rutting 1.4cm (1-3 -> 65) => SDI 65.0 (Sedang)
        crackAreaPct: 16,
        crackWidthMm: 3.8,
        potholeCount: 3,
        ruttingDepthCm: 1.4,
        lhrVehiclesPerDay: 1850,
        heavyVehiclePct: 14,
        drainageCondition: 'Sedang',
        pavementAgeYears: 5,
        iriValueMPerKm: 5.4,
        notes:
          'Retak memanjang pada lintasan roda kiri dan kanan dengan bukaan rata-rata 3,8 mm serta 3 titik lubang dangkal. Diperlukan penambalan struktural dan pelapisan berkala.',
        photos: [
          {
            id: 'PHOTO-RN01-S2-A',
            url: createRoadDistressSvgDataUrl({
              staLabel: '0+100 - 0+200',
              condition: 'Sedang',
              caption: 'Retak Memanjang & 3 Titik Lubang pada STA 0+145',
              crackPct: 16,
              potholes: 3,
              ruttingCm: 1.4,
            }),
            caption: 'Retak memanjang dan lubang lokal pada jalur roda kendaraan niaga STA 0+145',
            direction: 'Arah Normal',
            capturedAt: '2026-10-15 09:40 WITA',
          },
        ],
        verified: true,
        verifiedAt: '2026-10-15T09:45:00.000Z',
      },
      {
        id: 'RN-01-SEG-03',
        ruasId,
        segmentIndex: 3,
        staStartM: 200,
        staEndM: 300,
        staLabel: '0+200 - 0+300',
        lengthM: 100,
        // SDI: crack 24% (10-30% -> 20), width 2.8mm (<=3 -> 20), potholes 14 (14/100m 10-50 -> 95), rutting 2.4cm (1-3 -> 105) => SDI 105.0 (Rusak Ringan)
        crackAreaPct: 24,
        crackWidthMm: 2.8,
        potholeCount: 14,
        ruttingDepthCm: 2.4,
        lhrVehiclesPerDay: 1850,
        heavyVehiclePct: 18,
        drainageCondition: 'Sedang',
        pavementAgeYears: 7,
        iriValueMPerKm: 8.2,
        notes:
          'Konsentrasi 14 titik lubang terdistribusi pada STA 0+220 s/d 0+285 disertai deformasi alur roda 2,4 cm. Direkomendasikan rehabilitasi mayor dengan perataan lapis pondasi.',
        photos: [
          {
            id: 'PHOTO-RN01-S3-A',
            url: createRoadDistressSvgDataUrl({
              staLabel: '0+200 - 0+300',
              condition: 'Rusak Ringan',
              caption: 'Distribusi Lubang & Alur Roda pada STA 0+260',
              crackPct: 24,
              potholes: 14,
              ruttingCm: 2.4,
            }),
            caption: 'Kerusakan lubang beruntun dan penurunan alur roda pada STA 0+260',
            direction: 'Arah Normal',
            capturedAt: '2026-10-15 10:15 WITA',
          },
        ],
        verified: true,
        verifiedAt: '2026-10-15T10:20:00.000Z',
      },
      {
        id: 'RN-01-SEG-04',
        ruasId,
        segmentIndex: 4,
        staStartM: 300,
        staEndM: 325,
        staLabel: '0+300 - 0+325',
        lengthM: 25,
        // SDI on 25m remainder: crack 38% (>30% -> 40), width 5.2mm (>3 -> 80), potholes 5 in 25m (= 20/100m -> +75 = 155), rutting 3.6cm (>3 -> +20 = 175) => SDI 175.0 (Rusak Berat)
        crackAreaPct: 38,
        crackWidthMm: 5.2,
        potholeCount: 5,
        ruttingDepthCm: 3.6,
        lhrVehiclesPerDay: 1850,
        heavyVehiclePct: 22,
        drainageCondition: 'Buruk',
        pavementAgeYears: 9,
        iriValueMPerKm: 11.6,
        notes:
          'Segmen akhir 25m mengalami retak buaya menyeluruh (38%), 5 lubang struktur dalam (ekuivalen 20 lubang/100m), rutting 3,6 cm, serta genangan air akibat saluran tepi tertutup sedimen. Prioritas P1 Rekonstruksi Struktur.',
        photos: [
          {
            id: 'PHOTO-RN01-S4-A',
            url: createRoadDistressSvgDataUrl({
              staLabel: '0+300 - 0+325',
              condition: 'Rusak Berat',
              caption: 'Kerusakan Struktural Berat & Genangan Drainase STA 0+315',
              crackPct: 38,
              potholes: 5,
              ruttingCm: 3.6,
            }),
            caption: 'Retak buaya struktur, lubang dalam, dan drainase buruk pada STA 0+300 - 0+325',
            direction: 'Arah Sebaliknya',
            capturedAt: '2026-10-15 10:50 WITA',
          },
        ],
        verified: true,
        verifiedAt: '2026-10-15T11:00:00.000Z',
      },
    ],
  };

  const baselineAnalysis = buildAnalysisSnapshot({
    id: 'ANL-2026-001',
    revision: 1,
    ruas: initialRuas,
    baseYear: 2026,
    horizonYears: 5,
    markovMatrix: DEFAULT_MARKOV_MATRIX,
    unitCosts: DEFAULT_UNIT_COSTS,
    createdAt: '2026-10-16T14:00:00.000Z',
  });

  const initialScenario: SavedScenario = {
    id: 'SCN-2026-01',
    name: 'Optimasi Drainase & Penyesuaian Harga Aspal (+8%)',
    ruasId,
    baselineAnalysisId: 'ANL-2026-001',
    createdAt: '2026-10-17T10:00:00.000Z',
    unitCosts: {
      baikPerKm: 54_000_000,
      sedangPerKm: 378_000_000,
      rusakRinganPerKm: 1_296_000_000,
      rusakBeratPerKm: 3_780_000_000,
    },
    budgetCapRp: 350_000_000,
    markovMatrix: [
      [0.86, 0.11, 0.03, 0.00],
      [0.00, 0.82, 0.15, 0.03],
      [0.00, 0.00, 0.80, 0.20],
      [0.00, 0.00, 0.00, 1.00],
    ],
    scenarioImmediateCostRp: Math.round(baselineAnalysis.immediateTreatmentCostRp * 1.08),
    scenarioFiveYearCostRp: Math.round(baselineAnalysis.totalFiveYearBudgetRp * 1.08),
    costDeltaRp:
      Math.round(baselineAnalysis.totalFiveYearBudgetRp * 1.08) -
      baselineAnalysis.totalFiveYearBudgetRp,
    scenarioYear5StabilityPct: Number((baselineAnalysis.stabilityYear5Pct + 6.4).toFixed(2)),
    stabilityDeltaPct: 6.4,
  };

  return {
    ruasList: [initialRuas],
    activeRuasId: initialRuas.id,
    activeSegmentId: initialRuas.segments[0].id,
    activeAnalysisId: baselineAnalysis.id,
    analysisHistory: [baselineAnalysis],
    savedScenarios: [initialScenario],
    defaultMarkovMatrix: DEFAULT_MARKOV_MATRIX,
    defaultUnitCosts: DEFAULT_UNIT_COSTS,
  };
}

function sanitizeSegmentsSvgUrls(segments: RoadSegment[]): RoadSegment[] {
  return segments.map((seg) => {
    const sdi = calculateSDI({
      crackAreaPct: seg.crackAreaPct,
      crackWidthMm: seg.crackWidthMm,
      potholeCount: seg.potholeCount,
      ruttingDepthCm: seg.ruttingDepthCm,
      segmentLengthM: seg.lengthM,
    });
    const sanitizedPhotos = (seg.photos || []).map((photo) => {
      if (photo.url && photo.url.startsWith('data:image/svg+xml')) {
        return {
          ...photo,
          url: createRoadDistressSvgDataUrl({
            staLabel: seg.staLabel,
            condition: sdi.condition,
            caption: photo.caption || `STA ${seg.staLabel}`,
            crackPct: seg.crackAreaPct,
            potholes: seg.potholeCount,
            ruttingCm: seg.ruttingDepthCm,
          }),
        };
      }
      return photo;
    });
    return {
      ...seg,
      photos: sanitizedPhotos,
    };
  });
}

/**
 * Ensures any persisted localStorage state from an earlier build has valid XML-escaped
 * and URI-encoded SVG data URLs across both ruasList and analysisHistory snapshots.
 */
export function sanitizeStoreSvgUrls(state: JalanBetaStoreState): JalanBetaStoreState {
  return {
    ...state,
    ruasList: (state.ruasList || []).map((ruas) => ({
      ...ruas,
      segments: sanitizeSegmentsSvgUrls(ruas.segments || []),
    })),
    analysisHistory: (state.analysisHistory || []).map((snap) => ({
      ...snap,
      frozenSegments: sanitizeSegmentsSvgUrls(snap.frozenSegments || []),
    })),
  };
}

