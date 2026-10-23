import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cpu,
  Eye,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  DirectionTag,
  DrainageCondition,
  PhotoEvidence,
  RoadRuas,
  RoadSegment,
} from '../../types/jalan';
import { calculateSDI } from '../../utils/calculations';
import { createRoadDistressSvgDataUrl } from '../../data/initialData';
import { ConditionBadge, PageHeader } from '../ui/Primitives';

interface InputViewProps {
  activeRuas: RoadRuas;
  activeSegment: RoadSegment;
  onSelectSegment: (segmentId: string) => void;
  onUpdateSegment: (updated: RoadSegment) => void;
}

interface AiDistressResponse {
  distressTypes: string[];
  severityAssessment: string;
  technicalNotes: string;
}

export const InputView: React.FC<InputViewProps> = ({
  activeRuas,
  activeSegment,
  onSelectSegment,
  onUpdateSegment,
}) => {
  const [isAccordionOpen, setIsAccordionOpen] = useState(true);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoDirection, setPhotoDirection] = useState<DirectionTag>('Arah Normal');
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoEvidence | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiDistressResponse | null>(null);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const segments = activeRuas.segments;
  const currentIdx = segments.findIndex((s) => s.id === activeSegment.id);
  const prevSegment = currentIdx > 0 ? segments[currentIdx - 1] : null;
  const nextSegment =
    currentIdx >= 0 && currentIdx < segments.length - 1 ? segments[currentIdx + 1] : null;

  // Live SDI calculation
  const liveSdi = calculateSDI({
    crackAreaPct: activeSegment.crackAreaPct,
    crackWidthMm: activeSegment.crackWidthMm,
    potholeCount: activeSegment.potholeCount,
    ruttingDepthCm: activeSegment.ruttingDepthCm,
    segmentLengthM: activeSegment.lengthM,
  });

  const handleFieldChange = <K extends keyof RoadSegment>(
    field: K,
    value: RoadSegment[K]
  ) => {
    onUpdateSegment({
      ...activeSegment,
      [field]: value,
    });
  };

  const handleToggleVerified = (checked: boolean) => {
    onUpdateSegment({
      ...activeSegment,
      verified: checked,
      verifiedAt: checked ? new Date().toISOString() : undefined,
    });
  };

  const handleSaveAndNext = () => {
    const verifiedSegment: RoadSegment = {
      ...activeSegment,
      verified: true,
      verifiedAt: activeSegment.verifiedAt || new Date().toISOString(),
    };
    onUpdateSegment(verifiedSegment);
    if (nextSegment) {
      onSelectSegment(nextSegment.id);
      setSaveBanner(`Segmen ${activeSegment.staLabel} disimpan & diverifikasi. Beralih ke ${nextSegment.staLabel}.`);
    } else {
      setSaveBanner(`Seluruh segmen hingga ${activeSegment.staLabel} telah disimpan & diverifikasi.`);
    }
    setAiResult(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: PhotoEvidence = {
          id: `PHOTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: String(reader.result),
          caption:
            photoCaption.trim() ||
            `Dokumentasi Lapangan STA ${activeSegment.staLabel} (${file.name})`,
          direction: photoDirection,
          capturedAt: `${new Date().toLocaleDateString('id-ID')} WITA`,
        };
        onUpdateSegment({
          ...activeSegment,
          photos: [...activeSegment.photos, newPhoto],
        });
        setPhotoCaption('');
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleGenerateTechnicalIllustrationPhoto = () => {
    const captionText =
      photoCaption.trim() ||
      `Penampang Visual Kerusakan STA ${activeSegment.staLabel} (${liveSdi.condition})`;
    const svgUrl = createRoadDistressSvgDataUrl({
      staLabel: activeSegment.staLabel,
      condition: liveSdi.condition,
      caption: captionText,
      crackPct: activeSegment.crackAreaPct,
      potholes: activeSegment.potholeCount,
      ruttingCm: activeSegment.ruttingDepthCm,
    });
    const newPhoto: PhotoEvidence = {
      id: `PHOTO-DIAG-${Date.now()}`,
      url: svgUrl,
      caption: captionText,
      direction: photoDirection,
      capturedAt: `${new Date().toLocaleDateString('id-ID')} WITA`,
    };
    onUpdateSegment({
      ...activeSegment,
      photos: [...activeSegment.photos, newPhoto],
    });
    setPhotoCaption('');
  };

  const handleRemovePhoto = (photoId: string) => {
    onUpdateSegment({
      ...activeSegment,
      photos: activeSegment.photos.filter((p) => p.id !== photoId),
    });
  };

  const handleIdentifyDistressAi = async () => {
    setAiLoading(true);
    try {
      const firstPhotoUrl = activeSegment.photos[0]?.url;
      const response = await fetch('/api/identify-distress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staRange: activeSegment.staLabel,
          lengthM: activeSegment.lengthM,
          crackAreaPct: activeSegment.crackAreaPct,
          crackWidthMm: activeSegment.crackWidthMm,
          potholeCount: activeSegment.potholeCount,
          ruttingDepthCm: activeSegment.ruttingDepthCm,
          drainageCondition: activeSegment.drainageCondition,
          heavyVehiclePct: activeSegment.heavyVehiclePct,
          imageDataUrl: firstPhotoUrl,
        }),
      });
      const data = (await response.json()) as AiDistressResponse;
      setAiResult(data);
    } catch {
      setAiResult({
        distressTypes: ['Retak Permukaan Aspal', 'Deformasi Alur Roda'],
        severityAssessment: `Evaluasi SDI ${liveSdi.finalSdi} (${liveSdi.condition})`,
        technicalNotes: `Segmen STA ${activeSegment.staLabel} (${activeSegment.lengthM}m) menunjukkan luas retak ${activeSegment.crackAreaPct}%, lebar retak ${activeSegment.crackWidthMm} mm, ${activeSegment.potholeCount} titik lubang, dan rutting ${activeSegment.ruttingDepthCm} cm.`,
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiNotes = () => {
    if (!aiResult) return;
    onUpdateSegment({
      ...activeSegment,
      notes: aiResult.technicalNotes,
    });
    setSaveBanner('Catatan evaluasi teknis berhasil diterapkan ke dokumen segmen.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={`Survei Lapangan / ${activeRuas.code} — ${activeRuas.name}`}
        title="Input Survei Segmen & Pengukuran SDI"
        subtitle="Catat parameter kerusakan permukaan perkerasan jalan (luas retak, lebar retak, jumlah lubang, kedalaman alur) beserta dokumentasi visual per segmen STA."
      />

      {saveBanner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
          <span>{saveBanner}</span>
          <button
            type="button"
            onClick={() => setSaveBanner(null)}
            className="font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Sticky Segment Navigator Bar */}
      <div className="sticky top-14 lg:top-16 z-10 bg-white border border-[#D9DFDA] rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="segment-selector" className="sr-only">
            Pilih Segmen STA
          </label>
          <select
            id="segment-selector"
            value={activeSegment.id}
            onChange={(e) => {
              onSelectSegment(e.target.value);
              setAiResult(null);
            }}
            className="px-3 py-2 text-sm font-mono font-semibold tabular-nums bg-[#F4F5F1] border border-[#D9DFDA] rounded-lg text-[#172B2A] focus:outline-none focus:border-[#17635C]"
          >
            {segments.map((seg) => (
              <option key={seg.id} value={seg.id}>
                Segmen {seg.segmentIndex}: STA {seg.staLabel} ({seg.lengthM}m)
              </option>
            ))}
          </select>

          {activeSegment.verified ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Terverifikasi</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Belum Lengkap</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prevSegment}
            onClick={() => {
              if (prevSegment) {
                onSelectSegment(prevSegment.id);
                setAiResult(null);
              }
            }}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-[#F4F5F1] text-[#172B2A] border border-[#D9DFDA] disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
            <span>Sebelumnya</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAndNext}
            className="min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium bg-[#17635C] hover:bg-[#124E48] text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <span>Simpan & Lanjut</span>
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* 2-Column Asymmetric Desktop Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (lg:col-span-7 — Pengukuran SDI & Teknis) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Real-time SDI Score Preview Bar */}
          <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-[#52615D]">
                  Kalkulasi Real-Time Surface Distress Index (SDI)
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <span
                    data-testid="live-sdi-score"
                    className="text-3xl font-bold font-mono tabular-nums text-[#172B2A]"
                  >
                    {liveSdi.finalSdi.toFixed(1)}
                  </span>
                  <span className="text-xs text-[#52615D] font-mono tabular-nums">
                    STA {activeSegment.staLabel} ({activeSegment.lengthM} m)
                  </span>
                </div>
              </div>
              <ConditionBadge condition={liveSdi.condition} />
            </div>

            {/* 4-Step Deterministic Breakdown Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-[#D9DFDA] text-xs">
              <div className="p-2.5 rounded-lg bg-[#F4F5F1]">
                <span className="text-[#52615D] block">Tahap 1 (Luas Retak)</span>
                <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
                  SDI-1 = {liveSdi.sdi1.toFixed(1)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F4F5F1]">
                <span className="text-[#52615D] block">Tahap 2 (Lebar Retak)</span>
                <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
                  SDI-2 = {liveSdi.sdi2.toFixed(1)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F4F5F1]">
                <span className="text-[#52615D] block">
                  Tahap 3 ({liveSdi.potholesPer100m}/100m)
                </span>
                <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
                  SDI-3 = {liveSdi.sdi3.toFixed(1)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F4F5F1]">
                <span className="text-[#52615D] block">Tahap 4 (Alur Roda)</span>
                <span className="font-mono font-semibold text-[#17635C] tabular-nums">
                  SDI-4 = {liveSdi.sdi4.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Core SDI Inputs Card */}
          <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-5">
            <h2 className="text-base font-semibold text-[#172B2A]">
              Parameter Utama Kerusakan Permukaan (SDI)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Luas Retak (0-100%) */}
              <div>
                <label
                  htmlFor="sdi-crack-area"
                  className="block text-xs font-medium text-[#172B2A] mb-1"
                >
                  1. Luas Retak Permukaan (0–100%)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="sdi-crack-area"
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={activeSegment.crackAreaPct}
                    onChange={(e) =>
                      handleFieldChange(
                        'crackAreaPct',
                        Math.max(0, Math.min(100, Number(e.target.value) || 0))
                      )
                    }
                    className="w-full pr-12 pl-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                  <span className="absolute right-3 text-xs font-mono text-[#52615D]">
                    %
                  </span>
                </div>
                <span className="text-[11px] text-[#7A8884] mt-1 block">
                  0% = 0 · &lt;10% = 5 · 10–30% = 20 · &gt;30% = 40
                </span>
              </div>

              {/* 2. Rata-rata Lebar Retak (mm) */}
              <div>
                <label
                  htmlFor="sdi-crack-width"
                  className="block text-xs font-medium text-[#172B2A] mb-1"
                >
                  2. Rata-rata Lebar Retak
                </label>
                <div className="relative flex items-center">
                  <input
                    id="sdi-crack-width"
                    type="number"
                    min={0}
                    max={50}
                    step="0.1"
                    value={activeSegment.crackWidthMm}
                    onChange={(e) =>
                      handleFieldChange(
                        'crackWidthMm',
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className="w-full pr-12 pl-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                  <span className="absolute right-3 text-xs font-mono text-[#52615D]">
                    mm
                  </span>
                </div>
                <span className="text-[11px] text-[#7A8884] mt-1 block">
                  Bukaan &gt; 3 mm menggandakan bobot SDI-1 (SDI-2 = SDI-1 × 2)
                </span>
              </div>

              {/* 3. Jumlah Lubang pada Segmen (titik) */}
              <div>
                <label
                  htmlFor="sdi-potholes"
                  className="block text-xs font-medium text-[#172B2A] mb-1"
                >
                  3. Jumlah Lubang pada Segmen
                </label>
                <div className="relative flex items-center">
                  <input
                    id="sdi-potholes"
                    type="number"
                    min={0}
                    max={500}
                    step="1"
                    value={activeSegment.potholeCount}
                    onChange={(e) =>
                      handleFieldChange(
                        'potholeCount',
                        Math.max(0, Math.round(Number(e.target.value) || 0))
                      )
                    }
                    className="w-full pr-14 pl-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                  <span className="absolute right-3 text-xs font-mono text-[#52615D]">
                    titik
                  </span>
                </div>
                <span className="text-[11px] text-[#7A8884] mt-1 block tabular-nums">
                  Normalisasi 100m: {liveSdi.potholesPer100m} lubang/100m (Segmen {activeSegment.lengthM}m)
                </span>
              </div>

              {/* 4. Kedalaman Alur / Rutting (cm) */}
              <div>
                <label
                  htmlFor="sdi-rutting"
                  className="block text-xs font-medium text-[#172B2A] mb-1"
                >
                  4. Kedalaman Alur / Rutting
                </label>
                <div className="relative flex items-center">
                  <input
                    id="sdi-rutting"
                    type="number"
                    min={0}
                    max={30}
                    step="0.1"
                    value={activeSegment.ruttingDepthCm}
                    onChange={(e) =>
                      handleFieldChange(
                        'ruttingDepthCm',
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className="w-full pr-12 pl-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                  <span className="absolute right-3 text-xs font-mono text-[#52615D]">
                    cm
                  </span>
                </div>
                <span className="text-[11px] text-[#7A8884] mt-1 block">
                  0 cm = +0 · &lt;1 cm = +2,5 · 1–3 cm = +10 · &gt;3 cm = +20
                </span>
              </div>
            </div>

            {/* Catatan Teknis Lapangan */}
            <div>
              <label
                htmlFor="segment-notes"
                className="block text-xs font-medium text-[#172B2A] mb-1"
              >
                Catatan Teknis & Deskripsi Lapangan
              </label>
              <textarea
                id="segment-notes"
                rows={3}
                value={activeSegment.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Deskripsikan lokasi spesifik kerusakan, kondisi bahu jalan, dan rekomendasi teknis lapangan..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
              />
            </div>

            {/* Verification Toggle */}
            <div className="pt-3 border-t border-[#D9DFDA] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={activeSegment.verified}
                  onChange={(e) => handleToggleVerified(e.target.checked)}
                  className="w-4 h-4 rounded text-[#17635C] focus:ring-[#17635C]"
                />
                <span className="text-sm font-medium text-[#172B2A]">
                  Tandai Segmen Telah Diperiksa
                </span>
              </label>
              {activeSegment.verifiedAt && (
                <span className="text-xs font-mono tabular-nums text-[#52615D]">
                  Diverifikasi: {new Date(activeSegment.verifiedAt).toLocaleString('id-ID')}
                </span>
              )}
            </div>
          </div>

          {/* Collapsible Accordion: Data Teknis & LHR Pendukung */}
          <div className="bg-white border border-[#D9DFDA] rounded-xl shadow-xs overflow-hidden">
            <button
              type="button"
              aria-expanded={isAccordionOpen}
              onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#F4F5F1]/50 transition-colors"
            >
              <div>
                <h3 className="text-sm font-semibold text-[#172B2A]">
                  Data Teknis & LHR Pendukung
                </h3>
                <p className="text-xs text-[#52615D]">
                  Volume lalu lintas harian rata-rata, beban kendaraan berat, drainase, umur perkerasan, dan nilai IRI pembanding
                </p>
              </div>
              {isAccordionOpen ? (
                <ChevronUp className="w-4 h-4 text-[#52615D]" strokeWidth={1.75} />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#52615D]" strokeWidth={1.75} />
              )}
            </button>

            {isAccordionOpen && (
              <div className="p-5 pt-2 border-t border-[#D9DFDA] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="tech-lhr"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    LHR (kendaraan/hari)
                  </label>
                  <input
                    id="tech-lhr"
                    type="number"
                    min={0}
                    value={activeSegment.lhrVehiclesPerDay}
                    onChange={(e) =>
                      handleFieldChange(
                        'lhrVehiclesPerDay',
                        Math.max(0, Math.round(Number(e.target.value) || 0))
                      )
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tech-heavy-pct"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    Kendaraan Berat (%)
                  </label>
                  <input
                    id="tech-heavy-pct"
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={activeSegment.heavyVehiclePct}
                    onChange={(e) =>
                      handleFieldChange(
                        'heavyVehiclePct',
                        Math.max(0, Math.min(100, Number(e.target.value) || 0))
                      )
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tech-drainage"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    Kondisi Drainase Tepi
                  </label>
                  <select
                    id="tech-drainage"
                    value={activeSegment.drainageCondition}
                    onChange={(e) =>
                      handleFieldChange(
                        'drainageCondition',
                        e.target.value as DrainageCondition
                      )
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Buruk">Buruk</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="tech-age"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    Umur Perkerasan (tahun)
                  </label>
                  <input
                    id="tech-age"
                    type="number"
                    min={0}
                    max={50}
                    value={activeSegment.pavementAgeYears}
                    onChange={(e) =>
                      handleFieldChange(
                        'pavementAgeYears',
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="tech-iri"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    Nilai IRI Pembanding / PKRMS (m/km)
                  </label>
                  <input
                    id="tech-iri"
                    type="number"
                    min={0}
                    max={30}
                    step="0.1"
                    value={activeSegment.iriValueMPerKm}
                    onChange={(e) =>
                      handleFieldChange(
                        'iriValueMPerKm',
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (lg:col-span-5 — Bukti Foto & Bantuan AI) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Bukti Foto Lapangan Card */}
          <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#172B2A]">
                  Bukti Foto & Dokumentasi Segmen
                </h2>
                <p className="text-xs text-[#52615D]">
                  Unggah foto lapangan atau buat diagram visual kerusakan STA {activeSegment.staLabel}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#17635C] tabular-nums">
                {activeSegment.photos.length} Foto
              </span>
            </div>

            {/* Metadata Input before adding photo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label htmlFor="photo-caption-input" className="sr-only">
                  Keterangan Foto
                </label>
                <input
                  id="photo-caption-input"
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="Keterangan foto (misal: Lubang jalur kiri STA 0+140)"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                />
              </div>
              <div>
                <label htmlFor="photo-direction-select" className="sr-only">
                  Arah Pandang
                </label>
                <select
                  id="photo-direction-select"
                  value={photoDirection}
                  onChange={(e) => setPhotoDirection(e.target.value as DirectionTag)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                >
                  <option value="Arah Normal">Arah Normal</option>
                  <option value="Arah Sebaliknya">Arah Sebaliknya</option>
                  <option value="Potongan Melintang">Potongan Melintang</option>
                </select>
              </div>
            </div>

            {/* Upload Dropzone & Technical Diagram Button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[42px] px-3 py-2.5 rounded-lg border border-dashed border-[#17635C] bg-[#F4F5F1]/60 hover:bg-[#F4F5F1] text-xs font-medium text-[#172B2A] inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Camera className="w-4 h-4 text-[#17635C]" strokeWidth={1.75} />
                <span>Unggah Foto Lapangan</span>
              </button>
              <button
                type="button"
                onClick={handleGenerateTechnicalIllustrationPhoto}
                className="min-h-[42px] px-3 py-2.5 rounded-lg border border-[#D9DFDA] bg-white hover:bg-[#F4F5F1] text-xs font-medium text-[#172B2A] inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4 text-[#17635C]" strokeWidth={1.75} />
                <span>Tambah Ilustrasi Teknis STA</span>
              </button>
            </div>

            {/* Thumbnail List */}
            {activeSegment.photos.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#F4F5F1] text-center text-xs text-[#52615D]">
                Belum ada dokumentasi foto untuk segmen STA {activeSegment.staLabel}.
              </div>
            ) : (
              <div className="space-y-3">
                {activeSegment.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="p-2.5 rounded-lg border border-[#D9DFDA] bg-[#F4F5F1]/40 flex items-center gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxPhoto(photo)}
                      className="relative w-24 h-16 rounded-md overflow-hidden border border-[#D9DFDA] shrink-0 group focus:outline-none"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <Eye className="w-4 h-4" strokeWidth={1.75} />
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#172B2A] truncate">
                        {photo.caption}
                      </div>
                      <div className="text-[11px] text-[#52615D] mt-0.5">
                        {photo.direction} · {photo.capturedAt}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Hapus foto ${photo.caption}`}
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="p-1.5 text-[#52615D] hover:text-rose-700 rounded-md"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Identifikasi Kerusakan (AI) Card */}
          <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#172B2A]">
                  Evaluasi Teknis Berbantuan AI
                </h2>
                <p className="text-xs text-[#52615D]">
                  Sintesis jenis kerusakan perkerasan dan rekomendasi teknis berdasarkan metrik SDI dan foto segmen.
                </p>
              </div>
              <Cpu className="w-5 h-5 text-[#17635C] shrink-0" strokeWidth={1.75} />
            </div>

            <button
              type="button"
              disabled={aiLoading}
              onClick={handleIdentifyDistressAi}
              className="w-full min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-[#17635C] hover:bg-[#124E48] text-white disabled:opacity-50 transition-colors"
            >
              {aiLoading ? 'Menganalisis Parameter Segmen...' : 'Identifikasi Kerusakan (AI)'}
            </button>

            {aiResult && (
              <div className="p-4 rounded-lg bg-[#F4F5F1] border border-[#D9DFDA] space-y-3 text-xs">
                <div>
                  <span className="text-[#52615D] block font-medium">
                    Tingkat Keparahan Teridentifikasi:
                  </span>
                  <span className="font-semibold text-[#172B2A]">
                    {aiResult.severityAssessment}
                  </span>
                </div>

                <div>
                  <span className="text-[#52615D] block font-medium mb-1">
                    Klasifikasi Jenis Kerusakan:
                  </span>
                  <div className="text-[#172B2A] font-medium">
                    {aiResult.distressTypes.join(' · ')}
                  </div>
                </div>

                <div>
                  <span className="text-[#52615D] block font-medium mb-1">
                    Rekomendasi Catatan Teknis:
                  </span>
                  <p className="text-[#172B2A] leading-relaxed">
                    {aiResult.technicalNotes}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleApplyAiNotes}
                  className="w-full min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#D9DFDA]/40 text-[#17635C] border border-[#17635C] transition-colors"
                >
                  Terapkan ke Catatan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Lightbox Modal */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau Foto Segmen"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="bg-white border border-[#D9DFDA] rounded-xl max-w-3xl w-full overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-[#D9DFDA] flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#172B2A]">
                  {lightboxPhoto.caption}
                </div>
                <div className="text-xs text-[#52615D]">
                  STA {activeSegment.staLabel} · {lightboxPhoto.direction} ·{' '}
                  {lightboxPhoto.capturedAt}
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup Pratinjau Foto"
                onClick={() => setLightboxPhoto(null)}
                className="p-1.5 rounded-lg text-[#52615D] hover:bg-[#F4F5F1]"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-4 bg-[#172B2A] flex items-center justify-center">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.caption}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
