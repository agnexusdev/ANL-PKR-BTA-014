import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Layers,
  PlayCircle,
  Sliders,
  Wrench,
} from 'lucide-react';
import { ConditionClass, PriorityRank, RoadRuas, RoadSegment, ViewRoute } from '../../types/jalan';

/**
 * Semantic Condition Badge
 * Strictly pairs icon + text + semantic pill background per Section 2.1
 */
export const ConditionBadge: React.FC<{
  condition: ConditionClass;
  size?: 'sm' | 'md';
}> = ({ condition, size = 'md' }) => {
  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-xs gap-1'
      : 'px-3 py-1 text-xs font-semibold gap-1.5';

  switch (condition) {
    case 'Baik':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap shrink-0 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span>Baik</span>
        </span>
      );
    case 'Sedang':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0 ${sizeClasses}`}
        >
          <Wrench className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span>Sedang</span>
        </span>
      );
    case 'Rusak Ringan':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-orange-50 text-orange-800 border border-orange-200 whitespace-nowrap shrink-0 ${sizeClasses}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span>Rusak Ringan</span>
        </span>
      );
    case 'Rusak Berat':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap shrink-0 ${sizeClasses}`}
        >
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span>Rusak Berat</span>
        </span>
      );
  }
};

export const PriorityBadge: React.FC<{ priority: PriorityRank }> = ({ priority }) => {
  const styles: Record<PriorityRank, string> = {
    P1: 'bg-rose-50 text-rose-800 border-rose-200',
    P2: 'bg-orange-50 text-orange-800 border-orange-200',
    P3: 'bg-amber-50 text-amber-800 border-amber-200',
    P4: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border tabular-nums whitespace-nowrap shrink-0 ${styles[priority]}`}
    >
      {priority}
    </span>
  );
};

/**
 * PageHeader Primitive
 * Standardized top block with breadcrumb, text-xl lg:text-2xl font-semibold tracking-tight text-[#172B2A],
 * concise 1-sentence subtitle, and right-aligned action buttons that never crush the title.
 */
export const PageHeader: React.FC<{
  breadcrumb: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}> = ({ breadcrumb, title, subtitle, actions }) => {
  return (
    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 pb-5 border-b border-[#D9DFDA] no-print">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-[#52615D] tracking-wide">
          {breadcrumb}
        </div>
        <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-[#172B2A] mt-0.5">
          {title}
        </h1>
        <p className="text-sm text-[#52615D] mt-1 max-w-2xl">{subtitle}</p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>
      )}
    </div>
  );
};

/**
 * StatCard Primitive
 * Compact metric card with single-line tabular-nums discipline so currency/metrics never wrap awkwardly.
 */
export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  subLabel?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ label, value, subLabel, icon }) => {
  return (
    <div className="p-5 bg-white border border-[#D9DFDA] rounded-xl shadow-xs flex flex-col justify-between min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[#52615D]">
          {label}
        </span>
        {icon && <span className="text-[#17635C] shrink-0">{icon}</span>}
      </div>
      <div className="text-lg xl:text-2xl font-bold font-mono tabular-nums text-[#172B2A] whitespace-nowrap mt-1">
        {value}
      </div>
      {subLabel && (
        <div className="mt-2 text-xs text-[#52615D] flex items-center gap-1.5">
          {subLabel}
        </div>
      )}
    </div>
  );
};

/**
 * ResponsiveDataView (CRITICAL TABLE-TO-CARD ADAPTER)
 * - Desktop (>=1280px): Clean table-auto inside bg-white border border-[#D9DFDA] rounded-xl
 * - Mobile/Tablet/Compact Desktop (<1280px): Stacked cards in grid-cols-1 md:grid-cols-2 gap-4 xl:hidden
 */
export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}

export function ResponsiveDataView<T>({
  columns,
  data,
  renderMobileCard,
  onRowClick,
  keyExtractor,
  emptyState,
}: {
  columns: ResponsiveColumn<T>[];
  data: T[];
  renderMobileCard: (row: T, index: number) => React.ReactNode;
  onRowClick?: (row: T) => void;
  keyExtractor: (row: T, index: number) => string;
  emptyState?: React.ReactNode;
}) {
  if (data.length === 0) {
    return (
      <div className="p-8 bg-white border border-[#D9DFDA] rounded-xl text-center text-sm text-[#52615D]">
        {emptyState || 'Tidak ada data yang sesuai dengan kriteria filter.'}
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table (>= 1280px) */}
      <div className="hidden xl:block overflow-x-auto bg-white border border-[#D9DFDA] rounded-xl shadow-xs">
        <table className="w-full table-auto text-left border-collapse">
          <thead>
            <tr className="bg-[#F4F5F1] border-b border-[#D9DFDA]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3 px-3.5 text-xs font-semibold uppercase tracking-wider text-[#52615D] whitespace-nowrap ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9DFDA] text-xs lg:text-sm text-[#172B2A]">
            {data.map((row, idx) => (
              <tr
                key={keyExtractor(row, idx)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors hover:bg-[#F4F5F1]/60 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3 px-3.5 align-middle ${
                      col.align === 'right'
                        ? 'text-right tabular-nums'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {col.render(row, idx)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / Tablet / Compact Desktop Card Grid (< 1280px) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:hidden">
        {data.map((row, idx) => (
          <div
            key={keyExtractor(row, idx)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`p-4 bg-white border border-[#D9DFDA] rounded-xl shadow-xs ${
              onRowClick ? 'cursor-pointer active:bg-[#F4F5F1]' : ''
            }`}
          >
            {renderMobileCard(row, idx)}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * AppShell Component
 * Implements Desktop fixed left sidebar + clean sticky context top bar,
 * and Mobile/Tablet compact top bar + 5-item bottom navigation bar.
 */
interface NavItemConfig {
  id: ViewRoute;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string; strokeWidth?: number }>;
  mobileBar?: boolean;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'ruas',
    label: 'Manajemen Ruas',
    shortLabel: 'Ruas',
    icon: Layers,
    mobileBar: true,
  },
  {
    id: 'input',
    label: 'Input Survei Segmen',
    shortLabel: 'Input',
    icon: FileSpreadsheet,
    mobileBar: true,
  },
  {
    id: 'kelengkapan',
    label: 'Pemeriksaan Kelengkapan',
    shortLabel: 'Audit',
    icon: ClipboardCheck,
    mobileBar: true,
  },
  {
    id: 'analisis',
    label: 'Eksekusi & Riwayat Analisis',
    shortLabel: 'Analisis',
    icon: PlayCircle,
    mobileBar: false,
  },
  {
    id: 'hasil',
    label: 'Dashboard Hasil & Output',
    shortLabel: 'Hasil',
    icon: BarChart3,
    mobileBar: true,
  },
  {
    id: 'simulasi',
    label: 'Skenario & Simulasi',
    shortLabel: 'Simulasi',
    icon: Sliders,
    mobileBar: false,
  },
  {
    id: 'laporan',
    label: 'Pusat Laporan & PDF',
    shortLabel: 'Laporan',
    icon: FileText,
    mobileBar: true,
  },
];

export const AppShell: React.FC<{
  activeView: ViewRoute;
  onNavigate: (view: ViewRoute) => void;
  activeRuas?: RoadRuas;
  activeSegment?: RoadSegment;
  ruasList: RoadRuas[];
  onSelectRuas: (ruasId: string) => void;
  children: React.ReactNode;
}> = ({
  activeView,
  onNavigate,
  activeRuas,
  activeSegment,
  ruasList,
  onSelectRuas,
  children,
}) => {
  const mobileBottomItems = NAV_ITEMS.filter((item) => item.mobileBar);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F4F5F1] text-[#172B2A] lg:flex">
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-white border-r border-[#D9DFDA] flex-col justify-between z-30 no-print">
        <div>
          {/* Brand Lockup */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-[#D9DFDA]">
            <button
              type="button"
              onClick={() => onNavigate('ruas')}
              className="flex items-center gap-2.5 text-left focus:outline-none"
            >
              <div className="w-8 h-8 rounded-lg bg-[#17635C] text-white flex items-center justify-center font-bold text-sm tracking-tight">
                JB
              </div>
              <div>
                <div className="text-base font-bold tracking-tight text-[#172B2A] leading-none">
                  Jalan Beta
                </div>
                <div className="text-[11px] text-[#52615D] mt-1">
                  Analitik Perkerasan Jalan
                </div>
              </div>
            </button>
          </div>

          {/* Navigation Menu */}
          <nav aria-label="Menu Utama" className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#17635C] text-white'
                      : 'text-[#52615D] hover:bg-[#F4F5F1] hover:text-[#172B2A]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Active Road Quick Context Footer */}
        <div className="p-4 border-t border-[#D9DFDA] bg-[#F4F5F1]/60 space-y-2">
          <label
            htmlFor="sidebar-ruas-select"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[#52615D]"
          >
            Koridor Ruas Aktif
          </label>
          <select
            id="sidebar-ruas-select"
            value={activeRuas?.id || ''}
            onChange={(e) => onSelectRuas(e.target.value)}
            className="w-full px-2.5 py-2 text-xs font-medium bg-white border border-[#D9DFDA] rounded-lg text-[#172B2A] focus:outline-none focus:border-[#17635C]"
          >
            {ruasList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
          {activeRuas && (
            <div className="flex items-center justify-between text-xs text-[#52615D] pt-1">
              <span>Panjang Ruas</span>
              <span className="font-mono font-semibold text-[#172B2A] tabular-nums">
                {activeRuas.staEndM - activeRuas.staStartM} m ({activeRuas.segments.length} segmen)
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area Wrapper */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Desktop Sticky Top Context Bar */}
        <header className="hidden lg:flex h-16 bg-white/90 backdrop-blur border-b border-[#D9DFDA] px-6 items-center justify-between gap-6 sticky top-0 z-20 no-print">
          {/* Left: Active Corridor Badge & Total Length */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-[#172B2A] truncate">
              {activeRuas ? `${activeRuas.code} · ${activeRuas.name}` : 'Koridor Jalan Beta'}
            </span>
            {activeRuas && (
              <span className="text-xs font-mono tabular-nums text-[#52615D] whitespace-nowrap shrink-0">
                · {activeRuas.staEndM - activeRuas.staStartM} m · {activeRuas.segments.length} Segmen
              </span>
            )}
          </div>

          {/* Right: Compact Local Persistence Indicator */}
          <div className="flex items-center gap-2 text-xs font-medium text-[#52615D] whitespace-nowrap shrink-0">
            <CheckCircle2 className="w-4 h-4 text-[#17635C] shrink-0" strokeWidth={1.75} />
            <span>Data Tersimpan Lokal</span>
          </div>
        </header>

        {/* Mobile / Tablet Compact Sticky Top Bar (< lg) */}
        <header className="flex lg:hidden h-14 bg-white/95 backdrop-blur border-b border-[#D9DFDA] px-4 items-center justify-between gap-2 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#17635C] text-white flex items-center justify-center font-bold text-xs shrink-0">
              JB
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#172B2A] truncate">
                {activeRuas ? `${activeRuas.code} · ${activeRuas.name}` : 'Jalan Beta'}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-[#52615D] truncate">
                {activeSegment ? `STA ${activeSegment.staLabel}` : 'Manajemen Perkerasan'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('analisis')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${
                activeView === 'analisis'
                  ? 'bg-[#17635C] text-white border-[#17635C]'
                  : 'bg-white text-[#52615D] border-[#D9DFDA]'
              }`}
            >
              Analisis
            </button>
            <button
              type="button"
              onClick={() => onNavigate('simulasi')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${
                activeView === 'simulasi'
                  ? 'bg-[#17635C] text-white border-[#17635C]'
                  : 'bg-white text-[#52615D] border-[#D9DFDA]'
              }`}
            >
              Simulasi
            </button>
          </div>
        </header>

        {/* Scrollable Main Workspace */}
        <main className="w-full max-w-7xl mx-auto p-4 pb-24 lg:p-8 space-y-4 lg:space-y-6 min-w-0 flex-1 print-container">
          {children}
        </main>

        {/* Mobile/Tablet Fixed 5-Item Bottom Navigation Bar (< lg) */}
        <nav
          aria-label="Navigasi Bawah"
          className="lg:hidden h-16 bg-white border-t border-[#D9DFDA] fixed bottom-0 inset-x-0 z-40 flex justify-around items-center px-1 no-print"
        >
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center justify-center min-w-[56px] py-1 rounded-lg transition-colors ${
                  isActive ? 'text-[#17635C] font-semibold' : 'text-[#52615D]'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.75} />
                <span className="text-[11px] mt-0.5 whitespace-nowrap">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
