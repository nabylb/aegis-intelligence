import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SYMBOLS = [
  { symbol: '^GSPC', name: 'S&P 500', region: 'US' },
  { symbol: 'CL=F', name: 'Crude Oil WTI', region: 'Global' },
  { symbol: '^FTSE', name: 'FTSE 100', region: 'UK' },
  { symbol: '^N225', name: 'Nikkei 225', region: 'Japan' },
  { symbol: '^STOXX50E', name: 'EURO STOXX 50', region: 'Europe' }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get('range') || '1mo';
    
    let range = '1mo';
    let interval = '1d';
    
    if (rangeParam === '1d') {
      range = '1d';
      interval = '15m';
    } else if (rangeParam === '1mo' || rangeParam === '30d') {
      range = '1mo';
      interval = '1d';
    } else if (rangeParam === '1y') {
      range = '1y';
      interval = '1wk';
    }

    const results = await Promise.all(
      SYMBOLS.map(async (asset) => {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${asset.symbol}?interval=${interval}&range=${range}`;
        const res = await fetch(url, { 
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 300 } // Cache for 5 mins
        }).catch(() => null);
        
        if (!res || !res.ok) return null; // Gracefully drop failed assets
        const data = await res.json().catch(() => null);
        if (!data?.chart?.result?.[0]) return null;
        
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const prices = result.indicators.quote[0].close;
        
        const history = timestamps.map((t: number, i: number) => ({
          date: new Date(t * 1000).toISOString(),
          price: prices[i] !== null ? prices[i] : (prices[i-1] || 0)
        })).filter((d: any) => d.price > 0);
        
        const currentPrice = result.meta.regularMarketPrice;
        const previousClose = result.meta.chartPreviousClose;
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;

        return {
          id: asset.symbol,
          name: asset.name,
          region: asset.region,
          currentPrice,
          change,
          changePercent,
          history
        };
      })
    );
    
    return NextResponse.json(results.filter(Boolean));
  } catch (err: any) {
    console.error('Market fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
