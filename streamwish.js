const BaseExtractor = require('./base');
const { PROVIDERS } = require('./config');
const { isPacked, unpackJS, extractURLs } = require('./unpacker');
const { resolveUrl } = require('./proxyUtils');

class StreamWishExtractor extends BaseExtractor {
  constructor() { super(); this.name = 'StreamWish'; }
  static matches(url) {
    try { const h = new URL(url).hostname.replace(/^www\./, ''); return PROVIDERS.streamwish.domains.some(d => h === d || h.endsWith('.' + d)); } catch { return false; }
  }
  async extract(url) {
    console.log(`[StreamWish] Extrayendo: ${url}`);
    const ref = new URL(url).origin + '/';
    let html = (await this.fetch(url, { Referer: ref })).text;
    let iframeUrl = url;
    const im = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (im) {
      iframeUrl = resolveUrl(url, im[1]);
      html = (await this.fetch(iframeUrl, { Referer: ref })).text;
    }
    let m3u8 = extractURLs(html, /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi);
    if (!m3u8.length) {
      const sr = /<script[^>]*>([\s\S]*?)<\/script>/gi, sm; // jshint ignore:line
      let sm; while ((sm = sr.exec(html)) !== null) {
        const sc = sm[1];
        if (isPacked(sc)) { try { const u = unpackJS(sc); m3u8 = extractURLs(u); if (m3u8.length) break; const rel = u.match(/\/stream\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi); if (rel) { m3u8 = rel.map(r => resolveUrl(iframeUrl, r)); break; } } catch {} }
        m3u8 = extractURLs(sc); if (m3u8.length) break;
      }
    }
    if (!m3u8.length) { const d = html.match(/data-src=["']([^"']+\.m3u8[^"']*)["']/i); if (d) m3u8 = [resolveUrl(iframeUrl, d[1])]; }
    if (!m3u8.length) throw new Error('No se pudo extraer M3U8');
    const urlFinal = m3u8[m3u8.length - 1];
    const r2 = iframeUrl !== url ? iframeUrl + '/' : ref;
    let pl = null;
    try { const p = await this.fetch(urlFinal, { Referer: r2 }); pl = p.text; if (pl && !isMasterPlaylist(pl)) pl = this.filterAds(pl); } catch {}
    return { url: urlFinal, headers: { Referer: r2, Origin: new URL(iframeUrl).origin }, playlist: pl, referer: r2 };
  }
}

module.exports = StreamWishExtractor;
