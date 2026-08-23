const AD_PATTERNS = [
  /adservice/i, /doubleclick/i, /googlesyndication/i, /googleadservices/i,
  /adserver/i, /ad\.domain/i, /anuncio/i, /publicidad/i, /banner/i,
  /pre-?roll/i, /mid-?roll/i, /adbreak/i, /adsegment/i, /vast/i, /vpaid/i,
  /ads\./i, /\bprembed\b/i, /\bpopad\b/i, /tracking/i, /analytics/i,
];

function filterPlaylist(playlist) {
  const lines = playlist.split('\n');
  const result = [];
  let inAd = false, skipSeg = false;
  for (const line of lines) {
    if (/CUE-OUT|cue-out|#EXT-X-CUE-OUT/.test(line)) { inAd = true; skipSeg = true; continue; }
    if (/CUE-IN|cue-in|#EXT-X-CUE-IN/.test(line)) { inAd = false; skipSeg = false; continue; }
    if (inAd) { if (line.startsWith('#EXTINF') || line.startsWith('#EXT-X-') || (line.trim() && !line.startsWith('#'))) continue; continue; }
    if (skipSeg) { if (line.trim() && !line.startsWith('#')) { skipSeg = false; continue; } if (line.startsWith('#EXTINF')) continue; }
    if (line.trim() && !line.startsWith('#')) {
      if (AD_PATTERNS.some(p => p.test(line.trim()))) {
        if (result.length && result[result.length-1].startsWith('#EXTINF')) result.pop();
        continue;
      }
    }
    result.push(line);
  }
  return result.join('\n');
}

function isMasterPlaylist(pl) { return /#EXT-X-STREAM-INF/.test(pl); }
function cleanPlaylist(pl) { return (!pl || !pl.trim()) ? pl : (isMasterPlaylist(pl) ? pl.split('\n').filter(l => !AD_PATTERNS.some(p => p.test(l))).join('\n') : filterPlaylist(pl)); }

module.exports = { cleanPlaylist, isMasterPlaylist };
