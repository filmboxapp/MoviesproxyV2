const axios = require('axios');
const { getBrowserHeaders } = require('./proxyUtils');
const { cleanPlaylist, isMasterPlaylist } = require('./playlistFilter');

class BaseExtractor {
  constructor() { this.name = 'Base'; this.timeout = 30000; }

  async fetch(url, headers = {}, options = {}) {
    const config = {
      headers: { ...getBrowserHeaders(headers.referer || null), ...headers },
      timeout: options.timeout || this.timeout,
      responseType: options.responseType || 'text',
      decompress: true,
      validateStatus: s => s < 400,
    };
    try {
      const r = await axios.get(url, config);
      return { text: r.data, headers: r.headers, status: r.status, url: r.request?.res?.responseUrl || url };
    } catch (e) {
      if (e.response) return { text: e.response.data, headers: e.response.headers, status: e.response.status, url };
      throw e;
    }
  }
  async extract(url) { throw new Error('Implementar'); }
  static matches(url) { throw new Error('Implementar'); }
  filterAds(pl) { return cleanPlaylist(pl); }
}

module.exports = BaseExtractor;
