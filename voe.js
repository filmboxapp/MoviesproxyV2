const BaseExtractor = require('./base');
const { PROVIDERS } = require('./config');
const { isPacked, unpackJS, extractURLs } = require('./unpacker');

class VoeExtractor extends BaseExtractor {
  constructor() { super(); this.name = 'VOE'; }
  static matches(url) {
    try { const h = new URL(url).hostname.replace(/^www\./, ''); return PROVIDERS.voe.domains.some(d => h === d || h.endsWith('.' + d)); } catch { return false; }
  }
  async extract(url) {
    console.log(`[VOE] Extrayendo: ${url}`);
    const ref = new URL(url).origin + '/';
    const html = (await this.fetch(url, { Referer: ref })).text;
    let m3u8 = extractURLs(html, /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi);
    if (!m3u8.length) {
      const sr = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let sm; while ((sm = sr.exec(html)) !== null) {
        const sc = sm[1];
        if (isPacked(sc)) { try { const u = unpackJS(sc); m3u8 = extractURLs(u); if (m3u8.length) break; } catch {} }
        m3u8 = extractURLs(sc); if (m3u8.length) break;
        const f = sc.match(/["']file["']\s*:\s*["']([^"']+)["']/i); if (f && (f[1].includes('.m3u8') || f[1].includes('.mp4'))) { m3u8 = [f[1]]; break; }
        const s = sc.match(/src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i); if (s) { m3u8 = [s[1]]; break; }
      }
    }
    if (!m3u8.length) { const dr = /data-[^=]+=["']([^"']+\.m3u8[^"']*)["']/gi; let dm; while ((dm = dr.exec(html)) !== null) m3u8.push(dm[1]); }
    if (!m3u8.length) { const tm = html.match(/https?:\/\/[^\s<>"']+delivery[^\s<>"']*\.m3u8[^\s<>"']*/gi); if (tm) m3u8 = tm; }
    if (!m3u8.length) throw new Error('No se pudo extraer M3U8');
    let urlFinal = m3u8[0];
    const master = m3u8.find(u => u.includes('master.m3u8') || u.includes('.urlset'));
    if (master) urlFinal = master;
    let pl = null;
    try { const p = await this.fetch(urlFinal, { Referer: ref, Origin: new URL(url).origin }); pl = p.text; if (pl) pl = this.filterAds(pl); } catch {}
    return { url: urlFinal, headers: { Referer: ref, Origin: new URL(url).origin }, playlist: pl, referer: ref };
  }
}

module.exports = VoeExtractor;
