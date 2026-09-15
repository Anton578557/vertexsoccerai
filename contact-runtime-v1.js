'use strict';

(() => {
  if (window.__vertexContactRuntimeV1) return;
  window.__vertexContactRuntimeV1 = true;

  function ensureStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  ensureStylesheet('contact-runtime-v1.css');

  function toast(message, ms = 3600) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  function buildForm() {
    const container = document.querySelector('#tab-contact .contact-container');
    if (!container || container.querySelector('#vertexContactForm')) return;

    const oldCard = container.querySelector('.contact-card');
    if (oldCard) oldCard.remove();

    const shell = document.createElement('div');
    shell.className = 'vertex-contact-shell';
    shell.innerHTML = `
      <form id="vertexContactForm" class="vertex-contact-form" novalidate>
        <div class="vertex-contact-grid">
          <label>
            <span>Name</span>
            <input id="contactName" name="name" type="text" maxlength="100" autocomplete="name" placeholder="Your name" required>
          </label>
          <label>
            <span>Email</span>
            <input id="contactEmail" name="email" type="email" maxlength="180" autocomplete="email" placeholder="you@example.com" required>
          </label>
        </div>
        <label>
          <span>Message</span>
          <textarea id="contactMessage" name="message" maxlength="3000" rows="7" placeholder="Describe the issue, match or question…" required></textarea>
        </label>
        <div class="vertex-contact-actions">
          <button id="contactSubmit" class="btn-primary" type="submit">SEND MESSAGE</button>
          <a class="vertex-contact-email" href="mailto:vertexsoccerai@outlook.com">vertexsoccerai@outlook.com</a>
        </div>
        <p id="contactStatus" class="vertex-contact-status" aria-live="polite"></p>
      </form>`;
    container.appendChild(shell);

    shell.querySelector('#vertexContactForm')?.addEventListener('submit', submitContact);
  }

  async function submitContact(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('#contactSubmit');
    const status = form.querySelector('#contactStatus');
    const name = form.querySelector('#contactName')?.value.trim() || '';
    const email = form.querySelector('#contactEmail')?.value.trim() || '';
    const message = form.querySelector('#contactMessage')?.value.trim() || '';

    if (!name || !/^\S+@\S+\.\S+$/.test(email) || message.length < 5) {
      if (status) status.textContent = 'Enter your name, a valid email and a message.';
      toast('Please complete the contact form.');
      return;
    }

    const original = button?.textContent || 'SEND MESSAGE';
    if (button) {
      button.disabled = true;
      button.textContent = 'SENDING…';
    }
    if (status) status.textContent = 'Sending securely through Vertex…';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, message })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);

      form.reset();
      if (status) status.textContent = 'Message sent. We will reply by email.';
      toast('Message sent successfully.');
    } catch (error) {
      if (status) status.textContent = error?.message || 'Message delivery failed. Please try again.';
      toast('Message delivery failed. Please try again.', 5000);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  function boot() {
    buildForm();
    const target = document.getElementById('tab-contact');
    if (target) {
      new MutationObserver(buildForm).observe(target, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
