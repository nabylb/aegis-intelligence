"use client";

import React, { useMemo, useState } from 'react';
import {
  Link2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Users,
  Shield,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { IntelEvent, IntelSeverity } from '@/lib/types';
import { IncidentThread, resolveIncidents } from '@/lib/incidents';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IncidentThreadsProps {
  events: IntelEvent[];
  onFlyTo: (lng: number, lat: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_ABBREV: Record<string, string> = {
  'ACLED': 'ACLED',
  'GDELT': 'GDELT',
  'Reuters': 'RTR',
  'AP News': 'AP',
  'BBC News': 'BBC',
  'Al Jazeera': 'AJZ',
  'OpenSky': 'AIS',
  'Global AIS Satellite': 'GAIS',
  'Sentinel Hub': 'SAT',
};

function abbrevSource(source: string): string {
  return SOURCE_ABBREV[source] ?? source.slice(0, 4).toUpperCase();
}

function severityDotClass(severity: IntelSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-500 shadow-red-500/60 shadow-sm';
    case 'high':     return 'bg-orange-500 shadow-orange-500/60 shadow-sm';
    case 'medium':   return 'bg-yellow-500 shadow-yellow-500/60 shadow-sm';
    default:         return 'bg-neutral-500';
  }
}

function severityBorderClass(severity: IntelSeverity): string {
  switch (severity) {
    case 'critical': return 'border-red-900/50 bg-red-950/30 hover:bg-red-950/50';
    case 'high':     return 'border-orange-900/40 bg-orange-950/20 hover:bg-orange-950/40';
    case 'medium':   return 'border-yellow-900/30 bg-yellow-950/15 hover:bg-yellow-950/30';
    default:         return 'border-white/8 bg-white/3 hover:bg-white/6';
  }
}

function severityLabelClass(severity: IntelSeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-400';
    case 'high':     return 'text-orange-400';
    case 'medium':   return 'text-yellow-400';
    default:         return 'text-neutral-400';
  }
}

function confidenceBarClass(confidence: number): string {
  if (confidence > 0.75) return 'bg-emerald-500';
  if (confidence > 0.50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${format(s, 'MMM d HH:mm')} — ${format(e, 'HH:mm')}`;
  }
  return `${format(s, 'MMM d HH:mm')} — ${format(e, 'MMM d HH:mm')}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TimelineGraphProps {
  events: IntelEvent[];
  timeRange: { start: string; end: string };
}

function TimelineGraph({ events, timeRange }: TimelineGraphProps) {
  const startMs = new Date(timeRange.start).getTime();
  const endMs   = new Date(timeRange.end).getTime();
  const spanMs  = endMs - startMs || 1;

  return (
    <div className="relative h-4 w-full mt-2 mb-1">
      <div className="absolute inset-y-[7px] left-0 right-0 h-px bg-white/10" />
      {events.map((evt) => {
        const t = new Date(evt.timestamp).getTime();
        const pct = Math.max(0, Math.min(100, ((t - startMs) / spanMs) * 100));
        return (
          <div
            key={evt.id}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${severityDotClass(evt.severity)} ring-1 ring-black/60`}
            style={{ left: `${pct}%` }}
            title={evt.title}
          />
        );
      })}
      <div className="absolute left-0 -bottom-3 text-[8px] text-neutral-600">
        {format(new Date(timeRange.start), 'HH:mm')}
      </div>
      <div className="absolute right-0 -bottom-3 text-[8px] text-neutral-600">
        {format(new Date(timeRange.end), 'HH:mm')}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread card
// ---------------------------------------------------------------------------

interface ThreadCardProps {
  thread: IncidentThread;
  onFlyTo: (lng: number, lat: number) => void;
}

function ThreadCard({ thread, onFlyTo }: ThreadCardProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleSources = thread.sources.slice(0, 4);
  const overflowCount  = thread.sources.length - 4;

  const truncatedTitle = thread.title.length > 60
    ? thread.title.slice(0, 57) + '...'
    : thread.title;

  return (
    <div
      className={`rounded-lg border transition-all duration-150 ${severityBorderClass(thread.severity)}`}
    >
      {/* Card header — always visible */}
      <button
        className="w-full text-left px-3 py-2.5 flex flex-col gap-1.5"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Row 1: severity dot + title + chevron */}
        <div className="flex items-start gap-2">
          <div className={`mt-[3px] flex-shrink-0 w-1.5 h-1.5 rounded-full ${severityDotClass(thread.severity)}`} />
          <span className="flex-1 text-[10px] font-medium text-neutral-200 leading-tight">
            {truncatedTitle}
          </span>
          <div className="flex-shrink-0 text-neutral-500 mt-0.5">
            {expanded
              ? <ChevronUp className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />
            }
          </div>
        </div>

        {/* Row 2: summary */}
        <div className="pl-3.5">
          <p className="text-[9px] text-neutral-500 leading-snug">{thread.summary}</p>
        </div>

        {/* Row 3: source + type badges */}
        <div className="flex items-center gap-1 flex-wrap pl-3.5">
          {visibleSources.map(src => (
            <span key={src} className="text-[8px] px-1 py-px rounded bg-white/8 border border-white/10 text-neutral-400 font-mono uppercase tracking-wider">
              {abbrevSource(src)}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="text-[8px] px-1 py-px rounded bg-white/5 border border-white/8 text-neutral-500 font-mono">
              +{overflowCount}
            </span>
          )}
          {thread.eventTypes.slice(0, 3).map(t => (
            <span key={t} className="text-[7px] px-1 py-px rounded bg-orange-500/10 border border-orange-500/20 text-orange-400/80 font-mono uppercase tracking-wider">
              {t}
            </span>
          ))}
        </div>

        {/* Row 4: meta row */}
        <div className="flex items-center gap-3 pl-3.5 flex-wrap">
          <span className="flex items-center gap-1 text-[9px] text-neutral-500">
            <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
            {thread.events.length} correlated
          </span>

          {thread.location?.name && (
            <span className="flex items-center gap-1 text-[9px] text-neutral-500 truncate max-w-[100px]">
              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
              {thread.location.name}
            </span>
          )}

          {thread.totalFatalities > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-red-400 font-medium">
              <Users className="w-2.5 h-2.5 flex-shrink-0" />
              {thread.totalFatalities} KIA
            </span>
          )}
        </div>

        {/* Row 4: confidence bar + time range */}
        <div className="pl-3.5 space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/8 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${confidenceBarClass(thread.confidence)}`}
                style={{ width: `${Math.round(thread.confidence * 100)}%` }}
              />
            </div>
            <span className={`text-[8px] font-mono ${confidenceBarClass(thread.confidence).replace('bg-', 'text-')}`}>
              {Math.round(thread.confidence * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-1 text-[8px] text-neutral-600">
            <Clock className="w-2 h-2 flex-shrink-0" />
            {formatTimeRange(thread.timeRange.start, thread.timeRange.end)}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/8 px-3 pt-2 pb-3 space-y-2">
          {/* Timeline graph */}
          <TimelineGraph events={thread.events} timeRange={thread.timeRange} />

          {/* Event list */}
          <div className="mt-5 space-y-px">
            {thread.events.map((evt) => {
              const hasLoc = !!evt.location;
              return (
                <button
                  key={evt.id}
                  className={`w-full text-left flex items-center gap-2 px-1.5 py-1 rounded transition-colors ${
                    hasLoc
                      ? 'hover:bg-white/6 cursor-pointer'
                      : 'cursor-default opacity-70'
                  }`}
                  onClick={() => {
                    if (hasLoc) onFlyTo(evt.location!.lng, evt.location!.lat);
                  }}
                  disabled={!hasLoc}
                >
                  <div className={`flex-shrink-0 w-1 h-1 rounded-full ${severityDotClass(evt.severity)}`} />
                  <span className="text-[8px] font-mono text-neutral-500 w-[52px] flex-shrink-0 tabular-nums">
                    {format(new Date(evt.timestamp), 'HH:mm')}
                  </span>
                  <span className="text-[8px] px-1 py-px rounded bg-white/8 border border-white/10 text-neutral-400 font-mono uppercase tracking-wider flex-shrink-0">
                    {abbrevSource(evt.source)}
                  </span>
                  <span className="text-[9px] text-neutral-300 flex-1 truncate leading-tight">
                    {evt.title.length > 46 ? evt.title.slice(0, 43) + '...' : evt.title}
                  </span>
                  {hasLoc && (
                    <MapPin className="w-2.5 h-2.5 text-neutral-600 hover:text-neutral-300 flex-shrink-0 transition-colors" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Fly to centroid if thread has location */}
          {thread.location && (thread.location.lat !== 0 || thread.location.lng !== 0) && (
            <button
              onClick={() => onFlyTo(thread.location!.lng, thread.location!.lat)}
              className="w-full mt-1 flex items-center justify-center gap-1.5 py-1 rounded border border-white/8 bg-white/4 hover:bg-white/8 text-[8px] text-neutral-400 hover:text-neutral-200 transition-colors font-mono uppercase tracking-wider"
            >
              <MapPin className="w-2.5 h-2.5" />
              Fly to centroid
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function IncidentThreads({ events, onFlyTo }: IncidentThreadsProps) {
  const threads = useMemo(() => resolveIncidents(events), [events]);

  return (
    <div className="space-y-1.5">
      {/* Summary bar */}
      <div className="flex items-center gap-2 px-1 pb-1 border-b border-white/5 text-[8px] text-neutral-500">
        <span>{threads.length} threads</span>
        {threads.length > 0 && (
          <span className="ml-auto font-mono">
            CONF {Math.round((threads.reduce((s, t) => s + t.confidence, 0) / threads.length) * 100)}%
          </span>
        )}
      </div>

      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-neutral-600">
          <Link2 className="w-4 h-4 opacity-40" />
          <span className="text-[9px] uppercase tracking-widest">No correlated incidents</span>
        </div>
      ) : (
        threads.map(thread => (
          <ThreadCard key={thread.id} thread={thread} onFlyTo={onFlyTo} />
        ))
      )}
    </div>
  );
}
