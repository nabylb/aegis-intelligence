"use client";

import React, { useMemo, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, MapPin, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { IntelEvent, IntelSeverity } from '@/lib/types';
import { analyzeEscalation, EscalationAnalysis, EventCluster, Hotspot } from '@/lib/escalation';
import { format } from 'date-fns';

interface EscalationPulseProps {
  events: IntelEvent[];
  onFlyTo: (lng: number, lat: number) => void;
}

const TEMPO_CONFIG = {
  CALM: {
    label: 'CALM',
    color: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
    borderClass: 'border-emerald-500/30',
    glowClass: '',
    bgClass: 'bg-emerald-950/30',
  },
  ELEVATED: {
    label: 'ELEVATED',
    color: 'text-yellow-400',
    dotClass: 'bg-yellow-400',
    borderClass: 'border-yellow-500/30',
    glowClass: '',
    bgClass: 'bg-yellow-950/30',
  },
  SURGE: {
    label: 'SURGE',
    color: 'text-orange-400',
    dotClass: 'bg-orange-400',
    borderClass: 'border-orange-500/30',
    glowClass: '',
    bgClass: 'bg-orange-950/30',
  },
  CRITICAL: {
    label: 'CRITICAL',
    color: 'text-red-400',
    dotClass: 'bg-red-500',
    borderClass: 'border-red-500/40',
    glowClass: 'animate-pulse shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]',
    bgClass: 'bg-red-950/30',
  },
} as const;

const SEVERITY_DOT: Record<IntelSeverity, string> = {
  low: 'bg-neutral-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const SEVERITY_BAR_COLOR: Record<IntelSeverity, string> = {
  low: 'bg-neutral-600',
  medium: 'bg-yellow-600',
  high: 'bg-orange-600',
  critical: 'bg-red-600',
};

function SparkChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1);
  const width = 260;
  const height = 40;
  const barW = (width / data.length) - 1;

  const intensityColor = (v: number): string => {
    const ratio = v / max;
    if (ratio > 0.75) return '#f97316';
    if (ratio > 0.45) return '#eab308';
    if (ratio > 0.15) return '#3b82f6';
    return '#374151';
  };

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * (height - 4);
    return `${x},${y}`;
  });

  const areaPath = [
    `M 0,${height}`,
    ...data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 4);
      return `L ${x},${y}`;
    }),
    `L ${width},${height}`,
    'Z',
  ].join(' ');

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase">Activity</span>
        <span className="text-[9px] font-mono text-neutral-600 tracking-widest">{label}</span>
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ep-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#ep-area-fill)" />
        {data.map((v, i) => {
          const x = i * (barW + 1);
          const barH = Math.max(1, (v / max) * (height - 4));
          return (
            <rect
              key={i}
              x={x}
              y={height - barH}
              width={barW}
              height={barH}
              fill={intensityColor(v)}
              opacity={0.85}
              rx={1}
            />
          );
        })}
        {points.length > 1 && (
          <polyline
            points={points.join(' ')}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1"
            strokeOpacity="0.5"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}

function AccelerationIcon({ acceleration }: { acceleration: number }) {
  if (acceleration > 1.2) return <TrendingUp size={12} className="text-red-400" />;
  if (acceleration < 0.7) return <TrendingDown size={12} className="text-emerald-400" />;
  return <Minus size={12} className="text-neutral-500" />;
}

function formatTimeRange(start: string, end: string): string {
  try {
    const s = format(new Date(start), 'HHmm');
    const e = format(new Date(end), 'HHmm');
    return `${s}–${e}Z`;
  } catch {
    return '';
  }
}

function ClusterCard({ cluster, onFlyTo }: { cluster: EventCluster; onFlyTo: (lng: number, lat: number) => void }) {
  return (
    <button
      onClick={() => onFlyTo(cluster.centroid.lng, cluster.centroid.lat)}
      className="w-full text-left px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/10 transition-colors group"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[cluster.peakSeverity]}`} />
          <span className="text-[10px] font-mono text-neutral-200 truncate leading-tight">{cluster.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[9px] font-mono text-neutral-500">{cluster.count}ev</span>
          <MapPin size={8} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
        </div>
      </div>
      <div className="mt-0.5 pl-3">
        <span className="text-[9px] font-mono text-neutral-600 tabular-nums">
          {formatTimeRange(cluster.timeRange.start, cluster.timeRange.end)}
        </span>
      </div>
    </button>
  );
}

function HotspotRow({ hotspot, rank, onFlyTo }: { hotspot: Hotspot; rank: number; onFlyTo: (lng: number, lat: number) => void }) {
  const barWidth = `${Math.min(100, (hotspot.count / 30) * 100)}%`;

  return (
    <button
      onClick={() => onFlyTo(hotspot.lng, hotspot.lat)}
      className="w-full text-left group"
    >
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono text-neutral-600 w-3 flex-shrink-0 tabular-nums">{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[10px] font-mono text-neutral-300 truncate group-hover:text-neutral-100 transition-colors">
              {hotspot.name ?? `${hotspot.lat.toFixed(1)}°, ${hotspot.lng.toFixed(1)}°`}
            </span>
            <span className="text-[9px] font-mono text-neutral-500 flex-shrink-0 tabular-nums">{hotspot.count}</span>
          </div>
          <div className="h-px bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${SEVERITY_BAR_COLOR[hotspot.severity]}`}
              style={{ width: barWidth }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function EscalationPulse({ events, onFlyTo }: EscalationPulseProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const analysis = useMemo<EscalationAnalysis>(
    () => analyzeEscalation(events),
    [events]
  );

  const tempo = TEMPO_CONFIG[analysis.threatTempo];
  const hasClusters = analysis.clusters.length > 0;
  const hasHotspots = analysis.hotspots.length > 0;

  return (
    <div
      className="w-full rounded-xl border border-white/10 bg-black/40 overflow-hidden"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
    >
      {/* Header */}
      <div className={`px-3 py-2 border-b border-white/[0.07] flex items-center justify-between ${tempo.bgClass}`}>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${tempo.dotClass} ${tempo.glowClass}`}
          />
          <span className="text-[9px] font-mono text-neutral-400 tracking-widest uppercase">Threat Tempo</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity size={10} className="text-neutral-600" />
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="text-neutral-600 hover:text-neutral-300 transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Tempo badge */}
      <div className={`px-3 pt-2.5 pb-2 border-b border-white/[0.05] flex items-center justify-between ${tempo.bgClass}`}>
        <div className="flex items-baseline gap-2">
          <span className={`text-[22px] font-mono font-bold tracking-tight leading-none ${tempo.color}`}>
            {analysis.threatTempo}
          </span>
          <AccelerationIcon acceleration={analysis.acceleration} />
        </div>
        <div className="text-right">
          <div className="text-[9px] font-mono text-neutral-600 tracking-widest uppercase">Acceleration</div>
          <div className="text-[10px] font-mono text-neutral-400 tabular-nums">
            {analysis.acceleration > 0 ? '+' : ''}{analysis.acceleration.toFixed(2)}x
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 py-2.5 space-y-3">
          {/* Spark chart */}
          <SparkChart data={analysis.trend24h} label="24H" />

          {/* Clusters */}
          {hasClusters && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap size={9} className="text-neutral-600" />
                <span className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase">
                  Active Clusters
                </span>
                <span className="text-[9px] font-mono text-neutral-700 ml-auto tabular-nums">
                  {analysis.clusters.length}
                </span>
              </div>
              <div className="space-y-1">
                {analysis.clusters.slice(0, 4).map((cluster) => (
                  <ClusterCard
                    key={cluster.eventIds[0] ?? cluster.name}
                    cluster={cluster}
                    onFlyTo={onFlyTo}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Hotspots */}
          {hasHotspots && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin size={9} className="text-neutral-600" />
                <span className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase">
                  Top Hotspots
                </span>
              </div>
              <div className="space-y-2">
                {analysis.hotspots.slice(0, 3).map((hotspot, i) => (
                  <HotspotRow
                    key={`${hotspot.lat}-${hotspot.lng}`}
                    hotspot={hotspot}
                    rank={i + 1}
                    onFlyTo={onFlyTo}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasClusters && !hasHotspots && (
            <div className="py-2 text-center">
              <span className="text-[9px] font-mono text-neutral-700 tracking-widest uppercase">
                No significant activity
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
