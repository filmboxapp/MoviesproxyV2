const PROVIDERS = {
  streamwish: {
    name: 'StreamWish',
    domains: [
      'streamwish.com', 'streamwish.to', 'swishs.com', 'streame.com',
      'streamwish.lol', 'embedwish.com', 'wishonly.top', 'streamwish.io',
      'streamwish.pro', 'swishs.xyz', 'smoner.com',
    ],
    hasIframe: true,
  },
  voe: {
    name: 'VOE',
    domains: [
      'voe.sx', 'voe.la', 'voe-unblock.com', 'voe-network.net',
      'voe.xyz', 'voe.gg', 'voe.team',
    ],
    hasIframe: false,
  },
  filelions: {
    name: 'FileLions',
    domains: ['filelions.com', 'filelions.to', 'filelions.xyz', 'lionflix.com'],
    hasIframe: true,
  },
};

function identifyProvider(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    for (const [, provider] of Object.entries(PROVIDERS)) {
      for (const domain of provider.domains) {
        if (hostname === domain || hostname.endsWith('.' + domain)) return Object.keys(PROVIDERS).find(k => PROVIDERS[k] === provider);
      }
    }
    for (const [, provider] of Object.entries(PROVIDERS)) {
      for (const domain of provider.domains) {
        if (hostname.includes(domain.split('.')[0])) return Object.keys(PROVIDERS).find(k => PROVIDERS[k] === provider);
      }
    }
  } catch {}
  return null;
}

module.exports = { PROVIDERS, identifyProvider };
