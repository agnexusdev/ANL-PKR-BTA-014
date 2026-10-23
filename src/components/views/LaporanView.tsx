import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import {
  AnalysisSnapshot,
  SavedScenario,
} from '../../types/jalan';
import { formatRupiah } from '../../utils/calculations';
import {
  ConditionBadge,
  PageHeader,
  PriorityBadge,
} from '../ui/Primitives';

interface LaporanViewProps {
  snapshot: AnalysisSnapshot;
  allSnapshots: AnalysisSnapshot[];
  savedScenarios: SavedScenario[];
  onSelectSnapshot: (analysisId: string) => void;
}

type ReportScope = 'eksekutif' | 'segmen' | 'skenario';

export const LaporanView: React.FC<LaporanViewProps> = ({
  snapshot,
  allSnapshots,
  savedScenarios,
  onSelectSnapshot,
}) => {
  const [scope, setScope] = useState<ReportScope>('eksekutif');
  const [includePhotos, setIncludePhotos] = useState<boolean>(true);

  const handlePrintPdf = () => {
    window.print();
  };

  const allPhotos = snapshot.frozenSegments.flatMap((seg) =>
    seg.photos.map((photo) => ({
      ...photo,
      staLabel: seg.staLabel,
      segmentIndex: seg.segmentIndex,
      lengthM: seg.lengthM,
    }))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={`Pusat Dokumen Teknis / ${snapshot.ruasCode} — ${snapshot.ruasName}`}
        title="Pusat Laporan & Ekspor Dokumen PDF Resmi"
        subtitle="Susun dokumen laporan teknis standar Bina Marga dalam format A4 siap cetak beserta lampiran bukti foto stasioning."
        actions={
          <button
            type="button"
            onClick={handlePrintPdf}
            className="min-h-[40px] px-5 py-2 rounded-lg text-sm font-semibold bg-[#17635C] hover:bg-[#124E48] text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" strokeWidth={1.75} />
            <span>Unduh / Cetak PDF Resmi</span>
          </button>
        }
      />

      {/* Report Scope Selector & Controls Bar (Hidden in Print) */}
      <div className="p-4 bg-white border border-[#D9DFDA] rounded-xl shadow-xs flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 no-print">
        <div className="inline-flex flex-wrap items-center bg-[#F4F5F1] p-1 rounded-lg gap-1 self-start">
          <button
            type="button"
            onClick={() => setScope('eksekutif')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              scope === 'eksekutif'
                ? 'bg-white text-[#172B2A] shadow-xs'
                : 'text-[#52615D] hover:text-[#172B2A]'
            }`}
          >
            Laporan Lengkap Eksekutif
          </button>
          <button
            type="button"
            onClick={() => setScope('segmen')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              scope === 'segmen'
                ? 'bg-white text-[#172B2A] shadow-xs'
                : 'text-[#52615D] hover:text-[#172B2A]'
            }`}
          >
            Laporan Per Segmen STA
          </button>
          <button
            type="button"
            onClick={() => setScope('skenario')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              scope === 'skenario'
                ? 'bg-white text-[#172B2A] shadow-xs'
                : 'text-[#52615D] hover:text-[#172B2A]'
            }`}
          >
            Laporan Skenario Anggaran
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#172B2A] cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={includePhotos}
              onChange={(e) => setIncludePhotos(e.target.checked)}
              className="w-4 h-4 rounded text-[#17635C] focus:ring-[#17635C]"
            />
            <span>Sertakan Lampiran Bukti Foto ({allPhotos.length} Foto)</span>
          </label>

          <select
            aria-label="Pilih Snapshot Laporan"
            value={snapshot.id}
            onChange={(e) => onSelectSnapshot(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono font-semibold bg-[#F4F5F1] border border-[#D9DFDA] rounded-lg text-[#172B2A]"
          >
            {allSnapshots.map((s) => (
              <option key={s.id} value={s.id}>
                Snapshot {s.id} (Rev #{s.revision})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Formal A4 Document Preview Canvas */}
      <article className="bg-white border border-[#D9DFDA] rounded-xl shadow-xs p-6 sm:p-10 max-w-5xl mx-auto space-y-8 print-container">
        {/* Official Engineering Document Header Block */}
        <header className="border-b-2 border-[#172B2A] pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-widest text-[#17635C]">
              DIREKTORAT BINA TEKNIK JALAN DAN JEMBATAN — SISTEM JALAN BETA
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#172B2A]">
              {scope === 'eksekutif' &&
                'LAPORAN EKSEKUTIF EVALUASI KONDISI PERKERASAN & RENCANA PENANGANAN'}
              {scope === 'segmen' &&
                'LAPORAN TEKNIS PEMERIKSAAN DETAIL PER SEGMEN STASIONING (STA)'}
              {scope === 'skenario' &&
                'LAPORAN EVALUASI SENSITIVITAS SKENARIO & PEMBIAYAAN MULTI-TAHUN'}
            </h2>
            <p className="text-xs text-[#52615D]">
              Koridor: <strong>{snapshot.ruasCode} — {snapshot.ruasName}</strong> · Surveyor Pelaksana:{' '}
              <strong>{snapshot.surveyorName}</strong>
            </p>
          </div>

          <div className="text-xs font-mono tabular-nums text-left sm:text-right bg-[#F4F5F1] p-3 rounded-lg border border-[#D9DFDA] shrink-0">
            <div className="font-bold text-[#172B2A]">No. Dokumen: {snapshot.id}</div>
            <div>Revisi: #{snapshot.revision}</div>
            <div>Tahun Dasar: {snapshot.baseYear}</div>
            <div>Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}</div>
          </div>
        </header>

        {/* Section 1: Ringkasan Parameter Teknis Koridor */}
        <section className="space-y-3 break-inside-avoid">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#172B2A] border-b border-[#D9DFDA] pb-1.5">
            01. Ringkasan Parameter Teknis & Indikator Kinerja Ruas
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F4F5F1] border border-[#D9DFDA]">
              <span className="text-[#52615D] block">Panjang & Lebar Efektif</span>
              <strong className="font-mono text-sm text-[#172B2A] tabular-nums">
                {snapshot.totalAnalyzedLengthM} m × {snapshot.widthM.toFixed(1)} m
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-[#F4F5F1] border border-[#D9DFDA]">
              <span className="text-[#52615D] block">Rata-rata Tertimbang SDI</span>
              <strong className="font-mono text-sm text-[#172B2A] tabular-nums">
                {snapshot.weightedAvgSdi.toFixed(2)} ({snapshot.overallCondition})
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-[#F4F5F1] border border-[#D9DFDA]">
              <span className="text-[#52615D] block">Korelasi Pearson SDI–IRI</span>
              <strong className="font-mono text-sm text-[#17635C] tabular-nums">
                r = {snapshot.pearsonCorrelationIri.toFixed(3)}
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-[#F4F5F1] border border-[#D9DFDA]">
              <span className="text-[#52615D] block">Kebutuhan Anggaran 5 Tahun</span>
              <strong className="font-mono text-sm text-[#172B2A] tabular-nums">
                {formatRupiah(snapshot.totalFiveYearBudgetRp)}
              </strong>
            </div>
          </div>
        </section>

        {/* Section 2: Tabel Evaluasi Segmen & Prioritas Penanganan */}
        {(scope === 'eksekutif' || scope === 'segmen') && (
          <section className="space-y-3 break-inside-avoid">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#172B2A] border-b border-[#D9DFDA] pb-1.5">
              02. Matriks Hasil Pemeriksaan Segmen & Rekomendasi Penanganan
            </h3>
            <div className="overflow-x-auto border border-[#D9DFDA] rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F5F1] border-b border-[#D9DFDA]">
                    <th className="py-2.5 px-3 font-semibold text-[#52615D]">STA</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                      Panjang
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                      SDI-1 / SDI-2 / SDI-3 / SDI-4
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-[#52615D]">Kondisi</th>
                    <th className="py-2.5 px-3 font-semibold text-[#52615D]">
                      Prioritas & Program
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                      Biaya Segmen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9DFDA]">
                  {snapshot.segmentEvaluations.map((ev) => (
                    <tr key={ev.segmentId}>
                      <td className="py-2.5 px-3 font-mono font-semibold tabular-nums">
                        {ev.staLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {ev.lengthM} m
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#52615D]">
                        {ev.sdiBreakdown.sdi1} / {ev.sdiBreakdown.sdi2} /{' '}
                        {ev.sdiBreakdown.sdi3} /{' '}
                        <strong className="text-[#172B2A]">{ev.sdiBreakdown.finalSdi}</strong>
                      </td>
                      <td className="py-2.5 px-3">
                        <ConditionBadge condition={ev.condition} size="sm" />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <PriorityBadge priority={ev.priorityRank} />
                          <span className="font-medium text-[#172B2A]">{ev.treatment}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                        {formatRupiah(ev.estimatedCostRp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Section 3: Proyeksi Rantai Markov & Jadwal Anggaran Multi-Tahun */}
        {scope === 'eksekutif' && (
          <section className="space-y-3 break-inside-avoid">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#172B2A] border-b border-[#D9DFDA] pb-1.5">
              03. Proyeksi Kondisi Rantai Markov & Rencana Anggaran 5 Tahun
            </h3>
            <div className="grid grid-cols-1 gap-6">
              <div className="border border-[#D9DFDA] rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F4F5F1] border-b border-[#D9DFDA]">
                      <th className="py-2.5 px-3 font-semibold text-[#52615D]">Tahun</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                        Baik
                      </th>
                      <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                        Sedang
                      </th>
                      <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                        Rusak Ringan
                      </th>
                      <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                        Rusak Berat
                      </th>
                      <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                        Kemantapan (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9DFDA] font-mono tabular-nums">
                    {snapshot.markovProjections.map((m) => (
                      <tr key={m.calendarYear}>
                        <td className="py-2 px-3 font-semibold">{m.calendarYear}</td>
                        <td className="py-2 px-3 text-right">{m.proportions.Baik.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right">{m.proportions.Sedang.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right">
                          {m.proportions['Rusak Ringan'].toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-right">
                          {m.proportions['Rusak Berat'].toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[#17635C]">
                          {m.stabilityIndexPct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border border-[#D9DFDA] rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F4F5F1] border-b border-[#D9DFDA]">
                      <th className="py-2 px-2.5 font-semibold text-[#52615D]">Tahun</th>
                      <th className="py-2 px-2.5 font-semibold text-[#52615D]">Program Utama</th>
                      <th className="py-2 px-2.5 text-right font-semibold text-[#52615D]">
                        Alokasi Biaya
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9DFDA]">
                    {snapshot.multiYearSchedule.map((item) => (
                      <tr key={item.calendarYear}>
                        <td className="py-2 px-2.5 font-mono font-semibold tabular-nums">
                          {item.calendarYear}
                        </td>
                        <td className="py-2 px-2.5 text-[#172B2A]">{item.focusDescription}</td>
                        <td className="py-2 px-2.5 text-right font-mono font-semibold tabular-nums">
                          {formatRupiah(item.totalYearCostRp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Section for Scope = 'segmen': Detailed Field Notes per Segment */}
        {scope === 'segmen' && (
          <section className="space-y-3 break-inside-avoid">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#172B2A] border-b border-[#D9DFDA] pb-1.5">
              03. Uraian Catatan Teknis Lapangan Per Segmen STA
            </h3>
            <div className="space-y-3">
              {snapshot.frozenSegments.map((seg) => (
                <div
                  key={seg.id}
                  className="p-3.5 rounded-lg border border-[#D9DFDA] bg-[#F4F5F1]/40 text-xs space-y-1 break-inside-avoid"
                >
                  <div className="flex items-center justify-between font-mono font-bold text-[#172B2A] tabular-nums">
                    <span>
                      Segmen #{seg.segmentIndex} — STA {seg.staLabel} ({seg.lengthM} m)
                    </span>
                    <span>
                      LHR: {seg.lhrVehiclesPerDay.toLocaleString('id-ID')} kend/hari (HV{' '}
                      {seg.heavyVehiclePct}%) · Drainase: {seg.drainageCondition}
                    </span>
                  </div>
                  <p className="text-[#52615D] leading-relaxed">
                    {seg.notes || 'Pengukuran telah diverifikasi sesuai prosedur standar.'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section for Scope = 'skenario': Scenario Comparison Table */}
        {scope === 'skenario' && (
          <section className="space-y-3 break-inside-avoid">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#172B2A] border-b border-[#D9DFDA] pb-1.5">
              02. Evaluasi Perbandingan Skenario Anggaran Terhadap Baseline ({snapshot.id})
            </h3>
            <div className="overflow-x-auto border border-[#D9DFDA] rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F5F1] border-b border-[#D9DFDA]">
                    <th className="py-2.5 px-3 font-semibold text-[#52615D]">ID Skenario</th>
                    <th className="py-2.5 px-3 font-semibold text-[#52615D]">Nama Skenario</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                      Pagu Tahun 1
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                      Total 5 Tahun
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                      Selisih Biaya (Δ)
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold text-[#52615D]">
                      Kemantapan Thn 5
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9DFDA]">
                  {savedScenarios.map((scn) => (
                    <tr key={scn.id}>
                      <td className="py-2.5 px-3 font-mono font-semibold tabular-nums">
                        {scn.id}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#172B2A]">{scn.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatRupiah(scn.budgetCapRp)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                        {formatRupiah(scn.scenarioFiveYearCostRp)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {scn.costDeltaRp >= 0 ? '+' : ''}
                        {formatRupiah(scn.costDeltaRp)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#17635C] tabular-nums">
                        {scn.scenarioYear5StabilityPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Optional Photo Evidence Appendix */}
        {includePhotos && allPhotos.length > 0 && (
          <section className="space-y-3 break-inside-avoid">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#172B2A] border-b border-[#D9DFDA] pb-1.5">
               Lampiran Dokumentasi Visual Lapangan Per Stasioning
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allPhotos.map((item) => (
                <div
                  key={item.id}
                  className="border border-[#D9DFDA] rounded-lg overflow-hidden break-inside-avoid"
                >
                  <img
                    src={item.url}
                    alt={item.caption}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[5/3] object-contain bg-[#172B2A] border-b border-[#D9DFDA]"
                  />
                  <div className="p-3 bg-[#F4F5F1]/50 text-xs space-y-0.5">
                    <div className="font-mono font-bold text-[#172B2A] tabular-nums">
                      Segmen #{item.segmentIndex} · STA {item.staLabel} ({item.lengthM} m)
                    </div>
                    <div className="text-[#172B2A] font-medium">{item.caption}</div>
                    <div className="text-[11px] text-[#52615D]">
                      {item.direction} · Waktu rekam: {item.capturedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Official Engineering Sign-off Block */}
        <footer className="pt-6 border-t border-[#D9DFDA] grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs break-inside-avoid">
          <div>
            <div className="font-semibold text-[#172B2A]">Disiapkan Oleh:</div>
            <div className="text-[#52615D] mt-0.5">Tim Pelaksana Survei Kondisi Jalan</div>
            <div className="mt-12 font-semibold text-[#172B2A] underline">
              {snapshot.surveyorName}
            </div>
            <div className="text-[11px] font-mono text-[#52615D]">
              Unit Survei & Inventarisasi Jaringan Jalan
            </div>
          </div>

          <div className="sm:text-right">
            <div className="font-semibold text-[#172B2A]">Disahkan Oleh:</div>
            <div className="text-[#52615D] mt-0.5">
              Pejabat Pembuat Komitmen / Kepala Seksi Preservasi
            </div>
            <div className="mt-12 font-semibold text-[#172B2A] underline">
              Ir. H. Pratama Wijaya, ST., MT.
            </div>
            <div className="text-[11px] font-mono text-[#52615D] tabular-nums">
              NIP. 19820418 200901 1 004
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
};
