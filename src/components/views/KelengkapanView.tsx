import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Edit3,
  Ruler,
  Upload,
} from 'lucide-react';
import { DrainageCondition, RoadRuas, RoadSegment } from '../../types/jalan';
import { calculateSDI } from '../../utils/calculations';
import {
  ConditionBadge,
  PageHeader,
  ResponsiveColumn,
  ResponsiveDataView,
  StatCard,
} from '../ui/Primitives';

interface KelengkapanViewProps {
  activeRuas: RoadRuas;
  onOpenSegmentInput: (segmentId: string) => void;
  onBatchUpdateSegments: (updatedSegments: RoadSegment[]) => void;
  onNavigateToAnalisis: () => void;
}

type AuditFilter = 'all' | 'incomplete' | 'ready';

export const KelengkapanView: React.FC<KelengkapanViewProps> = ({
  activeRuas,
  onOpenSegmentInput,
  onBatchUpdateSegments,
  onNavigateToAnalisis,
}) => {
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const segments = activeRuas.segments;
  const totalRoadLengthM = activeRuas.staEndM - activeRuas.staStartM;
  const verifiedSegments = segments.filter((s) => s.verified);
  const verifiedLengthM = verifiedSegments.reduce((acc, s) => acc + s.lengthM, 0);
  const allReady = verifiedSegments.length === segments.length && segments.length > 0;

  const filteredSegments = segments.filter((seg) => {
    if (filter === 'incomplete') return !seg.verified;
    if (filter === 'ready') return seg.verified;
    return true;
  });

  const handleDownloadCsvTemplate = () => {
    const header =
      'segmentIndex,staStartM,staEndM,crackAreaPct,crackWidthMm,potholeCount,ruttingDepthCm,lhrVehiclesPerDay,heavyVehiclePct,drainageCondition,iriValueMPerKm,verified\n';
    const rows = segments
      .map(
        (s) =>
          `${s.segmentIndex},${s.staStartM},${s.staEndM},${s.crackAreaPct},${s.crackWidthMm},${s.potholeCount},${s.ruttingDepthCm},${s.lhrVehiclesPerDay},${s.heavyVehiclePct},${s.drainageCondition},${s.iriValueMPerKm},${s.verified}`
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `templat_survei_${activeRuas.code.toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCsvFeedback(`Templat CSV untuk ${activeRuas.code} berhasil diunduh.`);
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        if (lines.length < 2) {
          setCsvFeedback('Berkas CSV kosong atau tidak memiliki baris data segmen.');
          return;
        }

        const updatedMap = new Map<number, Partial<RoadSegment>>();
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim());
          if (cols.length < 7) continue;
          const segIndex = Number(cols[0]);
          if (Number.isNaN(segIndex)) continue;

          const drainageRaw = cols[9] as DrainageCondition;
          const validDrainage: DrainageCondition =
            drainageRaw === 'Baik' || drainageRaw === 'Sedang' || drainageRaw === 'Buruk'
              ? drainageRaw
              : 'Sedang';

          updatedMap.set(segIndex, {
            crackAreaPct: Math.max(0, Math.min(100, Number(cols[3]) || 0)),
            crackWidthMm: Math.max(0, Number(cols[4]) || 0),
            potholeCount: Math.max(0, Math.round(Number(cols[5]) || 0)),
            ruttingDepthCm: Math.max(0, Number(cols[6]) || 0),
            lhrVehiclesPerDay: Math.max(0, Math.round(Number(cols[7]) || 1850)),
            heavyVehiclePct: Math.max(0, Math.min(100, Number(cols[8]) || 12)),
            drainageCondition: validDrainage,
            iriValueMPerKm: Math.max(0, Number(cols[10]) || 4.0),
            verified: cols[11] ? cols[11].toLowerCase() === 'true' : true,
            verifiedAt: new Date().toISOString(),
          });
        }

        const nextSegments = segments.map((s) => {
          const patch = updatedMap.get(s.segmentIndex);
          return patch ? { ...s, ...patch } : s;
        });

        onBatchUpdateSegments(nextSegments);
        setCsvFeedback(
          `Berhasil mengimpor dan memperbarui ${updatedMap.size} segmen dari berkas CSV.`
        );
      } catch {
        setCsvFeedback('Gagal memproses berkas CSV. Pastikan urutan kolom sesuai templat.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const columns: ResponsiveColumn<RoadSegment>[] = [
    {
      key: 'staLength',
      header: 'Segmen & Panjang',
      render: (s) => (
        <div className="whitespace-nowrap">
          <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
            {s.staLabel}
          </span>
          <span className="block text-xs font-mono text-[#52615D] tabular-nums mt-0.5">
            Segmen #{s.segmentIndex} · {s.lengthM} m
          </span>
        </div>
      ),
    },
    {
      key: 'sdiPhotos',
      header: 'Parameter SDI & Foto',
      render: (s) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-[#172B2A] whitespace-nowrap">
            Retak {s.crackAreaPct}% ({s.crackWidthMm}mm) · Lubang {s.potholeCount} · Alur {s.ruttingDepthCm}cm
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#F4F5F1] text-[#17635C] border border-[#D9DFDA] whitespace-nowrap">
            {s.photos.length} Foto
          </span>
        </div>
      ),
    },
    {
      key: 'lhrDrainage',
      header: 'LHR & Drainase',
      render: (s) => (
        <div className="text-xs font-mono tabular-nums text-[#52615D] whitespace-nowrap">
          {s.lhrVehiclesPerDay.toLocaleString('id-ID')} kend/hr · {s.drainageCondition}
        </div>
      ),
    },
    {
      key: 'sdiScore',
      header: 'Skor & Kondisi SDI',
      align: 'right',
      render: (s) => {
        const sdi = calculateSDI({
          crackAreaPct: s.crackAreaPct,
          crackWidthMm: s.crackWidthMm,
          potholeCount: s.potholeCount,
          ruttingDepthCm: s.ruttingDepthCm,
          segmentLengthM: s.lengthM,
        });
        return (
          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
            <span className="font-mono font-bold text-[#172B2A] tabular-nums">
              {sdi.finalSdi.toFixed(1)}
            </span>
            <ConditionBadge condition={sdi.condition} size="sm" />
          </div>
        );
      },
    },
    {
      key: 'statusAction',
      header: 'Status & Aksi',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-2.5 whitespace-nowrap">
          {s.verified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span>Siap</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span>Belum</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpenSegmentInput(s.id)}
            className="min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F4F5F1] hover:bg-[#D9DFDA]/60 text-[#172B2A] border border-[#D9DFDA] inline-flex items-center gap-1 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span>Edit</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={`Audit Kesiapan Data / ${activeRuas.code} — ${activeRuas.name}`}
        title="Pemeriksaan Kelengkapan & Validasi Segmen"
        subtitle="Verifikasi kelengkapan pengukuran SDI, ketersediaan foto lapangan, dan parameter LHR sebelum mengeksekusi proyeksi Markov."
        actions={
          <button
            type="button"
            onClick={onNavigateToAnalisis}
            className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-[#17635C] hover:bg-[#124E48] text-white transition-colors whitespace-nowrap"
          >
            Lanjut ke Eksekusi Analisis
          </button>
        }
      />

      {csvFeedback && (
        <div className="p-3.5 bg-white border border-[#D9DFDA] rounded-xl flex items-center justify-between text-xs text-[#172B2A]">
          <span>{csvFeedback}</span>
          <button
            type="button"
            onClick={() => setCsvFeedback(null)}
            className="font-semibold text-[#52615D] hover:text-[#172B2A]"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Panjang Terukur vs Total Ruas"
          value={`${verifiedLengthM} / ${totalRoadLengthM} m`}
          subLabel={`Cakupan panjang terverifikasi ${
            totalRoadLengthM > 0
              ? ((verifiedLengthM / totalRoadLengthM) * 100).toFixed(1)
              : '0.0'
          }%`}
          icon={<Ruler className="w-5 h-5" strokeWidth={1.75} />}
        />
        <StatCard
          label="Segmen Terverifikasi"
          value={`${verifiedSegments.length} / ${segments.length} Segmen`}
          subLabel={`${segments.length - verifiedSegments.length} segmen menunggu verifikasi`}
          icon={<ClipboardCheck className="w-5 h-5" strokeWidth={1.75} />}
        />
        <StatCard
          label="Status Kesiapan Analisis"
          value={allReady ? 'Siap Dianalisis' : 'Verifikasi Parsial'}
          subLabel={
            allReady
              ? 'Seluruh segmen koridor telah memenuhi standar input SDI'
              : 'Lengkapi segmen yang belum terverifikasi atau unggah CSV'
          }
          icon={<CheckCircle2 className="w-5 h-5" strokeWidth={1.75} />}
        />
      </div>

      {/* Filter Bar + CSV Import/Template Download */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 bg-white border border-[#D9DFDA] rounded-xl p-3.5 shadow-xs">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F4F5F1] rounded-lg self-start">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'all'
                ? 'bg-white text-[#172B2A] shadow-xs font-semibold'
                : 'text-[#52615D] hover:text-[#172B2A]'
            }`}
          >
            Semua Segmen ({segments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('incomplete')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'incomplete'
                ? 'bg-white text-[#172B2A] shadow-xs font-semibold'
                : 'text-[#52615D] hover:text-[#172B2A]'
            }`}
          >
            Perlu Dilengkapi ({segments.length - verifiedSegments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('ready')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'ready'
                ? 'bg-white text-[#172B2A] shadow-xs font-semibold'
                : 'text-[#52615D] hover:text-[#172B2A]'
            }`}
          >
            Siap Analisis ({verifiedSegments.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCsv}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleDownloadCsvTemplate}
            className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-[#F4F5F1] text-[#172B2A] border border-[#D9DFDA] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Unduh Templat CSV</span>
          </button>
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-[#F4F5F1] text-[#172B2A] border border-[#D9DFDA] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Impor Data CSV</span>
          </button>
        </div>
      </div>

      {/* Segment Audit List */}
      <ResponsiveDataView
        columns={columns}
        data={filteredSegments}
        keyExtractor={(s) => s.id}
        renderMobileCard={(s) => {
          const sdi = calculateSDI({
            crackAreaPct: s.crackAreaPct,
            crackWidthMm: s.crackWidthMm,
            potholeCount: s.potholeCount,
            ruttingDepthCm: s.ruttingDepthCm,
            segmentLengthM: s.lengthM,
          });
          return (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-semibold text-[#17635C] tabular-nums">
                    Segmen #{s.segmentIndex} ({s.lengthM} m)
                  </span>
                  <h3 className="font-mono text-base font-bold text-[#172B2A] tabular-nums">
                    STA {s.staLabel}
                  </h3>
                </div>
                <ConditionBadge condition={sdi.condition} size="sm" />
              </div>

              <div className="text-xs font-mono tabular-nums text-[#52615D] space-y-1 pt-2 border-t border-[#D9DFDA]">
                <div>
                  SDI Sementara: <strong className="text-[#172B2A]">{sdi.finalSdi.toFixed(1)}</strong> · Foto: {s.photos.length}
                </div>
                <div>
                  Retak {s.crackAreaPct}% ({s.crackWidthMm}mm) · Lubang {s.potholeCount} · Alur {s.ruttingDepthCm}cm
                </div>
                <div>
                  LHR {s.lhrVehiclesPerDay.toLocaleString('id-ID')} kend/hr · Drainase {s.drainageCondition}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-[#172B2A]">
                  {s.verified ? 'Terverifikasi' : 'Belum Diverifikasi'}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenSegmentInput(s.id)}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium bg-[#17635C] text-white inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Lengkapi</span>
                </button>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};
