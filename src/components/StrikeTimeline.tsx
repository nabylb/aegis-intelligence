"use client";

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { IntelEvent } from '@/lib/types';
import { Flame, ChevronUp, ChevronDown, MapPin, Clock, Crosshair } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface StrikeTimelineProps {
  events: IntelEvent[];
  onFlyTo: (lng: number, lat: number) => void;
  historicalFilterDays: number;
}

export default function StrikeTimeline({ events, onFlyTo, historicalFilterDays }: StrikeTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedStrike, setSelectedStrike] = useState<IntelEvent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter to only strikes/conflicts with GPS coordinates
  const strikeEvents = useMemo(() => {
    const cutoff = historicalFilterDays > 0
      ? new Date(Date.now() - historicalFilterDays * 86400000)
      : null;

    return events
      .filter(e => {
        if (e.type !== 'strike' && e.type !== 'conflict') return false;
        if (!e.location) return false;
        // Skip the macro baseline aggregates (they're not real individual strikes)
        if (e.id.startsWith('public-baseline-')) return false;
        if (cutoff && new Date(e.timestamp) < cutoff) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events, historicalFilterDays]);

  // Group strikes by date for the timeline
  const groupedByDate = useMemo(() => {
    const groups: Record<string, IntelEvent[]> = {};
    strikeEvents.forEach(evt => {
      const dateKey = format(new Date(evt.timestamp), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(evt);
    });
    return groups;
  }, [strikeEvents]);

  const dateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  if (strikeEvents.length === 0) return null;

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 border-red-400 shadow-red-500/50';
      case 'high': return 'bg-orange-500 border-orange-400 shadow-orange-500/50';
      case 'medium': return 'bg-yellow-500 border-yellow-400 shadow-yellow-500/30';
      default: return 'bg-neutral-500 border-neutral-400';
    }
  };

  const severityGlow = (severity: string) => {
    switch (severity) {
      case 'critical': return 'ring-red-500/30 bg-red-950/60 border-red-900/60 hover:bg-red-950/80';
      case 'high': return 'ring-orange-500/20 bg-orange-950/40 border-orange-900/40 hover:bg-orange-950/60';
      case 'medium': return 'ring-yellow-500/10 bg-yellow-950/30 border-yellow-900/30 hover:bg-yellow-950/50';
      default: return 'ring-neutral-500/10 bg-neutral-900/40 border-neutral-800/40 hover:bg-neutral-900/60';
    }
  };

  return (
    <div className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${isExpanded ? 'h-[220px]' : 'h-10'}`}>
      {/* Toggle Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-full flex items-center gap-2 px-4 py-1.5 bg-black/90 backdrop-blur-xl border border-white/10 border-b-0 rounded-t-lg text-[10px] font-bold uppercase tracking-widest text-orange-400 hover:text-orange-300 transition z-40"
      >
        <Crosshair className="w-3.5 h-3.5" />
        KINETIC STRIKE TIMELINE ({strikeEvents.length})
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {isExpanded && (
        <div className="w-full h-full bg-black/90 backdrop-blur-xl border-t border-white/10 flex flex-col">
          {/* Timeline Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <div className="flex items-center gap-3 text-[10px] text-neutral-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Medium</span>
            </div>
            <div className="text-[10px] text-neutral-500">
              {dateKeys.length} day{dateKeys.length !== 1 ? 's' : ''} of kinetic activity | GPS-verified locations
            </div>
          </div>

          {/* Scrollable Timeline */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="flex gap-6 min-w-max h-full">
              {dateKeys.map(dateKey => {
                const dayStrikes = groupedByDate[dateKey];
                const dateObj = new Date(dateKey + 'T12:00:00');
                const isToday = format(new Date(), 'yyyy-MM-dd') === dateKey;

                return (
                  <div key={dateKey} className="flex flex-col min-w-[120px]">
                    {/* Date Header */}
                    <div className={`text-[10px] font-bold tracking-wider mb-2 flex items-center gap-1.5 ${isToday ? 'text-orange-400' : 'text-neutral-500'}`}>
                      <Clock className="w-3 h-3" />
                      {isToday ? 'TODAY' : format(dateObj, 'MMM dd')}
                      <span className="text-neutral-600 font-normal ml-1">({dayStrikes.length})</span>
                    </div>

                    {/* Timeline Rail */}
                    <div className="relative flex-1 flex items-start">
                      {/* Vertical line */}
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10" />

                      {/* Strike dots */}
                      <div className="flex flex-col gap-1.5 pl-3">
                        {dayStrikes.slice(0, 15).map((strike, idx) => (
                          <div
                            key={strike.id}
                            className={`relative flex items-center gap-2 px-2 py-1 rounded-md border cursor-pointer transition-all text-[10px] group ${severityGlow(strike.severity)} ${selectedStrike?.id === strike.id ? 'ring-1' : ''}`}
                            onClick={() => {
                              setSelectedStrike(strike);
                              if (strike.location) onFlyTo(strike.location.lng, strike.location.lat);
                            }}
                          >
                            {/* Connector dot */}
                            <div className={`absolute -left-[14.5px] w-2 h-2 rounded-full border shadow-sm ${severityColor(strike.severity)}`} />

                            {/* Strike Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-neutral-200 truncate max-w-[180px] group-hover:text-white transition">
                                {strike.location?.name || strike.title.slice(0, 40)}
                              </div>
                              <div className="flex items-center gap-2 text-[9px] text-neutral-500">
                                <span>{format(new Date(strike.timestamp), 'HH:mm')}</span>
                                {strike.fatalities && strike.fatalities > 0 && (
                                  <span className="text-red-400 font-bold">{strike.fatalities} KIA</span>
                                )}
                                {strike.source.includes('ACLED') && (
                                  <span className="text-emerald-600">GPS</span>
                                )}
                                {strike.source.includes('GDELT GEO') && (
                                  <span className="text-blue-600">GEO</span>
                                )}
                              </div>
                            </div>

                            {/* Fly-to indicator */}
                            {strike.location && (
                              <MapPin className="w-3 h-3 text-neutral-600 group-hover:text-orange-400 transition flex-shrink-0" />
                            )}
                          </div>
                        ))}
                        {dayStrikes.length > 15 && (
                          <div className="text-[9px] text-neutral-600 pl-2">+{dayStrikes.length - 15} more</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Strike Detail Bar */}
          {selectedStrike && (
            <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex items-center gap-4 text-[10px]">
              <div className={`w-2 h-2 rounded-full ${severityColor(selectedStrike.severity)}`} />
              <span className="text-neutral-200 font-medium truncate max-w-[300px]">{selectedStrike.title}</span>
              <span className="text-neutral-500">{selectedStrike.source}</span>
              {selectedStrike.location && (
                <span className="text-neutral-500 font-mono">
                  {selectedStrike.location.lat.toFixed(4)}, {selectedStrike.location.lng.toFixed(4)}
                </span>
              )}
              {selectedStrike.fatalities && selectedStrike.fatalities > 0 && (
                <span className="text-red-400 font-bold">{selectedStrike.fatalities.toLocaleString()} fatalities</span>
              )}
              <span className="text-neutral-600">{formatDistanceToNow(new Date(selectedStrike.timestamp), { addSuffix: true })}</span>
              <button onClick={() => setSelectedStrike(null)} className="ml-auto text-neutral-600 hover:text-white transition">x</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
