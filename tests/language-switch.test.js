'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const content = require('../locale-content');

// A small DOM fixture: exercise the real translator and language events without
// a browser dependency or changing application state in the production browser.
class Element {
  constructor(tag='div', text='', attrs={}) {
    this.tagName=tag.toUpperCase(); this.attrs={...attrs}; this.children=[];
    if(text) this.textContent=text;
  }
  append(child) { child.parentElement=this; this.children.push(child); return child; }
  get textContent() { return this.children.map(n=>n.nodeValue??n.textContent).join(''); }
  set textContent(text) { this.children=[];this.append({nodeValue:String(text)}); }
  hasAttribute(key) { return key in this.attrs; }
  getAttribute(key) { return this.attrs[key]??null; }
  setAttribute(key,value) { this.attrs[key]=String(value); }
  matches(selector) {
    return selector.split(',').some(part=>{
      part=part.trim();
      if(part.startsWith('.'))return (this.attrs.class||'').split(' ').includes(part.slice(1));
      const m=part.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      return m ? this.hasAttribute(m[1]) && (m[2]===undefined||this.attrs[m[1]]===m[2]) : this.tagName===part.toUpperCase();
    });
  }
  closest(selector) { return this.matches(selector)?this:this.parentElement?.closest(selector)||null; }
  querySelectorAll(selector) {
    return this.children.filter(n=>n instanceof Element).flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);
  }
}
function setup(language='en') {
  const body=new Element('body'), listeners=new Map(), storage=new Map([['vertex_language',language]]);
  const document={body,documentElement:{lang:language},readyState:'loading',getElementById:()=>null,
    addEventListener(name,fn){listeners.set(name,[...(listeners.get(name)||[]),fn]);},
    dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);},
    createTreeWalker(root){const nodes=[];const walk=n=>{for(const c of n.children||[])c.nodeValue===undefined?walk(c):nodes.push(c);};walk(root);return {nextNode:()=>nodes.shift()||null};}
  };
  const window={VertexLocaleContent:content};
  vm.runInNewContext(fs.readFileSync(require.resolve('../i18n.js'),'utf8'),{
    window,document,navigator:{language:'en'},Intl,NodeFilter:{SHOW_TEXT:4},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}
  });
  return {body,document,window,api:window.VertexI18n,storage};
}

test('static text and accessibility attributes survive EN → RU → ES → EN',()=>{
  const {body,document,api}=setup();
  const label=body.append(new Element('a','Match Analyzer'));
  const input=body.append(new Element('input','',{placeholder:'Your name','aria-label':'Language',title:'Open menu'}));
  for(const [language,title,placeholder,aria] of [['ru','Анализ матча','Ваше имя','Язык'],['es','Analizador','Tu nombre','Idioma'],['en','Match Analyzer','Your name','Language']]) {
    api.setLanguage(language);
    assert.equal(label.textContent,title);
    assert.equal(input.getAttribute('placeholder'),placeholder);
    assert.equal(input.getAttribute('aria-label'),aria);
    assert.equal(document.documentElement.lang,language);
  }
});

test('asynchronous text replacement is translated from the new message',()=>{
  const {body,api}=setup('ru');
  const label=body.append(new Element('p','Loading reviews…'));
  api.apply();
  label.textContent='Could not load reviews. Please open this section again.';
  api.apply();
  assert.match(label.textContent,/Не удалось загрузить отзывы/);
  api.setLanguage('es');assert.match(label.textContent,/No se pudieron cargar/);
  api.setLanguage('en');assert.equal(label.textContent,'Could not load reviews. Please open this section again.');
});

test('bound messages, counts and localized component toasts update without reload',()=>{
  const {body,api}=setup();
  const status=body.append(new Element()),count=body.append(new Element()),toast=body.append(new Element());
  api.setText(status,content.errorKey({code:'invalid_credentials'}));
  api.setText(count,'{count} analyses',{count:76});
  api.setLocalizedText(toast,{en:'Saved',ru:'Сохранено',es:'Guardado'});
  api.setLanguage('ru');assert.equal(status.textContent,'Неверная почта или пароль.');assert.equal(count.textContent,'Анализов: 76');assert.equal(toast.textContent,'Сохранено');
  api.setLanguage('es');assert.equal(count.textContent,'Análisis: 76');assert.equal(toast.textContent,'Guardado');
  api.setLanguage('en');assert.equal(status.textContent,'Invalid email or password.');assert.equal(count.textContent,'76 analyses');
});

test('component-owned text, user reviews and quoted articles keep their original content',()=>{
  const {body,api}=setup();
  const owned=body.append(new Element('section','',{'data-i18n-owned':''}));
  const input=owned.append(new Element('input','',{placeholder:'Ваше имя'}));
  const review=body.append(new Element('p','Home',{translate:'no'}));
  const strategy=body.append(new Element('div','',{'class':'vs-root'}));
  strategy.append(new Element('p','Loading'));
  api.setLanguage('es');
  assert.equal(input.getAttribute('placeholder'),'Ваше имя');assert.equal(review.textContent,'Home');assert.equal(strategy.textContent,'Loading');
});

test('provider diagnostics, errors and countries are localized without changing identities',()=>{
  for(const lang of ['ru','es']) {
    for(const raw of ['awaiting_verification','http_error','http_429','insufficient_recent_history','Connected · verified match history','Recent-form sample is limited (3 / 4 completed matches).','Fallback used · 3 cached calls']) {
      const translated=content.diagnostic(raw,lang);assert.notEqual(translated,raw);assert.ok(!translated.includes('undefined'));
    }
    assert.notEqual(content.country('Brazil',lang),'Brazil');
    assert.equal(content.diagnostic('BSD',lang),'BSD');
    assert.ok(content.diagnostic('BSD · verified regulation-time results',lang).startsWith('BSD · '));
    const key=content.errorKey({message:'Unexpected private upstream failure'});
    assert.notEqual(content.text(key,lang),key);
    assert.ok(!content.text(key,lang).includes('private'));
  }
  assert.equal(content.country('England','es'),'Inglaterra');
  assert.equal(content.country('Japan','ru'),'Япония');
});

test('all literal labels and placeholders in access, login and signup dialogs have translations',()=>{
  const {api,body}=setup();
  const source=fs.readFileSync(require.resolve('../script.js'),'utf8');
  const dialogs=source.slice(source.indexOf('function showAccessModal'),source.indexOf('async function initAuth'));
  const labels=[...dialogs.matchAll(/>([^<>`$]+)</g)].map(m=>m[1].trim()).filter(Boolean);
  assert.ok(labels.includes('SIGN UP'));
  for(const lang of ['ru','es']) {
    for(const label of labels) assert.notEqual(api.t(label,{},lang),label,`${lang}: ${label}`);
    const placeholders=[...dialogs.matchAll(/placeholder="([^"]+)"/g)].map(m=>m[1]);
    const inputs=placeholders.map(placeholder=>body.append(new Element('input','',{placeholder})));
    api.setLanguage(lang);
    inputs.forEach((input,i)=>assert.notEqual(input.getAttribute('placeholder'),placeholders[i]));
  }
});
