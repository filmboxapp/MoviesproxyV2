function isPacked(text) {
  return /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)/.test(text);
}

function extractPackedData(text) {
  const m = text.match(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)\s*\{[\s\S]*?\}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\s*\.split\s*\(\s*['"]\|['"]\s*\)/i);
  if (!m) return null;
  return { packed: m[1], a: parseInt(m[2]), c: parseInt(m[3]), words: m[4].split('|') };
}

function unpackJS(text) {
  if (!isPacked(text)) return text;
  const data = extractPackedData(text);
  if (!data) return text;
  const { packed, c, words } = data;
  while (words.length < c) words.push('');
  let result = packed;
  for (let i = c - 1; i >= 0; i--) {
    const key = i.toString(36);
    const value = words[i];
    if (value && key !== value) result = result.replace(new RegExp('\\b' + key + '\\b', 'g'), value);
  }
  return result;
}

function extractURLs(text, pattern) {
  const r = pattern || /https?:\/\/[^"'\s<>]+(?:\.m3u8[^"'\s<>]*|\.mp4[^"'\s<>]*)/gi;
  return text.match(r) || [];
}

module.exports = { isPacked, extractPackedData, unpackJS, extractURLs };
