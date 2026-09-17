'use strict';

(() => {
  if (window.__vertexLegalConsentV1) return;
  window.__vertexLegalConsentV1 = true;

  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  const copy = {
    en: { text: 'I confirm that I am 18+ and agree to the Terms of Use, Privacy Policy and Responsible Use notice.', terms: 'Terms', privacy: 'Privacy', responsible: 'Responsible use', error: 'Confirm that you are 18+ and accept the legal terms before creating an account.' },
    ru: { text: 'Я подтверждаю, что мне 18+, и принимаю Условия использования, Политику конфиденциальности и правила ответственного использования.', terms: 'Условия', privacy: 'Конфиденциальность', responsible: 'Ответственное использование', error: 'Подтвердите возраст 18+ и принятие юридических условий перед созданием аккаунта.' },
    es: { text: 'Confirmo que tengo 18 años o más y acepto los Términos de uso, la Política de privacidad y el aviso de Uso responsable.', terms: 'Términos', privacy: 'Privacidad', responsible: 'Uso responsable', error: 'Confirma que tienes 18 años o más y acepta las condiciones legales antes de crear la cuenta.' }
  };

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add('hidden'), 4500);
  }

  function injectConsent() {
    const modal = document.getElementById('modalContent');
    if (!modal || !modal.querySelector('#signupEmail')) return;
    const c = copy[lang()] || copy.en;
    let box = modal.querySelector('#vertexLegalConsentWrap');
    if (!box) {
      box = document.createElement('div');
      box.id = 'vertexLegalConsentWrap';
      box.className = 'v8-consent-wrap';
      const signupButton = modal.querySelector('[data-modal-action="do-signup"]');
      signupButton?.before(box);
    }
    box.innerHTML = `<label class="v8-consent"><input id="vertexLegalConsent" type="checkbox"><span>${c.text}</span></label><div class="v8-consent-links"><button type="button" data-consent-link="terms">${c.terms}</button><button type="button" data-consent-link="privacy">${c.privacy}</button><button type="button" data-consent-link="responsible">${c.responsible}</button></div>`;
  }

  function injectStyle() {
    if (document.getElementById('vertexLegalConsentStyle')) return;
    const style = document.createElement('style');
    style.id = 'vertexLegalConsentStyle';
    style.textContent = `
      .v8-consent-wrap{margin:4px 0 14px;padding:12px 13px;border:1px solid rgba(67,174,211,.15);border-radius:11px;background:rgba(2,10,18,.48)}
      .v8-consent{display:flex;gap:9px;align-items:flex-start;color:#a1b3c0;font-size:11px;line-height:1.55;cursor:pointer}.v8-consent input{width:16px!important;height:16px!important;min-width:16px;margin:1px 0 0!important;accent-color:#25dfff}.v8-consent-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.v8-consent-links button{width:auto!important;margin:0!important;padding:5px 8px!important;border-radius:7px!important;background:rgba(32,220,255,.05)!important;border:1px solid rgba(32,220,255,.14)!important;color:#45ddff!important;font-size:9px!important}
    `;
    document.head.appendChild(style);
  }

  window.addEventListener('click', (event) => {
    const signup = event.target.closest?.('[data-modal-action="do-signup"]');
    if (signup) {
      const accepted = document.getElementById('vertexLegalConsent')?.checked;
      if (!accepted) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showToast((copy[lang()] || copy.en).error);
        return;
      }
      localStorage.setItem('vertex_legal_acceptance', JSON.stringify({ version: '2026-09-17', acceptedAt: new Date().toISOString(), age18: true }));
    }
  }, true);

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('[data-consent-link]');
    if (!link) return;
    const id = link.dataset.consentLink === 'terms' ? 'linkTerms' : link.dataset.consentLink === 'privacy' ? 'linkPrivacy' : 'linkResponsible';
    document.getElementById(id)?.click();
  });

  document.addEventListener('vertex:languagechange', () => setTimeout(injectConsent, 0));

  function boot() {
    injectStyle();
    injectConsent();
    const modal = document.getElementById('modalContent');
    if (modal) new MutationObserver(() => injectConsent()).observe(modal, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
