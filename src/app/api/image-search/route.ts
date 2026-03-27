export const dynamic = 'force-dynamic';

// Server-side image search via Bing Images (no API key needed)
const imageCache = new Map<string, string | null>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  if (!query) return Response.json({ image: null });

  if (imageCache.has(query)) {
    return Response.json({ image: imageCache.get(query) });
  }

  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&count=5&qft=+filterui:imagesize-medium`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      imageCache.set(query, null);
      return Response.json({ image: null });
    }

    const html = await res.text();

    // Bing embeds image URLs in murl (media URL) attributes
    const murlPattern = /murl&quot;:&quot;(https?:\/\/[^&]+\.(?:jpg|jpeg|png|webp))/gi;
    const matches: string[] = [];
    let match;
    while ((match = murlPattern.exec(html)) !== null) {
      matches.push(match[1]);
    }

    // Fallback: JSON-encoded murl
    if (matches.length === 0) {
      const jsonPattern = /"murl":"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
      while ((match = jsonPattern.exec(html)) !== null) {
        matches.push(match[1]);
      }
    }

    // Filter out tiny tracking pixels and prefer larger images
    const filtered = matches.filter(u =>
      !u.includes('bing.com') &&
      !u.includes('microsoft.com') &&
      !u.includes('1x1') &&
      !u.includes('pixel')
    );

    const image = filtered[0] || null;
    imageCache.set(query, image);
    return Response.json({ image });
  } catch {
    imageCache.set(query, null);
    return Response.json({ image: null });
  }
}
