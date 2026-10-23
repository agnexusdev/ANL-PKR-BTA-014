import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  FileText,
  Layers,
  MapPin,
  Sliders,
  Wrench,
} from 'lucide-react';
import {
  AnalysisSnapshot,
  ConditionClass,
  MarkovYearRow,
  MultiYearScheduleItem,
  SegmentEvaluation,
  TreatmentType,
} from '../../types/jalan';
import { formatRupiah } from '../../utils/calculations';
import {
  ConditionBadge,
  PageHeader,
  PriorityBadge,
  ResponsiveColumn,
  ResponsiveDataView,
} from '../ui/Primitives';

interface HasilViewProps {
  snapshot: AnalysisSnapshot;
  allSnapshots: AnalysisSnapshot[];
  onSelectSnapshot: (analysisId: string) => void;
  onNavigateToSimulasi: () => void;
  onNavigateToLaporan: () => void;
  onInspectSegmentInInput: (ruasId: string, segmentId: string) => void;
}

type HasilTab = 'markov' | 'warning' | 'prioritas' | 'program' | 'biaya';

const CONDITION_HEX: Record<ConditionClass, string> = {
  Baik: '#10B981',
  Sedang: '#F59E0B',
  'Rusak Ringan': '#F97316',
  'Rusak Berat': '#F43F5E',
};

export const HasilView: React.FC<HasilViewProps> = ({
  snapshot,
  allSnapshots,
  onSelectSnapshot,
  onNavigateToSimulasi,
  onNavigateToLaporan,
  onInspectSegmentInInput,
}) => {
  const [activeTab, setActiveTab] = useState<HasilTab>('markov');
  const [selectedStripSegmentId, setSelectedStripSegmentId] = useState<string>(
    snapshot.segmentEvaluations[0]?.segmentId || ''
  );

  const selectedStripEvaluation =
    snapshot.segmentEvaluations.find((e) => e.segmentId === selectedStripSegmentId) ||
    snapshot.segmentEvaluations[0];

  const selectedFrozenSegment = snapshot.frozenSegments.find(
    (s) => s.id === selectedStripEvaluation?.segmentId
  );

  // Sorted priority evaluations (P1 -> P2 -> P3 -> P4, then compositePriorityScore desc)
  const priorityOrder: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
  const rankedEvaluations = [...snapshot.segmentEvaluations].sort((a, b) => {
    const rankDiff = priorityOrder[a.priorityRank] - priorityOrder[b.priorityRank];
    if (rankDiff !== 0) return rankDiff;
    return b.compositePriorityScore - a.compositePriorityScore;
  });

  // Early Warning segments
  const warningEvaluations = snapshot.segmentEvaluations.filter((e) => e.isEarlyWarning);

  // Aggregated Treatment Volume Summary
  const treatmentGroups: TreatmentType[] = [
    'Pemeliharaan Rutin',
    'Pemeliharaan Berkala',
    'Rehabilitasi Mayor',
    'Rekonstruksi Struktur',
  ];

  const aggregatedTreatments = treatmentGroups.map((tName) => {
    const matching = snapshot.segmentEvaluations.filter((e) => e.treatment === tName);
    const totalLengthM = matching.reduce((acc, e) => acc + e.lengthM, 0);
    const totalAreaM2 = matching.reduce((acc, e) => acc + e.areaM2, 0);
    const totalCostRp = matching.reduce((acc, e) => acc + e.estimatedCostRp, 0);
    return {
      treatment: tName,
      segmentCount: matching.length,
      lengthM: totalLengthM,
      lengthKm: Number((totalLengthM / 1000).toFixed(3)),
      areaM2: Number(totalAreaM2.toFixed(1)),
      totalCostRp,
    };
  });

  // Tab 1 Columns: Markov Projection Table
  const markovColumns: ResponsiveColumn<MarkovYearRow>[] = [
    {
      key: 'year',
      header: 'Tahun Proyeksi',
      render: (r) => (
        <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
          Tahun ke-{r.yearOffset} ({r.calendarYear})
        </span>
      ),
    },
    {
      key: 'baik',
      header: 'Baik (% / m)',
      align: 'right',
      render: (r) => (
        <span className="font-mono tabular-nums text-emerald-800 font-medium">
          {r.proportions.Baik.toFixed(2)}% ({r.lengthsM.Baik.toFixed(1)} m)
        </span>
      ),
    },
    {
      key: 'sedang',
      header: 'Sedang (% / m)',
      align: 'right',
      render: (r) => (
        <span className="font-mono tabular-nums text-amber-800 font-medium">
          {r.proportions.Sedang.toFixed(2)}% ({r.lengthsM.Sedang.toFixed(1)} m)
        </span>
      ),
    },
    {
      key: 'rusakRingan',
      header: 'Rusak Ringan (% / m)',
      align: 'right',
      render: (r) => (
        <span className="font-mono tabular-nums text-orange-800 font-medium">
          {r.proportions['Rusak Ringan'].toFixed(2)}% ({r.lengthsM['Rusak Ringan'].toFixed(1)} m)
        </span>
      ),
    },
    {
      key: 'rusakBerat',
      header: 'Rusak Berat (% / m)',
      align: 'right',
      render: (r) => (
        <span className="font-mono tabular-nums text-rose-800 font-medium">
          {r.proportions['Rusak Berat'].toFixed(2)}% ({r.lengthsM['Rusak Berat'].toFixed(1)} m)
        </span>
      ),
    },
    {
      key: 'mantap',
      header: 'Kemantapan Jalan',
      align: 'right',
      render: (r) => (
        <span className="font-mono font-bold text-[#172B2A] tabular-nums">
          {r.stabilityIndexPct.toFixed(2)}%
        </span>
      ),
    },
  ];

  // Tab 3 Columns: Priority Ranking
  const priorityColumns: ResponsiveColumn<SegmentEvaluation>[] = [
    {
      key: 'rank',
      header: 'Prioritas',
      render: (e, idx) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[#52615D] tabular-nums">
            #{idx + 1}
          </span>
          <PriorityBadge priority={e.priorityRank} />
        </div>
      ),
    },
    {
      key: 'sta',
      header: 'Segmen STA',
      render: (e) => (
        <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
          STA {e.staLabel}
        </span>
      ),
    },
    {
      key: 'length',
      header: 'Panjang',
      align: 'right',
      render: (e) => (
        <span className="font-mono tabular-nums">{e.lengthM} m</span>
      ),
    },
    {
      key: 'sdi',
      header: 'Skor SDI & Kondisi',
      align: 'right',
      render: (e) => (
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono font-bold tabular-nums">
            {e.sdiBreakdown.finalSdi.toFixed(1)}
          </span>
          <ConditionBadge condition={e.condition} size="sm" />
        </div>
      ),
    },
    {
      key: 'trafficDrainage',
      header: 'Faktor Beban & Drainase',
      render: (e) => (
        <span className="font-mono text-xs tabular-nums text-[#52615D]">
          HV {e.heavyVehiclePct}% · Drainase {e.drainageCondition} · Indeks {e.compositePriorityScore}
        </span>
      ),
    },
    {
      key: 'treatment',
      header: 'Rekomendasi Penanganan',
      render: (e) => (
        <span className="font-medium text-[#172B2A]">{e.treatment}</span>
      ),
    },
    {
      key: 'cost',
      header: 'Estimasi Biaya Segmen',
      align: 'right',
      render: (e) => (
        <span className="font-mono font-semibold tabular-nums text-[#172B2A]">
          {formatRupiah(e.estimatedCostRp)}
        </span>
      ),
    },
  ];

  // Tab 5 Columns: Multi-year schedule
  const scheduleColumns: ResponsiveColumn<MultiYearScheduleItem>[] = [
    {
      key: 'year',
      header: 'Tahun Anggaran',
      render: (item) => (
        <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
          Tahun {item.yearIndex} ({item.calendarYear})
        </span>
      ),
    },
    {
      key: 'focus',
      header: 'Fokus Program Penanganan',
      render: (item) => <span className="text-[#172B2A]">{item.focusDescription}</span>,
    },
    {
      key: 'routine',
      header: 'Biaya Rutin',
      align: 'right',
      render: (item) => (
        <span className="font-mono tabular-nums">{formatRupiah(item.routineCostRp)}</span>
      ),
    },
    {
      key: 'periodic',
      header: 'Biaya Berkala',
      align: 'right',
      render: (item) => (
        <span className="font-mono tabular-nums">{formatRupiah(item.periodicCostRp)}</span>
      ),
    },
    {
      key: 'rehab',
      header: 'Rehabilitasi & Rekonstruksi',
      align: 'right',
      render: (item) => (
        <span className="font-mono tabular-nums">
          {formatRupiah(item.rehabReconstructionCostRp)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total Kebutuhan Tahunan',
      align: 'right',
      render: (item) => (
        <span className="font-mono font-bold text-[#17635C] tabular-nums">
          {formatRupiah(item.totalYearCostRp)}
        </span>
      ),
    },
  ];

  const maxScheduleCost = Math.max(
    1,
    ...snapshot.multiYearSchedule.map((s) => s.totalYearCostRp)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={`Dashboard Hasil & Analitik / ${snapshot.ruasCode} — ${snapshot.ruasName}`}
        title="Dashboard Hasil & 5 Output Utama Perkerasan"
        subtitle="Evaluasi komprehensif kondisi perkerasan jalan berbasis panjang segmen aktual, proyeksi rantai Markov 5 tahun, dan rencana biaya multi-tahun."
        actions={
          <>
            <select
              aria-label="Pilih Snapshot Analisis"
              value={snapshot.id}
              onChange={(e) => onSelectSnapshot(e.target.value)}
              className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-mono font-semibold bg-white border border-[#D9DFDA] text-[#172B2A] focus:outline-none focus:border-[#17635C]"
            >
              {allSnapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.ruasCode} (Rev #{s.revision})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onNavigateToSimulasi}
              className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-white hover:bg-[#F4F5F1] text-[#172B2A] border border-[#D9DFDA] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Sliders className="w-4 h-4" strokeWidth={1.75} />
              <span>Simulasi Anggaran</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToLaporan}
              className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-[#17635C] hover:bg-[#124E48] text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <FileText className="w-4 h-4" strokeWidth={1.75} />
              <span>Ekspor Laporan PDF</span>
            </button>
          </>
        }
      />

      {/* Executive Header Card */}
      <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-[#D9DFDA]">
          <div>
            <div className="text-xs font-mono text-[#52615D] tabular-nums">
              ID Analisis: <strong className="text-[#172B2A]">{snapshot.id}</strong> · Revisi #{snapshot.revision} · Dieksekusi {new Date(snapshot.createdAt).toLocaleString('id-ID')}
            </div>
            <h2 className="text-lg font-bold text-[#172B2A] mt-0.5">
              {snapshot.ruasCode} — {snapshot.ruasName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#52615D]">Kondisi Rata-rata Koridor:</span>
            <ConditionBadge condition={snapshot.overallCondition} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <div>
            <span className="text-xs uppercase tracking-wider text-[#52615D] block">
              Total Panjang Dianalisis
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-[#172B2A] whitespace-nowrap mt-0.5 block">
              {snapshot.totalAnalyzedLengthM} m
            </span>
            <span className="text-xs text-[#52615D] font-mono tabular-nums">
              {(snapshot.totalAnalyzedLengthM / 1000).toFixed(3).replace('.', ',')} km · Lebar {snapshot.widthM.toFixed(1).replace('.', ',')} m · {snapshot.segmentEvaluations.length} segmen
            </span>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-[#52615D] block">
              Rata-rata Tertimbang SDI
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-[#172B2A] whitespace-nowrap mt-0.5 block">
              {snapshot.weightedAvgSdi.toFixed(2)}
            </span>
            <span className="text-xs text-[#52615D] font-mono tabular-nums">
              Kemantapan awal: {snapshot.stabilityYear0Pct.toFixed(1)}%
            </span>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-[#52615D] block">
              Indeks Korelasi Pearson (SDI–IRI)
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-[#17635C] whitespace-nowrap mt-0.5 block">
              r = {snapshot.pearsonCorrelationIri.toFixed(3)}
            </span>
            <span className="text-xs text-[#52615D]">
              Korelasi terhadap referensi IRI / PKRMS
            </span>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-[#52615D] block">
              Total Kebutuhan Anggaran 5 Tahun
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-[#172B2A] whitespace-nowrap mt-0.5 block">
              {formatRupiah(snapshot.totalFiveYearBudgetRp)}
            </span>
            <span className="text-xs text-[#52615D] font-mono tabular-nums">
              Penanganan Tahun 1: {formatRupiah(snapshot.immediateTreatmentCostRp)}
            </span>
          </div>
        </div>
      </div>

      {/* Segmented Control (Tab Bar) for the 5 Core Outputs */}
      <div
        role="tablist"
        aria-label="5 Output Utama Analisis"
        className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'markov'}
          onClick={() => setActiveTab('markov')}
          className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'markov'
              ? 'bg-[#17635C] text-white'
              : 'text-[#52615D] hover:bg-[#F4F5F1] hover:text-[#172B2A]'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>1. Prediksi Markov</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'warning'}
          onClick={() => setActiveTab('warning')}
          className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'warning'
              ? 'bg-[#17635C] text-white'
              : 'text-[#52615D] hover:bg-[#F4F5F1] hover:text-[#172B2A]'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>2. Peringatan Dini ({warningEvaluations.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'prioritas'}
          onClick={() => setActiveTab('prioritas')}
          className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'prioritas'
              ? 'bg-[#17635C] text-white'
              : 'text-[#52615D] hover:bg-[#F4F5F1] hover:text-[#172B2A]'
          }`}
        >
          <MapPin className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>3. Prioritas & Peta STA</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'program'}
          onClick={() => setActiveTab('program')}
          className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'program'
              ? 'bg-[#17635C] text-white'
              : 'text-[#52615D] hover:bg-[#F4F5F1] hover:text-[#172B2A]'
          }`}
        >
          <Wrench className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>4. Program Penanganan</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'biaya'}
          onClick={() => setActiveTab('biaya')}
          className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'biaya'
              ? 'bg-[#17635C] text-white'
              : 'text-[#52615D] hover:bg-[#F4F5F1] hover:text-[#172B2A]'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>5. Biaya & Jadwal</span>
        </button>
      </div>

      {/* TAB 1: Prediksi Kondisi (Markov 5 Tahun) */}
      {activeTab === 'markov' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-[#172B2A]">
                  Grafik Proporsi Kondisi Perkerasan Rantai Markov ({snapshot.baseYear}–
                  {snapshot.baseYear + snapshot.horizonYears})
                </h3>
                <p className="text-xs text-[#52615D]">
                  Proyeksi distribusi kondisi berbobot panjang segmen aktual tanpa intervensi struktural (do-nothing).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {(['Baik', 'Sedang', 'Rusak Ringan', 'Rusak Berat'] as ConditionClass[]).map(
                  (cls) => (
                    <span key={cls} className="inline-flex items-center gap-1.5 font-medium">
                      <span
                        className="w-3 h-3 rounded-xs inline-block"
                        style={{ backgroundColor: CONDITION_HEX[cls] }}
                      />
                      <span>{cls}</span>
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Responsive SVG Stacked Bar Chart */}
            <div className="w-full pt-2">
              <svg
                viewBox="0 0 760 280"
                className="w-full h-64 overflow-visible"
                role="img"
                aria-label="Grafik Proyeksi Kondisi Jalan 5 Tahun"
              >
                {/* Horizontal grid lines */}
                {[0, 25, 50, 75, 100].map((pct) => {
                  const y = 230 - (pct / 100) * 190;
                  return (
                    <g key={pct}>
                      <line
                        x1={55}
                        y1={y}
                        x2={730}
                        y2={y}
                        stroke="#D9DFDA"
                        strokeDasharray={pct === 0 ? undefined : '4 4'}
                        strokeWidth={1}
                      />
                      <text
                        x={45}
                        y={y + 4}
                        textAnchor="end"
                        fill="#52615D"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {pct}%
                      </text>
                    </g>
                  );
                })}

                {/* Stacked Bars per Year */}
                {snapshot.markovProjections.map((row, idx) => {
                  const count = snapshot.markovProjections.length;
                  const slotWidth = 660 / count;
                  const barWidth = Math.min(58, slotWidth * 0.58);
                  const x = 65 + idx * slotWidth + (slotWidth - barWidth) / 2;

                  const classes: ConditionClass[] = [
                    'Baik',
                    'Sedang',
                    'Rusak Ringan',
                    'Rusak Berat',
                  ];
                  let cumulativePct = 0;

                  return (
                    <g key={row.calendarYear}>
                      {classes.map((cls) => {
                        const valPct = row.proportions[cls];
                        const barH = (valPct / 100) * 190;
                        const y = 230 - ((cumulativePct + valPct) / 100) * 190;
                        cumulativePct += valPct;
                        return (
                          <rect
                            key={cls}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={Math.max(0, barH)}
                            fill={CONDITION_HEX[cls]}
                            rx={2}
                          >
                            <title>
                              {`Tahun ${row.calendarYear} - ${cls}: ${valPct.toFixed(2)}% (${row.lengthsM[cls].toFixed(1)} m)`}
                            </title>
                          </rect>
                        );
                      })}
                      {/* Stability label above bar */}
                      <text
                        x={x + barWidth / 2}
                        y={28}
                        textAnchor="middle"
                        fill="#172B2A"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {row.stabilityIndexPct.toFixed(1)}%
                      </text>
                      {/* X-axis label */}
                      <text
                        x={x + barWidth / 2}
                        y={252}
                        textAnchor="middle"
                        fill="#172B2A"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        T+{row.yearOffset} ({row.calendarYear})
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <ResponsiveDataView
            columns={markovColumns}
            data={snapshot.markovProjections}
            keyExtractor={(r) => String(r.calendarYear)}
            renderMobileCard={(r) => (
              <div className="space-y-2 font-mono text-xs tabular-nums">
                <div className="flex items-center justify-between border-b border-[#D9DFDA] pb-2">
                  <span className="font-bold text-sm text-[#172B2A]">
                    Tahun ke-{r.yearOffset} ({r.calendarYear})
                  </span>
                  <span className="font-semibold text-[#17635C]">
                    Mantap: {r.stabilityIndexPct.toFixed(2)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Baik: {r.proportions.Baik.toFixed(2)}% ({r.lengthsM.Baik.toFixed(1)}m)</div>
                  <div>Sedang: {r.proportions.Sedang.toFixed(2)}% ({r.lengthsM.Sedang.toFixed(1)}m)</div>
                  <div>R. Ringan: {r.proportions['Rusak Ringan'].toFixed(2)}% ({r.lengthsM['Rusak Ringan'].toFixed(1)}m)</div>
                  <div>R. Berat: {r.proportions['Rusak Berat'].toFixed(2)}% ({r.lengthsM['Rusak Berat'].toFixed(1)}m)</div>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* TAB 2: Peringatan Dini (Early Warning System) */}
      {activeTab === 'warning' && (
        <div className="space-y-6">
          {/* Corridor-level Deterioration Alert Banner */}
          <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#172B2A]">
                Indikator Peringatan Dini Degradasi Koridor
              </h3>
              <span className="font-mono text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full tabular-nums">
                {warningEvaluations.length} Segmen Melampaui Ambang Kritis
              </span>
            </div>
            <p className="text-sm text-[#52615D]">
              Tanpa penanganan segera pada segmen prioritas P1 & P2, tingkat kemantapan jalan pada{' '}
              <strong>{snapshot.ruasName}</strong> diproyeksikan turun dari{' '}
              <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
                {snapshot.stabilityYear0Pct.toFixed(2)}%
              </span>{' '}
              pada tahun {snapshot.baseYear} menjadi{' '}
              <span className="font-mono font-semibold text-rose-700 tabular-nums">
                {snapshot.stabilityYear5Pct.toFixed(2)}%
              </span>{' '}
              pada tahun {snapshot.baseYear + snapshot.horizonYears}.
            </p>
          </div>

          {/* Segment Warning Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warningEvaluations.map((ev) => (
              <div
                key={ev.segmentId}
                className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-semibold text-[#52615D] tabular-nums">
                        Segmen #{ev.segmentIndex} · Panjang {ev.lengthM} m
                      </span>
                      <h4 className="font-mono text-lg font-bold text-[#172B2A] tabular-nums">
                        STA {ev.staLabel}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={ev.priorityRank} />
                      <ConditionBadge condition={ev.condition} size="sm" />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1.5 text-xs text-rose-900">
                    {ev.warningReasons.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <AlertTriangle
                          className="w-4 h-4 text-rose-700 shrink-0 mt-0.5"
                          strokeWidth={1.75}
                        />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#D9DFDA] flex items-center justify-between text-xs">
                  <div className="font-mono tabular-nums text-[#52615D]">
                    Rekomendasi: <strong className="text-[#172B2A]">{ev.treatment}</strong> ({formatRupiah(ev.estimatedCostRp)})
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectSegmentInInput(snapshot.ruasId, ev.segmentId)}
                    className="font-semibold text-[#17635C] hover:underline whitespace-nowrap"
                  >
                    Periksa Segmen →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Prioritas Penanganan & Peta Strip STA */}
      {activeTab === 'prioritas' && (
        <div className="space-y-6">
          {/* Interactive Linear Strip Map (Diagram Linier STA) */}
          <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-[#172B2A]">
                  Peta Strip Linier Koridor STA (Proporsional Panjang Aktual)
                </h3>
                <p className="text-xs text-[#52615D]">
                  Klik blok segmen pada diagram linier untuk menampilkan rincian bukti pengukuran dan foto lapangan.
                </p>
              </div>
              <span className="font-mono text-xs text-[#52615D] tabular-nums">
                Total Bentang: {snapshot.totalAnalyzedLengthM} m
              </span>
            </div>

            {/* Proportional Strip Bar */}
            <div className="space-y-2">
              <div className="w-full h-16 rounded-xl overflow-hidden border border-[#D9DFDA] flex">
                {snapshot.segmentEvaluations.map((ev) => {
                  const widthPct =
                    (ev.lengthM / Math.max(1, snapshot.totalAnalyzedLengthM)) * 100;
                  const isSelected = ev.segmentId === selectedStripEvaluation?.segmentId;
                  return (
                    <button
                      key={ev.segmentId}
                      type="button"
                      onClick={() => setSelectedStripSegmentId(ev.segmentId)}
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: CONDITION_HEX[ev.condition],
                      }}
                      className={`h-full relative flex flex-col items-center justify-center text-white font-mono text-xs transition-opacity hover:opacity-95 border-r border-white/30 last:border-r-0 ${
                        isSelected ? 'ring-2 ring-inset ring-[#172B2A]' : ''
                      }`}
                    >
                      <span className="font-bold drop-shadow-xs truncate px-1">
                        {ev.staLabel}
                      </span>
                      <span className="text-[11px] opacity-95 drop-shadow-xs tabular-nums">
                        {ev.lengthM}m · SDI {ev.sdiBreakdown.finalSdi}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Stationing Ruler Markers */}
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#52615D] px-1">
                <span>STA 0+000</span>
                <span>Klik segmen untuk inspeksi detail</span>
                <span>
                  STA{' '}
                  {
                    snapshot.segmentEvaluations[snapshot.segmentEvaluations.length - 1]?.staLabel.split(
                      ' - '
                    )[1]
                  }
                </span>
              </div>
            </div>

            {/* Selected Segment Inspector Panel */}
            {selectedStripEvaluation && (
              <div className="p-4 rounded-xl bg-[#F4F5F1] border border-[#D9DFDA] grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-8 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <PriorityBadge priority={selectedStripEvaluation.priorityRank} />
                    <span className="font-mono text-sm font-bold text-[#172B2A] tabular-nums">
                      Segmen #{selectedStripEvaluation.segmentIndex}: STA{' '}
                      {selectedStripEvaluation.staLabel} ({selectedStripEvaluation.lengthM} m)
                    </span>
                    <ConditionBadge condition={selectedStripEvaluation.condition} size="sm" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono tabular-nums">
                    <div className="p-2 bg-white rounded-lg border border-[#D9DFDA]">
                      <span className="text-[#52615D] block font-sans">Skor SDI</span>
                      <strong className="text-[#172B2A]">
                        {selectedStripEvaluation.sdiBreakdown.finalSdi.toFixed(1)}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-[#D9DFDA]">
                      <span className="text-[#52615D] block font-sans">Nilai IRI</span>
                      <strong className="text-[#172B2A]">
                        {selectedStripEvaluation.iriValueMPerKm.toFixed(1)} m/km
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-[#D9DFDA]">
                      <span className="text-[#52615D] block font-sans">Program</span>
                      <strong className="text-[#172B2A] font-sans">
                        {selectedStripEvaluation.treatment}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-[#D9DFDA]">
                      <span className="text-[#52615D] block font-sans">Biaya Segmen</span>
                      <strong className="text-[#17635C]">
                        {formatRupiah(selectedStripEvaluation.estimatedCostRp)}
                      </strong>
                    </div>
                  </div>

                  {selectedFrozenSegment?.notes && (
                    <p className="text-xs text-[#52615D] leading-relaxed">
                      {selectedFrozenSegment.notes}
                    </p>
                  )}
                </div>

                <div className="lg:col-span-4 flex flex-col items-end justify-between gap-2">
                  {selectedFrozenSegment?.photos[0] && (
                    <img
                      src={selectedFrozenSegment.photos[0].url}
                      alt={selectedFrozenSegment.photos[0].caption}
                      referrerPolicy="no-referrer"
                      className="w-full h-32 object-cover rounded-lg border border-[#D9DFDA]"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onInspectSegmentInInput(
                        snapshot.ruasId,
                        selectedStripEvaluation.segmentId
                      )
                    }
                    className="text-xs font-semibold text-[#17635C] hover:underline"
                  >
                    Buka Formulir Survei Segmen Ini →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ranked Priority Table */}
          <ResponsiveDataView
            columns={priorityColumns}
            data={rankedEvaluations}
            keyExtractor={(e) => e.segmentId}
            renderMobileCard={(e, idx) => (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#52615D]">
                      #{idx + 1}
                    </span>
                    <PriorityBadge priority={e.priorityRank} />
                    <span className="font-mono font-bold text-sm text-[#172B2A] tabular-nums">
                      STA {e.staLabel}
                    </span>
                  </div>
                  <ConditionBadge condition={e.condition} size="sm" />
                </div>
                <div className="text-xs font-mono tabular-nums text-[#52615D] pt-2 border-t border-[#D9DFDA] space-y-1">
                  <div>
                    Panjang: {e.lengthM} m · SDI: <strong>{e.sdiBreakdown.finalSdi.toFixed(1)}</strong> · Indeks Prioritas: {e.compositePriorityScore}
                  </div>
                  <div>
                    Penanganan: <strong className="text-[#172B2A] font-sans">{e.treatment}</strong>
                  </div>
                  <div className="text-[#17635C] font-bold">
                    Biaya: {formatRupiah(e.estimatedCostRp)}
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* TAB 4: Program Penanganan */}
      {activeTab === 'program' && (
        <div className="space-y-6">
          {/* Aggregated Treatment Volume Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {aggregatedTreatments.map((grp) => (
              <div
                key={grp.treatment}
                className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#52615D]">
                    {grp.treatment}
                  </span>
                  <Layers className="w-4 h-4 text-[#17635C]" strokeWidth={1.75} />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#172B2A]">
                  {grp.lengthM} m ({grp.lengthKm} km)
                </div>
                <div className="text-xs font-mono tabular-nums text-[#52615D] space-y-0.5 pt-2 border-t border-[#D9DFDA]">
                  <div>Luas Area: {grp.areaM2.toLocaleString('id-ID')} m²</div>
                  <div>Jumlah Segmen: {grp.segmentCount} segmen</div>
                  <div className="font-semibold text-[#17635C]">
                    Subtotal: {formatRupiah(grp.totalCostRp)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Segment-by-Segment Engineering Recommendation Table */}
          <ResponsiveDataView
            columns={[
              {
                key: 'sta',
                header: 'Segmen STA',
                render: (e) => (
                  <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
                    STA {e.staLabel}
                  </span>
                ),
              },
              {
                key: 'dimensions',
                header: 'Dimensi (P × L = Luas)',
                align: 'right',
                render: (e) => (
                  <span className="font-mono text-xs tabular-nums">
                    {e.lengthM}m × {snapshot.widthM.toFixed(1)}m = {e.areaM2} m²
                  </span>
                ),
              },
              {
                key: 'condition',
                header: 'Kondisi & SDI',
                align: 'right',
                render: (e) => (
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono font-semibold tabular-nums">
                      {e.sdiBreakdown.finalSdi.toFixed(1)}
                    </span>
                    <ConditionBadge condition={e.condition} size="sm" />
                  </div>
                ),
              },
              {
                key: 'treatment',
                header: 'Program Penanganan Teknis',
                render: (e) => (
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={e.priorityRank} />
                    <span className="font-semibold text-[#172B2A]">{e.treatment}</span>
                  </div>
                ),
              },
              {
                key: 'unitCost',
                header: 'Harga Satuan (/km)',
                align: 'right',
                render: (e) => (
                  <span className="font-mono text-xs tabular-nums text-[#52615D]">
                    {formatRupiah(e.unitCostPerKm)}
                  </span>
                ),
              },
              {
                key: 'totalCost',
                header: 'Biaya Segmen Aktual',
                align: 'right',
                render: (e) => (
                  <span className="font-mono font-bold text-[#17635C] tabular-nums">
                    {formatRupiah(e.estimatedCostRp)}
                  </span>
                ),
              },
            ]}
            data={snapshot.segmentEvaluations}
            keyExtractor={(e) => e.segmentId}
            renderMobileCard={(e) => (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-[#172B2A] tabular-nums">
                    STA {e.staLabel} ({e.lengthM}m / {e.areaM2}m²)
                  </span>
                  <ConditionBadge condition={e.condition} size="sm" />
                </div>
                <div className="font-semibold text-[#172B2A]">
                  {e.priorityRank} — {e.treatment}
                </div>
                <div className="font-mono tabular-nums text-[#17635C] font-bold">
                  Biaya: {formatRupiah(e.estimatedCostRp)}
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* TAB 5: Rencana Biaya & Jadwal Multi-Tahun */}
      {activeTab === 'biaya' && (
        <div className="space-y-6">
          {/* Annual Budget Allocation SVG Bar Chart */}
          <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-[#172B2A]">
                  Distribusi Alokasi Anggaran Multi-Tahun ({snapshot.baseYear}–
                  {snapshot.baseYear + 4})
                </h3>
                <p className="text-xs text-[#52615D]">
                  Rincian kebutuhan biaya pemeliharaan rutin, berkala, serta rehabilitasi/rekonstruksi per tahun anggaran.
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-[#17635C] tabular-nums">
                Total 5 Tahun: {formatRupiah(snapshot.totalFiveYearBudgetRp)}
              </span>
            </div>

            <div className="w-full pt-2">
              <svg
                viewBox="0 0 760 250"
                className="w-full h-56 overflow-visible"
                role="img"
                aria-label="Grafik Alokasi Biaya Tahunan"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = 205 - ratio * 165;
                  const valRp = maxScheduleCost * ratio;
                  return (
                    <g key={ratio}>
                      <line
                        x1={95}
                        y1={y}
                        x2={730}
                        y2={y}
                        stroke="#D9DFDA"
                        strokeDasharray={ratio === 0 ? undefined : '4 4'}
                      />
                      <text
                        x={88}
                        y={y + 4}
                        textAnchor="end"
                        fill="#52615D"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {formatRupiah(valRp, true)}
                      </text>
                    </g>
                  );
                })}

                {snapshot.multiYearSchedule.map((item, idx) => {
                  const slotWidth = 620 / snapshot.multiYearSchedule.length;
                  const barW = 56;
                  const x = 105 + idx * slotWidth + (slotWidth - barW) / 2;
                  const barH = (item.totalYearCostRp / maxScheduleCost) * 165;
                  const y = 205 - barH;

                  return (
                    <g key={item.calendarYear}>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={Math.max(4, barH)}
                        fill="#17635C"
                        rx={4}
                      />
                      <text
                        x={x + barW / 2}
                        y={y - 8}
                        textAnchor="middle"
                        fill="#172B2A"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {formatRupiah(item.totalYearCostRp, true)}
                      </text>
                      <text
                        x={x + barW / 2}
                        y={228}
                        textAnchor="middle"
                        fill="#172B2A"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        Thn {item.yearIndex} ({item.calendarYear})
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <ResponsiveDataView
            columns={scheduleColumns}
            data={snapshot.multiYearSchedule}
            keyExtractor={(item) => String(item.calendarYear)}
            renderMobileCard={(item) => (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-[#D9DFDA] pb-2">
                  <span className="font-mono font-bold text-sm text-[#172B2A]">
                    Tahun {item.yearIndex} ({item.calendarYear})
                  </span>
                  <span className="font-mono font-bold text-[#17635C] tabular-nums">
                    {formatRupiah(item.totalYearCostRp)}
                  </span>
                </div>
                <div className="text-[#172B2A] font-medium">{item.focusDescription}</div>
                <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-[11px] text-[#52615D] pt-1">
                  <div>Rutin: {formatRupiah(item.routineCostRp, true)}</div>
                  <div>Berkala: {formatRupiah(item.periodicCostRp, true)}</div>
                  <div>Rehab/Rekon: {formatRupiah(item.rehabReconstructionCostRp, true)}</div>
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
};
