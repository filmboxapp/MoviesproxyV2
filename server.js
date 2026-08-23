const express = require('express');
const path = require('path');
const axios = require('axios');
const { identifyProvider } = require('./config');
const { generateStreamId } = require('./proxyUtils');
const { cleanPlaylist, isMasterPlaylist } = require('./playlistFilter');
const StreamWishExtractor = require('./streamwish');
const VoeExtractor = require('./voe');
const GenericExtractor = require('./generic');

const app = express();
const PORT = process.env.PORT || 3000;

// CACHE EN MEMORIA
const streamCache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of streamCache.entries()) {
    if (now - val.timestamp > CACHE_TTL) streamCache.delete(key);
  }
}, 30 * 60 * 1000);

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname))); // Sirve index.html, player.html, style.css, app.js

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// SELECTOR DE EXTRACTOR
function getExtractor(url) {
  switch (identifyProvider(url)) {
    case 'streamwish': case 'filelions': return new StreamWishExtractor();
    case 'voe': return new VoeExtractor();
    default: return new GenericExtractor();
  }
}

// API: Extraer stream
app.post('/api/extract', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'URL inválida' }); }

  try {
    const extractor = getExtractor(url);
    const result = await extractor.extract(url);
    const streamId = generateStreamId();
    streamCache.set(streamId, { ...result, timestamp: Date.now(), originalUrl: url });
    res.json({
      success: true, streamId, title: extractor.name,
      embedUrl: `/player/${streamId}`,
      apiUrl: `/api/stream/${streamId}/playlist.m3u8`,
      directUrl: result.url,
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'No se pudo extraer el stream', message: error.message });
  }
});

// API: Playlist M3U8 filtrado
app.get('/api/stream/:id/playlist.m3u8', async (req, res) => {
  const cached = streamCache.get(req.params.id);
  if (!cached) return res.status(404).send('# No encontrado');

  try {
    const pr = await axios.get(cached.url, {
      headers: cached.headers,
      responseType: 'text',
      timeout: 15000,
    });
    let playlist = cleanPlaylist(pr.data);

    if (isMasterPlaylist(playlist)) {
      const rw = [];
      for (const line of playlist.split('\n')) {
        if (line.trim() && !line.startsWith('#') && (line.includes('.m3u8') || line.includes('.urlset')))
          rw.push(`/api/stream/${req.params.id}/proxy/${encodeURIComponent(line.trim())}`);
        else rw.push(line);
      }
      playlist = rw.join('\n');
    } else {
      const baseUrl = cached.url.substring(0, cached.url.lastIndexOf('/') + 1);
      const rw = [];
      for (const line of playlist.split('\n')) {
        if (line.trim() && !line.startsWith('#')) {
          const fullUrl = line.startsWith('http') ? line.trim() : new URL(line.trim(), baseUrl).href;
          rw.push(`/api/stream/${req.params.id}/proxy/${encodeURIComponent(fullUrl)}`);
        } else rw.push(line);
      }
      playlist = rw.join('\n');
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(playlist);
  } catch (e) {
    console.error('Error playlist:', e.message);
    if (cached.playlist) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(cached.playlist);
    }
    res.status(502).send('# Error');
  }
});

// PROXY: Segmentos TS / sub-playlists
app.get('/api/stream/:id/proxy/*', async (req, res) => {
  const cached = streamCache.get(req.params.id);
  if (!cached) return res.status(404).send('No encontrado');

  const targetUrl = decodeURIComponent(req.params[0] || req.url.substring(req.url.indexOf('/proxy/') + 7));
  try {
    const response = await axios.get(targetUrl, {
      headers: { ...cached.headers, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      responseType: 'arraybuffer', timeout: 30000,
    });
    const ct = response.headers['content-type']
      || (targetUrl.endsWith('.ts') ? 'video/MP2T'
        : targetUrl.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl'
        : targetUrl.endsWith('.mp4') ? 'video/mp4'
        : 'application/octet-stream');
    res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(Buffer.from(response.data));
  } catch (e) {
    console.error('Error proxy:', e.message);
    res.status(502).send('Error');
  }
});

// PLAYER EMBED
app.get('/player/:id', (req, res) => {
  const cached = streamCache.get(req.params.id);
  if (!cached) {
    return res.status(404).send(
      `<html><head><title>No encontrado</title></head>`
      + `<body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">`
      + `<div><h1>Stream no encontrado</h1><p>ID inválido o expirado.</p><a href="/" style="color:#00b4d8">Volver</a></div></body></html>`
    );
  }
  res.sendFile(path.join(__dirname, 'player.html'));
});

// INFO
app.get('/api/stream/:id/info', (req, res) => {
  const cached = streamCache.get(req.params.id);
  if (!cached) return res.status(404).json({ error: 'No encontrado' });
  res.json({ streamId: req.params.id, originalUrl: cached.originalUrl, playlistUrl: `/api/stream/${req.params.id}/playlist.m3u8` });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
║           MOVIELIMPIO v1.0                    ║
║   Proxy de Streams Libre de Anuncios          ║
╚══════════════════════════════════════════════╝
  Servidor: http://localhost:${PORT}
  `);
});
