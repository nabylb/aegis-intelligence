import { fetchGDELTData, fetchGDELTGeoData, fetchRSSFeeds, fetchOpenSkyData, fetchACLEDData, fetchThinkTankAnalysis, fetchGlobalAISData, fetchTzevaAdomAlerts, fetchOSINTFeeds, fetchXFeeds, fetchSatelliteOSINT } from '@/lib/aggregator';

// We want to force this route to be dynamic so it doesn't get statically cached
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send an initial connected message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // Fetch initial data immediately
      try {
        const [rssData, gdeltData, gdeltGeoData, skyData, acledData, analysisData, aisData, tzevaData, osintData, xData, satelliteData] = await Promise.all([
          fetchRSSFeeds(),
          fetchGDELTData(),
          fetchGDELTGeoData(),
          fetchOpenSkyData(),
          fetchACLEDData(),
          fetchThinkTankAnalysis(),
          fetchGlobalAISData(),
          fetchTzevaAdomAlerts(),
          fetchOSINTFeeds(),
          fetchXFeeds(),
          fetchSatelliteOSINT(),
        ]);
        const allEvents = [...rssData, ...gdeltData, ...gdeltGeoData, ...skyData, ...acledData, ...analysisData, ...aisData, ...tzevaData, ...osintData, ...xData, ...satelliteData].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        if (!req.signal.aborted) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'init', events: allEvents })}\n\n`));
        }
      } catch (err) {
        console.error("Initial fetch error:", err);
      }

      // Set up a polling interval for live updates (every 30 seconds for RSS/GDELT to not hit rate limits)
      // Note: In a production serverless environment (like Vercel), long-lived connections might be closed after 10-60s.
      // If deployed to standard Node server, this runs indefinitely.
      const interval = setInterval(async () => {
        try {
          const [rssData, gdeltData, skyData, acledData, analysisData, aisData, tzevaData, osintData, xData, satelliteData] = await Promise.all([
            fetchRSSFeeds(),
            fetchGDELTData(),
            fetchOpenSkyData(),
            fetchACLEDData(),
            fetchThinkTankAnalysis(),
            fetchGlobalAISData(),
            fetchTzevaAdomAlerts(),
            fetchOSINTFeeds(),
            fetchXFeeds(),
            fetchSatelliteOSINT(),
          ]);
          const allEvents = [...rssData, ...gdeltData, ...skyData, ...acledData, ...analysisData, ...aisData, ...tzevaData, ...osintData, ...xData, ...satelliteData];
          
          if (allEvents.length > 0 && !req.signal.aborted) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'update', events: allEvents })}\n\n`));
            } catch (err) {
              console.error("Failed to enqueue, closing:", err);
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error("Interval fetch error:", err);
        }
      }, 60000); // 60 seconds (prevents burning through 400 anonymous API limits rapidly)

      // Clean up when the client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
