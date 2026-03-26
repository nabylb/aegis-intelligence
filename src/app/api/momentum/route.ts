import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── MULTI-FACTOR STRATEGIC MOMENTUM ENGINE ──────────────────────────────────
// Calculates a balanced 0-100% score across 6 independent factors.
// 50% = stalemate. <50% = US/Israel advantage. >50% = Iran/Proxy advantage.
//
// Factors:
//  1. Oil/Energy (20%) — crude price movement vs 7-day avg
//  2. Kinetic Balance (25%) — GDELT CAMEO actor-coded military events
//  3. Currency Stress (15%) — ILS weakening, IRR stability
//  4. Shipping Disruption (15%) — GDELT article volume for Red Sea/Hormuz
//  5. Diplomatic Signals (15%) — UN/diplomacy tone analysis
//  6. Cyber/Info Warfare (10%) — info-op and cyber attack volume

interface FactorResult { score: number; detail: string }

interface MomentumFactors {
  oil: FactorResult;
  kinetic: FactorResult;
  currency: FactorResult;
  shipping: FactorResult;
  diplomatic: FactorResult;
  cyber: FactorResult;
}

interface MomentumSnapshot {
  factors: MomentumFactors;
  composite: number;
  timestamp: number;
}

// ─── TREND HISTORY ─────────────────────────────────────────────────────────
// Store hourly snapshots for 7 days (168 entries max)
const trendHistory: Array<{ composite: number; timestamp: number }> = [];
const MAX_TREND_ENTRIES = 168;

let cachedMomentum: MomentumSnapshot | null = null;

export async function GET() {
  // Cache for 10 minutes
  if (cachedMomentum && Date.now() - cachedMomentum.timestamp < 600000) {
    return NextResponse.json({ ...cachedMomentum, trend: trendHistory }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
    });
  }

  const [oil, currency, shipping, kinetic, diplomatic, cyber] = await Promise.allSettled([
    calculateOilFactor(),
    calculateCurrencyFactor(),
    calculateShippingFactor(),
    calculateKineticFactor(),
    calculateDiplomaticFactor(),
    calculateCyberFactor(),
  ]);

  const factors: MomentumFactors = {
    oil: oil.status === 'fulfilled' ? oil.value : { score: 0, detail: 'Oil data unavailable' },
    kinetic: kinetic.status === 'fulfilled' ? kinetic.value : { score: 0, detail: 'Kinetic data unavailable' },
    currency: currency.status === 'fulfilled' ? currency.value : { score: 0, detail: 'Currency data unavailable' },
    shipping: shipping.status === 'fulfilled' ? shipping.value : { score: 0, detail: 'Shipping data unavailable' },
    diplomatic: diplomatic.status === 'fulfilled' ? diplomatic.value : { score: 0, detail: 'Diplomatic data unavailable' },
    cyber: cyber.status === 'fulfilled' ? cyber.value : { score: 0, detail: 'Cyber data unavailable' },
  };

  const weights = { oil: 0.20, kinetic: 0.25, currency: 0.15, shipping: 0.15, diplomatic: 0.15, cyber: 0.10 };
  const weighted =
    factors.oil.score * weights.oil +
    factors.kinetic.score * weights.kinetic +
    factors.currency.score * weights.currency +
    factors.shipping.score * weights.shipping +
    factors.diplomatic.score * weights.diplomatic +
    factors.cyber.score * weights.cyber;

  // tanh sigmoid — compresses extremes, prevents 100% one-sided results
  const composite = 50 + (Math.tanh(weighted / 3) * 50);
  const clampedComposite = Math.max(0, Math.min(100, composite));

  cachedMomentum = { factors, composite: clampedComposite, timestamp: Date.now() };

  // Append to trend (at most once per 10 minutes due to cache)
  const lastEntry = trendHistory[trendHistory.length - 1];
  if (!lastEntry || Date.now() - lastEntry.timestamp > 540000) {
    trendHistory.push({ composite: clampedComposite, timestamp: Date.now() });
    if (trendHistory.length > MAX_TREND_ENTRIES) trendHistory.shift();
  }

  return NextResponse.json({ ...cachedMomentum, trend: trendHistory }, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
  });
}

// ─── FACTOR 1: OIL/ENERGY DISRUPTION ────────────────────────────────────────
async function calculateOilFactor(): Promise<FactorResult> {
  try {
    const url = 'https://query2.finance.yahoo.com/v8/finance/chart/CL=F?interval=1d&range=1mo';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return { score: 0, detail: 'Yahoo Finance unavailable' };

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return { score: 0, detail: 'No oil data' };

    const prices = result.indicators.quote[0].close.filter((p: number | null) => p !== null);
    if (prices.length < 7) return { score: 0, detail: 'Insufficient price history' };

    const current = result.meta.regularMarketPrice;
    const last7 = prices.slice(-7);
    const avg7 = last7.reduce((a: number, b: number) => a + b, 0) / last7.length;
    const change = ((current - avg7) / avg7) * 100;

    let score = 0;
    if (change > 10) score = 5;
    else if (change > 5) score = 3;
    else if (change > 2) score = 1;
    else if (change < -10) score = -5;
    else if (change < -5) score = -3;
    else if (change < -2) score = -1;

    return { score, detail: `WTI $${current.toFixed(2)} (${change > 0 ? '+' : ''}${change.toFixed(1)}% vs 7d avg)` };
  } catch {
    return { score: 0, detail: 'Oil fetch failed' };
  }
}

// ─── FACTOR 2: KINETIC BALANCE (GDELT CAMEO) ─────────────────────────────────
async function calculateKineticFactor(): Promise<FactorResult> {
  try {
    const manifestResp = await fetch('http://data.gdeltproject.org/gdeltv2/lastupdate.txt');
    if (!manifestResp.ok) return { score: 0, detail: 'GDELT manifest unavailable' };
    const manifest = await manifestResp.text();
    const exportMatch = manifest.match(/(http[^\s]+\.export\.CSV\.zip)/);
    if (!exportMatch) return { score: 0, detail: 'No GDELT export' };

    const zipResp = await fetch(exportMatch[1]);
    if (!zipResp.ok) return { score: 0, detail: 'GDELT export download failed' };

    const zipBuffer = Buffer.from(await zipResp.arrayBuffer());
    const csvText = await decompressZip(zipBuffer);
    if (!csvText) return { score: 0, detail: 'GDELT decompress failed' };

    let iranProxy = 0;
    let usIsrael = 0;

    for (const line of csvText.split('\n')) {
      const cols = line.split('\t');
      if (cols.length < 61) continue;
      const eventCode = cols[26] || '';
      if (!eventCode.match(/^(18|19|20)/)) continue;

      const actor1Country = (cols[7] || '').toUpperCase();
      const actor2Country = (cols[17] || '').toUpperCase();

      if (['IRN', 'YEM', 'LBN', 'SYR', 'IRQ'].includes(actor1Country)) iranProxy++;
      if (['ISR', 'USA', 'GBR'].includes(actor1Country)) usIsrael++;
      if (['ISR', 'USA', 'GBR'].includes(actor2Country)) iranProxy++;
      if (['IRN', 'YEM', 'LBN'].includes(actor2Country)) usIsrael++;
    }

    const total = iranProxy + usIsrael;
    if (total === 0) return { score: 0, detail: 'No kinetic events in latest window' };

    const ratio = (iranProxy - usIsrael) / total;
    const score = Math.round(ratio * 5);

    return { score, detail: `Iran/Proxy: ${iranProxy} events, US/IL: ${usIsrael} events` };
  } catch {
    return { score: 0, detail: 'Kinetic calc failed' };
  }
}

// ─── FACTOR 3: CURRENCY STRESS ──────────────────────────────────────────────
async function calculateCurrencyFactor(): Promise<FactorResult> {
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    if (!res.ok) return { score: 0, detail: 'Currency API unavailable' };
    const data = await res.json();
    const currentILS = data?.usd?.ils;
    if (!currentILS) return { score: 0, detail: 'No ILS rate' };

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const histRes = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${weekAgo}/v1/currencies/usd.json`).catch(() => null);

    let prevILS = currentILS;
    if (histRes && histRes.ok) {
      const histData = await histRes.json().catch(() => null);
      if (histData?.usd?.ils) prevILS = histData.usd.ils;
    }

    const ilsChange = ((currentILS - prevILS) / prevILS) * 100;

    let score = 0;
    if (ilsChange > 4) score = 4;
    else if (ilsChange > 2) score = 2;
    else if (ilsChange > 0.5) score = 1;
    else if (ilsChange < -4) score = -4;
    else if (ilsChange < -2) score = -2;
    else if (ilsChange < -0.5) score = -1;

    let vixDetail = '';
    try {
      const vixRes = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (vixRes.ok) {
        const vixData = await vixRes.json();
        const vix = vixData?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (vix) {
          if (vix > 40) score += 2;
          else if (vix > 30) score += 1;
          vixDetail = ` | VIX: ${vix.toFixed(1)}`;
        }
      }
    } catch {}

    score = Math.max(-5, Math.min(5, score));
    return { score, detail: `ILS/USD: ${currentILS.toFixed(3)} (${ilsChange > 0 ? '+' : ''}${ilsChange.toFixed(1)}% 7d)${vixDetail}` };
  } catch {
    return { score: 0, detail: 'Currency calc failed' };
  }
}

// ─── FACTOR 4: SHIPPING DISRUPTION ──────────────────────────────────────────
async function calculateShippingFactor(): Promise<FactorResult> {
  try {
    const query = encodeURIComponent('("shipping disruption" OR "red sea attack" OR "houthi ship" OR "strait of hormuz" OR "tanker attack" OR "bab el mandeb")');
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=timelinevol&timespan=30d&format=json`;

    const res = await fetch(url);
    if (!res.ok) return { score: 0, detail: 'GDELT timeline unavailable' };

    const text = await res.text();
    const data = JSON.parse(text);
    const series = data?.timeline;
    if (!series || !Array.isArray(series) || series.length === 0) return { score: 0, detail: 'No shipping timeline' };
    const timeline = series[0]?.data;
    if (!timeline || timeline.length < 14) return { score: 0, detail: 'Insufficient shipping data' };

    const recent7 = timeline.slice(-7).reduce((a: number, d: any) => a + (d.value || 0), 0) / 7;
    const older = timeline.slice(0, -7).reduce((a: number, d: any) => a + (d.value || 0), 0) / Math.max(1, timeline.length - 7);

    if (older === 0) return { score: 0, detail: 'No baseline shipping data' };

    const spike = recent7 / older;

    let score = 0;
    if (spike > 4) score = 5;
    else if (spike > 2) score = 3;
    else if (spike > 1.5) score = 1;
    else if (spike < 0.5) score = -2;

    return { score, detail: `Disruption index: ${spike.toFixed(1)}x baseline (7d vs 30d avg)` };
  } catch {
    return { score: 0, detail: 'Shipping calc failed' };
  }
}

// ─── FACTOR 5: DIPLOMATIC SIGNALS ───────────────────────────────────────────
// Tracks diplomatic activity: UN sessions, negotiations, sanctions talk.
// High diplomatic volume with negative tone = escalation risk (Iran advantage)
// Positive diplomatic tone (ceasefire, agreement) = de-escalation (US advantage)
async function calculateDiplomaticFactor(): Promise<FactorResult> {
  try {
    // GDELT tone analysis for diplomatic keywords
    const escalationQuery = encodeURIComponent('("UN Security Council" OR "emergency session" OR "sanctions" OR "diplomatic crisis" OR "ambassador recalled" OR "severed relations") (iran OR israel OR middle east)');
    const deescQuery = encodeURIComponent('("ceasefire" OR "peace talks" OR "diplomatic solution" OR "agreement reached" OR "negotiations" OR "de-escalation") (iran OR israel OR middle east)');

    const [escalRes, deescRes] = await Promise.allSettled([
      fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${escalationQuery}&mode=artcount&timespan=7d&format=json`, { signal: AbortSignal.timeout(8000) }),
      fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${deescQuery}&mode=artcount&timespan=7d&format=json`, { signal: AbortSignal.timeout(8000) }),
    ]);

    let escalationCount = 0;
    let deescCount = 0;

    if (escalRes.status === 'fulfilled' && escalRes.value.ok) {
      const data = await escalRes.value.json().catch(() => null);
      escalationCount = data?.artcount ?? 0;
    }
    if (deescRes.status === 'fulfilled' && deescRes.value.ok) {
      const data = await deescRes.value.json().catch(() => null);
      deescCount = data?.artcount ?? 0;
    }

    const total = escalationCount + deescCount;
    if (total === 0) return { score: 0, detail: 'No diplomatic signals' };

    // Ratio: more escalation articles = Iran/proxy advantage
    const ratio = (escalationCount - deescCount) / total;
    let score = 0;
    if (ratio > 0.5) score = 4;
    else if (ratio > 0.2) score = 2;
    else if (ratio > 0) score = 1;
    else if (ratio < -0.5) score = -4;
    else if (ratio < -0.2) score = -2;
    else if (ratio < 0) score = -1;

    score = Math.max(-5, Math.min(5, score));
    return { score, detail: `Escalation: ${escalationCount} articles, De-escalation: ${deescCount} (7d)` };
  } catch {
    return { score: 0, detail: 'Diplomatic calc failed' };
  }
}

// ─── FACTOR 6: CYBER / INFORMATION WARFARE ──────────────────────────────────
// Tracks info-ops, cyber attacks, DDoS reports, defacement claims.
// Spikes often precede kinetic operations by 24-48 hours.
async function calculateCyberFactor(): Promise<FactorResult> {
  try {
    // GDELT article volume for cyber/info-war keywords
    const query = encodeURIComponent('("cyber attack" OR "DDoS" OR "hack" OR "defacement" OR "information operation" OR "disinformation campaign" OR "propaganda" OR "cyber warfare") (iran OR israel OR middle east OR hezbollah OR hamas)');
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=timelinevol&timespan=14d&format=json`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { score: 0, detail: 'GDELT cyber timeline unavailable' };

    const data = await res.json().catch(() => null);
    const series = data?.timeline;
    if (!series || !Array.isArray(series) || series.length === 0) return { score: 0, detail: 'No cyber timeline' };
    const timeline = series[0]?.data;
    if (!timeline || timeline.length < 7) return { score: 0, detail: 'Insufficient cyber data' };

    // Compare last 3 days to previous 11 days
    const recent3 = timeline.slice(-3).reduce((a: number, d: any) => a + (d.value || 0), 0) / 3;
    const older = timeline.slice(0, -3).reduce((a: number, d: any) => a + (d.value || 0), 0) / Math.max(1, timeline.length - 3);

    if (older === 0) return { score: 0, detail: 'No baseline cyber data' };

    const spike = recent3 / older;

    // Cyber spike = precursor to kinetic ops = Iran/proxy advantage
    let score = 0;
    if (spike > 3) score = 4;
    else if (spike > 2) score = 2;
    else if (spike > 1.3) score = 1;
    else if (spike < 0.5) score = -1; // Cyber quiet = normalizing

    score = Math.max(-5, Math.min(5, score));
    return { score, detail: `Cyber volume: ${spike.toFixed(1)}x baseline (3d vs 14d avg)` };
  } catch {
    return { score: 0, detail: 'Cyber calc failed' };
  }
}

// ─── ZIP DECOMPRESSION ─────────────────────────────────────────────────────
async function decompressZip(zipBuffer: Buffer): Promise<string | null> {
  try {
    const sig = zipBuffer.readUInt32LE(0);
    if (sig !== 0x04034b50) return null;
    const compMethod = zipBuffer.readUInt16LE(8);
    const fnameLen = zipBuffer.readUInt16LE(26);
    const extraLen = zipBuffer.readUInt16LE(28);
    const dataOffset = 30 + fnameLen + extraLen;
    const compSize = zipBuffer.readUInt32LE(18);
    const compData = zipBuffer.subarray(dataOffset, dataOffset + compSize);
    if (compMethod === 0) return compData.toString('utf-8');
    if (compMethod === 8) {
      const { inflateRawSync } = await import('zlib');
      return inflateRawSync(compData).toString('utf-8');
    }
    return null;
  } catch {
    return null;
  }
}
