// MangoI ARS Voice - Cloudflare Worker
// GitHub Raw URL for the MP3 file
const MP3_URL = 'https://raw.githubusercontent.com/navy111p-sudo/mangoai-ars-voice/main/mangoai-ars-voice.mp3';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Serve the MP3 audio file
    if (url.pathname === '/' || url.pathname === '/audio' || url.pathname === '/mangoai-ars-voice.mp3') {
      // Check cache first
      const cacheKey = new Request(url.toString(), request);
      const cache = caches.default;
      let response = await cache.match(cacheKey);

      if (!response) {
        // Fetch from GitHub raw
        const mp3Response = await fetch(MP3_URL);
        if (!mp3Response.ok) {
          return new Response('Audio file not found', { status: 404 });
        }

        const mp3Data = await mp3Response.arrayBuffer();

        response = new Response(mp3Data, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': 'inline; filename="mangoai-ars-voice.mp3"',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff',
          },
        });

        // Cache for 24 hours
        const responseToCache = response.clone();
        await cache.put(cacheKey, responseToCache);
      }

      return response;
    }

    // Player page with HTML
    if (url.pathname === '/player') {
      return new Response(getPlayerHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'mangoai-ars-voice' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('MangoI ARS Voice Service. Use /audio for MP3, /player for web player.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};

function getPlayerHTML() {
  return \`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MangoI ARS Voice Player</title>
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
    audio { width: 100%; margin: 16px 0; }
    .info { color: #999; font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">&#127837;</div>
    <h1>MangoI ARS Voice</h1>
    <p>Automated Response System</p>
    <audio controls autoplay>
      <source src="/audio" type="audio/mpeg">
    </audio>
    <div class="info">Powered by Cloudflare Workers</div>
  </div>
</body>
</html>\`;
}
