import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  AnalysisSnapshot,
  JalanBetaStoreState,
  MarkovMatrix4x4,
  RoadRuas,
  UnitCostConfig,
} from '../../types/jalan';
import {
  buildAnalysisSnapshot,
  DEFAULT_MARKOV_MATRIX,
  DEFAULT_UNIT_COSTS,
  formatRupiah,
  validateMarkovMatrix,
} from '../../utils/calculations';
import {
  ConditionBadge,
  PageHeader,
  ResponsiveColumn,
  ResponsiveDataView,
} from '../ui/Primitives';

interface AnalisisViewProps {
  store: JalanBetaStoreState;
  activeRuas: RoadRuas;
  onSelectRuas: (ruasId: string) => void;
  onSaveSnapshotAndOpenHasil: (snapshot: AnalysisSnapshot, markovMatrix: MarkovMatrix4x4, unitCosts: UnitCostConfig) => void;
  onOpenExistingSnapshot: (analysisId: string) => void;
}

const STATE_LABELS = ['Baik', 'Sedang', 'Rusak Ringan', 'Rusak Berat'] as const;

export const AnalisisView: React.FC<AnalisisViewProps> = ({
  store,
  activeRuas,
  onSelectRuas,
  onSaveSnapshotAndOpenHasil,
  onOpenExistingSnapshot,
}) => {
  const [baseYear, setBaseYear] = useState<number>(
    Number(activeRuas.surveyPeriod) || 2026
  );
  const [horizonYears, setHorizonYears] = useState<number>(5);
  const [matrix, setMatrix] = useState<MarkovMatrix4x4>(() =>
    JSON.parse(JSON.stringify(store.defaultMarkovMatrix))
  );
  const [unitCosts, setUnitCosts] = useState<UnitCostConfig>(() => ({
    ...store.defaultUnitCosts,
  }));

  const validation = validateMarkovMatrix(matrix);

  const handleMatrixCellChange = (rowIdx: number, colIdx: number, rawVal: string) => {
    const val = Math.max(0, Math.min(1, Number(rawVal) || 0));
    const next: MarkovMatrix4x4 = JSON.parse(JSON.stringify(matrix));
    next[rowIdx][colIdx] = Number(val.toFixed(2));
    setMatrix(next);
  };

  const handleResetDefaults = () => {
    setMatrix(JSON.parse(JSON.stringify(DEFAULT_MARKOV_MATRIX)));
    setUnitCosts({ ...DEFAULT_UNIT_COSTS });
    setBaseYear(Number(activeRuas.surveyPeriod) || 2026);
    setHorizonYears(5);
  };

  const handleExecuteAnalysis = () => {
    if (!validation.valid) return;

    const existingForRuas = store.analysisHistory.filter(
      (a) => a.ruasId === activeRuas.id
    );
    const nextRevision = existingForRuas.length + 1;
    const totalNumber = store.analysisHistory.length + 1;
    const snapshotId = `ANL-${baseYear}-${String(totalNumber).padStart(3, '0')}`;

    const snapshot = buildAnalysisSnapshot({
      id: snapshotId,
      revision: nextRevision,
      ruas: activeRuas,
      baseYear,
      horizonYears,
      markovMatrix: matrix,
      unitCosts,
    });

    onSaveSnapshotAndOpenHasil(snapshot, matrix, unitCosts);
  };

  const historyColumns: ResponsiveColumn<AnalysisSnapshot>[] = [
    {
      key: 'id',
      header: 'ID Snapshot & Revisi',
      render: (a) => (
        <div>
          <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
            {a.id}
          </span>
          <span className="block text-xs text-[#52615D] font-mono tabular-nums">
            Revisi #{a.revision} · {new Date(a.createdAt).toLocaleString('id-ID')}
          </span>
        </div>
      ),
    },
    {
      key: 'ruas',
      header: 'Ruas Dianalisis',
      render: (a) => (
        <div>
          <div className="font-semibold text-[#172B2A]">
            {a.ruasCode} — {a.ruasName}
          </div>
          <div className="text-xs font-mono tabular-nums text-[#52615D]">
            Panjang {a.totalAnalyzedLengthM} m ({a.frozenSegments.length} segmen)
          </div>
        </div>
      ),
    },
    {
      key: 'sdi',
      header: 'Rata-rata Tertimbang SDI',
      align: 'right',
      render: (a) => (
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono font-bold text-[#172B2A] tabular-nums">
            {a.weightedAvgSdi.toFixed(2)}
          </span>
          <ConditionBadge condition={a.overallCondition} size="sm" />
        </div>
      ),
    },
    {
      key: 'stability',
      header: 'Kemantapan (Thn 0 → Thn 5)',
      align: 'right',
      render: (a) => (
        <span className="font-mono text-xs tabular-nums text-[#172B2A]">
          {a.stabilityYear0Pct.toFixed(1)}% → {a.stabilityYear5Pct.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'budget',
      header: 'Total Kebutuhan 5 Tahun',
      align: 'right',
      render: (a) => (
        <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
          {formatRupiah(a.totalFiveYearBudgetRp)}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Tindakan',
      align: 'right',
      render: (a) => (
        <button
          type="button"
          onClick={() => onOpenExistingSnapshot(a.id)}
          className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#17635C] hover:bg-[#124E48] text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Buka Snapshot</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={`Konfigurasi Parameter / ${activeRuas.code} — ${activeRuas.name}`}
        title="Eksekusi & Riwayat Snapshot Analisis"
        subtitle="Konfigurasikan matriks probabilitas transisi Markov 4×4 serta harga satuan penanganan per kilometer, lalu simpan hasil evaluasi sebagai rekaman permanen."
        actions={
          <>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-white hover:bg-[#F4F5F1] text-[#172B2A] border border-[#D9DFDA] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
              <span>Reset Standar Bina Marga</span>
            </button>
            <button
              type="button"
              disabled={!validation.valid}
              onClick={handleExecuteAnalysis}
              className="min-h-[40px] px-5 py-2 rounded-lg text-sm font-semibold bg-[#17635C] hover:bg-[#124E48] text-white disabled:opacity-40 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Play className="w-4 h-4" strokeWidth={1.75} />
              <span>Jalankan & Simpan Snapshot Analisis</span>
            </button>
          </>
        }
      />

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Ruas, Horizon & Markov Transition Matrix (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white border border-[#D9DFDA] rounded-xl p-5 shadow-xs space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="analisis-ruas-select"
                className="block text-xs font-medium text-[#172B2A] mb-1"
              >
                Koridor Ruas Aktif
              </label>
              <select
                id="analisis-ruas-select"
                value={activeRuas.id}
                onChange={(e) => onSelectRuas(e.target.value)}
                className="w-full px-3 py-2 text-sm font-medium bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
              >
                {store.ruasList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="analisis-base-year"
                className="block text-xs font-medium text-[#172B2A] mb-1"
              >
                Tahun Dasar Survei
              </label>
              <input
                id="analisis-base-year"
                type="number"
                min={2020}
                max={2040}
                value={baseYear}
                onChange={(e) => setBaseYear(Number(e.target.value) || 2026)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
              />
            </div>

            <div>
              <label
                htmlFor="analisis-horizon"
                className="block text-xs font-medium text-[#172B2A] mb-1"
              >
                Horizon Proyeksi (Tahun)
              </label>
              <select
                id="analisis-horizon"
                value={horizonYears}
                onChange={(e) => setHorizonYears(Number(e.target.value) || 5)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
              >
                <option value={5}>5 Tahun ({baseYear}–{baseYear + 5})</option>
                <option value={3}>3 Tahun ({baseYear}–{baseYear + 3})</option>
                <option value={10}>10 Tahun ({baseYear}–{baseYear + 10})</option>
              </select>
            </div>
          </div>

          {/* 4x4 Markov Transition Matrix */}
          <div className="space-y-3 pt-2 border-t border-[#D9DFDA]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[#172B2A]">
                  Matriks Probabilitas Transisi Rantai Markov (P)
                </h2>
                <p className="text-xs text-[#52615D]">
                  Probabilitas perpindahan kelas kondisi tahunan α(t) = α(0) × Pᵗ (Jumlah setiap baris wajib = 1,00).
                </p>
              </div>
              {validation.valid ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Matriks Valid (Σ = 1,00)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Jumlah Baris ≠ 1,00</span>
                </span>
              )}
            </div>

            <div className="overflow-x-auto border border-[#D9DFDA] rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F5F1] border-b border-[#D9DFDA]">
                    <th className="py-2.5 px-3 font-semibold text-[#52615D]">
                      Dari \ Ke
                    </th>
                    {STATE_LABELS.map((lbl) => (
                      <th
                        key={lbl}
                        className="py-2.5 px-3 text-right font-semibold text-[#52615D]"
                      >
                        {lbl}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                      Σ Baris
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9DFDA]">
                  {STATE_LABELS.map((rowLabel, rIdx) => {
                    const rowSum = validation.rowSums[rIdx];
                    const isRowValid = !validation.invalidRows.includes(rIdx);
                    return (
                      <tr key={rowLabel}>
                        <td className="py-2.5 px-3 font-semibold text-[#172B2A] whitespace-nowrap">
                          {rowLabel}
                        </td>
                        {STATE_LABELS.map((colLabel, cIdx) => (
                          <td key={colLabel} className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              max={1}
                              aria-label={`Transisi ${rowLabel} ke ${colLabel}`}
                              value={matrix[rIdx][cIdx]}
                              onChange={(e) =>
                                handleMatrixCellChange(rIdx, cIdx, e.target.value)
                              }
                              className="w-18 px-2 py-1 text-right font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-md focus:outline-none focus:border-[#17635C]"
                            />
                          </td>
                        ))}
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                            isRowValid ? 'text-emerald-800' : 'text-rose-700'
                          }`}
                        >
                          {rowSum.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Standar Harga Satuan Pemeliharaan (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white border border-[#D9DFDA] rounded-xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[#172B2A]">
              Standar Harga Satuan Penanganan (Rp/km)
            </h2>
            <p className="text-xs text-[#52615D]">
              Biaya segmen dihitung proporsional terhadap panjang aktual: (Panjang_Segmen_m / 1000) × Harga_Satuan_Km.
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="p-3.5 rounded-lg bg-[#F4F5F1]/60 border border-[#D9DFDA] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#172B2A]">
                  Prioritas P4 — Pemeliharaan Rutin (Kondisi Baik)
                </span>
                <span className="font-mono text-[#52615D] tabular-nums">
                  SDI &lt; 50
                </span>
              </div>
              <input
                type="number"
                step={1000000}
                min={0}
                aria-label="Harga Satuan Pemeliharaan Rutin per km"
                value={unitCosts.baikPerKm}
                onChange={(e) =>
                  setUnitCosts({
                    ...unitCosts,
                    baikPerKm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
              />
              <div className="text-[11px] font-mono tabular-nums text-[#52615D]">
                Terformat: {formatRupiah(unitCosts.baikPerKm)} / km
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F4F5F1]/60 border border-[#D9DFDA] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#172B2A]">
                  Prioritas P3 — Pemeliharaan Berkala (Kondisi Sedang)
                </span>
                <span className="font-mono text-[#52615D] tabular-nums">
                  50 ≤ SDI &lt; 100
                </span>
              </div>
              <input
                type="number"
                step={5000000}
                min={0}
                aria-label="Harga Satuan Pemeliharaan Berkala per km"
                value={unitCosts.sedangPerKm}
                onChange={(e) =>
                  setUnitCosts({
                    ...unitCosts,
                    sedangPerKm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
              />
              <div className="text-[11px] font-mono tabular-nums text-[#52615D]">
                Terformat: {formatRupiah(unitCosts.sedangPerKm)} / km
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F4F5F1]/60 border border-[#D9DFDA] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#172B2A]">
                  Prioritas P2 — Rehabilitasi Mayor (Rusak Ringan)
                </span>
                <span className="font-mono text-[#52615D] tabular-nums">
                  100 ≤ SDI &lt; 150
                </span>
              </div>
              <input
                type="number"
                step={10000000}
                min={0}
                aria-label="Harga Satuan Rehabilitasi Mayor per km"
                value={unitCosts.rusakRinganPerKm}
                onChange={(e) =>
                  setUnitCosts({
                    ...unitCosts,
                    rusakRinganPerKm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
              />
              <div className="text-[11px] font-mono tabular-nums text-[#52615D]">
                Terformat: {formatRupiah(unitCosts.rusakRinganPerKm)} / km
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F4F5F1]/60 border border-[#D9DFDA] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#172B2A]">
                  Prioritas P1 — Rekonstruksi Struktur (Rusak Berat)
                </span>
                <span className="font-mono text-[#52615D] tabular-nums">
                  SDI ≥ 150
                </span>
              </div>
              <input
                type="number"
                step={25000000}
                min={0}
                aria-label="Harga Satuan Rekonstruksi Struktur per km"
                value={unitCosts.rusakBeratPerKm}
                onChange={(e) =>
                  setUnitCosts({
                    ...unitCosts,
                    rusakBeratPerKm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
              />
              <div className="text-[11px] font-mono tabular-nums text-[#52615D]">
                Terformat: {formatRupiah(unitCosts.rusakBeratPerKm)} / km
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Analysis History */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[#172B2A]">
            Riwayat Snapshot Analisis Tersimpan
          </h2>
          <p className="text-xs text-[#52615D]">
            Setiap snapshot membekukan hasil pengukuran segmen dan parameter biaya pada saat dieksekusi.
          </p>
        </div>

        <ResponsiveDataView
          columns={historyColumns}
          data={store.analysisHistory}
          keyExtractor={(a) => a.id}
          renderMobileCard={(a) => (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-semibold text-[#17635C] tabular-nums">
                    {a.id} · Revisi #{a.revision}
                  </span>
                  <h3 className="text-base font-semibold text-[#172B2A]">
                    {a.ruasCode} — {a.ruasName}
                  </h3>
                  <span className="text-xs text-[#52615D] font-mono tabular-nums">
                    {new Date(a.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>
                <ConditionBadge condition={a.overallCondition} size="sm" />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#D9DFDA] text-xs font-mono tabular-nums">
                <div>
                  <span className="text-[#52615D] block font-sans">Rata-rata SDI</span>
                  <span className="font-bold text-[#172B2A]">{a.weightedAvgSdi.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[#52615D] block font-sans">Kebutuhan 5 Tahun</span>
                  <span className="font-bold text-[#172B2A]">
                    {formatRupiah(a.totalFiveYearBudgetRp, true)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenExistingSnapshot(a.id)}
                className="w-full min-h-[38px] px-3 py-2 rounded-lg text-xs font-medium bg-[#17635C] text-white inline-flex items-center justify-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Buka Snapshot</span>
              </button>
            </div>
          )}
        />
      </div>
    </div>
  );
};
