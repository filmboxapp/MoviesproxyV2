/**
 * MOVIEPROXY - Core del Servidor
 * Intercepta, desofusca y limpia streams de Streamwish/Voy/etc
 */

const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const cache = new NodeCache({ stdTTL: 300 });

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      mediaSrc: ["'self'", "*", "blob:", "data:"],
      connectSrc: ["'self'", "*"],
      imgSrc: ["'self'", "*", "data:", "blob:"],
    },
  },
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(__dirname, { dotfiles: 'deny', index: ['index.html'] }));

const PORT = process.env.PORT || 3000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const commonHeaders = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Fetch wrapper
async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...commonHeaders, ...options.headers }
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

function unpackJavaScript(packed) {
  try {
    const packPattern = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
    const match = packed.match(packPattern);
    if (!match) return null;
    
    let [_, source, count, base, keywords] = match;
    const words = keywords.split('|');
    const dict = {};
    
    for (let i = 0; i < parseInt(count); i++) {
      const key = (i + parseInt(base)).toString(36);
      dict[key] = words[i] || key;
    }
    
    let unpacked = source.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => 
      String.fromCharCode(parseInt(hex, 16))
    );
    
    unpacked = unpacked.replace(/\b\w+\b/g, (word) => dict[word] || word);
    return unpacked;
  } catch (e) {
    return null;
  }
}

function extractM3U8(script) {
  const patterns = [
    /(https?:\/\/[^\s"']+\.m3u8(?:\?[^\s"']*)?)/gi,
    /["']([^"']*\.m3u8[^"']*)/gi,
    /source\s*:\s*["']([^"']*\.m3u8[^"']*)/i,
    /file\s*:\s*["']([^"']*\.m3u8[^"']*)/i,
    /src\s*:\s*["']([^"']*\.m3u8[^"']*)/i,
  ];
  
  for (const pattern of patterns) {
    const matches = script.match(pattern);
    if (matches) {
      const url = matches[0].replace(/^["']|["']$/g, '').replace(/^source\s*:\s*|^file\s*:\s*|^src\s*:\s*/i, '').replace(/^["']|["']$/g, '');
      if (url.includes('.m3u8')) return url;
    }
  }
  return null;
}

async function extractPlayerData(url) {
  const cacheKey = `stream_${Buffer.from(url).toString('base64')}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetchWithTimeout(url, {}, 15000);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let m3u8Url = null;
    let title = $('title').text() || 'Stream';
    let poster = '';
    
    const posterMatch = html.match(/poster\s*=\s*["']([^"']+)["']/i) || 
                       html.match(/og:image["']\s*content\s*=\s*["']([^"']+)["']/i);
    if (posterMatch) poster = posterMatch[1];
    
    const scripts = $('script').map((i, el) => $(el).html()).get().filter(Boolean);
    
    for (const script of scripts) {
      if (script.includes('eval(function(p,a,c,k,e,d)')) {
        const unpacked = unpackJavaScript(script);
        if (unpacked) {
          m3u8Url = extractM3U8(unpacked);
          if (m3u8Url) break;
        }
      }
      m3u8Url = extractM3U8(script);
      if (m3u8Url) break;
    }
    
    if (!m3u8Url) {
      const dataSources = $('[data-src*=".m3u8"], [data-file*=".m3u8"], [data-source*=".m3u8"]');
      if (dataSources.length) {
        m3u8Url = dataSources.first().attr('data-src') || 
                  dataSources.first().attr('data-file') || 
                  dataSources.first().attr('data-source');
      }
    }
    
    if (!m3u8Url) {
      const iframe = $('iframe[src*=".m3u8"]').first();
      if (iframe.length) m3u8Url = iframe.attr('src');
    }
    
    if (!m3u8Url) {
      const videoMatch = html.match(/(https?:\/\/[^\s"']+\.(?:mp4|m3u8|webm)[^\s"']*)/i);
      if (videoMatch) m3u8Url = videoMatch[1];
    }
    
    const result = { m3u8Url, title, poster, source: url };
    cache.set(cacheKey, result);
    return result;
    
  } catch (error) {
    throw new Error('No se pudo acceder al stream');
  }
}

function cleanPlaylist(playlist, baseUrl) {
  const lines = playlist.split('\n');
  const clean = [];
  let skipSegment = false;
  
  const adPatterns = [
    /doubleclick\.net/i, /googleads/i, /googlesyndication/i,
    /facebook\.com\/tr/i, /analytics/i, /tracking/i, /adsystem/i,
    /advertising/i, /pre-roll|preroll/i, /mid-roll|midroll/i,
    /post-roll|postroll/i, /ad\.(ts|mp4|m3u8)/i, /commercial/i, /promo/i,
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.includes('#EXT-X-CUE-OUT')) { skipSegment = true; continue; }
    if (trimmed.includes('#EXT-X-CUE-IN')) { skipSegment = false; continue; }
    if (skipSegment) continue;
    
    if (trimmed.startsWith('http') || trimmed.endsWith('.ts') || trimmed.endsWith('.mp4')) {
      const isAd = adPatterns.some(pattern => pattern.test(trimmed));
      if (!isAd) {
        if (!trimmed.startsWith('http') && baseUrl) {
          clean.push(new URL(trimmed, baseUrl).href);
        } else {
          clean.push(trimmed);
        }
      }
      continue;
    }
    
    if (trimmed.startsWith('#EXT')) clean.push(trimmed);
  }
  
  return clean.join('\n');
}

app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL requerida' });
    
    let targetUrl = url;
    if (!url.startsWith('http')) targetUrl = 'https://' + url;
    
    console.log(`[EXTRACT] ${targetUrl}`);
    const data = await extractPlayerData(targetUrl);
    
    if (!data.m3u8Url) {
      return res.status(404).json({ error: 'No se encontró stream válido' });
    }
    
    res.json({
      success: true,
      stream: {
        url: `/api/stream?url=${encodeURIComponent(data.m3u8Url)}`,
        direct: data.m3u8Url,
        title: data.title,
        poster: data.poster,
      }
    });
    
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stream', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL requerida' });
    
    const streamHeaders = {
      ...commonHeaders,
      'Referer': new URL(url).origin,
      'Origin': new URL(url).origin,
    };
    
    if (url.includes('.m3u8')) {
      const response = await fetchWithTimeout(url, { headers: streamHeaders }, 10000);
      const text = await response.text();
      
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const clean = cleanPlaylist(text, baseUrl);
      
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(clean);
      
    } else {
      const response = await fetchWithTimeout(url, { headers: streamHeaders }, 30000);
      
      res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp2t');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      const reader = response.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) return;
        res.write(Buffer.from(value));
        return pump();
      };
      
      await pump();
      res.end();
    }
    
  } catch (error) {
    console.error('[STREAM ERROR]', error.message);
    res.status(500).json({ error: 'Error al obtener stream' });
  }
});

app.get('/api/info', (req, res) => {
  res.json({ name: 'MovieProxy', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`MovieProxy activo en puerto ${PORT}`);
});
