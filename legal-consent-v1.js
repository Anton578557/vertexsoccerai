'use strict';

// Retired: registration no longer uses a mandatory 18+ / legal-consent checkbox.
// Legal information remains available through Terms, Privacy and Responsible Use.
(() => {
  window.__vertexLegalConsentV1 = true;
  document.getElementById('vertexLegalConsentWrap')?.remove();
  document.getElementById('vertexLegalConsentStyle')?.remove();
})();
