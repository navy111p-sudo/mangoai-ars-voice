// MangoAI ARS Voice - Cloudflare Worker
// Fetches MP3 from GitHub, caches with Cache API, serves with streaming support

const DEFAULT_MP3_URL =
  'https://raw.githubusercontent.com/navy111p-sudo/mangoai-ars-voice/main/mangoai-ars-voice.mp3';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

const CACHE_TTL = 86400; // 24 hours

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Audio endpoints
    if (path === '/' || path === '/audio' || path === '/mangoai-ars-voice.mp3') {
      return handleAudio(request, env);
    }

    // Streaming endpoint (same audio, explicit streaming headers)
    if (path === '/stream') {
      return handleAudio(request, env, true);
    }

    // Web player
    if (path === '/player') {
      return new Response(getPlayerHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Health check
    if (path === '/health') {
      return Response.json({
        status: 'ok',
        service: 'mangoai-ars-voice',
        endpoints: ['/audio', '/stream', '/player', '/health'],
      });
    }

    return new Response(
      'MangoAI ARS Voice Service\n\nEndpoints:\n  /audio   - MP3 download/play\n  /stream  - Streaming playback\n  /player  - Web player UI\n  /health  - Health check\n',
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  },
};

async function handleAudio(request, env, streaming = false) {
  const mp3Url = (env && env.AUDIO_URL) || DEFAULT_MP3_URL;

  // Try Cache API first
  const cache = caches.default;
  const cacheKey = new Request(new URL('/audio', request.url).toString());

  let mp3Data;
  let cachedResp = await cache.match(cacheKey);

  if (cachedResp) {
    mp3Data = await cachedResp.arrayBuffer();
  } else {
    // Fetch from GitHub
    const upstream = await fetch(mp3Url, {
      headers: { 'User-Agent': 'MangoAI-ARS-Worker/1.0' },
    });

    if (!upstream.ok) {
      return new Response('Failed to fetch audio from source', { status: 502 });
    }

    mp3Data = await upstream.arrayBuffer();

    // Store in cache
    const toCache = new Response(mp3Data, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
      },
    });
    // Non-blocking cache put
    cache.put(cacheKey, toCache);
  }

  const totalSize = mp3Data.byteLength;
  const etag = `"ars-${totalSize}"`;

  // ETag: conditional request
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: CORS_HEADERS });
  }

  const baseHeaders = {
    ...CORS_HEADERS,
    'Content-Type': 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'ETag': etag,
    'Cache-Control': `public, max-age=${CACHE_TTL}`,
    'X-Content-Type-Options': 'nosniff',
  };

  // Range request support for seeking
  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

      if (start >= totalSize) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: { ...CORS_HEADERS, 'Content-Range': `bytes */${totalSize}` },
        });
      }

      const slice = mp3Data.slice(start, end + 1);
      return new Response(slice, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': String(slice.byteLength),
        },
      });
    }
  }

  // Full response
  if (streaming) {
    baseHeaders['Content-Disposition'] = 'inline; filename="mangoai-ars-voice.mp3"';
  } else {
    baseHeaders['Content-Disposition'] = 'inline; filename="mangoai-ars-voice.mp3"';
  }
  baseHeaders['Content-Length'] = String(totalSize);

  return new Response(mp3Data, { status: 200, headers: baseHeaders });
}

function getPlayerHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MangoAI ARS Voice Player</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #FF9800 0%, #FF5722 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      text-align: center;
    }
    .logo { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #333; font-size: 24px; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; margin-bottom: 24px; }
    audio { width: 100%; margin: 16px 0; border-radius: 8px; }
    .info { color: #999; font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">&#127837;</div>
    <h1>MangoAI ARS Voice</h1>
    <p>Automated Response System</p>
    <audio controls preload="auto">
      <source src="/audio" type="audio/mpeg">
      Your browser does not support the audio element.
    </audio>
    <div class="info">Powered by Cloudflare Workers &middot; Cached &amp; Streamed</div>
  </div>
</body>
</html>`;
}
