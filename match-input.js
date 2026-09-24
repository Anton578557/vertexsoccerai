(function (root) {
  'use strict';
  // A space on either side makes an ASCII dash a match separator. Internal
  // hyphens (Saint-Etienne, Paris-Saint-Germain) remain part of the club name.
  function parts(value) {
    return String(value || '').split(/\s+(?:против|contra|versus|vs\.?|v\.?)\s+|\s*[–—]\s*|\s+-\s*|\s*-\s+/i);
  }
  function parse(value) {
    const names = parts(value).map(name => name.trim());
    return names.length === 2 && names.every(name => name.length >= 2)
      ? { home: names[0], away: names[1] } : null;
  }
  const api = { parts, parse };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VertexMatchInput = api;
})(typeof window === 'object' ? window : globalThis);
