const userAgent = require('user-agents');

function getBrowserHeaders(referer, origin) {
  const ua = new userAgent({ deviceCategory: 'desktop' });
  return {
    'User-Agent': ua.toString(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    ...(referer && { Referer: referer }),
    ...(origin && { Origin: origin }),
  };
}

function getStreamHeaders(referer) {
  const ua = new userAgent({ deviceCategory: 'desktop' });
  return {
    'User-Agent': ua.toString(),
    'Accept': '*/*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Referer': referer || '',
    'Origin': referer ? new URL(referer).origin : '',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
  };
}

function resolveUrl(base, relative) {
  if (!relative) return null;
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
  try { return new URL(relative, base).href; } catch { return null; }
}

function generateStreamId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

module.exports = { getBrowserHeaders, getStreamHeaders, resolveUrl, generateStreamId };
