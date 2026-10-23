import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Layers,
  Plus,
  Route,
  Upload,
  X,
} from 'lucide-react';
import {
  JalanBetaStoreState,
  RoadRuas,
  ViewRoute,
} from '../../types/jalan';
import {
  formatStaRange,
  generateSegmentsForRuas,
} from '../../utils/calculations';
import {
  PageHeader,
  ResponsiveColumn,
  ResponsiveDataView,
  StatCard,
} from '../ui/Primitives';

interface RuasViewProps {
  store: JalanBetaStoreState;
  onAddRuas: (newRuas: RoadRuas) => void;
  onSelectRuasAndNavigate: (ruasId: string, targetView: ViewRoute, segmentId?: string) => void;
  onImportStoreBackup: (nextStore: JalanBetaStoreState) => void;
}

export const RuasView: React.FC<RuasViewProps> = ({
  store,
  onAddRuas,
  onSelectRuasAndNavigate,
  onImportStoreBackup,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [code, setCode] = useState('RN-02');
  const [name, setName] = useState('');
  const [staStartM, setStaStartM] = useState<string>('0');
  const [staEndM, setStaEndM] = useState<string>('250');
  const [widthM, setWidthM] = useState<string>('6.5');
  const [surveyPeriod, setSurveyPeriod] = useState<string>('2026');
  const [surveyorName, setSurveyorName] = useState<string>('Tim Teknis Bina Marga');
  const [formError, setFormError] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compute Top Summary KPIs
  const totalRuas = store.ruasList.length;
  const totalMeters = store.ruasList.reduce(
    (acc, r) => acc + (r.staEndM - r.staStartM),
    0
  );
  const totalKm = (totalMeters / 1000).toFixed(3);

  const totalSegments = store.ruasList.reduce(
    (acc, r) => acc + r.segments.length,
    0
  );
  const verifiedSegments = store.ruasList.reduce(
    (acc, r) => acc + r.segments.filter((s) => s.verified).length,
    0
  );
  const verifiedPct =
    totalSegments > 0 ? ((verifiedSegments / totalSegments) * 100).toFixed(1) : '0.0';

  const handleExportJson = () => {
    const jsonString = JSON.stringify(store, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jalan_beta_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setBackupMessage('Cadangan basis data JSON berhasil diekspor.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.ruasList) || parsed.ruasList.length === 0) {
          setBackupMessage('Format berkas JSON tidak valid: daftar ruas tidak ditemukan.');
          return;
        }
        onImportStoreBackup(parsed as JalanBetaStoreState);
        setBackupMessage(`Berhasil memulihkan ${parsed.ruasList.length} ruas jalan dari cadangan JSON.`);
      } catch {
        setBackupMessage('Gagal membaca berkas JSON. Pastikan struktur berkas sesuai.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateRuas = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const startNum = Number(staStartM);
    const endNum = Number(staEndM);
    const widthNum = Number(widthM);

    if (!trimmedCode || !trimmedName) {
      setFormError('Kode Ruas dan Nama Ruas wajib diisi.');
      return;
    }
    if (Number.isNaN(startNum) || Number.isNaN(endNum) || endNum <= startNum) {
      setFormError('STA Akhir harus lebih besar daripada STA Awal (minimal 1 meter).');
      return;
    }
    if (endNum - startNum > 25000) {
      setFormError('Rentang satu seksi survei maksimal 25.000 meter (25 km).');
      return;
    }
    if (Number.isNaN(widthNum) || widthNum < 2 || widthNum > 30) {
      setFormError('Lebar perkerasan jalan harus berada pada rentang 2,0 m hingga 30,0 m.');
      return;
    }

    const ruasId = `RUAS-${trimmedCode}-${Date.now().toString().slice(-4)}`;
    const generatedSegments = generateSegmentsForRuas(ruasId, startNum, endNum);

    const newRuas: RoadRuas = {
      id: ruasId,
      code: trimmedCode,
      name: trimmedName,
      staStartM: Math.round(startNum),
      staEndM: Math.round(endNum),
      widthM: Number(widthNum.toFixed(2)),
      surveyPeriod: surveyPeriod.trim() || '2026',
      surveyorName: surveyorName.trim() || 'Tim Teknis Bina Marga',
      createdAt: new Date().toISOString(),
      segments: generatedSegments,
    };

    onAddRuas(newRuas);
    setIsAddModalOpen(false);
    setName('');
    setCode(`RN-0${store.ruasList.length + 2}`);
  };

  // Preview segment split inside modal
  const previewStart = Math.max(0, Math.round(Number(staStartM) || 0));
  const previewEnd = Math.max(previewStart, Math.round(Number(staEndM) || 0));
  const previewLength = Math.max(0, previewEnd - previewStart);
  const full100Count = Math.floor(previewLength / 100);
  const remainderM = previewLength % 100;

  const columns: ResponsiveColumn<RoadRuas>[] = [
    {
      key: 'corridor',
      header: 'Koridor & Kode Ruas',
      render: (r) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[#17635C] tabular-nums">
              {r.code}
            </span>
            <span className="font-semibold text-[#172B2A]">{r.name}</span>
          </div>
          <div className="text-xs text-[#52615D] mt-0.5">
            Surveyor: {r.surveyorName}
          </div>
        </div>
      ),
    },
    {
      key: 'dimensions',
      header: 'Rentang STA & Dimensi',
      render: (r) => (
        <div className="font-mono tabular-nums whitespace-nowrap">
          <div className="font-semibold text-[#172B2A]">
            {formatStaRange(r.staStartM, r.staEndM)}
          </div>
          <div className="text-xs text-[#52615D] mt-0.5">
            {r.staEndM - r.staStartM} m ({r.segments.length} segmen) · Lebar {r.widthM.toFixed(1)} m
          </div>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Periode',
      align: 'center',
      render: (r) => (
        <span className="font-mono text-xs font-medium tabular-nums text-[#52615D] whitespace-nowrap">
          {r.surveyPeriod}
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Progres Verifikasi',
      render: (r) => {
        const verified = r.segments.filter((s) => s.verified).length;
        const total = r.segments.length;
        const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
        return (
          <div className="w-40 space-y-1">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-[#172B2A] font-medium">
                {verified}/{total} Segmen
              </span>
              <span className="text-[#52615D]">{pct}%</span>
            </div>
            <div className="w-full h-2 bg-[#F4F5F1] rounded-full overflow-hidden border border-[#D9DFDA]">
              <div
                className="h-full bg-[#17635C] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectRuasAndNavigate(r.id, 'input', r.segments[0]?.id);
            }}
            className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F4F5F1] hover:bg-[#D9DFDA]/60 text-[#172B2A] border border-[#D9DFDA] transition-colors whitespace-nowrap"
          >
            Buka Input
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectRuasAndNavigate(r.id, 'hasil');
            }}
            className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium bg-[#17635C] hover:bg-[#124E48] text-white transition-colors whitespace-nowrap"
          >
            Lihat Hasil
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Inventaris Jaringan Jalan / Manajemen Koridor"
        title="Manajemen Ruas & Segmentasi STA"
        subtitle="Kelola daftar koridor jalan, pembagian segmen per 100 meter beserta sisa panjang aktual, serta portabilitas basis data survei."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-white hover:bg-[#F4F5F1] text-[#172B2A] border border-[#D9DFDA] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4" strokeWidth={1.75} />
              <span>Impor Backup (JSON)</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-white hover:bg-[#F4F5F1] text-[#172B2A] border border-[#D9DFDA] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} />
              <span>Ekspor Backup (JSON)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setIsAddModalOpen(true);
              }}
              className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-[#17635C] hover:bg-[#124E48] text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              <span>Tambah Ruas Baru</span>
            </button>
          </>
        }
      />

      {backupMessage && (
        <div className="p-3.5 bg-white border border-[#D9DFDA] rounded-xl flex items-center justify-between text-xs text-[#172B2A]">
          <span>{backupMessage}</span>
          <button
            type="button"
            onClick={() => setBackupMessage(null)}
            className="text-[#52615D] hover:text-[#172B2A] font-medium"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Top 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Ruas Terdaftar"
          value={`${totalRuas} Ruas`}
          subLabel={`Terdiri atas ${totalSegments} segmen stasioning aktif`}
          icon={<Layers className="w-5 h-5" strokeWidth={1.75} />}
        />
        <StatCard
          label="Total Panjang Jalan"
          value={`${totalKm} km`}
          subLabel={`Panjang akumulasi ${totalMeters.toLocaleString('id-ID')} meter`}
          icon={<Route className="w-5 h-5" strokeWidth={1.75} />}
        />
        <StatCard
          label="Persentase Segmen Terverifikasi"
          value={`${verifiedPct}%`}
          subLabel={`${verifiedSegments} dari ${totalSegments} segmen telah diperiksa`}
          icon={<CheckCircle2 className="w-5 h-5" strokeWidth={1.75} />}
        />
      </div>

      {/* Ruas Table / Mobile Cards */}
      <ResponsiveDataView
        columns={columns}
        data={store.ruasList}
        keyExtractor={(r) => r.id}
        renderMobileCard={(r) => {
          const verified = r.segments.filter((s) => s.verified).length;
          const total = r.segments.length;
          const pct = total > 0 ? Math.round((verified / total) * 100) : 0;

          return (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-mono font-semibold text-[#17635C] tabular-nums">
                    {r.code} · Periode {r.surveyPeriod}
                  </span>
                  <h3 className="text-base font-semibold text-[#172B2A] mt-0.5">
                    {r.name}
                  </h3>
                  <p className="text-xs text-[#52615D]">Surveyor: {r.surveyorName}</p>
                </div>
                <span className="font-mono text-xs font-semibold text-[#172B2A] tabular-nums">
                  {r.staEndM - r.staStartM} m
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#D9DFDA] text-xs">
                <div>
                  <span className="text-[#52615D] block">Rentang STA</span>
                  <span className="font-mono font-medium text-[#172B2A] tabular-nums">
                    {formatStaRange(r.staStartM, r.staEndM)}
                  </span>
                </div>
                <div>
                  <span className="text-[#52615D] block">Lebar & Segmen</span>
                  <span className="font-mono font-medium text-[#172B2A] tabular-nums">
                    {r.widthM.toFixed(1)} m · {r.segments.length} segmen
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-[#52615D]">Progres Pemeriksaan</span>
                  <span className="font-semibold text-[#172B2A]">
                    {verified}/{total} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-[#F4F5F1] rounded-full overflow-hidden border border-[#D9DFDA]">
                  <div
                    className="h-full bg-[#17635C]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectRuasAndNavigate(r.id, 'input', r.segments[0]?.id)}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium bg-[#F4F5F1] text-[#172B2A] border border-[#D9DFDA] inline-flex items-center justify-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Buka Input</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectRuasAndNavigate(r.id, 'hasil')}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium bg-[#17635C] text-white inline-flex items-center justify-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Lihat Hasil</span>
                </button>
              </div>
            </div>
          );
        }}
      />

      {/* Modal "Tambah Ruas Baru" */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-tambah-ruas-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#D9DFDA] rounded-xl shadow-lg w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D9DFDA] flex items-center justify-between">
              <div>
                <h2
                  id="modal-tambah-ruas-title"
                  className="text-lg font-semibold text-[#172B2A]"
                >
                  Tambah Ruas Jalan Baru
                </h2>
                <p className="text-xs text-[#52615D]">
                  Sistem otomatis membagi ruas menjadi segmen 100 m beserta segmen sisa aktual.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup Modal"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-[#52615D] hover:bg-[#F4F5F1] hover:text-[#172B2A]"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleCreateRuas} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="input-ruas-code"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    Kode Ruas
                  </label>
                  <input
                    id="input-ruas-code"
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="RN-02"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="input-ruas-name"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    Nama Ruas Jalan
                  </label>
                  <input
                    id="input-ruas-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Ruas Oesao – Bokong"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="input-sta-awal"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    STA Awal (m)
                  </label>
                  <input
                    id="input-sta-awal"
                    type="number"
                    min={0}
                    required
                    value={staStartM}
                    onChange={(e) => setStaStartM(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-sta-akhir"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    STA Akhir (m)
                  </label>
                  <input
                    id="input-sta-akhir"
                    type="number"
                    min={1}
                    required
                    value={staEndM}
                    onChange={(e) => setStaEndM(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-lebar-jalan"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    Lebar Jalan (m)
                  </label>
                  <input
                    id="input-lebar-jalan"
                    type="number"
                    step="0.1"
                    min={2}
                    max={30}
                    required
                    value={widthM}
                    onChange={(e) => setWidthM(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="input-periode-survei"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    Tahun / Periode Survei
                  </label>
                  <input
                    id="input-periode-survei"
                    type="text"
                    required
                    value={surveyPeriod}
                    onChange={(e) => setSurveyPeriod(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-nama-surveyor"
                    className="block text-xs font-medium text-[#172B2A] mb-1"
                  >
                    Nama Tim Surveyor
                  </label>
                  <input
                    id="input-nama-surveyor"
                    type="text"
                    required
                    value={surveyorName}
                    onChange={(e) => setSurveyorName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D9DFDA] rounded-lg focus:outline-none focus:border-[#17635C]"
                  />
                </div>
              </div>

              {/* Automatic Segment Generation Preview */}
              <div className="p-3.5 rounded-lg bg-[#F4F5F1] border border-[#D9DFDA] text-xs space-y-1">
                <div className="font-semibold text-[#172B2A]">
                  Pratinjau Pembagian Segmen Otomatis:
                </div>
                <div className="text-[#52615D] font-mono tabular-nums">
                  Panjang Aktual: {previewLength} m ({formatStaRange(previewStart, previewEnd)}) →{' '}
                  {full100Count} segmen @ 100m
                  {remainderM > 0 ? ` + 1 segmen sisa @ ${remainderM}m` : ''} (Total{' '}
                  {full100Count + (remainderM > 0 ? 1 : 0)} segmen)
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D9DFDA]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-white border border-[#D9DFDA] text-[#52615D] hover:text-[#172B2A]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium bg-[#17635C] hover:bg-[#124E48] text-white"
                >
                  Simpan & Buat Segmen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
