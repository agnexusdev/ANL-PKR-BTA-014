import React, { useState } from 'react';
import {
  ArrowRightLeft,
  BookmarkCheck,
  RotateCcw,
  Save,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  AnalysisSnapshot,
  MarkovMatrix4x4,
  SavedScenario,
  UnitCostConfig,
} from '../../types/jalan';
import {
  buildMultiYearSchedule,
  calculateMarkovProjection,
  evaluateSegment,
  formatRupiah,
} from '../../utils/calculations';
import {
  ConditionBadge,
  PageHeader,
  PriorityBadge,
  ResponsiveColumn,
  ResponsiveDataView,
  StatCard,
} from '../ui/Primitives';

interface SimulasiViewProps {
  baselineSnapshot: AnalysisSnapshot;
  savedScenarios: SavedScenario[];
  onSaveScenario: (scenario: SavedScenario) => void;
}

export const SimulasiView: React.FC<SimulasiViewProps> = ({
  baselineSnapshot,
  savedScenarios,
  onSaveScenario,
}) => {
  const [scenarioName, setScenarioName] = useState(
    'Optimalisasi Drainase & Eskalasi Harga Satuan'
  );
  const [unitCosts, setUnitCosts] = useState<UnitCostConfig>({
    ...baselineSnapshot.unitCosts,
  });
  const [budgetCapRp, setBudgetCapRp] = useState<number>(
    Math.round(baselineSnapshot.immediateTreatmentCostRp * 1.15)
  );
  // Transition retention boost (%) representing preventive drainage & sealing effectiveness
  const [retentionBoostPct, setRetentionBoostPct] = useState<number>(4);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Build adjusted Markov Matrix from retentionBoostPct
  const buildScenarioMatrix = (): MarkovMatrix4x4 => {
    const base = baselineSnapshot.markovMatrix;
    const boost = retentionBoostPct / 100;
    const adjustRow = (
      row: [number, number, number, number],
      diagIdx: number
    ): [number, number, number, number] => {
      if (diagIdx === 3) return [0, 0, 0, 1];
      const nextDiag = Math.max(0.1, Math.min(0.98, row[diagIdx] + boost));
      const rem = 1 - nextDiag;
      const origRem = 1 - row[diagIdx];
      const result: [number, number, number, number] = [0, 0, 0, 0];
      result[diagIdx] = Number(nextDiag.toFixed(3));
      if (origRem > 0) {
        for (let c = diagIdx + 1; c < 4; c++) {
          result[c] = Number(((row[c] / origRem) * rem).toFixed(3));
        }
      } else {
        result[diagIdx + 1] = Number(rem.toFixed(3));
      }
      // Fix rounding on last non-zero column
      const sum = result[0] + result[1] + result[2] + result[3];
      result[diagIdx] = Number((result[diagIdx] + (1 - sum)).toFixed(3));
      return result;
    };

    return [
      adjustRow(base[0], 0),
      adjustRow(base[1], 1),
      adjustRow(base[2], 2),
      [0, 0, 0, 1],
    ];
  };

  const scenarioMatrix = buildScenarioMatrix();

  // Compute Scenario Evaluations & Multi-Year Projections
  const scenarioEvaluations = baselineSnapshot.frozenSegments.map((seg) =>
    evaluateSegment(seg, baselineSnapshot.widthM, unitCosts)
  );

  const scenarioMarkov = calculateMarkovProjection(
    baselineSnapshot.frozenSegments,
    scenarioMatrix,
    baselineSnapshot.baseYear,
    baselineSnapshot.horizonYears
  );

  const scenarioSchedule = buildMultiYearSchedule(
    scenarioEvaluations,
    scenarioMarkov,
    unitCosts,
    baselineSnapshot.baseYear
  );

  const scenarioImmediateCostRp = scenarioEvaluations.reduce(
    (acc, e) => acc + e.estimatedCostRp,
    0
  );
  const scenarioFiveYearCostRp = scenarioSchedule.reduce(
    (acc, s) => acc + s.totalYearCostRp,
    0
  );

  const costDeltaRp = scenarioFiveYearCostRp - baselineSnapshot.totalFiveYearBudgetRp;
  const scenarioYear5StabilityPct =
    scenarioMarkov[baselineSnapshot.horizonYears]?.stabilityIndexPct ?? 0;
  const stabilityDeltaPct = Number(
    (scenarioYear5StabilityPct - baselineSnapshot.stabilityYear5Pct).toFixed(2)
  );

  const isWithinCap = scenarioImmediateCostRp <= budgetCapRp;

  const handleResetToBaseline = () => {
    setUnitCosts({ ...baselineSnapshot.unitCosts });
    setRetentionBoostPct(0);
    setBudgetCapRp(baselineSnapshot.immediateTreatmentCostRp);
  };

  const handleSaveCurrentScenario = () => {
    const newScenario: SavedScenario = {
      id: `SCN-${baselineSnapshot.baseYear}-${String(savedScenarios.length + 1).padStart(2, '0')}`,
      name: scenarioName.trim() || `Skenario Anggaran #${savedScenarios.length + 1}`,
      ruasId: baselineSnapshot.ruasId,
      baselineAnalysisId: baselineSnapshot.id,
      createdAt: new Date().toISOString(),
      unitCosts: { ...unitCosts },
      budgetCapRp,
      markovMatrix: scenarioMatrix,
      scenarioImmediateCostRp,
      scenarioFiveYearCostRp,
      costDeltaRp,
      scenarioYear5StabilityPct,
      stabilityDeltaPct,
    };
    onSaveScenario(newScenario);
    setSavedNotice(`Skenario "${newScenario.name}" (${newScenario.id}) berhasil disimpan.`);
  };

  const handleLoadSavedScenario = (scn: SavedScenario) => {
    setScenarioName(scn.name);
    setUnitCosts({ ...scn.unitCosts });
    setBudgetCapRp(scn.budgetCapRp);
    const diagDiff = Math.round(
      (scn.markovMatrix[0][0] - baselineSnapshot.markovMatrix[0][0]) * 100
    );
    setRetentionBoostPct(diagDiff);
  };

  interface SegmentComparisonRow {
    segmentId: string;
    staLabel: string;
    lengthM: number;
    condition: AnalysisSnapshot['overallCondition'];
    priorityRank: AnalysisSnapshot['segmentEvaluations'][0]['priorityRank'];
    treatment: string;
    baselineCostRp: number;
    scenarioCostRp: number;
    deltaRp: number;
  }

  const comparisonRows: SegmentComparisonRow[] = baselineSnapshot.segmentEvaluations.map(
    (baseEv, idx) => {
      const scnEv = scenarioEvaluations[idx];
      return {
        segmentId: baseEv.segmentId,
        staLabel: baseEv.staLabel,
        lengthM: baseEv.lengthM,
        condition: baseEv.condition,
        priorityRank: baseEv.priorityRank,
        treatment: baseEv.treatment,
        baselineCostRp: baseEv.estimatedCostRp,
        scenarioCostRp: scnEv.estimatedCostRp,
        deltaRp: scnEv.estimatedCostRp - baseEv.estimatedCostRp,
      };
    }
  );

  const comparisonColumns: ResponsiveColumn<SegmentComparisonRow>[] = [
    {
      key: 'sta',
      header: 'STA & Dimensi',
      render: (r) => (
        <div className="whitespace-nowrap">
          <div className="font-mono font-semibold text-[#172B2A] tabular-nums">
            {r.staLabel}
          </div>
          <div className="text-xs font-mono text-[#52615D] tabular-nums mt-0.5">
            {r.lengthM} m · {r.priorityRank}
          </div>
        </div>
      ),
    },
    {
      key: 'conditionProgram',
      header: 'Kondisi & Program',
      render: (r) => (
        <div>
          <div className="whitespace-nowrap">
            <ConditionBadge condition={r.condition} size="sm" />
          </div>
          <div className="font-medium text-[#172B2A] text-xs mt-1">
            {r.treatment}
          </div>
        </div>
      ),
    },
    {
      key: 'baseCost',
      header: 'Baseline',
      align: 'right',
      render: (r) => (
        <span className="font-mono tabular-nums text-[#52615D] whitespace-nowrap">
          {formatRupiah(r.baselineCostRp)}
        </span>
      ),
    },
    {
      key: 'scnCost',
      header: 'Skenario',
      align: 'right',
      render: (r) => (
        <span className="font-mono font-semibold tabular-nums text-[#172B2A] whitespace-nowrap">
          {formatRupiah(r.scenarioCostRp)}
        </span>
      ),
    },
    {
      key: 'delta',
      header: 'Selisih (Δ)',
      align: 'right',
      render: (r) => (
        <span
          className={`font-mono font-semibold tabular-nums whitespace-nowrap ${
            r.deltaRp > 0
              ? 'text-rose-700'
              : r.deltaRp < 0
              ? 'text-emerald-800'
              : 'text-[#52615D]'
          }`}
        >
          {r.deltaRp > 0 ? '+' : ''}
          {formatRupiah(r.deltaRp)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={`Perencanaan Multi-Skenario / Baseline ${baselineSnapshot.id}`}
        title="Skenario & Simulasi Sensitivitas Anggaran"
        subtitle="Bandingkan dampak perubahan harga satuan penanganan, pagu anggaran tahun pertama, dan laju retensi kondisi Markov terhadap baseline."
        actions={
          <>
            <button
              type="button"
              onClick={handleResetToBaseline}
              className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-white hover:bg-[#F4F5F1] text-[#172B2A] border border-[#D9DFDA] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span>Reset ke Baseline</span>
            </button>
            <button
              type="button"
              onClick={handleSaveCurrentScenario}
              className="min-h-[40px] px-5 py-2 rounded-lg text-sm font-semibold bg-[#17635C] hover:bg-[#124E48] text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Save className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span>Simpan Skenario</span>
            </button>
          </>
        }
      />

      {savedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
          <span>{savedNotice}</span>
          <button
            type="button"
            onClick={() => setSavedNotice(null)}
            className="font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Full-Width 3-Column Scenario Comparison StatCards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Selisih Total Biaya 5 Tahun"
          value={
            <span
              className={
                costDeltaRp > 0
                  ? 'text-rose-700'
                  : costDeltaRp < 0
                  ? 'text-emerald-800'
                  : 'text-[#172B2A]'
              }
            >
              {costDeltaRp > 0 ? '+' : ''}
              {formatRupiah(costDeltaRp, true)}
            </span>
          }
          subLabel={
            <span className="font-mono tabular-nums">
              {formatRupiah(baselineSnapshot.totalFiveYearBudgetRp, true)} →{' '}
              {formatRupiah(scenarioFiveYearCostRp, true)}
            </span>
          }
          icon={<ArrowRightLeft className="w-5 h-5" strokeWidth={1.75} />}
        />

        <StatCard
          label="Perubahan Kemantapan Thn 5"
          value={
            <span
              className={
                stabilityDeltaPct > 0
                  ? 'text-emerald-800'
                  : stabilityDeltaPct < 0
                  ? 'text-rose-700'
                  : 'text-[#172B2A]'
              }
            >
              {stabilityDeltaPct > 0
                ? `+${stabilityDeltaPct.toFixed(2)}%`
                : `${stabilityDeltaPct.toFixed(2)}%`}
            </span>
          }
          subLabel={
            <span className="font-mono tabular-nums">
              Baseline {baselineSnapshot.stabilityYear5Pct.toFixed(1)}% → Skenario{' '}
              {scenarioYear5StabilityPct.toFixed(1)}%
            </span>
          }
          icon={
            stabilityDeltaPct >= 0 ? (
              <TrendingUp className="w-5 h-5 text-emerald-700" strokeWidth={1.75} />
            ) : (
              <TrendingDown className="w-5 h-5 text-rose-700" strokeWidth={1.75} />
            )
          }
        />

        <StatCard
          label="Kebutuhan Tahun 1"
          value={formatRupiah(scenarioImmediateCostRp, true)}
          subLabel={
            <span
              className={`font-mono tabular-nums font-medium ${
                isWithinCap ? 'text-emerald-800' : 'text-rose-700'
              }`}
            >
              {isWithinCap
                ? `Sisa Pagu: ${formatRupiah(budgetCapRp - scenarioImmediateCostRp)}`
                : `Defisit: ${formatRupiah(scenarioImmediateCostRp - budgetCapRp)}`}
            </span>
          }
          icon={<BookmarkCheck className="w-5 h-5" strokeWidth={1.75} />}
        />
      </div>

      {/* Side-by-Side Split Layout (lg:grid-cols-12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Panel (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white border border-[#D9DFDA] rounded-xl p-5 shadow-xs space-y-5 min-w-0">
          <div>
            <h2 className="text-base font-semibold text-[#172B2A]">
              Parameter Variabel Skenario
            </h2>
            <p className="text-xs text-[#52615D]">
              Sesuaikan parameter biaya dan transisi untuk melihat selisih terhadap {baselineSnapshot.id}.
            </p>
          </div>

          <div>
            <label
              htmlFor="sim-scenario-name"
              className="block text-xs font-medium text-[#172B2A] mb-1"
            >
              Nama Skenario Evaluasi
            </label>
            <input
              id="sim-scenario-name"
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
            />
          </div>

          <div>
            <label
              htmlFor="sim-budget-cap"
              className="block text-xs font-medium text-[#172B2A] mb-1"
            >
              Pagu Anggaran Tahun Pertama (Rp)
            </label>
            <input
              id="sim-budget-cap"
              type="number"
              step={5000000}
              min={0}
              value={budgetCapRp}
              onChange={(e) => setBudgetCapRp(Math.max(0, Number(e.target.value) || 0))}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
            />
            <span className="text-[11px] font-mono tabular-nums text-[#52615D] mt-1 block">
              Pagu: {formatRupiah(budgetCapRp)} ({isWithinCap ? 'Mencukupi' : 'Defisit Pagu'})
            </span>
          </div>

          {/* Markov Retention Factor Control */}
          <div className="p-3.5 rounded-lg bg-[#F4F5F1] border border-[#D9DFDA] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="sim-retention-slider" className="font-semibold text-[#172B2A]">
                Faktor Retensi Kondisi Markov
              </label>
              <span className="font-mono font-bold text-[#17635C] tabular-nums">
                {retentionBoostPct >= 0 ? `+${retentionBoostPct}%` : `${retentionBoostPct}%`}
              </span>
            </div>
            <input
              id="sim-retention-slider"
              type="range"
              min={-15}
              max={15}
              step={1}
              value={retentionBoostPct}
              onChange={(e) => setRetentionBoostPct(Number(e.target.value))}
              className="w-full accent-[#17635C]"
            />
            <p className="text-[11px] text-[#52615D]">
              Mengatur perubahan probabilitas bertahan pada kelas kondisi yang sama (Pii) akibat kualitas drainase dan pengendalian beban sumbu.
            </p>
          </div>

          {/* Unit Costs Inputs */}
          <div className="space-y-3 pt-2 border-t border-[#D9DFDA]">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#52615D]">
              Simulasi Harga Satuan (Rp / km)
            </div>

            <div>
              <label
                htmlFor="sim-cost-baik"
                className="block text-xs text-[#172B2A] mb-1"
              >
                Pemeliharaan Rutin (Baik — P4)
              </label>
              <input
                id="sim-cost-baik"
                type="number"
                step={1000000}
                value={unitCosts.baikPerKm}
                onChange={(e) =>
                  setUnitCosts({
                    ...unitCosts,
                    baikPerKm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="sim-cost-sedang"
                className="block text-xs text-[#172B2A] mb-1"
              >
                Pemeliharaan Berkala (Sedang — P3)
              </label>
              <input
                id="sim-cost-sedang"
                type="number"
                step={5000000}
                value={unitCosts.sedangPerKm}
                onChange={(e) =>
                  setUnitCosts({
                    ...unitCosts,
                    sedangPerKm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="sim-cost-ringan"
                className="block text-xs text-[#172B2A] mb-1"
              >
                Rehabilitasi Mayor (Rusak Ringan — P2)
              </label>
              <input
                id="sim-cost-ringan"
                type="number"
                step={10000000}
                value={unitCosts.rusakRinganPerKm}
                onChange={(e) =>
                  setUnitCosts({
                    ...unitCosts,
                    rusakRinganPerKm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="sim-cost-berat"
                className="block text-xs text-[#172B2A] mb-1"
              >
                Rekonstruksi Struktur (Rusak Berat — P1)
              </label>
              <input
                id="sim-cost-berat"
                type="number"
                step={25000000}
                value={unitCosts.rusakBeratPerKm}
                onChange={(e) =>
                  setUnitCosts({
                    ...unitCosts,
                    rusakBeratPerKm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Right Comparison Panel (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {/* Segment Cost Comparison Table */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-[#172B2A]">
              Perbandingan Biaya Penanganan Per Segmen (Baseline vs. Skenario)
            </h3>
            <ResponsiveDataView
              columns={comparisonColumns}
              data={comparisonRows}
              keyExtractor={(r) => r.segmentId}
              renderMobileCard={(r) => (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-[#172B2A] tabular-nums">
                      STA {r.staLabel} ({r.lengthM}m)
                    </span>
                    <ConditionBadge condition={r.condition} size="sm" />
                  </div>
                  <div className="text-[#52615D]">{r.treatment}</div>
                  <div className="grid grid-cols-2 gap-2 font-mono tabular-nums pt-2 border-t border-[#D9DFDA]">
                    <div>Baseline: {formatRupiah(r.baselineCostRp)}</div>
                    <div className="font-bold text-[#172B2A]">
                      Skenario: {formatRupiah(r.scenarioCostRp)}
                    </div>
                  </div>
                </div>
              )}
            />
          </div>

          {/* Saved Scenarios List */}
          <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-3">
            <h3 className="text-base font-semibold text-[#172B2A]">
              Daftar Skenario Tersimpan ({savedScenarios.length})
            </h3>
            <div className="divide-y divide-[#D9DFDA]">
              {savedScenarios.map((scn) => (
                <div
                  key={scn.id}
                  className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#172B2A]">
                      {scn.id} — {scn.name}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-[#52615D]">
                      Total 5 Thn: {formatRupiah(scn.scenarioFiveYearCostRp)} (Δ{' '}
                      {scn.costDeltaRp >= 0 ? '+' : ''}
                      {formatRupiah(scn.costDeltaRp)}) · Kemantapan Thn 5:{' '}
                      {scn.scenarioYear5StabilityPct.toFixed(2)}%
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadSavedScenario(scn)}
                    className="min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F4F5F1] hover:bg-[#D9DFDA]/60 text-[#172B2A] border border-[#D9DFDA] whitespace-nowrap self-start sm:self-auto"
                  >
                    Muat Parameter
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
