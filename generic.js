const BaseExtractor = require('./base');
const { isPacked, unpackJS, extractURLs } = require('./unpacker');
const { resolveUrl } = require('./proxyUtils');

class GenericExtractor extends BaseExtractor {
  constructor() { super(); this.name = 'Generic'; }
  static matches() { return true; }
  async extract(url) {
    console.log(`[Generic] Extrayendo: ${url}`);
    const ref = new URL(url).origin + '/';
    const html = (await this.fetch(url, { Referer: ref })).text;
    let m3u8 = extractURLs(html);
    if (!m3u8.length) {
      const sr = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let sm; while ((sm = sr.exec(html)) !== null) { const sc = sm[1]; if (isPacked(sc)) { try { const u = unpackJS(sc); m3u8 = extractURLs(u); if (m3u8.length) break; } catch {} } m3u8 = extractURLs(sc); if (m3u8.length) break; }
    }
    if (!m3u8.length) {
      const ir = /<iframe[^>]+src=["']([^"']+)["']/gi;
      let im; while ((im = ir.exec(html)) !== null) {
        const iu = resolveUrl(url, im[1]);
        if (iu && !iu.includes('google') && !iu.includes('facebook')) {
          try { const ip = await this.fetch(iu, { Referer: ref }); m3u8 = extractURLs(ip.text); if (m3u8.length) { const p = await this.fetch(m3u8[m3u8.length-1], { Referer: iu }); return { url: m3u8[m3u8.length-1], headers: { Referer: iu, Origin: new URL(iu).origin }, playlist: this.filterAds(p.text), referer: iu }; } } catch {}
        }
      }
    }
    if (!m3u8.length) throw new Error('No se pudo extraer M3U8');
    const u = m3u8[m3u8.length-1];
    let pl = null;
    try { const p = await this.fetch(u, { Referer: ref, Origin: new URL(url).origin }); pl = this.filterAds(p.text); } catch {}
    return { url: u, headers: { Referer: ref, Origin: new URL(url).origin }, playlist: pl, referer: ref };
  }
}

module.exports = GenericExtractor;
