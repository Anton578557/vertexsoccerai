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

  const copy = {
    en: { name: 'Name', namePh: 'Your name', email: 'Email', message: 'Message', messagePh: 'Describe the issue, match or question…', send: 'SEND MESSAGE', sending: 'SENDING…', invalid: 'Enter your name, a valid email and a message.', invalidToast: 'Please complete the contact form.', sendingStatus: 'Sending securely through Vertex…', sent: 'Message sent. We will reply by email.', sentToast: 'Message sent successfully.', failed: 'Message delivery failed. Please try again.' },
    ru: { name: 'Имя', namePh: 'Ваше имя', email: 'Электронная почта', message: 'Сообщение', messagePh: 'Опишите проблему, матч или вопрос…', send: 'ОТПРАВИТЬ СООБЩЕНИЕ', sending: 'ОТПРАВЛЯЕМ…', invalid: 'Укажите имя, корректную почту и сообщение.', invalidToast: 'Заполните форму обратной связи.', sendingStatus: 'Безопасно отправляем сообщение через Vertex…', sent: 'Сообщение отправлено. Мы ответим по электронной почте.', sentToast: 'Сообщение успешно отправлено.', failed: 'Не удалось отправить сообщение. Попробуйте позже.' },
    es: { name: 'Nombre', namePh: 'Tu nombre', email: 'Correo electrónico', message: 'Mensaje', messagePh: 'Describe el problema, partido o pregunta…', send: 'ENVIAR MENSAJE', sending: 'ENVIANDO…', invalid: 'Introduce tu nombre, un correo válido y un mensaje.', invalidToast: 'Completa el formulario de contacto.', sendingStatus: 'Enviando de forma segura a través de Vertex…', sent: 'Mensaje enviado. Responderemos por correo electrónico.', sentToast: 'Mensaje enviado correctamente.', failed: 'No se pudo enviar el mensaje. Inténtalo más tarde.' }
  };
  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  const t = () => copy[lang()] || copy.en;
  let statusKey = '', statusError = null;

  function showStatus(key,error=null) {
    statusKey=key; statusError=error;
    const el=document.getElementById('contactStatus');
    if(el) el.textContent=error ? window.VertexI18n.t(window.VertexI18n.errorKey(error,copy.en.failed)) : t()[key] || '';
  }

  function localizeForm() {
    const form = document.getElementById('vertexContactForm');
    if (!form) return;
    const text = t();
    const labels = form.querySelectorAll('label > span');
    if (labels[0]) labels[0].textContent = text.name;
    if (labels[1]) labels[1].textContent = text.email;
    if (labels[2]) labels[2].textContent = text.message;
    const name = form.querySelector('#contactName');
    const message = form.querySelector('#contactMessage');
    const button = form.querySelector('#contactSubmit');
    if (name) name.placeholder = text.namePh;
    if (message) message.placeholder = text.messagePh;
    if (button) button.textContent = button.disabled ? text.sending : text.send;
    showStatus(statusKey,statusError);
  }

  function toast(message, ms = 3600) {
    const el = document.getElementById('toast');
    if (!el) return;
    window.VertexI18n.setText(el,message);
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
    shell.setAttribute('data-i18n-owned','');
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
    localizeForm();
  }

  async function submitContact(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('#contactSubmit');
    const name = form.querySelector('#contactName')?.value.trim() || '';
    const email = form.querySelector('#contactEmail')?.value.trim() || '';
    const message = form.querySelector('#contactMessage')?.value.trim() || '';

    if (!name || !/^\S+@\S+\.\S+$/.test(email) || message.length < 5) {
      showStatus('invalid');
      toast(copy.en.invalidToast);
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = t().sending;
    }
    showStatus('sendingStatus');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, message })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error=new Error(data?.error || 'Request failed');error.status=response.status;throw error; }

      form.reset();
      showStatus('sent');
      toast(copy.en.sentToast);
    } catch (error) {
      showStatus('failed',error);
      toast(window.VertexI18n.errorKey(error,copy.en.failed), 5000);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = t().send;
      }
    }
  }

  function boot() {
    buildForm();
    localizeForm();
  }

  document.addEventListener('vertex:languagechange', localizeForm);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
