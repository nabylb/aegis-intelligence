"use client";

import React, { useMemo, useState, useRef } from 'react';
import { IntelEvent } from '@/lib/types';
import { MapPin, Clock, Crosshair, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface StrikeTimelineProps {
  events: IntelEvent[];
  onFlyTo: (lng: number, lat: number) => void;
  historicalFilterDays: number;
  sigintWidth: number; // px width of the SIGINT sidebar
}

export default function StrikeTimeline({ events, onFlyTo, historicalFilterDays, sigintWidth }: StrikeTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedStrike, setSelectedStrike] = useState<IntelEvent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const strikeEvents = useMemo(() => {
    const cutoff = historicalFilterDays > 0
      ? new Date(Date.now() - historicalFilterDays * 86400000)
      : null;

    return events
      .filter(e => {
        if (e.type !== 'strike' && e.type !== 'conflict') return false;
        if (!e.location) return false;
        if (e.id.startsWith('public-baseline-')) return false;
        if (cutoff && new Date(e.timestamp) < cutoff) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events, historicalFilterDays]);

  // Group by LOCAL date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, IntelEvent[]> = {};
    strikeEvents.forEach(evt => {
      const d = new Date(evt.timestamp);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(evt);
    });
    return groups;
  }, [strikeEvents]);

  const dateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  if (strikeEvents.length === 0) return null;

  const severityDot = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-neutral-500';
    }
  };

  const severityGlow = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-950/50 border-red-900/50 hover:bg-red-950/70';
      case 'high': return 'bg-orange-950/30 border-orange-900/30 hover:bg-orange-950/50';
      case 'medium': return 'bg-yellow-950/20 border-yellow-900/20 hover:bg-yellow-950/40';
      default: return 'bg-neutral-900/30 border-neutral-800/30 hover:bg-neutral-900/50';
    }
  };

  // Position: to the right of the SIGINT sidebar + 16px gap
  const leftOffset = sigintWidth + 20;

  return (
    <>
      {/* Collapsed toggle tab */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          style={{ left: leftOffset }}
          className="absolute top-20 z-20 flex items-center gap-1 px-2 py-6 bg-black/80 backdrop-blur-xl border border-white/10 rounded-r-lg text-[9px] font-bold uppercase tracking-widest text-orange-400 hover:text-orange-300 transition shadow-lg writing-mode-vertical"
        >
          <Crosshair className="w-3 h-3 mb-1" />
          <span className="[writing-mode:vertical-lr] rotate-180">STRIKES ({strikeEvents.length})</span>
          <ChevronRight className="w-3 h-3 mt-1" />
        </button>
      )}

      {/* Expanded sidebar */}
      {isExpanded && (
        <aside
          style={{ left: leftOffset }}
          className="absolute top-20 bottom-4 w-72 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl z-20 flex flex-col overflow-hidden shadow-2xl transition-all duration-300"
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crosshair className="w-3.5 h-3.5 text-orange-500" />
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-neutral-200">Kinetic Strikes</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full border border-orange-500/30">
                {strikeEvents.length}
              </span>
              <button onClick={() => setIsExpanded(false)} className="text-neutral-500 hover:text-white transition">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 text-[8px] text-neutral-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> CRIT</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> HIGH</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> MED</span>
            <span className="ml-auto">{dateKeys.length}d</span>
          </div>

          {/* Scrollable vertical timeline */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {dateKeys.map(dateKey => {
              const dayStrikes = groupedByDate[dateKey];
              const dateObj = new Date(dateKey + 'T12:00:00');
              const now = new Date();
              const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
              const isToday = todayKey === dateKey;

              return (
                <div key={dateKey}>
                  {/* Date header */}
                  <div className={`text-[9px] font-bold tracking-wider mb-1.5 flex items-center gap-1.5 sticky top-0 bg-black/80 backdrop-blur-sm py-1 -mx-1 px-1 z-10 ${isToday ? 'text-orange-400' : 'text-neutral-500'}`}>
                    <Clock className="w-3 h-3" />
                    {isToday ? 'TODAY' : format(dateObj, 'EEE, MMM dd')}
                    <span className="text-neutral-600 font-normal">({dayStrikes.length})</span>
                  </div>

                  {/* Strike items */}
                  <div className="space-y-1 pl-2 border-l border-white/10 ml-1">
                    {dayStrikes.map((strike) => (
                      <div
                        key={strike.id}
                        className={`relative flex items-start gap-2 px-2 py-1.5 rounded-md border cursor-pointer transition-all text-[9px] group ${severityGlow(strike.severity)} ${selectedStrike?.id === strike.id ? 'ring-1 ring-orange-500/40' : ''}`}
                        onClick={() => {
                          setSelectedStrike(strike);
                          if (strike.location) onFlyTo(strike.location.lng, strike.location.lat);
                        }}
                      >
                        {/* Connector dot on the timeline rail */}
                        <div className={`absolute -left-[9px] top-3 w-2 h-2 rounded-full ${severityDot(strike.severity)} shadow-sm`} />

                        <div className="flex-1 min-w-0">
                          {/* Title — event type or location */}
                          <div className="font-medium text-neutral-200 group-hover:text-white transition text-[10px] leading-tight">
                            {strike.title.length > 50 ? strike.title.slice(0, 48) + '...' : strike.title}
                          </div>
                          {/* Location name */}
                          {strike.location?.name && (
                            <div className="text-[8px] text-neutral-400 mt-0.5 truncate">
                              {strike.location.name}
                            </div>
                          )}
                          {/* Meta row: time, fatalities, CAMEO/source */}
                          <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0 text-[8px] text-neutral-500 mt-0.5">
                            <span>{new Date(strike.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {strike.fatalities && strike.fatalities > 0 && (
                              <span className="text-red-400 font-bold">{strike.fatalities} KIA</span>
                            )}
                            {/* Extract CAMEO code from summary if available */}
                            {strike.summary?.includes('CAMEO') && (
                              <span className="text-orange-600">{strike.summary.split('|')[0]?.trim()}</span>
                            )}
                            {/* Goldstein score if available */}
                            {strike.summary?.includes('Goldstein') && (() => {
                              const gMatch = strike.summary?.match(/Goldstein:\s*(-?[\d.]+)/);
                              if (gMatch) {
                                const g = parseFloat(gMatch[1]);
                                return <span className={g < -5 ? 'text-red-500' : 'text-neutral-600'}>G:{g.toFixed(0)}</span>;
                              }
                              return null;
                            })()}
                          </div>
                          {/* Source link */}
                          {strike.sourceUrl && (
                            <a
                              href={strike.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[7px] text-blue-500/60 hover:text-blue-400 mt-0.5 block truncate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {strike.sourceUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                            </a>
                          )}
                        </div>

                        <MapPin className="w-3 h-3 text-neutral-700 group-hover:text-orange-400 transition flex-shrink-0 mt-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected strike detail */}
          {selectedStrike && (
            <div className="px-3 py-2 border-t border-white/5 bg-white/[0.02] text-[9px]">
              <div className="flex items-start justify-between mb-1">
                <span className="text-neutral-200 font-medium leading-tight">{selectedStrike.title.slice(0, 60)}</span>
                <button onClick={() => setSelectedStrike(null)} className="text-neutral-600 hover:text-white transition ml-1 flex-shrink-0">x</button>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[8px] text-neutral-500">
                {selectedStrike.location && (
                  <span className="font-mono">{selectedStrike.location.lat.toFixed(4)}, {selectedStrike.location.lng.toFixed(4)}</span>
                )}
                <span>{selectedStrike.source}</span>
                <span>{formatDistanceToNow(new Date(selectedStrike.timestamp), { addSuffix: true })}</span>
                {selectedStrike.fatalities && selectedStrike.fatalities > 0 && (
                  <span className="text-red-400 font-bold">{selectedStrike.fatalities.toLocaleString()} fatalities</span>
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
