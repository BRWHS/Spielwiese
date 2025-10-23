// --- global debounce shim (muss VOR jeder Nutzung stehen) ---
if (typeof window.debounce !== 'function') {
  window.debounce = function(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
}

(() => {
  // === Canonical rates storage key (fixes undefined RATES_KEY / RKEY mismatch) ===
  var RATES_KEY = (typeof window !== 'undefined' && window.RATES_KEY) ? window.RATES_KEY : 'resTool.rates';
  if (typeof window !== 'undefined') window.RATES_KEY = RATES_KEY;

  // ===== Re-Init Guard (verhindert doppeltes Registrieren von Listenern) =====
  if (window.__RESTOOL_APP_V2__) return;
  window.__RESTOOL_APP_V2__ = true;

  // ===== Modal Manager (Stacking) =====
(function () {
  if (window.__RESTOOL_MODAL_CORE__) return;
  window.__RESTOOL_MODAL_CORE__ = true;

  function ensureBackdrop(){
    let b = document.getElementById('backdrop') || document.querySelector('.modal-backdrop');
    if (!b){
      b = document.createElement('div');
      b.id = 'backdrop';
      b.className = 'modal-backdrop';
      document.body.appendChild(b);
    }
    return b;
  }
  function asEl(target){
    if (!target) return null;
    if (typeof target === 'string') return document.getElementById(target.replace(/^#/,''));
    return target.nodeType ? target : null;
  }

  const STACK = (window.__MODAL_STACK__ ||= []);

  function openModal(target){
    const el = asEl(target);
    if (!el) return;

    const prevTop = STACK[STACK.length - 1];
    const prevTopZ = prevTop
      ? parseInt(prevTop.style.zIndex || getComputedStyle(prevTop).zIndex || '60', 10)
      : 60;

    if (prevTop && prevTop !== el) { /* keep parent visible and interactive */ }

    const b = ensureBackdrop();
    b.classList.add('open');
    b.style.display = 'block';
    b.setAttribute('aria-hidden','false');
    // Backdrop zwischen alt (prevTop) und neu (el)
    b.style.zIndex = String(prevTopZ + 1);

    el.classList.add('open');
    el.setAttribute('aria-hidden','false');
    el.style.zIndex = String(prevTopZ + 2);

    STACK.push(el);
    document.documentElement.classList.add('modal-open');

    const focusEl = el.querySelector('[data-close]') || el.querySelector('h3, h2, [tabindex], button, input, select, textarea');
    focusEl?.focus?.({ preventScroll: true });
  }

  function closeModal(target){
    const b = ensureBackdrop();
    const el = asEl(target) || STACK[STACK.length - 1];
    if (!el) return;

    const idx = STACK.lastIndexOf(el);
    if (idx >= 0) STACK.splice(idx, 1);

    el.classList.remove('open','blurred');
    el.style.pointerEvents = '';
    el.style.zIndex = '';
    el.setAttribute('aria-hidden','true');

    const newTop = STACK[STACK.length - 1];
    if (newTop){
      const newTopZ = parseInt(newTop.style.zIndex || getComputedStyle(newTop).zIndex || '60', 10);
      b.style.zIndex = String(newTopZ - 1);
      newTop.classList.remove('blurred');
      newTop.style.pointerEvents = '';
      newTop.focus?.({ preventScroll: true });
    } else {
      b.classList.remove('open');
      b.style.display = 'none';
      b.setAttribute('aria-hidden','true');
      document.documentElement.classList.remove('modal-open');
    }
  }

// Extra safety: if no open modals are visible, make sure backdrop is hidden
(function(){ 
  try {
    const anyOpen = document.querySelector('.modal.open');
    if (!anyOpen) {
      const b = document.getElementById('backdrop') || document.querySelector('.modal-backdrop');
      if (b) { b.classList.remove('open'); b.style.display='none'; b.setAttribute('aria-hidden','true'); }
      document.documentElement.classList.remove('modal-open');
      // Reset modal stack to avoid stale entries
      if (Array.isArray(window.__MODAL_STACK__)) window.__MODAL_STACK__.length = 0;
    }
  } catch(e){ /* noop */ }
})();

  window.openModal  = openModal;
  window.closeModal = closeModal;

  // ESC → nur oberstes Modal schließen
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeModal(); });

  // Backdrop-Klick → nur oberstes Modal schließen
  ensureBackdrop().addEventListener('click', ()=> closeModal());

  // [data-close] Buttons
  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-close]');
    if (!btn) return;
    e.preventDefault();
    closeModal(btn.closest('.modal'));
  }, { passive:false });
})();

// Legacy-Alias, damit alle vorhandenen Listener weiter funktionieren
var openModal  = window.openModal;
var closeModal = window.closeModal;

// ESC schließt immer
window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') window.closeModal(); });


  /***** Supabase *****/
  const SB_URL = "https://kytuiodojfcaggkvizto.supabase.co";
  const SB_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dHVpb2RvamZjYWdna3ZpenRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MzA0NjgsImV4cCI6MjA3MDQwNjQ2OH0.YobQZnCQ7LihWtewynoCJ6ZTjqetkGwh82Nd2mmmhLU";
  const SB = window.supabase.createClient(SB_URL, SB_ANON_KEY);

  // === User-Passwörter (lokal, gehashed) ===
const LS_PW_KEY = 'resTool.userPw';

function readPwMap(){
  try { return JSON.parse(localStorage.getItem(LS_PW_KEY) || '{}'); }
  catch { return {}; }
}
function writePwMap(map){
  try { localStorage.setItem(LS_PW_KEY, JSON.stringify(map||{})); } catch {}
}

// SHA-256-Hash (Hex)
async function sha256Hex(str){
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Passwort setzen/entfernen (pw == null → löschen)
async function setUserPassword(userId, pw){
  const map = readPwMap();
  if (pw == null) { delete map[userId]; writePwMap(map); return true; }
  const hex = await sha256Hex(pw);
  map[userId] = hex;
  writePwMap(map);
  return true;
}


  if (!SB?.from) {
  console.error('Supabase-Client nicht initialisiert – prüfe Script-Einbindung!');
}
  // >>> EINZEILER EINFÜGEN (globaler Alias, damit Handler außerhalb vom Closure SB finden)
window.SB = SB;

  // ===== Auth/Rollen – Minimal-Layer =====
// Quelle für aktuellen User: bevorzugt window.__AUTH_USER__ (aus auth.js), sonst LocalStorage-Fallback
function getCurrentUser(){
  try {
    if (window.__AUTH_USER__ && window.__AUTH_USER__.username) return window.__AUTH_USER__;
    const raw = localStorage.getItem('resTool.user');
    if (raw) return JSON.parse(raw);
  } catch(e){}
  return { username: 'viewer', role: 'viewer' };
}

// UI-Badge rechts oben füllen
function syncAuthUi(){
  const u = getCurrentUser();
  const n = document.getElementById('authUserInline');
  if (n) n.textContent = u?.username ? `${u.username} (${u.role||'viewer'})` : '—';
}
syncAuthUi();
window.addEventListener('auth:login', syncAuthUi);
window.addEventListener('auth:logout', syncAuthUi);

// Role-Gates: Elemente mit data-role-required="admin" o.ä. sperren/ausblenden
function enforceRoleGates(){
  const u = getCurrentUser();
  const roleRank = { viewer:1, agent:2, admin:3 };
  const rank = roleRank[u.role] || 1;

  // admin-only / agent-only / viewer-only
  document.querySelectorAll('[data-role-required]').forEach(el=>{
    const need = String(el.dataset.roleRequired||'').toLowerCase();
    const needRank = roleRank[need] || 99;
    const allow = rank >= needRank;
    el.style.display = allow ? '' : 'none';
    el.disabled = !allow;
    el.setAttribute('aria-disabled', String(!allow));
  });

  // read-only für viewer: Buttons, Inputs sperren (aber Anzeigen erlauben)
  const isViewer = (u.role||'viewer') === 'viewer';
  document.querySelectorAll('button, input, select, textarea').forEach(el=>{
    if (isViewer){
     // Ausnahmen: reine Navigation/Modals + Scheduler
const okIds = new Set(['btnAvail','btnReporting','btnRepSchedule','btnRepSave','btnRepTest']);
const isNav = okIds.has(el.id) || el.closest('#modalReporting') || el.closest('#modalRepScheduler');
if (!isNav) {
  el.disabled = (el.tagName==='BUTTON' || el.tagName==='INPUT' || el.tagName==='SELECT' || el.tagName==='TEXTAREA');
}
    }
  });
}
enforceRoleGates();
window.addEventListener('auth:login', enforceRoleGates);
window.addEventListener('auth:logout', enforceRoleGates);

// Globales Audit-Log (schreibt nach Supabase.activity_log); fällt auf console zurück
async function logActivity(type, action, meta){
  try {
    const u = getCurrentUser();
    await SB.from('activity_log').insert({
      user_name: u?.username || null,
      user_role: u?.role || null,
      type, action, meta
    });
  } catch(e){
    console.warn('logActivity fallback', {type, action, meta, err:String(e)});
  }
}
window.logActivity = logActivity;


  // === User Management (Supabase: app_users; Fallback: LocalStorage) ===
const USERS_TABLE = 'app_users';
const LS_USERS_KEY = 'resTool.users';

// Privater Cache
let __users = [];

// LocalStorage-Fallback laden/speichern
function readUsersLS(){
  try { return JSON.parse(localStorage.getItem(LS_USERS_KEY) || '[]'); } catch(_) { return []; }
}
function writeUsersLS(list){
  try { localStorage.setItem(LS_USERS_KEY, JSON.stringify(list||[])); } catch(_) {}
}
  const LS_CODES_KEY = 'resTool.userAccessCodes'; // { [userId]: "123456" }
function readCodes(){ try { return JSON.parse(localStorage.getItem(LS_CODES_KEY)||'{}'); } catch(_) { return {}; } }
function writeCodes(map){ try { localStorage.setItem(LS_CODES_KEY, JSON.stringify(map||{})); } catch(_){} }

function generateCode(){ return String(Math.floor(100000 + Math.random()*900000)); } // 6-stellig


// Normalisiere Datensatz
function normalizeUser(u){
  const name  = (u.name||'').trim();
  const email = (u.email||'').trim().toLowerCase();
  const role  = String(u.role || 'agent').toLowerCase();

  // Stabile ID: bevorzugt Supabase-ID, sonst E-Mail, sonst Name, erst dann random
  const id = u.id
    || (email ? `email:${email}` : (name ? `name:${name.toLowerCase()}` : (crypto.randomUUID?.() || ('u_'+Date.now()))));

  return {
    id, name, email, role,
    active: (typeof u.active==='boolean') ? u.active : String(u.active) !== 'false',
    created_at: u.created_at || new Date().toISOString()
  };
}

  // --- Default-Admin seeden (falls Liste leer) ---
async function ensureDefaultAdminSeed(){
  // nur seeden, wenn gar keine Nutzer vorhanden
  if ((__users||[]).length > 0) return;

  const seed = normalizeUser({
    name: 'Admin',
    email: 'admin@local',  // rein informativ
    role: 'admin',
    active: true
  });

  // Supabase versuchen
  try{
    const { error } = await SB.from(USERS_TABLE).insert({
      id: seed.id, name: seed.name, email: seed.email,
      role: seed.role, active: seed.active, created_at: seed.created_at
    });
    if (!error) { __users = [seed]; return; }
  }catch(_){}

  // Fallback: LocalStorage
  const list = readUsersLS();
  list.unshift(seed);
  writeUsersLS(list);
  __users = list;
}


async function loadUsers(){
  // Beide Quellen laden
  let sbList = [];
  try {
    const { data, error } = await SB.from(USERS_TABLE).select('*').order('created_at',{ascending:false});
    if (!error && Array.isArray(data)) {
      sbList = data.map(normalizeUser);
    }
  } catch(_) {}

  const lsList = readUsersLS().map(normalizeUser);

  // „Tombstones“ (lokal gelöschte IDs), damit aus Supabase kommendes nicht „wieder auftaucht“
  const removed = (function(){
    try { return JSON.parse(localStorage.getItem('resTool.usersRemoved')||'[]'); }
    catch { return []; }
  })();
  const removedSet = new Set(removed);

  // Merge: Supabase bevorzugen, LocalStorage ergänzen, Entfernte filtern
  const map = new Map();
  for (const u of sbList) { if (!removedSet.has(u.id)) map.set(u.id, u); }
  for (const u of lsList) { if (!removedSet.has(u.id) && !map.has(u.id)) map.set(u.id, u); }

  __users = Array.from(map.values())
    .sort((a,b)=> String(b.created_at).localeCompare(String(a.created_at)));

  // Falls komplett leer → Default-Admin säen
  if ((__users||[]).length === 0) {
    await ensureDefaultAdminSeed();
  }

  renderUsers();
}


function renderUsers(){
  const tbody = document.getElementById('usrBody');
  if (!tbody) return;

  const term = (document.getElementById('usrSearch')?.value || '').toLowerCase();
  const roleF = (document.getElementById('usrRoleFilter')?.value || 'all');

  const rows = __users.filter(u=>{
    const okRole = roleF==='all' || u.role===roleF;
    const okTerm = !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
    return okRole && okTerm;
  });

  tbody.innerHTML = rows.map(u => `
    <tr data-id="${u.id}">
      <td>${escapeHtml(u.name||'')}</td>
      <td>${escapeHtml(u.email||'')}</td>
      <td>${escapeHtml(u.role||'')}</td>
      <td>${u.active ? 'ja' : 'nein'}</td>
      <td>${new Date(u.created_at).toLocaleString('de-DE')}</td>
     <td class="row-actions">
  <button class="btn sm ghost" data-usr-toggle="${u.id}">${u.active?'Deaktivieren':'Aktivieren'}</button>
  <button class="btn sm" data-usr-pass="${u.id}">Passwort setzen</button>
  <button class="btn sm danger" data-usr-del="${u.id}">Löschen</button>
</td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="muted">Keine Benutzer gefunden.</td></tr>`;
}

// simples Escaping
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  async function createUser(u){
  const rec = normalizeUser(u);

  // Supabase zuerst versuchen
  try{
    const { error } = await SB.from(USERS_TABLE).insert({
      id: rec.id, name: rec.name, email: rec.email,
      role: rec.role, active: rec.active, created_at: rec.created_at
    });
    if (!error) return rec;
    // wenn 42P01 (relation does not exist) → Fallback
  }catch(_){}

  // Fallback: LocalStorage
  const list = readUsersLS();
  list.unshift(rec);
  writeUsersLS(list);
  return rec;
}
  async function deleteUser(id){
  // Supabase versuchen
  try{
    const { error } = await SB.from(USERS_TABLE).delete().eq('id', id);
    if (!error){
      __users = __users.filter(u=>u.id!==id);
      renderUsers();
      return true;
    }
  }catch(_){}

  // LocalStorage-List anpassen
  const list = readUsersLS().filter(u=>u.id!==id);
  writeUsersLS(list);

  // Tombstone setzen
  let removed = [];
  try { removed = JSON.parse(localStorage.getItem('resTool.usersRemoved')||'[]'); } catch(_){}
  if (!removed.includes(id)) removed.push(id);
  try { localStorage.setItem('resTool.usersRemoved', JSON.stringify(removed)); } catch(_){}

  // UI
  __users = __users.filter(u=>u.id!==id);
  renderUsers();
  return true;
}



async function toggleUserActive(id){
  const u = __users.find(x=>x.id===id);
  if (!u) return false;
  const next = !u.active;

  // Supabase
  try{
    const { error } = await SB.from(USERS_TABLE).update({ active: next }).eq('id', id);
    if (!error){ u.active = next; renderUsers(); return true; }
  }catch(_){}

  // Fallback
  const list = readUsersLS();
  const idx = list.findIndex(x=>x.id===id); if (idx>=0){ list[idx].active = next; writeUsersLS(list); }
  u.active = next; renderUsers(); return true;
}
  // === Benutzerverwaltung im Einstellungen-Modal (Panel) ===
(function bindUserAdminPanel(){
  const panel = document.getElementById('userAdminPanel');
  const btnOpen = document.getElementById('btnUserPrefs');
  const btnClose = document.getElementById('btnUserPanelClose');

  if (!panel || !btnOpen) return;

  // Öffnen über "Benutzereinstellungen"
  btnOpen.addEventListener('click', async ()=>{
    panel.classList.remove('hidden');
    try { await loadUsers(); } catch(_) {}
    // etwas scrollen, damit Panel im Blick ist
    panel.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  // Panel schließen (blend only)
  btnClose?.addEventListener('click', ()=>{
    panel.classList.add('hidden');
  });

  // Suche & Rollenfilter
  document.getElementById('usrSearch')?.addEventListener('input', debounce(()=>renderUsers(), 200));
  document.getElementById('usrRoleFilter')?.addEventListener('change', ()=>renderUsers());

  // Neuanlage
  document.getElementById('btnUserCreate')?.addEventListener('click', async ()=>{
    const name  = (document.getElementById('newUserName')?.value || '').trim();
    const email = (document.getElementById('newUserEmail')?.value || '').trim();
    const role  = document.getElementById('newUserRole')?.value || 'agent';
    const pw    = (document.getElementById('newUserPw')?.value || '').trim();

    if (!name){ alert('Bitte Login-Name angeben.'); return; }

    const rec = await createUser({ name, email, role, active:true });

    if (pw) { try { await setUserPassword(name, pw); } catch(_) {} }

    try { await logActivity('settings','user_create',{ name, role, via:'ui' }); } catch(_){}

    // Felder leeren + Liste neu
    const ids = ['newUserPw','newUserName','newUserEmail'];
    ids.forEach(id => { const n = document.getElementById(id); if (n) n.value=''; });
    await loadUsers();
  });

  // Tabellenaktionen via Event Delegation
  document.addEventListener('click', async (e)=>{
    const t = e.target;

    // Aktivieren/Deaktivieren
    const tgl = t.closest?.('[data-usr-toggle]');
    if (tgl){
      e.preventDefault();
      const id = tgl.getAttribute('data-usr-toggle');
      await toggleUserActive(id);
      try { await logActivity('settings','user_toggle',{ id }); } catch(_){}
      return;
    }

    // Einmalcode setzen (6-stellig)
    const setCode = t.closest?.('[data-usr-code]');
    if (setCode){
      e.preventDefault();
      const id = setCode.getAttribute('data-usr-code');
      try {
        const map = (function(){ try { return JSON.parse(localStorage.getItem('resTool.userAccessCodes')||'{}'); } catch { return {}; } })();
        map[id] = String(Math.floor(100000 + Math.random()*900000));
        localStorage.setItem('resTool.userAccessCodes', JSON.stringify(map));
        try { await logActivity('settings','user_code_set',{ id }); } catch(_){}
        alert('Zugangscode gesetzt.');
      } catch(_){}
      return;
    }

    // Einmalcode löschen
    const delCode = t.closest?.('[data-usr-code-del]');
    if (delCode){
      e.preventDefault();
      const id = delCode.getAttribute('data-usr-code-del');
      try {
        const map = (function(){ try { return JSON.parse(localStorage.getItem('resTool.userAccessCodes')||'{}'); } catch { return {}; } })();
        delete map[id];
        localStorage.setItem('resTool.userAccessCodes', JSON.stringify(map));
        try { await logActivity('settings','user_code_del',{ id }); } catch(_){}
        alert('Zugangscode gelöscht.');
      } catch(_){}
      return;
    }

    // Benutzer löschen
    const del = t.closest?.('[data-usr-del]');
    if (del){
      e.preventDefault();
      const id = del.getAttribute('data-usr-del');
      if (!confirm('Benutzer wirklich löschen?')) return;
      await deleteUser(id);
      try { await logActivity('settings','user_delete',{ id }); } catch(_){}
      return;
    }
  });
})();


  // ===== Confirmation: Templates & Modal Control =====

// Optional: hotel-spezifische Templates (später pflegen)
const confirmationTemplatesByHotel = {
  // Beispiel:
  // 'MA7-M-DOR': {
  //   subject: ({hotel}) => `Ihre Buchungsbestätigung – ${hotel.display_name || hotel.name || 'Ihr Hotel'}`,
  //   body: ({guest,res,hotel}) => `Hallo ${[guest.first_name, guest.last_name].filter(Boolean).join(' ')||'Gäst*in'},\n\n...`
  // }
};

function defaultConfirmationTemplate({ guest, res, hotel }) {
  const name = [guest?.first_name, guest?.last_name].filter(Boolean).join(' ') || 'Gäst*in';
  const arrival = res?.arrival || '';
  const departure = res?.departure || '';
  const hotelName = hotel?.display_name || hotel?.name || hotel?.hotel_name || 'Ihr Hotel';
  const category = res?.category || res?.category_name || '';
  const rate = res?.rate_name || '';
  const total = (typeof res?.total === 'number') ? res.total.toFixed(2) + ' €' : '';
  const resNo = res?.reservation_number || res?.id || '';

  return {
    subject: `Ihre Buchungsbestätigung – ${hotelName}`,
    body:
`Hallo ${name},

vielen Dank für Ihre Reservierung im ${hotelName}.

• Anreise: ${arrival}
• Abreise: ${departure}
${category ? `• Kategorie: ${category}\n` : ''}${rate ? `• Rate: ${rate}\n` : ''}${total ? `• Gesamtpreis: ${total}\n` : ''}${resNo ? `• Reservierungsnummer: ${resNo}\n` : ''}

Bei Rückfragen sind wir gerne für Sie da.
Herzliche Grüße
${hotelName} Reservierung`
  };
}

function buildConfirmationContent({ hotel, guest, res }) {
  const key = hotel?.code || hotel?.hotel_code || hotel?.display_name || '';
  const tpl = confirmationTemplatesByHotel[key];
  if (tpl) {
    const subject = typeof tpl.subject === 'function' ? tpl.subject({hotel, guest, res}) : tpl.subject;
    const body = typeof tpl.body === 'function' ? tpl.body({hotel, guest, res}) : tpl.body;
    return { subject, body };
  }
  return defaultConfirmationTemplate({ hotel, guest, res });
}

function openConfirmationModal(context) {
  const modal = document.getElementById('confirmEmailModal');
  if (!modal) return;
  const { hotel, guest, res } = context || {};
  const content = buildConfirmationContent({ hotel, guest, res });

  const input = document.getElementById('confirmEmailTo');
  const ta = document.getElementById('confirmEmailBody');

  // Prefill E-Mail: beachtet dein Feld 'guest_email'
  const guessedEmail =
    res?.guest_email ||
    guest?.email ||
    document.querySelector('#step1 input[type="email"], input[name="email"], #guestEmail')?.value ||
    '';

  input.value = guessedEmail || '';
  input.dataset.subject = content.subject || '';
  ta.value = content.body || '';

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeConfirmationModal() {
  const modal = document.getElementById('confirmEmailModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

// Close-Click
document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (t?.dataset?.close === 'confirmEmailModal' || t?.closest?.('[data-close="confirmEmailModal"]')) {
    closeConfirmationModal();
  }
});

// Versand-Hook (vorerst Mailto; später echte API)
async function sendConfirmationEmail({ to, subject, body, context }) {
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
  await new Promise(r=>setTimeout(r,200)); // kurzer Tick für UX
  return { ok: true };
}

// Button im Modal binden (einmalig)
(function bindSendConfirmationNow(){
  const btn = document.getElementById('btnSendConfirmationNow');
  if (!btn || btn.__bound) return;
  btn.__bound = true;

  btn.addEventListener('click', async () => {
    const to = document.getElementById('confirmEmailTo')?.value?.trim();
    const body = document.getElementById('confirmEmailBody')?.value || '';
    const subject = document.getElementById('confirmEmailTo')?.dataset?.subject || 'Ihre Buchungsbestätigung';
    if (!to) { alert('Bitte eine gültige E-Mail eintragen.'); return; }
    btn.disabled = true;
    try{
      const ctx = window.__lastReservationContext || {};
      const res = await sendConfirmationEmail({ to, subject, body, context: ctx });
      if (res?.ok){
        alert('Bestätigung wurde versendet.');
        closeConfirmationModal();
        window.dispatchEvent(new Event('confirmation:sent'));
      } else {
        alert('Senden fehlgeschlagen. Bitte später erneut versuchen.');
      }
    }catch(e){
      console.error(e);
      alert('Senden fehlgeschlagen. Bitte später erneut versuchen.');
    }finally{
      btn.disabled = false;
    }
  });
})();

  

  /***** Bildquellen *****/
  const HOTEL_IMG_SRC  = "/assets/hotel-placeholder.png";
  const SKETCH_IMG_SRC = "/assets/sketch-placeholder.png";
  const IMG_FALLBACK = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'>
       <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
         <stop offset='0' stop-color='#0ea5b0'/><stop offset='1' stop-color='#052a36'/>
       </linearGradient></defs>
       <rect width='800' height='500' rx='24' fill='url(#g)'/>
       <text x='50%' y='50%' fill='#9adce6' font-family='Inter' font-size='24' text-anchor='middle'>Kein Bild</text>
     </svg>`
  );

  /***** Hotels (UI-Liste) *****/
  const HOTELS = [
    { group:'MASEVEN',  name:'MASEVEN München Dornach',   code:'MA7-M-DOR' },
    { group:'MASEVEN',  name:'MASEVEN München Trudering', code:'MA7-M-TRU' },
    { group:'MASEVEN',  name:'MASEVEN Frankfurt',         code:'MA7-FRA' },
    { group:'MASEVEN',  name:'MASEVEN Stuttgart',         code:'MA7-STR' },
    { group:'Fidelity', name:'Fidelity Robenstein',       code:'FID-ROB' },
    { group:'Fidelity', name:'Fidelity Struck',           code:'FID-STR' },
    { group:'Fidelity', name:'Fidelity Doerr',            code:'FID-DOE' },
    { group:'Fidelity', name:'Fidelity Gr. Baum',         code:'FID-GRB' },
    { group:'Fidelity', name:'Fidelity Landskron',        code:'FID-LAN' },
    { group:'Fidelity', name:'Fidelity Pürgl',            code:'FID-PUE' },
    { group:'Fidelity', name:'Fidelity Seppl',            code:'FID-SEP' },
    { group:'Tante Alma', name:'Tante Alma Bonn',         code:'TAL-BON' },
    { group:'Tante Alma', name:'Tante Alma Köln',         code:'TAL-KOE' },
    { group:'Tante Alma', name:'Tante Alma Erfurt',       code:'TAL-ERF' },
    { group:'Tante Alma', name:'Tante Alma Mannheim',     code:'TAL-MAN' },
    { group:'Tante Alma', name:'Tante Alma Mülheim',      code:'TAL-MUE' },
    { group:'Tante Alma', name:'Tante Alma Sonnen',       code:'TAL-SON' },
    { group:'Delta by Marriot', name:'Delta by Marriot Offenbach', code:'DBM-OF' },
    { group:'Villa Viva', name:'Villa Viva Hamburg',      code:'VV-HH' },
  ];
  const BRAND_PREFIXES = ['MASEVEN','Fidelity','Tante Alma','Delta by Marriot','Villa Viva'];
  const hotelCity = (full) => {
    if(!full) return '';
    for (const p of BRAND_PREFIXES){ if(full.startsWith(p+' ')) return full.slice(p.length+1); }
    return full;
  };
  const displayHotel = (h) => h ? `${h.group} - ${hotelCity(h.name)}` : '—';
  window.HOTELS = HOTELS;

  /* Alias-Keyword für Filter-Fallback per hotel_name */
  const HOTEL_KEYWORD = {
    'MA7-M-DOR':'Dornach','MA7-M-TRU':'Trudering','MA7-FRA':'Frankfurt','MA7-STR':'Stuttgart',
    'FID-ROB':'Robenstein','FID-STR':'Struck','FID-DOE':'Doerr','FID-GRB':'Baum','FID-LAN':'Landskron','FID-PUE':'Pürgl','FID-SEP':'Seppl',
    'TAL-BON':'Bonn','TAL-KOE':'Köln','TAL-ERF':'Erfurt','TAL-MAN':'Mannheim','TAL-MUE':'Mülheim','TAL-SON':'Sonnen',
    'DBM-OF':'Offenbach','VV-HH':'Hamburg'
  };

  /***** Dummy Kategorien/Raten *****/
  const HOTEL_CATEGORIES = { default: ['Standard','Superior','Suite'] };
  const HOTEL_RATES = { default: [
    {name:'Flex exkl. Frühstück', price:89},
    {name:'Flex inkl. Frühstück', price:109}
  ]};

  /***** Kategorie-Metadaten (Step 2) *****/
  const CAT_META = {
    'Standard':  { size:'18–22 m²', beds:'Queen (160)',    note:'Komfortabel, ruhig' },
    'Superior':  { size:'22–28 m²', beds:'King (180)/Twin', note:'Mehr Platz, Sitzecke' },
    'Suite':     { size:'35–45 m²', beds:'King (180)',      note:'Separater Wohnbereich' }
  };

  /***** Helpers *****/
  const D2 = new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
  const Dm = new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit'});
  const EUR = new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
  // neu (fix: große Beträge + zwei Nachkommastellen):
const euro = v=>{
  if (v == null || isNaN(v)) return '— €';
  return new Intl.NumberFormat('de-DE',{
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(Number(v));
};
  
// Gibt gemappte Raten für Hotel+*Kategorie* zurück; wir brauchen hier nur Name/Preis.
// Fallback: Default-Dummy
function getRatesForHotel(hotelCode){
  try {
    // Versuch: gemappte Raten über bestehende Funktion (falls vorhanden)
    const cats = getCategoriesForHotel(hotelCode).map(c=>c.name);
    const uniq = new Map();
    cats.forEach(c=>{
      const list = getMappedRatesFor(hotelCode, c) || [];
      list.forEach(r => uniq.set(r.name, { name: r.name, price: r.price }));
    });
    const arr = [...uniq.values()];
    if (arr.length) return arr;
  } catch(e){}
  // Fallback
  return (window.HOTEL_RATES?.default || []).map(r => ({ name:r.name, price:r.price }));
}

function fillRatesDropdown(sel, hotelCode){
  if (!sel) return;
  const list = getRatesForHotel(hotelCode);
  sel.innerHTML = list.map(r=>`<option value="${r.name}" data-price="${r.price}">${r.name} (${r.price.toLocaleString('de-DE')} €)</option>`).join('');
}

  

  const pct  = v=>v==null?'—%':`${v}%`;
  const soD = d=>{const x=new Date(d); x.setHours(0,0,0,0); return x;};
  const isoDate = d => d.toISOString().slice(0,10);
  const q = s=>document.querySelector(s);
  const qa = s=>Array.from(document.querySelectorAll(s));
  function el(tag,attrs={},...kids){
    const e=document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if (k==='class') e.className=v;
      else if (k==='html') e.innerHTML=v;
      else e.setAttribute(k,v);
    });
    kids.forEach(k=>e.append(k));
    return e;
  }
  function debounce(fn, ms = 300){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
  function setChip(node, ok){ node?.classList.remove('lvl-2','lvl-1','lvl-0'); node?.classList.add(ok?'lvl-0':'lvl-1'); }
  function download(filename, mime, content){
    const blob = new Blob([content], {type:mime});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }
  function isoWeek(d){
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(),0,4));
    const diff = (date - firstThursday) / 86400000;
    return 1 + Math.round(diff / 7);
  }
  // YYYY-MM-DD aus *lokaler* Zeit (ohne UTC-Shift)
function isoDateLocal(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
  // Occupancy → Klasse für Farblegende
function occClass(pct){
  if (pct == null || isNaN(pct)) return '';
  if (pct <= 64) return 'occ-g';
  if (pct <= 89) return 'occ-o';
  return 'occ-r';
}
// Datums-Range (lokal, inkl. beide Enden)
function dateRange(startISO, days){
  const out = [];
  const [y,m,d] = startISO.split('-').map(Number);
  const s = new Date(y, (m||1)-1, d||1);
  for (let i=0;i<days;i++){
    const x = new Date(s); x.setDate(s.getDate()+i);
    out.push(isoDateLocal(x));
  }
  return out;
}


  // ==== Priceplan Helpers ====
const DAY_MS = 86400000;

function nightsBetween(arrISO, depISO){
  if (!arrISO || !depISO) return [];
  const arr = toDateOnly(arrISO);
  const dep = toDateOnly(depISO);
  const out = [];
  for (let d = new Date(arr); d < dep; d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1)){
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1);
    out.push({
      from: isoDateLocal(d),
      to:   isoDateLocal(to),
      wFrom: d.toLocaleDateString('de-DE', { weekday:'long' }),
      wTo: to.toLocaleDateString('de-DE', { weekday:'long' }),
      price: null,
      incl: true,
      notes: ''
    });
  }
  return out;
}
function basePlanFrom(res){
  const base = Number(res.rate_price||0);
  const arr = res.arrival   ? isoDateLocal(toDateOnly(res.arrival))   : null;
  const dep = res.departure ? isoDateLocal(toDateOnly(res.departure)) : null;
  const plan = nightsBetween(arr, dep);
  plan.forEach(n => n.price = base);
  return plan;
}
  
function totalOfPlan(plan){
  return plan.reduce((s,n)=> s + (n.incl ? Number(n.price||0) : 0), 0);
}

  // --- Date-only Parser (verhindert Off-by-one durch Zeitzonen) ---
function toDateOnly(isoLike){
  // akzeptiert 'YYYY-MM-DD' oder volles ISO → nimmt nur das Datum
  const s = String(isoLike||'').slice(0,10);
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, (m||1)-1, d||1); // lokales Datum (00:00) ohne TZ-Verschiebung
}
  // Gesamtpreis aus Row berechnen (Priceplan bevorzugt, sonst Basisrate * Nächte)
function totalPriceFromRow(row){
  const hasPlan = Array.isArray(row.priceplan) && row.priceplan.length;
  if (hasPlan) return totalOfPlan(row.priceplan);

  const arr = row.arrival   ? isoDateLocal(toDateOnly(row.arrival))   : null;
  const dep = row.departure ? isoDateLocal(toDateOnly(row.departure)) : null;
  const plan = nightsBetween(arr, dep);
  const base = Number(row.rate_price || 0);
  plan.forEach(n => n.price = base);
  return totalOfPlan(plan);
}


  /***** Bild-Helfer *****/
  function safeSetImg(imgEl, src){
    if (!imgEl) return;
    imgEl.onerror = null; // reset
    imgEl.src = src || SKETCH_IMG_SRC;
    imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = IMG_FALLBACK; };
  }
  function ensureHotelImageSlot(){
    const grid = q('#w1 .grid2');
    if (!grid) return null;
    let img = q('#hotelImg');
    if (img) return img;

    const slot = grid.children[1];
    const wrap = slot || el('div', {});
    wrap.classList.add('imgcard');
    wrap.style.maxWidth = '320px';
    wrap.style.justifySelf = 'end';

    img = el('img',{ id:'hotelImg', alt:'Hotelbild', style:'width:100%;border-radius:12px;display:block;' });
    wrap.innerHTML = '';
    wrap.append(img);

    if (!slot) grid.insertBefore(wrap, grid.firstChild?.nextSibling || null);
    return img;
  }
  function setHotelImage(src){
    const img = ensureHotelImageSlot();
    safeSetImg(img, src || HOTEL_IMG_SRC);
  }
  function setCatImage(src){
  const arr = ['#imgCatPreview', '#imgCatPreview2', '#imgCatPreview3'].map(sel => q(sel)).filter(Boolean);
  if (arr.length === 0) { // Fallback falls alte Struktur
    safeSetImg(q('#imgCatPreview'), src || SKETCH_IMG_SRC);
    return;
  }
  arr.forEach(imgEl => safeSetImg(imgEl, src || SKETCH_IMG_SRC));
}

  function setSketchImage(src){
    safeSetImg(q('#sketchImage'), src || SKETCH_IMG_SRC);
  }
  
/* ===== Hotelskizze (links Liste, rechts Vorschau) ===== */
function showSketch(hotel){
  // Label aktualisieren
  const label = document.querySelector('#sketchHotelLabel');
  if (label) label.textContent = `${hotel.group} - ${hotel.name.replace(/^.*? /,'')}`;

  // (Platzhalter) Bild setzen – später pro Hotel ersetzen
  setSketchImage(SKETCH_IMG_SRC);

  // Active-Status in der Liste markieren
  document.querySelectorAll('.sketch-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.code === hotel.code);
  });
}

function buildSketch(){
  const listBox = document.querySelector('#sketchList');
  if (!listBox) return;

  listBox.innerHTML = '';

  // Buttons je Hotel rendern
  HOTELS.forEach(h => {
    const btn = document.createElement('button');
    btn.className = 'sketch-item';
    btn.dataset.code = h.code;
    btn.title = h.code;

    const badge = document.createElement('span');
    badge.className = 'sketch-badge';
    badge.textContent = h.group;

    const name = document.createElement('span');
    name.className = 'sketch-name';
    name.textContent = hotelCity(h.name); // nur Stadt/Shortname

    btn.append(badge, name);
    btn.addEventListener('click', () => showSketch(h));
    listBox.append(btn);
  });

  // Default: erstes Hotel anzeigen
  if (HOTELS.length){
    showSketch(HOTELS[0]);
  }
}

  /***** Clock + Status *****/
  function startClocks(){
    const tick=()=>{ const d=new Date();
      q('#clockLocal') && (q('#clockLocal').textContent=d.toLocaleTimeString('de-DE'));
      q('#dateLocal')  && (q('#dateLocal').textContent = d.toLocaleDateString('de-DE'));
    };
    tick(); setInterval(tick,1000);
  }
  async function refreshStatus(){
    const a = await SB.from('reservations').select('id',{head:true,count:'exact'});
    const b = await SB.from('availability').select('date',{head:true,count:'exact'});
    setChip(q('#chipSb'), !a.error && !b.error);
    // HNS ist noch nicht verbunden → hart auf rot (lvl-2)
    const chipH = q('#chipHns');
    chipH?.classList.remove('lvl-0','lvl-1','lvl-2');
    chipH?.classList.add('lvl-2');
  }
  // === Availability: Laden + Rendern + Interaktionen ===
async function fetchAvailabilityWindow(startISO, days){
  const dates = dateRange(startISO, days);
  const endISO = dates[dates.length-1];

  const { data, error } = await SB
    .from('availability')
    .select('hotel_code,date,capacity,booked')
    .gte('date', startISO)
    .lte('date', endISO)
    .order('hotel_code', { ascending: true })
    .order('date', { ascending: true });

  if (error) { console.warn('availability error', error); return new Map(); }

  // Map: hotel_code -> { dateISO -> {cap,booked} }
  const map = new Map();
  for (const row of (data||[])) {
    const h = row.hotel_code || '—';
    if (!map.has(h)) map.set(h, new Map());
    map.get(h).set(row.date, { cap: Number(row.capacity||0), bok: Number(row.booked||0) });
  }
  return map;
}

function hotelByCode(code){ return HOTELS.find(h=>h.code===code); }

// Drag-Select State
let __drag = { active:false, hotel:null, fromIdx:null, toIdx:null };

function attachCellDragEvents(){ /* disabled: multi-select entfernt */ }


function highlightDrag(tbody){
  const { hotel, fromIdx, toIdx } = __drag;
  if (hotel == null || fromIdx == null || toIdx == null) return;
  const [a,b] = [Math.min(fromIdx,toIdx), Math.max(fromIdx,toIdx)];
  tbody.querySelectorAll('td[data-hotel]').forEach(td => {
    const idx = Number(td.dataset.idx);
    td.classList.toggle('drag-sel', td.dataset.hotel===hotel && idx>=a && idx<=b);
  });
}
function clearDragHighlight(tbody){
  tbody.querySelectorAll('.drag-sel').forEach(td => td.classList.remove('drag-sel'));
}

async function applyAvailabilityAction(hotelCode, dateList, mode){
  // Wir setzen:
  // block → booked = capacity
  // free  → booked = 0
  // Für block brauchen wir pro Datum capacity → diese holen wir in einem Rutsch:
  const { data, error } = await SB
    .from('availability')
    .select('date,capacity')
    .eq('hotel_code', hotelCode)
    .in('date', dateList);

  if (error) { alert('Fehler beim Laden (apply): ' + error.message); return; }

  const capByDate = new Map((data||[]).map(r => [r.date, Number(r.capacity||0)]));

  // Updates nacheinander (einfach, robust)
  for (const d of dateList){
    const cap = capByDate.get(d) ?? 0;
    const payload = (mode === 'block')
      ? { capacity: cap, booked: cap }
      : { capacity: cap, booked: 0 };

    // erst versuchen zu updaten …
    const { error: updErr, count } = await SB.from('availability')
      .update(payload)
      .eq('hotel_code', hotelCode)
      .eq('date', d)
      .select('*', { count: 'exact' });

    // … wenn keine Row betroffen → insert (Upsert light)
    if (updErr || !count){
      await SB.from('availability').insert({
        hotel_code: hotelCode,
        date: d,
        capacity: payload.capacity,
        booked: payload.booked
      });
    }
  }
}
  /* === Single-Click Delta-Anpassung (isolated IIFE) === */
;(() => {
  const LS_MANUAL_KEY = 'resTool.availability.manualMarks';

  function readManualMarks(){
    try { return JSON.parse(localStorage.getItem(LS_MANUAL_KEY) || '{}'); } catch { return {}; }
  }
  function writeManualMarks(map){
    try { localStorage.setItem(LS_MANUAL_KEY, JSON.stringify(map||{})); } catch {}
  }
  function markManual(hotel, dateISO, delta){
    const m = readManualMarks();
    const k = `${hotel}|${dateISO}`;
    const v = Number(delta);
    if (!isFinite(v) || v === 0){
      delete m[k];               // +0 → Marker entfernen
    } else {
      m[k] = v;                  // +/-x merken
    }
    writeManualMarks(m);
  }
  function getManualDelta(hotel, dateISO){
    const m = readManualMarks();
    const v = m[`${hotel}|${dateISO}`];
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }

  async function handleCellAdjust(hotelCode, dateISO){
    // aktuellen Stand holen
    let cap = 0, bok = 0;
    try {
      const q = await SB.from('availability')
        .select('capacity, booked')
        .eq('hotel_code', hotelCode)
        .eq('date', dateISO)
        .maybeSingle();
      if (!q.error && q.data){ cap = Number(q.data.capacity||0); bok = Number(q.data.booked||0); }
    } catch(_){}

    // genau EIN Prompt: nur Delta
    const curTxt = `${bok} belegt / Kap ${cap}`;
    const val = window.prompt(
      `Änderung für ${dateISO} (${hotelCode})\nAktuell: ${curTxt}\n\nBitte Delta eingeben (z.B. 10 oder -57):`,
      ''
    );
    if (val == null) return;
    const delta = Number(String(val).replace(',', '.'));
    if (!isFinite(delta)) { alert('Ungültige Zahl.'); return; }

    const next = Math.max(0, bok + delta);   // nie < 0 (Overbooking erlaubt)

    // Update → falls 0 Rows, Insert
    let didUpdate = false;
    try {
      const { error, count } = await SB.from('availability')
        .update({ booked: next, manual: true })
        .eq('hotel_code', hotelCode)
        .eq('date', dateISO)
        .select('*', { count: 'exact' });
      if (!error && count) didUpdate = true;
    } catch(_){}

    if (!didUpdate){
      try {
        await SB.from('availability').insert({
          hotel_code: hotelCode,
          date: dateISO,
          capacity: cap,
          booked: next,
          manual: true
        });
      } catch(_){}
    }

    // Marker (±x), „0“ entfernt Marker
    const appliedDelta = next - bok;
    markManual(hotelCode, dateISO, appliedDelta);

    // UI neu
    try { await runAvailability(); } catch(_){}
  }

  window.handleCellAdjust = handleCellAdjust;
  window.getManualDelta   = getManualDelta;
  window.isManualMarked   = (h, d) => (getManualDelta(h, d) ?? null) !== null;
})();



function renderAvailabilityMatrix(avMap, startISO, days, activeOnly=false){
  const dates = dateRange(startISO, days);
  const thead = document.querySelector('#matrixTable thead tr');
  const tbody = document.getElementById('matrixBody');
  if (!thead || !tbody) return;

  // Header
  thead.innerHTML = `<th class="sticky">Hotel</th>` + dates.map((d)=> {
    const dm = new Date(d).toLocaleDateString('de-DE',{ day:'2-digit', month:'2-digit' });
    return `<th title="${d}">${dm}</th>`;
  }).join('');

  // Body
  tbody.innerHTML = '';
  const hotels = HOTELS.slice();

  for (const h of hotels){
    const perDate = avMap.get(h.code) || new Map();

    if (activeOnly){
      const sumCap = dates.reduce((s,d)=> s + (perDate.get(d)?.cap || 0), 0);
      const sumBok = dates.reduce((s,d)=> s + (perDate.get(d)?.bok || 0), 0);
      if (sumCap === 0 && sumBok === 0) continue;
    }

    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.className = 'sticky';
    th.textContent = `${h.group} - ${hotelCity(h.name)}`;
    tr.appendChild(th);

    dates.forEach((d, idx)=>{
      const rec = perDate.get(d) || { cap:0, bok:0 };
      // echte % ohne Deckelung → Overbooking sichtbar
      const pct = rec.cap > 0 ? Math.round((rec.bok / rec.cap) * 100) : 0;

      const td = document.createElement('td');
      td.dataset.hotel = h.code;
      td.dataset.idx   = String(idx);
      td.dataset.date  = d;
      td.dataset.cap   = String(rec.cap);
      td.dataset.bok   = String(rec.bok);
      td.dataset.pct   = String(pct);
      td.className     = occClass(pct);
      td.style.textAlign = 'center';

      // Prozent-Pill
      td.innerHTML = (rec.cap > 0)
        ? `<span class="pill ${occClass(pct)}" data-tt="1">${pct}%</span>`
        : '—';

      // Overbooking-Badge oben rechts
      const over = Math.max(0, rec.bok - rec.cap);
      if (over > 0) {
        td.classList.add('overbook');
        const ob = document.createElement('div');
        ob.className = 'avail-ob-badge';
        ob.textContent = `+${over}`;
        td.appendChild(ob);
      }

      // Manuelle Δ-Badge unten rechts (nur wenn ≠ 0)
      const md = window.getManualDelta?.(h.code, d);
      if (md != null && md !== 0) {
        td.classList.add('manual');
        const badge = document.createElement('div');
        badge.className = 'avail-delta-badge';
        badge.textContent = `${md > 0 ? '+' : ''}${md}`;
        td.appendChild(badge);
      }

      // EINZIGER Klick-Handler (kein Drag)
      td.addEventListener('click', () => window.handleCellAdjust?.(h.code, d, td));

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  // --- Tooltip-Delegation (einmalig binden) ---
  (function ensureAvailTooltipHandlers(){
    if (tbody.__ttBound) return;
    tbody.__ttBound = true;

    let tt = document.getElementById('availTT');
    if (!tt){
      tt = document.createElement('div');
      tt.id = 'availTT';
      tt.className = 'avail-tt';
      tt.style.display = 'none';
      document.body.appendChild(tt);
    }

    function fillAndShow(e, td){
      const d   = td.dataset.date;
      const cap = Number(td.dataset.cap||0);
      const bok = Number(td.dataset.bok||0);
      const pct = Number(td.dataset.pct||0);
      const md  = window.getManualDelta?.(td.dataset.hotel, d);
      const over= Math.max(0, bok - cap);
      tt.innerHTML = `
        <div class="tt-title">${d}</div>
        <div class="tt-line"><span>Kapazität</span><span>${cap}</span></div>
        <div class="tt-line"><span>Belegt</span><span>${bok}${over>0 ? ` (OB +${over})` : ''}</span></div>
        <div class="tt-line"><span>Auslastung</span><span>${pct}%</span></div>
        ${md!=null && md!==0 ? `<div class="tt-line"><span>Manuell</span><span>${md>0?'+':''}${md}</span></div>` : ''}
      `;
      tt.style.left = (e.clientX + 14) + 'px';
      tt.style.top  = (e.clientY + 14) + 'px';
      tt.style.display = 'block';
    }

    function hide(){ tt.style.display = 'none'; }

    // nur über einer Pill anzeigen
    tbody.addEventListener('mousemove', (e)=>{
      const pill = e.target.closest('.pill[data-tt]');
      if (!pill) { hide(); return; }
      const td = pill.closest('td[data-hotel][data-idx]');
      if (!td) { hide(); return; }
      fillAndShow(e, td);
    });
    tbody.addEventListener('mouseleave', hide);
  })();
}

async function runAvailability(){
  const inpFrom = document.getElementById('availFrom');
  const inpDays = document.getElementById('availDays');
  const cbOnly  = document.getElementById('availActiveOnly');

  const startISO = inpFrom?.value || isoDateLocal(new Date());
  const days = Number(inpDays?.value || 14);
  const activeOnly = !!cbOnly?.checked;

  const map = await fetchAvailabilityWindow(startISO, days);
  renderAvailabilityMatrix(map, startISO, days, activeOnly);
}
  window.runAvailability = runAvailability;


  /***** Auto-Roll: Vergangenheit → done *****/
  async function autoRollPastToDone(){
    const today = isoDate(soD(new Date()));
    await SB.from('reservations')
      .update({ status:'done' })
      .lt('departure', today)
      .neq('status','canceled')
      .or('status.eq.active,status.eq.confirmed,status.is.null');

    await SB.from('reservations')
      .update({ status:'done' })
      .is('departure', null)
      .lt('arrival', today)
      .neq('status','canceled')
      .or('status.eq.active,status.eq.confirmed,status.is.null');
  }

 /***** Mini-Analytics — YoY (heute vs. heute vor 1 Jahr) *****/
async function buildMiniAnalytics(){
  const list = q('#miniAnalyticsDock'); if (!list) return; list.innerHTML = '';

  // Heute (Start/Ende)
  const today = soD(new Date());                       // 00:00:00 heute
  const todayStartISO = today.toISOString();
  const todayEnd = new Date(today); todayEnd.setDate(todayEnd.getDate() + 1); // exklusiv
  const todayEndISO = todayEnd.toISOString();

  // Gleicher Kalendertag im Vorjahr
  const prev = new Date(today);
  prev.setFullYear(prev.getFullYear() - 1);
  const prevStart = soD(prev);
  const prevEnd = new Date(prevStart); prevEnd.setDate(prevEnd.getDate() + 1);
  const prevStartISO = prevStart.toISOString();
  const prevEndISO = prevEnd.toISOString();

  // Buchungen (created_at) für heute / Vorjahr laden
  const cur = await SB.from('reservations')
    .select('hotel_code,created_at')
    .gte('created_at', todayStartISO).lt('created_at', todayEndISO);

  const prv = await SB.from('reservations')
    .select('hotel_code,created_at')
    .gte('created_at', prevStartISO).lt('created_at', prevEndISO);

  const countByHotel = (res) => {
    const m = new Map();
    (res?.data || []).forEach(r => m.set(r.hotel_code || '—', (m.get(r.hotel_code || '—') || 0) + 1));
    return m;
  };

  const mCur = countByHotel(cur);
  const mPrv = countByHotel(prv);

  // kleines SVG-Sparkline als Deko (7 zufällige Punkte, bis echte Tagesreihe kommt)
  const SPARK_W = 60, SPARK_H = 22;

  HOTELS.forEach(h => {
    const c = mCur.get(h.code) || 0;
    const p = mPrv.get(h.code) || 0;
    const up = p === 0 ? c > 0 : c > p;

    const pts = Array.from({ length: 7 }, () => Math.max(0, Math.round((c / 7) + (Math.random() * 2 - 1))));
    const max = Math.max(1, ...pts), min = Math.min(...pts);
    const path = pts.map((v, i) => {
      const x = (i / (pts.length - 1)) * SPARK_W;
      const y = SPARK_H - ((v - min) / (max - min || 1)) * (SPARK_H - 2) - 1;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const brandAndHotel = `${h.group} ${hotelCity(h.name)}`;
    const yoyPct = p ? Math.round(((c - p) / p) * 100) : (c > 0 ? '∞' : 0);

    const item = el('div', { class: 'dock-item', title: `${brandAndHotel} · YoY ${yoyPct}%` },
      el('div', { class: 'dock-name' }, brandAndHotel),
      (() => {
        const svg = el('svg', { class: 'spark', viewBox: `0 0 ${SPARK_W} ${SPARK_H}`, xmlns: 'http://www.w3.org/2000/svg' });
        svg.append(el('path', { d: path, fill: 'none', stroke: up ? '#35e08a' : '#ff4d6d', 'stroke-width': '2' }));
        return svg;
      })(),
      el('div', { class: `dock-arrow ${up ? 'up' : 'down'}` }, up ? '↑' : '↓')
    );
    list.append(item);
  });
}
  /***** MODALS *****/

  function fillHotelSelectOptions(sel){
  if (!sel) return;
  sel.innerHTML='';
  HOTELS.forEach(h => sel.append(el('option',{value:h.code}, `${h.group} - ${h.name.replace(/^.*? /,'')}`)));
}

function loadCatsIntoSelect(sel, hotelCode){
  if (!sel) return;
  const cats = catsForHotel(hotelCode);
  sel.innerHTML = ['*', ...cats].map(c=>`<option value="${c}">${c==='*'?'Alle':c}</option>`).join('');
  makeMultiSelectFriendly(sel);
}
  // ===== Kategoriebeschreibung – Modal =====
let __catDescCtx = null; // {hotel, code, name?, maxPax?, isNew?}
function openCatDescModal({hotel, code, name, maxPax, isNew=false}){
  __catDescCtx = {hotel, code, name, maxPax, isNew};
  const rec = findCatByCode(hotel, code);
  const ta = document.getElementById('catDescTextarea');
  if (ta) ta.value = (rec?.desc || '');
  openModal('modalCatDesc');
}

// Save-Button nur einmal binden
(function bindCatDescSave(){
  const btn = document.getElementById('btnCatDescSave');
  if (!btn || btn.__bound) return;
  btn.__bound = true;
  btn.addEventListener('click', ()=>{
    if (!__catDescCtx) return closeModal('modalCatDesc');
    const txt = (document.getElementById('catDescTextarea')?.value || '').trim();
    const {hotel, code, name, maxPax, isNew} = __catDescCtx;

    const existing = findCatByCode(hotel, code);
    const cat = existing
      ? {...existing, desc: txt}
      : { code, name, maxPax, desc: txt };

    upsertCategory(hotel, cat);
    renderCatsV2();
    closeModal('modalCatDesc');
    setCatsInfo(isNew ? 'Hinzugefügt.' : 'Gespeichert.');
    __catDescCtx = null;
  });
})();

  
  /* ===== Rateneinstellungen (neues Modal) ===== */
function fillHotelSelectGeneric(sel){
  if (!sel) return;
  sel.innerHTML = '';
  HOTELS.forEach(h => sel.append(el('option', {value:h.code}, displayHotel(h))));
}
function fillCatsSelectGeneric(sel){
  if (!sel) return;
  const cats = HOTEL_CATEGORIES['default'] || [];
  sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}
function prepareRateFormReset(){
  fillHotelSelectGeneric(q('#rateHotel'));

  // Hotelabhängige Kategorien direkt befüllen
  const code = q('#rateHotel')?.value || (HOTELS[0]?.code || '');
  refreshCategoryDependents(code); // baut #rateCats korrekt aus V2

  // onChange erneut befüllen
  q('#rateHotel')?.addEventListener('change', (e)=>{
    refreshCategoryDependents(e.target.value);
  }, { once: true });

  // Rest wie gehabt:
  if (q('#rateType')) q('#rateType').value = '';
  if (q('#rateCode')) q('#rateCode').value = '';
  if (q('#rateName')) q('#rateName').value = '';
  if (q('#ratePolicy')) q('#ratePolicy').value = 'Bis zum Anreisetag 18:00 Uhr kostenfrei stornierbar.';
  if (q('#ratePrice')) q('#ratePrice').value = 89;
  if (q('#rateMapped')) q('#rateMapped').checked = true;
  if (q('#rateInfo')) q('#rateInfo').textContent = '';
}


// Beim Öffnen von Editor/Neuanlage aufrufen:
makeMultiSelectFriendly(document.querySelector('#crCats')); // Neuanlage
makeMultiSelectFriendly(document.querySelector('#erCats')); // Bearbeiten

  
// Öffner für Rateneinstellungen (statt direkt „Neue Rate“)
q('#rsTabDirect')?.addEventListener('click', ()=> rsSetType('Direct'));
q('#rsTabCorp')  ?.addEventListener('click', ()=> rsSetType('Corp'));
q('#rsTabIds')   ?.addEventListener('click', ()=> rsSetType('IDS'));
q('#rsNewRate')?.addEventListener('click', ()=> openRateCreate());


// Öffner: Rateneinstellungen (statt Channel)
q('#navNewRate')?.addEventListener('click', ()=>{ prepareRateFormReset(); openModal('modalRateSettings'); });
  
// Speichern
q('#btnRateSave')?.addEventListener('click', ()=>{
  const ratecode  = (q('#rateCode')?.value || '').trim();
  const ratetype  = q('#rateType')?.value || '';
  const hotel_code= q('#rateHotel')?.value || '';
  const catsSel   = Array.from(q('#rateCats')?.selectedOptions || []).map(o=>o.value);
  const name      = (q('#rateName')?.value || '').trim();
  const policy    = (q('#ratePolicy')?.value || '').trim();
  const price     = Number(q('#ratePrice')?.value || 0);
  const mapped    = !!q('#rateMapped')?.checked;

  if (!/^\d+$/.test(ratecode)) { q('#rateInfo').textContent='Ratecode muss nur Zahlen enthalten.'; return; }
  if (!ratetype)                { q('#rateInfo').textContent='Bitte Ratentyp wählen.'; return; }
  if (!hotel_code)              { q('#rateInfo').textContent='Bitte Hotel wählen.'; return; }
  if (!name)                    { q('#rateInfo').textContent='Bitte Ratename angeben.'; return; }
  if (!(price>=0))              { q('#rateInfo').textContent='Preis prüfen.'; return; }

  // Eindeutigkeit pro Hotel+Ratecode
  if (readRates().some(r => r.hotel_code===hotel_code && r.ratecode===ratecode)){
    q('#rateInfo').textContent = 'Ratecode existiert bereits für dieses Hotel.';
    return;
  }

  const now = new Date().toISOString();
  upsertRate({
    id:'r_'+Date.now(),
    ratecode, ratetype, hotel_code,
    categories: catsSel.length ? catsSel : (HOTEL_CATEGORIES['default']||[]),
    name, policy, price, mapped,
    created_at: now, updated_at: now
  });

  q('#rateInfo').textContent = 'Rate gespeichert.';
  // Falls du ein Raten-Board auf der Startmaske hast, hier refreshen:
  try {
    const active = qa('#rateTabs .tab.active')[0]?.dataset.ratetype || ratetype;
    if (typeof renderRatesList === 'function') renderRatesList(active);
  } catch(e){}
});

  qa('[data-close]').forEach(b=>b.addEventListener('click',()=>{
    const tgt = b.getAttribute('data-close');
    if (tgt) closeModal(tgt); else closeModal(b.closest('.modal').id);
  }));

  
  document.addEventListener('click', async function(e){
  const btn = e.target.closest('#btnRates, [data-modal="#modalRates"]');
  if (!btn) return;
  e.preventDefault();

  // Hilfsfunktionen (verwenden bestehende, falls vorhanden)
  const $ = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

  const _open = (selOrEl) => {
    if (typeof window.openModal === 'function') return window.openModal(selOrEl);
    const el = typeof selOrEl === 'string' ? $(selOrEl) : selOrEl;
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('modal-open');
    const backdrop = $('#backdrop');
    if (backdrop) { backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden', 'false'); }
  };

  const _close = (modalEl) => {
    if (typeof window.closeModal === 'function') return window.closeModal(modalEl);
    const el = modalEl && modalEl.classList ? modalEl : btn.closest('.modal');
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    if ($$('.modal.open').length === 0) {
      document.documentElement.classList.remove('modal-open');
      const backdrop = $('#backdrop');
      if (backdrop) { backdrop.classList.remove('open'); backdrop.setAttribute('aria-hidden', 'true'); }
    }
  };

  // 1) Eltern-Modal (Einstellungen) schließen …
  // stack Rates without closing parent
  setTimeout(() => _open('#modalRates'), 0);
}, { passive: false });

  // Modal-IDs
const MODALS = {
  rateSettings: 'modalRateSettings',
  rateCreate:   'modalRateCreate',
};

// Helper zum Öffnen/Schließen (nutzt deine bestehenden Funktionen, falls vorhanden)
function open(id){ return (typeof openModal==='function') ? openModal(id) : document.getElementById(id)?.removeAttribute('hidden'); }
function close(id){
  if (typeof closeModal==='function') return closeModal(id);
  const el = document.getElementById(id); if (el) el.setAttribute('hidden','');
}

// „+ Neue Rate“ in Rateneinstellungen → eigenes Create-Modal
const newRateBtn = document.querySelector('#rsNewRate, #btnOpenNewRate, [data-open="rate-create"]');
newRateBtn?.addEventListener('click', () => {
  // close(MODALS.rateSettings);   // <- RAUS
  document.getElementById('rateCreateForm')?.reset();
  open('modalRateCreate'); // <- draufstapeln
  try { renderCatStack('crCatsWrap', document.getElementById('crHotel')?.value || (HOTELS[0]?.code||''), []); } catch(e){}
  // Enable '+ weitere Kategorie' in Create modal
  (function(){
    const wrap = document.getElementById('crCatsWrap');
    const add  = document.getElementById('crAddCatRow');
    if (wrap) wrap.removeAttribute('data-disabled');
    if (add) { add.disabled = false; add.removeAttribute('disabled'); }
  })();

});

// Abbrechen/X im Create → zurück zu Rateneinstellungen
document.querySelector('[data-cancel-create]')?.addEventListener('click', () => {
  close('modalRateCreate'); // kein open('modalRates') mehr
});
document.querySelectorAll('[data-close="modalRateCreate"]').forEach(btn=>{
  btn.addEventListener('click', () => {
    close('modalRateCreate'); // kein open('modalRates') mehr
  });
});

// Submit im Create → speichern (deine Logik) → zurück zur Liste
document.getElementById('rateCreateForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const newRate = {
    name: (fd.get('name')||'').toString().trim(),
    code: (fd.get('code')||'').toString().trim().toUpperCase(),
    type: fd.get('type'),
    hotel: fd.get('hotel'),
    valid_from: fd.get('valid_from'),
    valid_to: fd.get('valid_to'),
    desc: (fd.get('desc')||'').toString().trim(),
    status: 'active'
  };

  // TODO: hier deine persistente Speicherung (Supabase/HNS/LocalStorage)
  // z.B.: demoRates.unshift(newRate);

  // zurück zur Liste + refresh
  close(MODALS.rateCreate);
  open('modalRates');
  if (typeof applyRateFilters === 'function') applyRateFilters();
});


  
  /***** KPI/Performance-Filter füllen *****/
  function fillHotelFilter(selectEl){
    if (!selectEl) return;
    selectEl.innerHTML = '';
    selectEl.append(el('option',{value:'all'},'Gesamt'));
    HOTELS.forEach(h=> selectEl.append(el('option',{value:h.code}, displayHotel(h))));
  }
  
  /***** Performance — Heute *****/
async function loadKpisToday(){
  try{
    const codeSel = q('#kpiFilterToday')?.value || 'all';
    const todayISO = isoDateLocal(soD(new Date()));

   // Buchungen (eingegangen) heute – echte Gesamtzahl ohne 1000er-Cap
const startISO = new Date(new Date().setHours(0,0,0,0)).toISOString();
const nowISO   = new Date().toISOString();

let qb = SB
  .from('reservations')
  .select('id', { count: 'exact', head: true })
  .gte('created_at', startISO)
  .lte('created_at', nowISO);

if (codeSel !== 'all') qb = qb.eq('hotel_code', codeSel);

const rB = await qb;
const bookingsToday = rB.count || 0;


    // Umsatz HEUTE aus Daily-Prices
    const { byDay, bookings } = await loadDailyPricesWindow(todayISO, todayISO, codeSel);
    const revToday = byDay.get(todayISO)||0;

    // ADR (heute) = Umsatz / Buchungen, die diese Nacht berühren
    const adr = bookings ? Math.round((revToday/bookings)*100)/100 : null;

    // Auslastung (heute) unverändert aus availability
    let occ = null;
    if (codeSel!=='all'){
      const r = await SB.from('availability').select('capacity,booked').eq('hotel_code', codeSel).eq('date', todayISO);
      if (!r.error && r.data?.length){
        const a = r.data[0], cap=Math.max(1,Number(a.capacity||0)), bok=Math.max(0,Number(a.booked||0));
        occ = Math.round(Math.min(100,(bok/cap)*100));
      }
    } else {
      const r = await SB.from('availability').select('capacity,booked').eq('date', todayISO);
      if (!r.error && r.data?.length){
        const avg = r.data.reduce((s,a)=> s + Math.min(100, Math.round((Math.max(0,Number(a.booked||0))/Math.max(1,Number(a.capacity||0)))*100)),0)/r.data.length;
        occ = Math.round(avg);
      }
    }

    q('#tBookings') && (q('#tBookings').textContent = bookingsToday);
    q('#tRevenue')  && (q('#tRevenue').textContent  = euro(revToday));
    q('#tADR')      && (q('#tADR').textContent      = euro(adr));
    q('#tOcc')      && (q('#tOcc').textContent      = pct(occ));
  }catch(err){
    console.error('loadKpisToday fatal', err);
    q('#tBookings') && (q('#tBookings').textContent = '—');
    q('#tRevenue')  && (q('#tRevenue').textContent  = '— €');
    q('#tADR')      && (q('#tADR').textContent      = '— €');
    q('#tOcc')      && (q('#tOcc').textContent      = '—%');
  }
}

/***** Performance — Nächste 7 Tage *****/
async function loadKpisNext(){
  try{
    const codeSel = q('#kpiFilterNext')?.value || 'all';

    const today = soD(new Date());                 // 00:00 lokal
    const start = new Date(today); start.setDate(start.getDate() + 1);
    const end   = new Date(today); end.setDate(end.getDate() + 7);
    const startISO = isoDateLocal(start);
    const endISO   = isoDateLocal(end);


    // KW-Label (wenn vorhanden)
    const kwFrom = isoWeek(start), kwTo = isoWeek(end);
    const kwNode = q('#kwLabel');
    if (kwNode) kwNode.textContent = kwFrom===kwTo ? `(KW ${kwFrom})` : `(KW ${kwFrom}–${kwTo})`;

    // Umsatz & Buchungen aus Daily-Prices
    const { byDay, bookings } = await loadDailyPricesWindow(startISO, endISO, codeSel);

    // Summe im Fenster (7 Tage)
    const totalRevenue = Array.from(byDay.entries())
      .filter(([d])=> d>=startISO && d<=endISO)
      .reduce((s,[,v])=> s+Number(v||0), 0);

    // ADR (WDR) = Umsatz / Buchungen mit >=1 Nacht im Fenster
    const adr = bookings ? Math.round((totalRevenue/bookings)*100)/100 : null;

    // Ø Auslastung im Fenster wie gehabt
    let nOcc = null;
    if (codeSel!=='all'){
      const r = await SB.from('availability').select('capacity,booked')
        .eq('hotel_code', codeSel).gte('date', startISO).lte('date', endISO);
      if (!r.error && r.data?.length){
        const avg = r.data.reduce((s,a)=>{
          const cap=Math.max(1,Number(a.capacity||0)), bok=Math.max(0,Number(a.booked||0));
          return s + Math.min(100, Math.round((bok/cap)*100));
        },0)/r.data.length;
        nOcc = Math.round(avg);
      }
    } else {
      const r = await SB.from('availability').select('capacity,booked')
        .gte('date', startISO).lte('date', endISO);
      if (!r.error && r.data?.length){
        const avg = r.data.reduce((s,a)=>{
          const cap=Math.max(1,Number(a.capacity||0)), bok=Math.max(0,Number(a.booked||0));
          return s + Math.min(100, Math.round((bok/cap)*100));
        },0)/r.data.length;
        nOcc = Math.round(avg);
      }
    }

    q('#nRevenue') && (q('#nRevenue').textContent = euro(totalRevenue));
    q('#nADR')     && (q('#nADR').textContent     = euro(adr));
    q('#nOcc')     && (q('#nOcc').textContent     = pct(nOcc));

  }catch(err){
    console.error('loadKpisNext fatal', err);
    q('#nRevenue') && (q('#nRevenue').textContent  = '— €');
    q('#nADR')     && (q('#nADR').textContent      = '— €');
    q('#nOcc')     && (q('#nOcc').textContent      = '—%');
  }
}

  /***** Reservierungsliste (+ Statuslogik) *****/
  let page=1, pageSize=50, search='', fHotel='all', fResNo='', fFrom=null, fTo=null, fStatus='active';

  function fillFilters(){
    const sel = q('#filterHotel'); if (!sel) return;
    sel.innerHTML='';
    sel.append(el('option',{value:'all'},'Alle Hotels'));
    HOTELS.forEach(h=> sel.append(el('option',{value:h.code}, displayHotel(h))));
  }

  function uiStatus(row){
    const todayStr = isoDate(soD(new Date()));
    let s = (row.status||'active').toLowerCase();
    if (s==='confirmed') s = 'active';
    const arr = row.arrival ? isoDate(new Date(row.arrival)) : null;
    const dep = row.departure ? isoDate(new Date(row.departure)) : null;
    if (s!=='canceled' && ((dep && dep < todayStr) || (!dep && arr && arr < todayStr))) s = 'done';
    return s;
  }

  async function loadReservations(){
    await autoRollPastToDone();

    const body = q('#resvBody'); if (!body) return;
    body.innerHTML = '';
    const from = (page-1)*pageSize, to = from + pageSize - 1;
    const todayStr = isoDate(soD(new Date()));

    const applyFilters = (query) => {
      if (search)  query = query.ilike('guest_last_name', `%${search}%`);
      if (fResNo)  query = query.ilike('reservation_number', `%${fResNo}%`);
      if (fFrom)   query = query.gte('arrival', fFrom);
      if (fTo)     query = query.lte('arrival', fTo);
      if (fStatus==='active'){
        query = query.gte('arrival', todayStr).neq('status','canceled').or('status.eq.active,status.eq.confirmed,status.is.null');
      } else if (fStatus==='done'){
        query = query.neq('status','canceled').lt('arrival', todayStr);
      } else if (fStatus==='canceled'){
        query = query.eq('status','canceled');
      }
      return query;
    };

    const selectCols = 'id,reservation_number,guest_first_name,guest_last_name,arrival,departure,hotel_name,hotel_code,category,rate_name,rate_price,status,created_at,priceplan';

    let data = [], count = 0, error = null;

    if (fHotel === 'all'){
      let q1 = SB.from('reservations').select(selectCols, { count:'exact' })
        .order('arrival', { ascending: true })
        .range(from, to);
      q1 = applyFilters(q1);
      const r = await q1;
      data = r.data || []; count = r.count || 0; error = r.error || null;
    } else {
      let qCode = SB.from('reservations').select(selectCols).order('arrival',{ascending:true}).range(from,to);
      qCode = applyFilters(qCode.eq('hotel_code', fHotel));
      const r1 = await qCode;

      const needle = HOTEL_KEYWORD[fHotel] || hotelCity(HOTELS.find(h=>h.code===fHotel)?.name || '');
      let qName = SB.from('reservations').select(selectCols).order('arrival',{ascending:true}).range(from,to);
      qName = applyFilters(qName.ilike('hotel_name', `%${needle}%`));
      const r2 = await qName;

      const map = new Map();
      (r1.data||[]).concat(r2.data||[]).forEach(row => map.set(row.id, row));
      data  = [...map.values()];
      count = data.length;
      error = r1.error || r2.error || null;
    }

    if (error){ q('#pageInfo') && (q('#pageInfo').textContent='Fehler'); console.warn(error); return; }

    data.forEach(row => {
      const rStatus = uiStatus(row);
      const dotCls = rStatus==='canceled'?'dot-canceled':(rStatus==='done'?'dot-done':'dot-active');
      const guest = `${row.guest_last_name||'—'}${row.guest_first_name?', '+row.guest_first_name:''}`;

      const tr = el('tr', { class: 'row', 'data-id': row.id },
        el('td', {}, row.reservation_number || '—'),
        el('td', {}, safeDisplayFromRow(row)),
        el('td', {}, guest),
        el('td', {}, row.arrival ? D2.format(new Date(row.arrival)) : '—'),
        el('td', {}, row.departure ? D2.format(new Date(row.departure)) : '—'),
        el('td', {}, row.category || '—'),
        el('td', {}, row.rate_name || '—'),
        el('td', {}, EUR.format(totalPriceFromRow(row))),
        (()=>{
          const td = el('td',{class:'status'});
          td.append(el('span',{class:`status-dot ${dotCls}` }));
          td.append(document.createTextNode(rStatus));
          return td;
        })()
      );
      tr.addEventListener('click', ()=> openEdit(row.id));
      body.append(tr);
    });

    const totalPages = Math.max(1, Math.ceil((count || 0)/pageSize));
    q('#pageInfo') && (q('#pageInfo').textContent = `Seite ${page} / ${totalPages}`);
  }

  // Filter Events
  q('#searchInput')?.addEventListener('input', (e)=>{ search = e.target.value.trim(); page = 1; loadReservations(); });
  q('#filterHotel')?.addEventListener('change', (e)=>{ fHotel = e.target.value; page=1; loadReservations(); });
  q('#filterResNo')?.addEventListener('input', (e)=>{ fResNo = e.target.value.trim(); page=1; loadReservations(); });
  q('#filterFrom')?.addEventListener('change', (e)=>{ fFrom = e.target.value||null; page=1; loadReservations(); });
  q('#filterTo')  ?.addEventListener('change', (e)=>{ fTo   = e.target.value||null; page=1; loadReservations(); });
  q('#filterStatus')?.addEventListener('change', (e)=>{ fStatus = e.target.value; page=1; loadReservations(); });
  q('#btnRefresh')?.addEventListener('click', async ()=>{ await autoRollPastToDone(); loadReservations(); });
  q('#prevPage')  ?.addEventListener('click', ()=>{ page = Math.max(1, page-1); loadReservations(); });
  q('#nextPage')  ?.addEventListener('click', ()=>{ page = page+1; loadReservations(); });

  /***** Edit: Dropdowns *****/
function fillEditDropdowns(hotelCode, curCat, curRate){
  // 1) Kategorien pro Hotel aus V2 ziehen (Fallback: Defaults)
  let cats = [];
  try { cats = (getCategoriesForHotel(hotelCode) || []).map(c => c.name); } catch(e) { cats = []; }
  if (!cats.length) { cats = (HOTEL_CATEGORIES?.[hotelCode] || HOTEL_CATEGORIES?.default || []); }

  const selCat  = q('#eCat');
  const selRate = q('#eRate');

  if (selCat){
    selCat.innerHTML = cats.map(n => `<option value="${n}" ${n===curCat?'selected':''}>${n}</option>`).join('');
  }

  // 2) Raten passend zur Kategorie/Hotel (nur gemappte Raten, sonst Fallback)
  function renderRates(forCat, currentRate){
    // zuerst gemappte Raten probieren
    let list = [];
    try { list = getMappedRatesFor(hotelCode, forCat); } catch(e) { list = []; }
    if (!list.length){
      // Fallback: Default-Dummyraten
      list = (HOTEL_RATES?.default || []).map(r => ({ name:r.name, price:r.price }));
    }
    if (selRate){
      selRate.innerHTML = list.map(r =>
        `<option value="${r.name}" data-price="${r.price}" ${r.name===currentRate?'selected':''}>${r.name} (${EUR.format(r.price)})</option>`
      ).join('');
    }
    // Preis mitziehen, wenn Rate steht
    const p = selRate?.selectedOptions?.[0]?.dataset.price;
    if (p && q('#ePrice')) q('#ePrice').value = p;
  }

  renderRates(curCat || (selCat?.value || ''), curRate);

  // 3) Wenn Kategorie geändert wird → Ratenliste neu bauen
  selCat?.addEventListener('change', (e)=>{
    renderRates(e.target.value, /* keep current rate unless not available */ (q('#eRate')?.value || ''));
  }, { once:true });

  // 4) Preis bei Ratenwechsel live updaten
  selRate?.addEventListener('change', (e)=>{
    const p = e.target.selectedOptions[0]?.dataset.price;
    if (p && q('#ePrice')) q('#ePrice').value = p;
  }, { once:true });
}
// === REPLACE ENTIRE FUNCTION: renderPricePlan ===
async function renderPricePlan(resRow){
  const list = document.getElementById('planList');
  const info = document.getElementById('planInfo');
  const btnTrim = document.getElementById('btnPlanFillWeekdays');
  const btnReset = document.getElementById('btnPlanReset');
  const btnSave  = document.getElementById('btnSavePlan');
  const btnApplyTrim = document.getElementById('btnApplyTrim');
  const elTotal = document.getElementById('editTotalPrice');
  const elNotes = document.getElementById('editNotes');
  const popAll   = document.getElementById('planAllPopup');
  const inpAll   = document.getElementById('planAllValue');
  const allCancel= document.getElementById('planAllCancel');
  const allApply = document.getElementById('planAllApply');

  if (!list) return;

  // Arbeitskopie
  let plan = Array.isArray(resRow.priceplan) ? JSON.parse(JSON.stringify(resRow.priceplan)) : basePlanFrom(resRow);

  // Trim-State
  let trimMode = false;
  let trimSel  = null;

  // Grid (schlank/hochkant)
  list.style.display = 'grid';
  list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(170px, 1fr))';
  list.style.gap = '10px';

  // Hilfen
  const isWE = (iso) => { const d = toDateOnly(iso).getDay(); return d===0 || d===6; };
  const selA = () => Math.min(trimSel?.a ?? Infinity, trimSel?.b ?? -Infinity);
  const selB = () => Math.max(trimSel?.a ?? -Infinity, trimSel?.b ?? -Infinity);
  const inRange = (i) => { if (!trimSel) return false; const a=selA(), b=selB(); if(!isFinite(a)||!isFinite(b)) return i===a; return i>=a&&i<=b; };
  const isEnd   = (i) => trimSel && (i === selA() || i === selB());

  function cardHtml(n, idx){
    const weekend = isWE(n.from) || isWE(n.to);
    const _in = inRange(idx), _end = isEnd(idx);
    return `
      <div class="content" style="
        display:flex; flex-direction:column; gap:8px;
        padding:12px; min-height:245px; border-radius:12px;
        border:1px solid ${_end ? 'var(--accent,#00CCCC)' : 'var(--line,#17414b)'};
        ${_in && !_end ? 'background:linear-gradient(0deg, rgba(0,255,255,0.06), rgba(0,255,255,0.06));' : ''}
      ">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div class="mono" style="font-size:12px; letter-spacing:.2px; opacity:.95;">
            ${toDateOnly(n.from).toLocaleDateString('de-DE',{weekday:'long'})}
            <span style="opacity:.6;">→</span>
            ${toDateOnly(n.to).toLocaleDateString('de-DE',{weekday:'long'})}
          </div>
          ${weekend ? `<span class="mono" style="font-size:10px; padding:2px 6px; border-radius:999px; border:1px solid var(--line,#17414b); opacity:.85;">WE</span>` : ``}
        </div>

        <div style="font-size:13.5px; color:#9adce6; line-height:1.25;">
          <b>${n.from}</b> <span style="opacity:.55;">→</span> <b>${n.to}</b>
        </div>

        <div class="muted tiny">Leistungen (Placeholder)</div>
        <div class="muted tiny" style="margin-top:-4px;">– leer –</div>

        <div style="margin-top:auto; border-top:1px solid var(--line,#17414b); padding-top:8px; display:flex; align-items:center; gap:8px; justify-content:flex-end;">
          <input class="input sm mono price-input" type="number" min="0" step="0.01"
                 style="width:112px; padding-right:8px;"
                 value="${Number(n.price||0)}"
                 data-idx="${idx}">
          <span class="mono">€ / Nacht</span>
        </div>
      </div>
    `;
  }

  function updateTotalsUI(){
    const sum = totalOfPlan(plan);
    info.textContent = `Summe im Aufenthalt: ${EUR.format(sum)} (Rate × Nächte)` +
      (trimMode ? ' · Kürzen aktiv: wähle „von“, dann „bis“.' : '');
    if (elTotal) elTotal.value = Number(sum).toFixed(2);
  }

  function drawStatic(){
    // äußere .card ohne Rahmen → kein Doppelrand
    list.innerHTML = plan.map((n,i)=>`<button class="card" data-idx="${i}" style="padding:0; text-align:left; border:none; background:transparent;">${cardHtml(n,i)}</button>`).join('');

    // Inputs: live aktualisieren ohne Re-Render, & Events nicht in Trim-Klicks laufen lassen
    list.querySelectorAll('.price-input').forEach(inp=>{
      inp.addEventListener('mousedown', e=>e.stopPropagation());
      inp.addEventListener('click',     e=>e.stopPropagation());
      inp.addEventListener('input', (e)=>{
        const i = Number(e.target.dataset.idx);
        plan[i].price = Number(e.target.value || 0);
        updateTotalsUI(); // KEIN drawStatic(); Fokus bleibt!
      });
    });

    // Bestätigen: alle Nachtpreise setzen UND SOFORT SPEICHERN
if (allApply && !allApply.__bound){
  allApply.__bound = true;
  allApply.addEventListener('click', async ()=>{
    const vRaw = (inpAll?.value ?? '').trim();
    const v = Number(vRaw.replace(',', '.'));
    if (!(v >= 0)) { inpAll?.focus(); return; }

    // 1) lokal alle Nachtpreise setzen
    plan.forEach(n => n.price = v);

    // 2) persistieren
    const payload = { priceplan: plan };
    const { error } = await SB
      .from('reservations')
      .update(payload)
      .eq('id', resRow.id);

    // 3) UI aktualisieren
    if (error){
      info.textContent = 'Fehler: ' + error.message;
      return;
    }
    // Popup zu
    popAll?.classList.add('hidden');

    // Eingabefelder im Grid aktualisieren (ohne Re-Render, Fokus bleibt)
    list.querySelectorAll('.price-input').forEach(inp=>{
      inp.value = String(v);
    });

    // Summen/„Gesamtpreis“ neu berechnen
    (typeof updateTotalsUI === 'function') && updateTotalsUI();

    // KPIs/Liste refreshen (nicht kritisch, aber nice)
    try{
      await loadKpisToday(); await loadKpisNext(); await loadReservations();
    }catch(_){}

    info.textContent = 'Alle Nachtpreise gesetzt & gespeichert.';
  });
}


    updateTotalsUI();

    // Trim-Aktion unten rechts
    const haveRange = trimSel && isFinite(selA()) && isFinite(selB());
    if (btnApplyTrim) btnApplyTrim.classList.toggle('hidden', !(trimMode && haveRange));
  }

  drawStatic();

  // === All Price: robustes Popup, dynamisch erzeugt ===
(function initAllPrice(){
  const btnAll = document.getElementById('btnPlanAll');
  if (!btnAll) return;

  // Popup erzeugen, wenn noch nicht im DOM
  let popAll = document.getElementById('planAllPopupDyn');
  if (!popAll){
    popAll = document.createElement('div');
    popAll.id = 'planAllPopupDyn';
    popAll.className = 'card hidden';
    popAll.setAttribute('role','dialog');
    popAll.style.position = 'fixed';
    popAll.style.right = '18px';
    popAll.style.bottom = '18px';
    popAll.style.width = '280px';
    popAll.style.zIndex = '9999';
    popAll.style.padding = '12px';
    popAll.style.border = '1px solid var(--line,#17414b)';
    popAll.innerHTML = `
      <div class="mono" style="margin-bottom:8px;">Alle Nächte auf Preis setzen</div>
      <div class="row" style="gap:8px; align-items:center;">
        <input id="planAllValueDyn" class="input mono" type="number" step="0.01" min="0"
               placeholder="z. B. 109.00" style="flex:1;">
        <span class="mono">€</span>
      </div>
      <div class="row" style="justify-content:flex-end; gap:8px; margin-top:10px;">
        <button id="planAllCancelDyn" class="btn sm">Abbrechen</button>
        <button id="planAllApplyDyn"  class="btn sm primary">Preise setzen</button>
      </div>
    `;
    document.body.appendChild(popAll);
  }
  const inpAll   = popAll.querySelector('#planAllValueDyn');
  const allCancel= popAll.querySelector('#planAllCancelDyn');
  const allApply = popAll.querySelector('#planAllApplyDyn');

  // Öffnen
  btnAll.onclick = ()=>{
    popAll.classList.remove('hidden');
    setTimeout(()=> inpAll?.focus?.(), 0);
  };

  // Schließen
  allCancel.onclick = ()=> popAll.classList.add('hidden');
  document.addEventListener('click', async (e)=>{
    if (popAll.classList.contains('hidden')) return;
    const inside = e.target.closest('#planAllPopupDyn') || e.target.closest('#btnPlanAll');
    if (!inside) popAll.classList.add('hidden');
  });

  // Anwenden + SPEICHERN
  allApply.onclick = async ()=>{
    const vRaw = (inpAll?.value ?? '').trim();
    const v = Number(String(vRaw).replace(',', '.'));
    if (!(v >= 0)) { inpAll?.focus(); return; }

    // 1) lokal setzen
    plan.forEach(n => n.price = v);

    // 2) persistieren
    const { error } = await SB
      .from('reservations')
      .update({ priceplan: plan })
      .eq('id', resRow.id);

    if (!error) window.dispatchEvent(new Event('priceplan:saved'));

    if (error){
      info.textContent = 'Fehler: ' + error.message;
      return;
    }

    // 3) UI: Inputs aktualisieren ohne Re-Render, Summe neu, Popup schließen
    list.querySelectorAll('.price-input').forEach(inp=>{ inp.value = String(v); });
    (typeof updateTotalsUI === 'function') && updateTotalsUI();
    popAll.classList.add('hidden');

    // 4) KPIs/Listen auffrischen (optional, aber hilfreich)
    try{
      await loadKpisToday(); await loadKpisNext(); await loadReservations();
    }catch(_){}
    info.textContent = 'Alle Nachtpreise gesetzt & gespeichert.';
  };
})();


  // Kartenklicks nur im Trim-Modus
  list.addEventListener('click', (e)=>{
    if (!trimMode) return;
    const card = e.target.closest('.card'); if (!card) return;
    const idx = Number(card.dataset.idx);
    if (!trimSel) trimSel = { a: idx, b: idx };
    else if (trimSel.a === trimSel.b) trimSel.b = idx;
    else trimSel = { a: idx, b: idx };
    drawStatic();
  });

  // ✂️ Toggle
  if (btnTrim && !btnTrim.__bound){
    btnTrim.__bound = true;
    btnTrim.textContent = '✂️ Aufenthalt verkürzen';
    btnTrim.title = 'Von- & Bis-Nacht wählen. Dann „Anpassung speichern“.';
    btnTrim.addEventListener('click', ()=>{
      if (plan.length < 2){
        info.textContent = 'Verkürzen nicht möglich: Aufenthalt hat nur 1 Nacht.';
        return;
      }
      trimMode = !trimMode;
      if (!trimMode) trimSel = null;
      drawStatic();
    });
  }

  // Zurücksetzen: Basisplan + Trim aus
  if (btnReset && !btnReset.__bound){
    btnReset.__bound = true;
    btnReset.addEventListener('click', ()=>{
      plan = basePlanFrom(resRow);
      trimMode = false; trimSel = null;
      drawStatic();
    });
  }

  // Trim anwenden (unten rechts Button)
  if (btnApplyTrim && !btnApplyTrim.__bound){
    btnApplyTrim.__bound = true;
    btnApplyTrim.addEventListener('click', async ()=>{
      const a = selA(), b = selB();
      if (!isFinite(a) || !isFinite(b)) return;
      const slice = plan.slice(Math.min(a,b), Math.max(a,b)+1);
      if (!slice.length) return;

      const payload = {
        priceplan: slice,
        arrival:   slice[0].from,
        departure: slice[slice.length-1].to
      };
      const { error } = await SB.from('reservations').update(payload).eq('id', resRow.id);
      info.textContent = error ? ('Fehler: ' + error.message) : 'Aufenthalt verkürzt & gespeichert.';
      if (!error){
        plan = slice; trimMode = false; trimSel = null;
        drawStatic();
        try{ await loadKpisToday(); await loadKpisNext(); await loadReservations(); }catch{}
        if (!error) window.dispatchEvent(new Event('priceplan:saved'));
      }
    });
  }

  // Speichern: NUR Preise (ohne Kürzung)
  if (btnSave){
    btnSave.onclick = async ()=>{
      const payload = { priceplan: plan };
      const { error } = await SB.from('reservations').update(payload).eq('id', resRow.id);
      info.textContent = error ? ('Fehler: ' + error.message) : 'Preisplan gespeichert.';
      if (!error){
        try{ await loadKpisToday(); await loadKpisNext(); await loadReservations(); }catch{}
      }
    };
  }

  // Notes initial befüllen
  if (elNotes && resRow.notes != null) elNotes.value = String(resRow.notes||'');
  if (elNotes && !elNotes.__bound){
    elNotes.__bound = true;
    elNotes.addEventListener('input', debounce(async (e)=>{
      await SB.from('reservations').update({ notes: e.target.value }).eq('id', resRow.id);
    }, 350));
  }
}




  /***** Edit-Dialog *****/
  async function openEdit(id){
    const { data, error } = await SB.from('reservations').select('*').eq('id', id).maybeSingle();
    if (error || !data) return alert('Konnte Reservierung nicht laden.');

    q('#eResNo') && (q('#eResNo').value = data.reservation_number || '');
    q('#eHotel') && (q('#eHotel').value = safeDisplayFromRow(data));
    q('#eLname') && (q('#eLname').value = data.guest_last_name || '');
    q('#eArr') && (q('#eArr').value = data.arrival ? isoDate(new Date(data.arrival)) : '');
    q('#eDep') && (q('#eDep').value = data.departure ? isoDate(new Date(data.departure)) : '');

    const eStatus = q('#eStatus');
    if (eStatus){
      eStatus.value = uiStatus(data);
      eStatus.disabled = true;
    }

    fillEditDropdowns(data.hotel_code, data.category||'', data.rate_name||'');

    q('#ePrice') && (q('#ePrice').value = data.rate_price || 0);
    q('#eNotes') && (q('#eNotes').value = data.notes || '');
    q('#eCcHolder') && (q('#eCcHolder').value = data.cc_holder || '');
    q('#eCcLast4')  && (q('#eCcLast4').value  = data.cc_last4  || '');
    q('#eCcExpM')   && (q('#eCcExpM').value   = data.cc_exp_month || '');
    q('#eCcExpY')   && (q('#eCcExpY').value   = data.cc_exp_year  || '');

    const createdAtTxt = data.created_at ? `Erstellt am ${new Date(data.created_at).toLocaleString('de-DE')}` : '';
    q('#editInfo') && (q('#editInfo').textContent = createdAtTxt);

    q('#btnSaveEdit') && (q('#btnSaveEdit').onclick = async ()=>{
      const payload = {
  guest_last_name: q('#eLname')?.value || null,
  arrival: q('#eArr')?.value || null,
  departure: q('#eDep')?.value || null,
  category: q('#eCat')?.value || null,
  rate_name: q('#eRate')?.value || null,
  rate_price: Number(q('#ePrice')?.value || 0),
  notes: q('#eNotes') ? q('#eNotes').value : null
};
      const { error } = await SB.from('reservations').update(payload).eq('id', id);
      q('#editInfo').textContent = error ? ('Fehler: '+error.message) : createdAtTxt;
      await autoRollPastToDone(); await loadReservations();
    });

    q('#btnSavePay') && (q('#btnSavePay').onclick = async ()=>{
      const payload = {
        cc_holder: q('#eCcHolder').value || null,
        cc_last4:  q('#eCcLast4').value  || null,
        cc_exp_month: q('#eCcExpM').value ? Number(q('#eCcExpM').value) : null,
        cc_exp_year:  q('#eCcExpY').value ? Number(q('#eCcExpY').value) : null
      };
      const { error } = await SB.from('reservations').update(payload).eq('id', id);
      q('#editInfo').textContent = error ? ('Fehler: '+error.message) : createdAtTxt;
    });

    q('#btnCancelRes') && (q('#btnCancelRes').onclick = async ()=>{
      const { error } = await SB.from('reservations').update({ status:'canceled', canceled_at: new Date().toISOString() }).eq('id', id);
      q('#editInfo').textContent = error ? ('Fehler: '+error.message) : createdAtTxt;
      await loadReservations();
    });

    // Aktionen-Tab: "Bestätigung erneut senden" anbinden
(function bindResendConfirmation(){
  const btn = document.getElementById('btnResendConfirmation');
  if (!btn || btn.__bound) return;
  btn.__bound = true;

  btn.addEventListener('click', ()=>{
    const hotel = { code: data.hotel_code, display_name: data.hotel_name };
    const guest = {
      first_name: data.guest_first_name,
      last_name:  data.guest_last_name,
      email:      data.guest_email
    };
    const res = data;
    window.__lastReservationContext = { hotel, guest, res };
    openConfirmationModal(window.__lastReservationContext);
  });
})();


    try { await renderPricePlan(data); } catch(e){ console.warn('Preisplan/UI', e); }

    // Details-Tab: Notizen & Gesamtpreis initialisieren/sperren
q('#editNotes')?.addEventListener?.('input', debounce(async (e)=>{
  await SB.from('reservations').update({ notes: e.target.value }).eq('id', data.id);
}, 400));
const sumField = q('#editTotalPrice');
if (sumField){ // falls kein Preisplan: Basispreis * Nächte
  const pplan = Array.isArray(data.priceplan) ? data.priceplan : basePlanFrom(data);
  sumField.value = totalOfPlan(pplan).toFixed(2);
  sumField.readOnly = true;
}


    qa('.tab').forEach(b=>b.classList.remove('active')); q('.tab[data-tab="tabDet"]')?.classList.add('active');
    qa('.tabpage').forEach(p=>p.classList.add('hidden')); q('#tabDet')?.classList.remove('hidden');
    openModal('modalEdit');
  }

  qa('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      qa('.tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      qa('.tabpage').forEach(p=>p.classList.add('hidden'));
      q('#'+btn.dataset.tab)?.classList.remove('hidden');
    });
  });

  /***** Wizard *****/
  function ensureCatRateOptions(){
    const hotelCode = q('#newHotel')?.value || '';
    const cats = hotelCode ? getCategoriesForHotel(hotelCode) : DEFAULT_CATS;
    const rates = HOTEL_RATES['default'];
    const selCat  = q('#newCat');
    const selRate = q('#newRate');

      if (selCat && !selCat.options.length){
      selCat.innerHTML = cats.map(c => `<option value="${c.name}" data-code="${c.code}" data-max="${c.maxPax}">
      ${c.name} (${c.code} · max ${c.maxPax})
      </option>`).join('');
      selCat.value = cats[0]?.name || '';
    }
    if (selRate && !selRate.options.length){
      selRate.innerHTML = rates.map(r => `<option value="${r.name}" data-price="${r.price}">${r.name} (${EUR.format(r.price)})</option>`).join('');
      selRate.value = rates[0].name;
      q('#newPrice') && (q('#newPrice').value = rates[0].price);
    }
    updateCatMeta();
    
    // Platzhalter-Beschreibung unter dem Dropdown (später pro Hotel/Kategorie dynamisch)
   const desc = q('#catDesc');
  if (desc) {
    desc.textContent = "das Zimmer hat eine größe von mehr oder weniger als 40m², Toaster, Mikrowelle und Balkon mit Ausblick. Dies ist ein Placeholder‑Text und soll einen visuellen Effekt erzeugen. Die Beschreibung soll dem Agent alle Infos zu der Zimmerkategorie liefern, um möglichst präziser arbeiten zu können.";
  }
}

  function updateCatMeta(){
  const hotel = document.getElementById('newHotel')?.value || '';
  const catName = document.getElementById('newCat')?.value || '';
  const rec = getCategoriesForHotel(hotel).find(c => c.name === catName);

  // Beschreibung einsetzen
  const descEl = document.getElementById('catDesc');
  if (descEl){
    descEl.textContent = (rec?.desc && rec.desc.trim())
      ? rec.desc
      : "—";
  }

  // „Fakten“ Max-Personen dynamisch zeigen (Rest bleibt als Platzhalter)
  const facts = document.querySelector('#w2 .s2-facts .tiny');
  if (facts){
    const max = rec?.maxPax ?? 2;
    facts.innerHTML = `Max Personen: ${max}<br/>Haustiere erlaubt: Nein<br/>Check In: 15:00<br/>Check Out: 11:00`;
  }

  // Galerie-Bild(er) Placeholder belassen
  const cap = document.getElementById('imgCatCaption');
  if (cap) cap.textContent = `${catName || 'Kategorie'} – Beispielbild`;
}

  function wizardSet(step){
    qa('.wstep').forEach(b=>b.classList.toggle('active', b.dataset.step==step));
    qa('.wpage').forEach(p=>p.classList.add('hidden'));
    q('#w'+step)?.classList.remove('hidden');
    q('#btnPrev')?.classList.toggle('hidden', step==='1');
    q('#btnNext')?.classList.toggle('hidden', step==='4');
    q('#btnCreate')?.classList.toggle('hidden', step!=='4');

    if (step==='2' || step==='3') {
    ensureCatRateOptions();
      setCatImage(SKETCH_IMG_SRC);
    }
    if (step==='1'){
      setHotelImage(HOTEL_IMG_SRC);
    }

    validateStep(step);
    if (step==='4') updateSummary('#summaryFinal');
  }
  qa('.wstep').forEach(s=> s.style.pointerEvents='none');

  function validateStep(step){
    let ok=false;
    if (step==='1'){ ok = !!q('#newHotel')?.value && !!q('#newArr')?.value && !!q('#newDep')?.value; }
    else if (step==='2'){ ok = !!q('#newCat')?.value; }
    else if (step==='3'){ ok = !!q('#newRate')?.value && Number(q('#newPrice')?.value||0) > 0; }
    else if (step==='4'){ ok = true; }
    q('#btnNext') && (q('#btnNext').disabled = (!ok && step!=='4'));
    return ok;
  }

  function fillHotelSelect(){
    const sel=q('#newHotel'); if (!sel) return;
    sel.innerHTML='';
    sel.append(el('option',{value:''},'Bitte wählen'));
    HOTELS.forEach(h=> sel.append(el('option',{value:h.code}, displayHotel(h))));

    sel.addEventListener('change', ()=>{
      const cats  = HOTEL_CATEGORIES['default'];
      const rates = HOTEL_RATES['default'];

      refreshCategoryDependents(sel.value);   // setzt #newCat anhand getCategoriesForHotel()
      refreshNewResRates();                   // mapped Rates neu (Step 3)
      setHotelImage(HOTEL_IMG_SRC);
      setCatImage(SKETCH_IMG_SRC);
      validateStep('1'); updateSummary('#summaryFinal'); updateCatMeta();

      setHotelImage(HOTEL_IMG_SRC);
      setCatImage(SKETCH_IMG_SRC);

      validateStep('1'); updateSummary('#summaryFinal'); updateCatMeta();
    });
  }

  /* Wizard Step 3 – nur gemappte Raten */
/* === Step 3: Policy-Text robust setzen (ohne Duplikate) === */
function setSelectedRatePolicy(policyText){
  const first = document.getElementById('ratePolicyPreview');
  if (first) {
    first.textContent = policyText || '—';
    // evtl. doppelte Absätze im selben Block verbergen
    const box = first.closest('.policy-box') || document.getElementById('w3');
    if (box){
      const ps = Array.from(box.querySelectorAll('p')).filter(p=>p!==first);
      ps.forEach(p => { if ((p.textContent||'').trim() === (first.textContent||'').trim()) p.style.display='none'; });
    }
    return;
  }
  // Fallback: erstes Vorkommen "Stornobedingung" suchen
  const label = Array.from(document.querySelectorAll('#w3 *')).find(n => /stornobedingung/i.test(n.textContent||''));
  const p = label?.parentElement?.querySelector('p');
  if (p) p.textContent = policyText || '—';
}

/* Wenn die Rate gewechselt wird → Preis & Policy spiegeln */
q('#newRate')?.addEventListener('change', (e)=>{
  const opt = e.target.selectedOptions[0];
  if (!opt) return;
  const p = opt.dataset.price;
  const pol = opt.dataset.policy || '';
  if (p && q('#newPrice')) q('#newPrice').value = p;
  setSelectedRatePolicy(pol);
});
  
// Bei Hotel/Kategorie-Wechsel neu befüllen
q('#newHotel')?.addEventListener('change', refreshNewResRates);
q('#newCat')  ?.addEventListener('change', refreshNewResRates);
q('#newRate') ?.addEventListener('change', (e)=>{
  const p = e.target.selectedOptions[0]?.dataset.price;
  if (p && q('#newPrice')) q('#newPrice').value = p;
});


 // Wizard Buttons
q('#btnPrev')?.addEventListener('click', ()=>{
  const cur = Number(qa('.wstep.active')[0]?.dataset.step || '1');
  wizardSet(String(cur - 1));
});
  
q('#btnNext')?.addEventListener('click', ()=>{
  const cur = Number(qa('.wstep.active')[0]?.dataset.step || '1');
  wizardSet(String(cur + 1));
});

  // Inputs → Live-Validation + Summary
  q('#newRate')?.addEventListener('change', e=>{
    const price=e.target.selectedOptions[0]?.dataset.price;
    if(price && q('#newPrice')) q('#newPrice').value=price;
    validateStep('3'); updateSummary('#summaryFinal');
  });
  ['newArr','newDep','newAdults','newChildren','newHotel','newFname','newLname'].forEach(id=>{
    const n=q('#'+id); n?.addEventListener('input', ()=>{ validateStep('1'); updateSummary('#summaryFinal'); });
  });
  q('#newCat')  ?.addEventListener('change', ()=>{ validateStep('2'); updateSummary('#summaryFinal'); setCatImage(SKETCH_IMG_SRC); updateCatMeta(); });
  q('#newPrice')?.addEventListener('input',  ()=>{ validateStep('3'); updateSummary('#summaryFinal'); });

  /* Summary (Step 4) */
  function linesSummary(){
    const code = q('#newHotel')?.value;
    const h    = HOTELS.find(x=>x.code===code);
    const adults   = Number(q('#newAdults')?.value||1);
    const children = Number(q('#newChildren')?.value||0);
    const fname = q('#newFname')?.value || '';
    const lname = q('#newLname')?.value || '';
    const gast  = (lname || fname) ? `${lname}${fname ? ', '+fname : ''}` : '—';

    return [
      ['Hotel',    h ? displayHotel(h) : '—'],
      ['Gast',     gast],
      ['Zeitraum', (q('#newArr')?.value||'—') + ' → ' + (q('#newDep')?.value||'—')],
      ['Belegung', `${adults} Erw. / ${children} Kind.`],
      ['Kategorie', q('#newCat')?.value||'—'],
      ['Rate',      q('#newRate')?.value||'—'],
      ['Preis',     q('#newPrice')?.value ? EUR.format(q('#newPrice').value) : '—']
    ];
  }
  function updateSummary(selector='#summaryFinal'){
    const box = q(selector); if (!box) return;
    const rows = linesSummary().map(([k,v])=>`<div class="summary line"><span>${k}</span><span>${v}</span></div>`).join('');
    box.innerHTML = `<h4 class="mono">Zusammenfassung</h4>${rows}`;
  }

  /* Live Credit-Card mirroring */
  ;['ccHolder','ccNumber','ccExpiry'].forEach(id=>{
    const map = {ccHolder:'ccHolderLive',ccNumber:'ccNumLive',ccExpiry:'ccExpLive'};
    const fmtNum = v => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim().padEnd(19,'•');
    const node = q('#'+id);
    node?.addEventListener('input', e=>{
      const v = e.target.value;
      if (id==='ccNumber') q('#'+map[id]).textContent = fmtNum(v);
      else q('#'+map[id]).textContent = v || (id==='ccExpiry'?'MM/YY':'NAME');
    });
  });

  /* Reservierung anlegen */
  function parseCc(){
    const num = (q('#ccNumber')?.value || '').replace(/\D/g,'');
    const last4 = num.slice(-4) || null;
    const holder= q('#ccHolder')?.value || null;
    const exp   = q('#ccExpiry')?.value || '';
    const m = exp.match(/^(\d{1,2})\s*\/\s*(\d{2})$/);
    const exp_m = m ? Number(m[1]) : null;
    const exp_y = m ? Number(m[2]) : null;
    return { last4, holder, exp_m, exp_y };
  }
  function genResNo(){ return 'R' + Date.now().toString(36).toUpperCase(); }
  async function createReservation(){
  try {
    // 1) Pflichtfelder (Step 4 ist immer ok – hier ggf. später echte Checks ergänzen)
    if (!validateStep('4')){
      if (q('#newInfo')) q('#newInfo').textContent = 'Bitte Pflichtfelder ausfüllen.';
      return;
    }

    // 2) Daten einsammeln
    const code = q('#newHotel')?.value;
    const hUI  = HOTELS.find(h => h.code === code);
    const adults   = Number(q('#newAdults')?.value || 1);
    const children = Number(q('#newChildren')?.value || 0);
    const guests   = adults + children;
    const cc = parseCc();

    const payload = {
      reservation_number: genResNo(),
      status: 'active',
      hotel_code: code || null,
      hotel_name: (hUI ? displayHotel(hUI) : (code || null)),
      arrival: q('#newArr')?.value || null,
      departure: q('#newDep')?.value || null,
      guests,
      guests_adults: adults,
      guests_children: children,
      category: q('#newCat')?.value || null,
      rate_name: q('#newRate')?.value || null,
      rate_price: Number(q('#newPrice')?.value || 0),

      guest_first_name: q('#newFname')?.value || null,
      guest_last_name:  q('#newLname')?.value || null,
      guest_email:      q('#newEmail')?.value || null,
      guest_phone:      q('#newPhone')?.value || null,
      guest_street:     q('#newStreet')?.value || null,
      guest_postal_code:q('#newZip')?.value || null,
      guest_city:       q('#newCity')?.value || null,

      company_name: q('#newCompany')?.value || null,
      company_vat:  q('#newVat')?.value || null,
      // IDs gemäß HTML:
      company_postal_code: q('#newCompanyZip')?.value || null,   // statt newCompanyZipCity
      company_address:     q('#newAddress')?.value || null,      // statt newAddressStreet

      cc_holder: cc.holder,
      cc_last4:  cc.last4,
      cc_exp_month: cc.exp_m,
      cc_exp_year:  cc.exp_y,

      channel: 'Direct',
      notes: q('#newNotes')?.value || null
    };

    // 3) Speichern
    const { error } = await SB.from('reservations').insert(payload);
if (error) {
  console.warn(error);
  alert('Speichern fehlgeschlagen: ' + (error.message || 'unbekannter Fehler'));
  return;
}

    // 4) Optional: non-blocking Push an HNS (wenn Channel konfiguriert)
    (async ()=>{
      try { await pushReservationToHns(payload); }
      catch(e){ logActivity('channel','push_fail', { err: String(e), res_no: payload.reservation_number }); }
    })();

    // 5) UI refresh
await autoRollPastToDone();
await loadKpisToday();
await loadKpisNext();
await loadReservations();

// 6) Context für Bestätigungsmodal setzen (payload reicht hier)
window.__lastReservationContext = {
  hotel: { code: payload.hotel_code, display_name: payload.hotel_name },
  guest: {
    first_name: payload.guest_first_name,
    last_name:  payload.guest_last_name,
    email:      payload.guest_email
  },
  res: payload
};

// 7) Bestätigungs-Popup öffnen (Modal "Reservierungsbestätigung versenden")
openConfirmationModal(window.__lastReservationContext);

// Optional: New-Wizard erst nach Versand schließen (wenn du willst):
// window.addEventListener('confirmation:sent', ()=> closeModal('modalNew'), { once:true });

// Oder sofort schließen und Pop-up über der Seite zeigen:
// closeModal('modalNew');

  } catch (err) {
    console.error('createReservation fatal', err);
    if (q('#newInfo')) q('#newInfo').textContent = 'Fehler: ' + err.message;
  }
}

// Click-Handler (so lassen)
q('#btnCreate')?.addEventListener('click', createReservation);


  /***** Availability *****/
  function datesFrom(startDate, days){
    const ds=[]; const base = startDate? new Date(startDate) : soD(new Date());
    base.setHours(0,0,0,0);
    for(let i=0;i<days;i++){ const d=new Date(base); d.setDate(base.getDate()+i); ds.push(d); }
    return ds;
  }
  function occClass(p){ if (p>=90) return 'occ-r'; if (p>=65) return 'occ-o'; return 'occ-g'; }
  async function buildMatrix(){
    const fromVal = q('#availFrom')?.value || isoDate(new Date());
    const days = Number(q('#availDays')?.value||14);
    const ds = datesFrom(fromVal, days);

    const head=q('#matrixTable thead tr'); head?.querySelectorAll('th:not(.sticky)')?.forEach(n=>n.remove());
    ds.forEach(d=> head?.append(el('th',{}, Dm.format(d))));
    const body=q('#matrixBody'); if (!body) return; body.innerHTML='';

    const from = isoDate(ds[0]), to = isoDate(ds.at(-1));

    for (const h of HOTELS){
      const tr=el('tr'); tr.append(el('td',{class:'sticky'}, displayHotel(h)));
      const { data } = await SB.from('availability')
        .select('date,capacity,booked')
        .eq('hotel_code', h.code)
        .gte('date', from).lte('date', to)
        .order('date',{ascending:true});
      const map={}; (data||[]).forEach(r=>map[r.date]=r);

      ds.forEach(d=>{
  const k   = isoDate(d);
  const cap = map[k]?.capacity ?? 100;
  const b   = map[k]?.booked ?? 0;
  const p   = Math.min(100, Math.round((Number(b)/Math.max(1,Number(cap)))*100));
  const avail = Math.max(0, Number(cap) - Number(b));

  const pill = el('span', { class: `pill ${occClass(p)}` }, `${p}%`);

  // Dummy-Kategorien nach Verfügbarkeit aufteilen
  const split = splitDummyCategories(avail);

  // Tooltip-Events
  pill.addEventListener('mouseenter', (evt)=>{
    const title = `${displayHotel(h)} · ${Dm.format(d)}`;
    const lines = [
      ['Standard', split.Standard],
      ['Superior', split.Superior],
      ['Suite',    split.Suite]
    ];
    showAvailTooltip(evt, title, lines);
  });
  pill.addEventListener('mousemove', moveAvailTooltip);
  pill.addEventListener('mouseleave', hideAvailTooltip);

  tr.append(el('td', {}, pill));
});

      // ---- Availability Tooltip Helpers ----
let __availTT = null;
function ensureAvailTooltip(){
  if (__availTT) return __availTT;
  __availTT = document.createElement('div');
  __availTT.className = 'avail-tt';
  __availTT.style.display = 'none';
  document.body.appendChild(__availTT);
  return __availTT;
}
function showAvailTooltip(evt, title, lines){
  const tt = ensureAvailTooltip();
  tt.innerHTML = `
    <div class="tt-title">${title}</div>
    ${lines.map(([label, val]) => `<div class="tt-line"><span>${label}</span><span>${val}</span></div>`).join('')}
  `;
  tt.style.display = 'block';
  moveAvailTooltip(evt);
}
function moveAvailTooltip(evt){
  const tt = ensureAvailTooltip();
  const pad = 12;
  const x = evt.clientX + pad;
  const y = evt.clientY + pad;
  tt.style.left = x + 'px';
  tt.style.top  = y + 'px';
}
function hideAvailTooltip(){
  const tt = ensureAvailTooltip();
  tt.style.display = 'none';
}
function splitDummyCategories(avail){
  // Verteile die Verfügbarkeit (cap - booked) grob auf Standard/Superior/Suite (50/30/20)
  const a = Math.max(0, Number(avail)||0);
  const std = Math.max(0, Math.floor(a * 0.5));
  const sup = Math.max(0, Math.floor(a * 0.3));
  const sui = Math.max(0, a - std - sup);
  return { Standard: std, Superior: sup, Suite: sui };
}
      body.append(tr);
    }
  }
  q('#availRun')?.addEventListener('click', runAvailability);

  /***** Reporting *****/

// --- Reporting: Chart State ---
let chartRevenue = null;
let chartBookings = null;

// zuletzt berechnete Zusammenfassung (für PDF-Export)
let reportSummary = {
  labels: [],
  bookings: [],
  revenue: [],
  adr: [],
  occPct: [] // Belegungsrate
};

// Charts zeichnen/aktualisieren
function updateReportCharts() {
  const labels   = reportSummary.labels;
  const revenue  = reportSummary.revenue;
  const bookings = reportSummary.bookings;

  // Canvas-Kontexte holen
  const ctxR = document.getElementById('chartRevenue')?.getContext('2d');
  const ctxB = document.getElementById('chartBookings')?.getContext('2d');

  // Revenue-Bar
  if (ctxR) {
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(ctxR, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Umsatz (€)', data: revenue }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Bookings-Pie
  if (ctxB) {
    if (chartBookings) chartBookings.destroy();
    chartBookings = new Chart(ctxB, {
      type: 'pie',
      data: { labels, datasets: [{ label: 'Buchungen', data: bookings }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

function setDefaultReportRange(){
  const to=soD(new Date()); const from=soD(new Date(Date.now()-29*86400000));
  q('#repFrom') && (q('#repFrom').value=isoDate(from));
  q('#repTo')   && (q('#repTo').value=isoDate(to));
}
function fillRepHotel(){
  const sel=q('#repHotel'); if (!sel) return;
  sel.innerHTML='';
  sel.append(el('option',{value:'all'},'Alle Hotels'));
  HOTELS.forEach(h=> sel.append(el('option',{value:h.code}, displayHotel(h))));
}

async function runReport(){
  const from = q('#repFrom')?.value;
  const to   = q('#repTo')?.value;
  const code = q('#repHotel')?.value || 'all';
  if (!from || !to) return;

  const body = q('#repBody'); if (!body) return;
  body.innerHTML = '';

 // (1) Reservierungen laden (alle, die den Zeitraum ÜBERLAPPEN)
let qRes = SB.from('reservations')
  .select('hotel_name,hotel_code,rate_price,arrival,departure,status,channel,created_at')
  // overlap: arrival <= to  AND  (departure IS NULL OR departure >= from)
  .lte('arrival', to)
  .or(`departure.is.null,departure.gte.${from}`)
  .neq('status','canceled');

if (code !== 'all') qRes = qRes.eq('hotel_code', code);

const { data: resRows, error: resErr } = await qRes;


  // (2) Availability laden (Belegungsrate)
  let qAv = SB.from('availability')
    .select('date,hotel_code,capacity,booked')
    .gte('date', from).lte('date', to);
  if (code !== 'all') qAv = qAv.eq('hotel_code', code);
  const { data: avRows, error: avErr } = await qAv;
  if (avErr){ body.append(el('tr',{}, el('td',{colspan:'5'}, 'Fehler beim Laden (Availability)'))); return; }

 // (3) Aggregation NACH NACHTEN im Zeitraum
const DAY = 86400000;
const fromD = soD(new Date(from));
const toD   = soD(new Date(to));
const toEx  = new Date(toD); toEx.setDate(toEx.getDate()+1);

const byHotel = new Map();
(resRows||[]).forEach(r=>{
  // Überlappung von Aufenthalt mit [fromD, toEx)
  const arr = soD(new Date(r.arrival));
  const dep = r.departure ? soD(new Date(r.departure)) : null;
  const stayEndEx = dep ? dep : toEx; // open-ended bis Fensterende
  const overlapStart = new Date(Math.max(arr.getTime(), fromD.getTime()));
  const overlapEndEx = new Date(Math.min(stayEndEx.getTime(), toEx.getTime()));
  const nights = Math.max(0, Math.round((overlapEndEx - overlapStart)/DAY));
  if (nights <= 0) return;

  const key = r.hotel_code || r.hotel_name || '—';
  const o = byHotel.get(key) || { hotel_code:r.hotel_code, hotel_name:r.hotel_name||r.hotel_code, bookings:0, revenue:0 };
  o.bookings += 1;                              // >= 1 Nacht im Fenster
  o.revenue  += Number(r.rate_price||0) * nights; // NACHTEN-basiert
  byHotel.set(key, o);
});

  const occMap = new Map(); // code -> {sum,n}
  (avRows||[]).forEach(a=>{
    const cap = Number(a.capacity||0), b = Number(a.booked||0);
    if (cap>0){
      const p = Math.min(100, Math.round((b/cap)*100));
      const k = a.hotel_code || '—';
      const o = occMap.get(k) || {sum:0,n:0};
      o.sum += p; o.n += 1;
      occMap.set(k,o);
    }
  });

  const labels=[], bookings=[], revenue=[], adrArr=[], occPct=[];
  const rows = [...byHotel.entries()].map(([key,o])=>{
    const h   = HOTELS.find(x=>x.code===o.hotel_code);
    const name= h ? `${h.group} - ${ (h.name||'').replace(/^.*? /,'') }` : (o.hotel_name || key);
    const adr = o.bookings ? (o.revenue/o.bookings) : null;
    const om  = occMap.get(o.hotel_code || key);
    const occ = (om && om.n>0) ? Math.round(om.sum/om.n) : null;

    labels.push(name);
    bookings.push(o.bookings);
    revenue.push(Math.round(o.revenue));
    adrArr.push(adr);
    occPct.push(occ);

    return { name, bookings:o.bookings, revenue:o.revenue, adr, occ };
  });

  if (rows.length===0){
    body.append(el('tr',{}, el('td',{colspan:'5'}, 'Keine Daten im Zeitraum')));
    reportSummary = { labels:[], bookings:[], revenue:[], adr:[], occPct:[] };
    updateReportCharts();
    return;
  }

  // nach Umsatz sortieren
  rows.sort((a,b)=> b.revenue - a.revenue);

  // Tabelle rendern
  rows.forEach(r=>{
    body.append(el('tr',{},
      el('td',{}, r.name),
      el('td',{}, String(r.bookings)),
      el('td',{}, EUR.format(r.revenue)),
      el('td',{}, r.adr!=null ? EUR.format(r.adr) : '—'),
      el('td',{}, r.occ!=null ? (r.occ + '%') : '—')
    ));
  });

  // Charts refresh
  reportSummary = { labels, bookings, revenue, adr: adrArr, occPct };
  updateReportCharts();
}

// Buttons
q('#repRun')?.addEventListener('click', runReport);

  // === Report-Scheduler (Automatischer Versand) ===
const REPORT_JOBS_TABLE = 'report_jobs'; // Supabase (optional); Fallback: LocalStorage
const LS_REPORT_JOB_KEY = 'resTool.reportJob.v1';

// Hotels in Multiselect ODER Checkbox-Grid füllen
function fillRsHotels(){
  const sel  = document.getElementById('rsHotels');      // alte Variante (select multiple)
  const grid = document.getElementById('rsHotelList');   // neue Variante (Checkboxen)
  const list = (window.HOTELS || []);

  if (sel){
    sel.innerHTML = '';
    list.forEach(h=>{
      const opt = document.createElement('option');
      opt.value = h.code;
      opt.textContent = `${h.group} - ${h.name.replace(/^.*? /,'')}`;
      sel.appendChild(opt);
    });
    return;
  }

  if (grid){
    grid.innerHTML = '';
    list.forEach(h=>{
      const code = h.code;
      const label = `${h.group} - ${h.name.replace(/^.*? /,'')}`;
      const id = `rsH_${code}`;
      const wrap = document.createElement('label');
      wrap.className = 'row';
      wrap.style.gap = '8px';
      wrap.innerHTML = `
        <input type="checkbox" data-code="${code}" id="${id}">
        <span>${label}</span>
      `;
      grid.appendChild(wrap);
    });
  }
}

// Helper: Auswahl aus Select/Checkboxen lesen
function getSelectedHotelCodes(){
  const sel  = document.getElementById('rsHotels');
  if (sel) return Array.from(sel.selectedOptions || []).map(o=>o.value);

  const grid = document.getElementById('rsHotelList');
  if (grid) return Array.from(grid.querySelectorAll('input[type="checkbox"]:checked')).map(ch=>ch.dataset.code);

  return [];
}
function getSelectedHotelLabels(){
  const codes = getSelectedHotelCodes();
  const map = new Map((window.HOTELS||[]).map(h=>[h.code, `${h.group} - ${h.name.replace(/^.*? /,'')}`]));
  return codes.map(c=> map.get(c) || c);
}


// Load/Save – versucht Supabase, sonst LocalStorage
async function loadReportJob(){
  // Try Supabase
  try{
    const { data, error } = await SB.from(REPORT_JOBS_TABLE).select('*').limit(1);
    if (!error && data && data[0]) return data[0];
  }catch(_){}
  // Fallback LS
  try{ return JSON.parse(localStorage.getItem(LS_REPORT_JOB_KEY) || 'null') }catch{ return null; }
}

async function saveReportJob(job){
  // Try Supabase: upsert single row (id = 'singleton')
  try{
    const withId = { id: 'singleton', ...job, updated_at: new Date().toISOString() };
    const { error } = await SB.from(REPORT_JOBS_TABLE).upsert(withId).eq('id','singleton');
    if (!error) return true;
  }catch(_){}
  // Fallback LS
  try{ localStorage.setItem(LS_REPORT_JOB_KEY, JSON.stringify(job)); return true; }catch(_){ return false; }
}

// Öffnen
document.getElementById('btnRepSchedule')?.addEventListener('click', async ()=>{
  fillRsHotels();
  makeMultiSelectFriendly(document.getElementById('rsHotels'));
  const pref = await loadReportJob();

  // defaults
  document.getElementById('rsActive').value = String(pref?.active ?? true);
  document.getElementById('rsFreq').value   = pref?.frequency || 'daily';
  document.getElementById('rsTime').value   = pref?.time || '08:00';
  document.getElementById('rsRange').value  = pref?.range || 'today';
  document.getElementById('rsFrom').value   = pref?.from || '';
  document.getElementById('rsTo').value     = pref?.to || '';
  document.getElementById('rsPdf').checked  = pref?.formats?.pdf !== false;
  document.getElementById('rsCsv').checked  = pref?.formats?.csv !== false;

  document.getElementById('rsRecipients').value = (pref?.recipients || []).join(', ');
  document.getElementById('rsSubj').value       = pref?.subject || 'Report {{range}} – {{date}} – {{hotels}}';
  document.getElementById('rsBody').value       = pref?.body || 'Guten Morgen,\n anbei der automatisierte Report für {{range}} ({{date}}) – Hotels: {{hotels}}.\nViele Grüße\nReservierung';

  // Hotels vorselektieren
 const wanted = new Set(pref?.hotels || []);
const sel = document.getElementById('rsHotels');
if (sel){
  Array.from(sel.options).forEach(o => { o.selected = wanted.has(o.value); });
} else {
  const grid = document.getElementById('rsHotelList');
  if (grid){
    grid.querySelectorAll('input[type="checkbox"]').forEach(ch=>{
      ch.checked = wanted.has(ch.dataset.code);
    });
  }
}
  openModal('modalRepScheduler');
});

// Speichern
document.getElementById('btnRepSave')?.addEventListener('click', async ()=>{
  const job = {
    active: document.getElementById('rsActive').value === 'true',
    frequency: document.getElementById('rsFreq').value,
    time: document.getElementById('rsTime').value,
    range: document.getElementById('rsRange').value,
    from: document.getElementById('rsFrom').value || null,
    to:   document.getElementById('rsTo').value   || null,
    hotels: getSelectedHotelCodes(),
    formats: {
      pdf: document.getElementById('rsPdf').checked,
      csv: document.getElementById('rsCsv').checked
    },
    recipients: (document.getElementById('rsRecipients').value || '')
      .split(',').map(s=>s.trim()).filter(Boolean),
    subject: document.getElementById('rsSubj').value || '',
    body:    document.getElementById('rsBody').value || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'
  };

  const ok = await saveReportJob(job);
  const info = document.getElementById('rsInfo');
  info.textContent = ok ? 'Gespeichert. (Scheduler-Konfig ist aktiv.)' : 'Konnte nicht speichern.';
  if (ok) {
    try { await logActivity('report','schedule_save', job); } catch(_){}
  }
});

// Test senden (ruft die Edge Function sofort mit force=true auf)
document.getElementById('btnRepTest')?.addEventListener('click', async () => {
  const info = document.getElementById('rsInfo');
  info.textContent = 'Sende Test…';

  // Payload anreichern (hilft beim Debuggen/Backend)
  const recipients = (document.getElementById('rsRecipients').value || '')
    .split(',').map(s=>s.trim()).filter(Boolean);

  if (!recipients.length) {
  info.textContent = 'Bitte mindestens eine Empfänger-E-Mail eintragen.';
  return;
}

  const payload = {
    force: true,
    range:  document.getElementById('rsRange').value,
    from:   document.getElementById('rsFrom').value || null,
    to:     document.getElementById('rsTo').value   || null,
    hotels: (function(){
      const sel = document.getElementById('rsHotels');
      if (sel) return Array.from(sel.selectedOptions||[]).map(o=>o.value);
      const grid = document.getElementById('rsHotelList');
      if (grid) return Array.from(grid.querySelectorAll('input[type="checkbox"]:checked')).map(ch=>ch.dataset.code);
      return [];
    })(),
    recipients,
    formats: {
      pdf: document.getElementById('rsPdf').checked,
      csv: document.getElementById('rsCsv').checked
    }
    ,
subject: document.getElementById('rsSubj').value || 'Report {{range}} – {{date}} – {{hotels}}',
body:    document.getElementById('rsBody').value || 'Guten Morgen,\n anbei der automatisierte Report für {{range}} ({{date}}) – Hotels: {{hotels}}.\nViele Grüße\nReservierung',
hotels_labels: (typeof getSelectedHotelLabels === 'function' ? getSelectedHotelLabels() : []),
timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'),
debug: true

  };
  

  try {
    // 1) Supabase SDK Invoke
    const { data, error } = await SB.functions.invoke('bright-task', {
      body: payload,
    headers: {
  Authorization: `Bearer ${SB_ANON_KEY}`,
  apikey: SB_ANON_KEY,
  'Content-Type': 'application/json'
}
    });

    if (error) {
      info.textContent = 'Fehler: ' + (error.message || JSON.stringify(error));
      console.warn('bright-task error', error);
      return;
    }

    const msg = typeof data === 'string' ? data : (data?.message || JSON.stringify(data));
    info.textContent = 'OK: ' + (msg || 'Test ausgelöst.');
  } catch (e) {
    // 2) SDK-Fehler → Diagnose-Fallback: Direktaufruf der Function-URL
    info.textContent = 'Fehler: ' + (e.message || String(e));
    console.error('bright-task invoke failed', e);

    try {
      const resp = await fetch(`${SB_URL}/functions/v1/bright-task`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SB_ANON_KEY}`,
    apikey: SB_ANON_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

      const text = await resp.text();
      console.warn('Direct function call status', resp.status, 'body:', text);
      info.textContent += ` | Direktaufruf: HTTP ${resp.status} – ${text?.slice(0,140) || ''}`;
    } catch (e2) {
      console.warn('Direct call failed:', e2);
      info.textContent += ' | Direktaufruf fehlgeschlagen (CORS/Netzwerk).';
    }
  }
});

// Beim Range-Wechsel From/To aktivieren/deaktivieren
(function bindRangeUi(){
  const rangeSel = document.getElementById('rsRange');
  const fromEl   = document.getElementById('rsFrom');
  const toEl     = document.getElementById('rsTo');
  if (!rangeSel) return;
  function toggle(){
    const custom = rangeSel.value === 'custom';
    fromEl.disabled = toEl.disabled = !custom;
    if (!custom){ fromEl.value=''; toEl.value=''; }
  }
  rangeSel.addEventListener('change', toggle);
  toggle();
})();


q('#repCsv')?.addEventListener('click', ()=>{
  const tbody = Array.from(document.querySelectorAll('#repBody tr'));
  const rows = [['Hotel','Buchungen','Umsatz','ADR','Belegungsrate']];
  tbody.forEach(tr=> rows.push([...tr.children].map(td=>td.textContent)));
  download('report.csv','text/csv;charset=utf-8',
    rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  );
});

  // Hotelskizze sicher binden (doppelte Listener vermeiden)
(function bindSketchSafe(){
  const old = document.getElementById('btnSketch');
  if (!old) return;
  const clone = old.cloneNode(true);
  old.replaceWith(clone);
  clone.addEventListener('click', ()=>{
    try { typeof buildSketch === 'function' && buildSketch(); } catch(e){}
    openModal('modalSketch');
  });
})();

  
q('#repXls')?.addEventListener('click', ()=>{
  const tbody = Array.from(document.querySelectorAll('#repBody tr'));
  const rows = [['Hotel','Buchungen','Umsatz','ADR','Belegungsrate']];
  tbody.forEach(tr=> rows.push([...tr.children].map(td=>td.textContent)));
  const header=`<?xml version="1.0"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Worksheet ss:Name="Report"><Table>`;
  const rowsXml = rows.map(r=>`<Row>`+r.map(c=>`<Cell><Data ss:Type="String">${String(c??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</Data></Cell>`).join('')+`</Row>`).join('');
  const xls = header+rowsXml+`</Table></Worksheet></Workbook>`;
  download('report.xls','application/vnd.ms-excel', xls);
});

q('#repPdf')?.addEventListener('click', async ()=>{
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return alert('PDF-Bibliothek nicht geladen.');

  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  const from = q('#repFrom')?.value || '';
  const to   = q('#repTo')?.value || '';
  const title = 'Report';
  const subtitle = `Zeitraum: ${from} – ${to}`;
  const ts = new Date().toLocaleString('de-DE');

  // Header
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFont('helvetica','normal'); doc.setFontSize(11);
  doc.text(subtitle, 40, 60);
  doc.setFontSize(9);
  doc.text(`Erstellt: ${ts}`, 40, 76);

  // Tabelle
  const head = [['Hotel','Buchungen','Umsatz','ADR','Belegungsrate']];
  const body = reportSummary.labels.map((label, i)=>[
    label,
    String(reportSummary.bookings[i] ?? ''),
    (reportSummary.revenue[i]!=null ? EUR.format(reportSummary.revenue[i]) : '—'),
    (reportSummary.adr[i]!=null ? EUR.format(reportSummary.adr[i]) : '—'),
    (reportSummary.occPct[i]!=null ? (reportSummary.occPct[i] + '%') : '—')
  ]);

  doc.autoTable({
    head, body,
    startY: 96,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [0, 180, 180] }
  });

  // Charts kompakt nebeneinander
  const revCanvas = document.getElementById('chartRevenue');
  const bokCanvas = document.getElementById('chartBookings');

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const gap = 20;

  let y = (doc.lastAutoTable?.finalY || 96) + 30;

  if (revCanvas || bokCanvas) {
    const maxW = (pageW - marginX*2 - gap) / 2; // zwei Spalten

    // Falls nur ein Chart existiert → volle Breite nutzen (kompakt in der Höhe)
    const placeOne = (canvas, labelText) => {
      const img = canvas.toDataURL('image/png', 1.0);
      const w = pageW - marginX*2;
      const h = (canvas.height/canvas.width) * w * 0.5;
      if (y + 20 + h > pageH - 40) { doc.addPage(); y = 40; }
      doc.setFont('helvetica','bold'); doc.setFontSize(11);
      doc.text(labelText, marginX, y); y += 10;
      doc.addImage(img, 'PNG', marginX, y, w, h); y += h;
    };

    if (revCanvas && bokCanvas) {
      const imgR = revCanvas.toDataURL('image/png', 1.0);
      const imgB = bokCanvas.toDataURL('image/png', 1.0);
      const hR = (revCanvas.height/revCanvas.width) * maxW;
      const hB = (bokCanvas.height/bokCanvas.width) * maxW;
      const h = Math.min(220, Math.max(hR, hB)); // Deckelung für Kompaktheit

      if (y + 30 + h > pageH - 40) { doc.addPage(); y = 40; }

      doc.setFont('helvetica','bold'); doc.setFontSize(11);
      doc.text('Umsatz pro Hotel', marginX, y);
      doc.text('Buchungen pro Hotel', marginX + maxW + gap, y);
      y += 10;

      doc.addImage(imgR, 'PNG', marginX, y, maxW, h);
      doc.addImage(imgB, 'PNG', marginX + maxW + gap, y, maxW, h);
      y += h;
    } else if (revCanvas) {
      placeOne(revCanvas, 'Umsatz pro Hotel');
    } else if (bokCanvas) {
      placeOne(bokCanvas, 'Buchungen pro Hotel');
    }
  }

  doc.save('report.pdf');
});

/***** EVENTS & INIT *****/
q('#btnAvail')?.addEventListener('click', async ()=>{
  q('#availFrom') && (q('#availFrom').value = isoDate(new Date()));
  q('#availDays') && (q('#availDays').value = '14');
  await runAvailability();
  openModal('modalAvail');
});
q('#btnReporting')?.addEventListener('click', async ()=>{
  setDefaultReportRange(); 
  fillRepHotel(); 
  await runReport(); 
  openModal('modalReporting');
});
q('#btnSettings')?.addEventListener('click', async ()=>{
  await fetchNetworkInfo();           // NEU: live laden
  openModal('modalSettings');
});
  q('#btnHelp') ?.addEventListener('click', ()=> openModal('modalHelp'));

q('#btnNew')?.addEventListener('click', ()=>{
  // Reset
  ['newArr','newDep','newAdults','newChildren','newCat','newRate','newPrice','newFname','newLname','newEmail','newPhone','newStreet','newZip','newCity','newCompany','newVat','newCompanyZipCity','newAddressStreet','newNotes','ccHolder','ccNumber','ccExpiry']
    .forEach(id=>{ const n=q('#'+id); if(n){ n.value=''; } });
  q('#newAdults') && (q('#newAdults').value=1);
  q('#newChildren') && (q('#newChildren').value=0);
  q('#btnNext') && (q('#btnNext').disabled=true);

  // Live-Card reset
  q('#ccNumLive')    && (q('#ccNumLive').textContent='•••• •••• •••• ••••');
  q('#ccHolderLive') && (q('#ccHolderLive').textContent='NAME');
  q('#ccExpLive')    && (q('#ccExpLive').textContent='MM/YY');

  // Selects + Bilder
  fillHotelSelect();
  ensureCatRateOptions();
  setHotelImage(HOTEL_IMG_SRC);
  setCatImage(SKETCH_IMG_SRC);

  wizardSet('1');
  q('#newInfo') && (q('#newInfo').textContent='');
  openModal('modalNew');
});
  
// Back-Button in der Hotelskizze
document.querySelector('#sketchBack')?.addEventListener('click', () => {
  document.querySelector('#sketchStateView')?.classList.add('hidden');
  document.querySelector('#sketchStateList')?.classList.remove('hidden');
});

/* =========================
   CATEGORY MODULE v2 (per Hotel: code, name, maxPax)
   ========================= */
const CATS_V2_KEY = 'resTool.categoriesV2';
const LEGACY_CATS_KEY = 'resTool.categories'; // alte Liste: nur Namen[]
const CAT_CODE_RE = /^[A-Z0-9]{2,12}$/;
const CAT_PAGE_SIZE = 50;

const DEFAULT_CATS = [
  { code:'STD', name:'Standard', maxPax:2, desc:'' },
  { code:'SUP', name:'Superior', maxPax:2, desc:'' },
  { code:'STE', name:'Suite',    maxPax:4, desc:'' },
];

// --- Storage helpers ---
function readCatsV2(){
  try { return JSON.parse(localStorage.getItem(CATS_V2_KEY)) || {}; }
  catch { return {}; }
}
function writeCatsV2(map){
  localStorage.setItem(CATS_V2_KEY, JSON.stringify(map||{}));
  // Sync für Legacy-Kompatibilität (HOTEL_CATEGORIES → Namen[])
  window.HOTEL_CATEGORIES = window.HOTEL_CATEGORIES || { default: ['Standard','Superior','Suite'] };
  Object.entries(map||{}).forEach(([code, list])=>{
    window.HOTEL_CATEGORIES[code] = (list||[]).map(x=>x.name);
  });
}
function hotelsList(){ return Array.isArray(window.HOTELS) ? window.HOTELS : []; } // HOTELS existiert bereits. :contentReference[oaicite:2]{index=2}

// --- Migration / Seed ---
(function migrateCats(){
  const v2 = readCatsV2();
  if (Object.keys(v2).length) { writeCatsV2(v2); return; } // schon V2

  // Legacy vorhanden?
  let legacy = {};
  try { legacy = JSON.parse(localStorage.getItem(LEGACY_CATS_KEY)) || {}; } catch {}

  if (Object.keys(legacy).length){
    const map = {};
    for (const h of hotelsList()){
      const names = legacy[h.code] || window.HOTEL_CATEGORIES?.default || [];
      const used = new Set();
      map[h.code] = names.map((n,i)=>{
        let base = (n||'').normalize('NFD').replace(/[^\w]/g,'').toUpperCase().slice(0,3);
        if (!base || base.length<2) base = 'CAT';
        let code = base; let k=1;
        while (used.has(code)) { code = base + (++k); }
        used.add(code);
        return { code, name:n, maxPax:2, desc:'' };
      });
    }
    writeCatsV2(map);
  } else {
    // Erstbefüllung: Defaults je Hotel
    const map = {};
    for (const h of hotelsList()){ map[h.code] = DEFAULT_CATS.map(x=>({...x})); }
    writeCatsV2(map);
  }
})();


// --- Public helpers ---
function getCategoriesForHotel(hotelCode){
  const map = readCatsV2();
  return (map[hotelCode] || []).slice();
}
function upsertCategory(hotelCode, cat){ // {code,name,maxPax,desc}
  const map = readCatsV2();
  const list = (map[hotelCode]||[]).slice();
  const i = list.findIndex(x=>x.code===cat.code);
  if (i>=0) list[i] = {...list[i], name:cat.name, maxPax:cat.maxPax, desc:(cat.desc ?? list[i].desc ?? '')};
  else list.push({code:cat.code, name:cat.name, maxPax:cat.maxPax, desc:(cat.desc ?? '')});
  map[hotelCode]=list; writeCatsV2(map);
  refreshCategoryDependents(hotelCode);
}
function deleteCategory(hotelCode, code){
  const map = readCatsV2();
  map[hotelCode] = (map[hotelCode]||[]).filter(x=>x.code!==code);
  writeCatsV2(map);
  refreshCategoryDependents(hotelCode);
}
function findCatByName(hotelCode, name){
  return getCategoriesForHotel(hotelCode).find(x=>x.name===name);
}
function findCatByCode(hotelCode, code){
  return getCategoriesForHotel(hotelCode).find(x=>x.code===code);
}

// --- Mapping in bestehende UIs (Neue Rate, Wizard) ---
function refreshCategoryDependents(hotelCode){
  // 1) Ratenformular (multi): #rateCats – Werte bleiben die NAMEN (Kompatibilität),
  //    Anzeige enthält Code/Max. Pers. als Text.
  const rateCats = document.getElementById('rateCats');
  if (rateCats){
    const cats = getCategoriesForHotel(hotelCode);
    rateCats.innerHTML = ['*', ...cats.map(c=>c.name)]
      .map(n => {
        if (n==='*') return `<option value="*">Alle</option>`;
        const c = findCatByName(hotelCode, n);
        return `<option value="${n}" data-code="${c?.code||''}" data-max="${c?.maxPax||''}">${n} (${c?.code||'—'} · max ${c?.maxPax||'—'})</option>`;
      }).join('');
    try { makeMultiSelectFriendly(rateCats); } catch(e){}
  }

  // 2) Wizard Step „Neue Buchung“ – #newCat (single)
  const wizardHotelSel = document.getElementById('newHotel');
  const wizardCatSel   = document.getElementById('newCat');
  if (wizardHotelSel && wizardCatSel && (wizardHotelSel.value || hotelCode)){
    const code = wizardHotelSel.value || hotelCode;
    const cats = getCategoriesForHotel(code);
    wizardCatSel.innerHTML = cats.map(c=>`<option value="${c.name}" data-code="${c.code}" data-max="${c.maxPax}">${c.name} (${c.code} · max ${c.maxPax})</option>`).join('');
  }
}

// --- UI Rendering (Suche + Pagination) ---
window.__catsState = window.__catsState || { page:1, q:'' };

function renderCatsV2(){
  const sel = document.getElementById('catsHotel');
  const qIn = document.getElementById('catsSearch');
  const body= document.getElementById('catsTbody');
  const title = document.getElementById('catsTitleHotel');
  const count = document.getElementById('catsCount');
  if (!sel || !body) return;

  // Hotels einmalig füllen
  if (!sel.options.length){
    hotelsList().forEach(h=>{
      const opt = document.createElement('option');
      opt.value = h.code; opt.textContent = `${h.group} - ${h.name.replace(/^.*? /,'')}`;
      sel.append(opt);
    });
    sel.value = sel.value || (hotelsList()[0]?.code || '');
    sel.addEventListener('change', ()=>{ window.__catsState.page=1; renderCatsV2(); });
  }

  // Titel
  const h = hotelsList().find(x=>x.code===sel.value);
  if (title && h) title.textContent = `Kategorien – ${h.group} ${h.name.replace(/^.*? /,'')}`;

  // Filter
  const term = (window.__catsState.q || '').trim().toUpperCase();
  if (qIn && !qIn.__bound){
    qIn.__bound=true;
    qIn.addEventListener('input', (e)=>{ window.__catsState.q=e.target.value; window.__catsState.page=1; renderCatsV2(); });
  }

  // Daten holen + filtern
  const all = getCategoriesForHotel(sel.value);
  const filtered = term ? all.filter(c =>
    c.code.toUpperCase().includes(term) || c.name.toUpperCase().includes(term)
  ) : all;

  // Pagination
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / CAT_PAGE_SIZE));
  const page  = Math.min(window.__catsState.page, pages);
  const start = (page-1) * CAT_PAGE_SIZE;
  const rows  = filtered.slice(start, start+CAT_PAGE_SIZE);

  // Tabelle rendern (Code & Hotel nicht editierbar, Name/MaxPax editierbar)
  body.innerHTML = rows.map(c=>`
    <tr class="row" data-code="${c.code}">
      <td><input class="input sm" value="${c.code}" disabled></td>
      <td><input class="input sm" value="${c.name}" data-f="name"></td>
      <td><input class="input sm" type="number" min="1" max="12" value="${c.maxPax}" data-f="max"></td>
      <td class="right">
        <button class="btn sm" data-act="save">Speichern</button>
        <button class="btn sm danger" data-act="del">Löschen</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="muted tiny">Keine Kategorien gefunden.</td></tr>`;

  // Zähler + Paging UI
  const info = document.getElementById('catsPageInfo');
  const btnPrev = document.getElementById('catsPrev');
  const btnNext = document.getElementById('catsNext');
  if (info) info.textContent = `Seite ${page} / ${pages}`;
  if (count) count.textContent = `${total} Einträge`;

  if (btnPrev && !btnPrev.__bound){
    btnPrev.__bound = true;
    btnPrev.addEventListener('click', ()=>{ if (window.__catsState.page>1){ window.__catsState.page--; renderCatsV2(); }});
  }
  if (btnNext && !btnNext.__bound){
    btnNext.__bound = true;
    btnNext.addEventListener('click', ()=>{ if (window.__catsState.page<pages){ window.__catsState.page++; renderCatsV2(); }});
  }

    // Row actions
  body.onclick = (e)=>{
    const tr = e.target.closest('tr.row'); if (!tr) return;
    const act= e.target.closest('button[data-act]')?.dataset.act;
    const code = tr.dataset.code;
    const hotel = document.getElementById('catsHotel')?.value;

    if (act === 'del'){ deleteCategory(hotel, code); renderCatsV2(); return; }
    if (act === 'save'){
      const name = tr.querySelector('input[data-f="name"]')?.value.trim();
      const max  = Number(tr.querySelector('input[data-f="max"]')?.value || 2);
      if (!name){ setCatsInfo('Name darf nicht leer sein.'); return; }
      if (!(max>=1 && max<=12)){ setCatsInfo('Max. Personen zwischen 1–12.'); return; }
      upsertCategory(hotel, {code, name, maxPax:max});
      setCatsInfo('Gespeichert.');
      return;
    }

    // Klick auf Zeile (kein Button/Input) → Beschreibungs-Editor
    if (!e.target.closest('button') && !e.target.matches('input')){
      openCatDescModal({ hotel, code, isNew:false });
    }
  };
} // <-- schließt renderCatsV2

// Infozeile unter „Neue Kategorie“
function setCatsInfo(txt){ const el = document.getElementById('catsInfo'); if (el) el.textContent = txt||''; }


// --- Anlage neue Kategorie ---
(function bindCatCreate(){
  const btn = document.getElementById('btnCatCreate');
  if (!btn || btn.__bound) return;
  btn.__bound = true;
  
  btn.addEventListener('click', ()=>{
    const hotel = document.getElementById('catsHotel')?.value || '';
    const code  = (document.getElementById('catCodeNew')?.value || '').toUpperCase().trim();
    const name  = (document.getElementById('catNameNew')?.value || '').trim();
    const max   = Number(document.getElementById('catMaxNew')?.value || 2);

    if (!hotel) return setCatsInfo('Bitte Hotel wählen.');
    if (!CAT_CODE_RE.test(code)) return setCatsInfo('Ungültiger Code (nur A-Z/0-9, 2–12 Zeichen).');
    if (!name) return setCatsInfo('Bitte einen Namen angeben.');
    if (!(max>=1 && max<=12)) return setCatsInfo('Max. Personen zwischen 1–12.');
    if (findCatByCode(hotel, code)) return setCatsInfo('Code existiert bereits für dieses Hotel.');

    // Felder leeren – Anlage erfolgt nach Speichern im Popup
    document.getElementById('catCodeNew').value = '';
    document.getElementById('catNameNew').value = '';
    document.getElementById('catMaxNew').value = '2';

    openCatDescModal({ hotel, code, name, maxPax:max, isNew:true });
  });
})();

// --- Öffner (ersetze ggf. alten Listener) ---
(function wireCatsOpener(){
  const btn = document.getElementById('btnCats');
  if (!btn) return;
  btn.addEventListener('click', ()=>{ renderCatsV2(); openModal('modalCats'); });
})();

// Öffner (Einstellungen → Kategorieverwaltung)
document.getElementById('btnCats')?.addEventListener('click', ()=>{
  renderCatsV2();
  openModal('modalCats');
});
  
(async function init(){
  startClocks();
  await refreshStatus(); setInterval(refreshStatus, 30000);
  await autoRollPastToDone();
  await buildMiniAnalytics();

  fillHotelFilter(q('#kpiFilterToday'));
  fillHotelFilter(q('#kpiFilterNext'));
  q('#kpiFilterToday')?.addEventListener('change', loadKpisToday);
  q('#kpiFilterNext')?.addEventListener('change', loadKpisNext);

  fillFilters();
  if (q('#filterStatus')) q('#filterStatus').value = 'active';

  await loadKpisToday();
  await loadKpisNext();
  await loadReservations();
})();

/* =========================
   HNS CHANNEL INTEGRATION (fetch + mapping + push/pull)
   ========================= */
(function HNS_INTEGRATION(){
  const CH_KEY = 'resTool.channelSettings';

  function readChannelSettings(){
    try { return JSON.parse(localStorage.getItem(CH_KEY)) || {}; }
    catch { return {}; }
  }
  function hnsBaseUrl(s){
    return (s.mode === 'live' ? s.hns_prod : s.hns_test) || '';
  }
  function mapHotel(code, s){ return (s.hotel_map||{})[code] || null; }
  function mapCategory(name, s){ return (s.cat_map||{})[name] || null; }
  function mapRate(code, s){ return (s.rate_map||{})[code] || null; }

  async function hnsFetch(path, { method='GET', headers={}, body, timeoutMs, retries } = {}){
    const s = readChannelSettings();
    const base = hnsBaseUrl(s).replace(/\/+$/,'');
    if (!base) throw new Error('HNS-Endpoint ist nicht konfiguriert.');
    const url = base + '/' + String(path||'').replace(/^\/+/,'');
    const to  = timeoutMs ?? (s.timeout_ms || 15000);
    const max = retries   ?? (s.retry_count || 2);

    const baseHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': s.api_key || '',
      'X-API-Secret': s.api_secret || '',
      ...headers
    };

    let attempt = 0, lastErr;
    while (attempt <= max){
      const ctl = new AbortController();
      const t = setTimeout(()=>ctl.abort(new Error('timeout')), to);
      const t0 = performance.now();
      try{
        const res = await fetch(url, {
          method,
          headers: baseHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: ctl.signal
        });
        clearTimeout(t);
        const ms = Math.round(performance.now()-t0);
        if (!res.ok) {
          const txt = await res.text().catch(()=> '');
          logActivity('channel','api_call',{ path, status: res.status, ms, body, resp: txt?.slice?.(0,400) });
          throw new Error(`HNS ${res.status}`);
        }
        const json = await res.json().catch(()=> ({}));
        logActivity('channel','api_call',{ path, status: 'ok', ms, body });
        return json;
      }catch(e){
        clearTimeout(t);
        lastErr = e;
        attempt++;
        if (attempt > max){
          logActivity('channel','api_call',{ path, status:'fail', err:String(e) });
          throw e;
        }
        await new Promise(r=>setTimeout(r, 400*attempt));
      }
    }
    throw lastErr;
  }

  // --- PUSH: Reservierung an HNS senden (nach lokalem Insert)
  async function pushReservationToHns(resRow){
    const s = readChannelSettings();
    if (!s.api_key || !(s.hns_prod || s.hns_test)) return; // nicht konfiguriert → silent return
    if (Array.isArray(s.hotels_active) && !s.hotels_active.includes(resRow.hotel_code)) return;

    const hnsHotelId = mapHotel(resRow.hotel_code, s);
    if (!hnsHotelId) throw new Error('Hotel nicht gemappt (Channel-Einstellungen → Hotel-Mapping).');

    // TIP: falls du `ratecode` im Wizard speicherst, ist das Mapping stabiler.
    const rateHns = resRow.ratecode ? (mapRate(resRow.ratecode, s) || null) : null;
    const catHns  = resRow.category ? (mapCategory(resRow.category, s) || null) : null;

    const payload = {
      hotelId: hnsHotelId,
      stay: {
        arrival:   resRow.arrival,
        departure: resRow.departure,
        adults:    resRow.guests_adults || 1,
        children:  resRow.guests_children || 0
      },
      guest: {
        firstName: resRow.guest_first_name || '',
        lastName:  resRow.guest_last_name  || '',
        email:     resRow.guest_email      || '',
        phone:     resRow.guest_phone      || ''
      },
      room: { categoryId: catHns },
      rate: { code: rateHns, name: resRow.rate_name || '', price: Number(resRow.rate_price||0), currency: 'EUR' },
      notes: resRow.notes || '',
      idempotencyKey: resRow.reservation_number // gegen Doppelanlage bei Retry
    };

    const resp = await hnsFetch('/reservations', { method:'POST', body: payload });
    // Optional: externe ID zurückspeichern
    // await SB.from('reservations').update({ hns_id: resp.id }).eq('reservation_number', resRow.reservation_number);
    return resp;
  }

  // --- PULL: Availability von HNS holen → Supabase schreiben
  async function pullAvailabilityFromHns(dateFrom, days=14){
    const s = readChannelSettings();
    const from = dateFrom || new Date().toISOString().slice(0,10);
    for (const h of (window.HOTELS||[])){
      if (Array.isArray(s.hotels_active) && !s.hotels_active.includes(h.code)) continue;
      const id = mapHotel(h.code, s); if (!id) continue;

      // Erwartete HNS-Antwort: [{date:'YYYY-MM-DD', capacity:100, booked:67}, …]
      const data = await hnsFetch(`/availability?hotel=${encodeURIComponent(id)}&from=${from}&days=${days}`);
      for (const r of (data||[])){
        await SB.from('availability').upsert({
          hotel_code: h.code,
          date: r.date,
          capacity: Number(r.capacity||0),
          booked:   Number(r.booked||0)
        }, { onConflict: 'hotel_code,date' });
      }
    }
  }

// --- SYNC-Knopf im Channel-Admin anbinden (falls vorhanden)
function bindChannelSync(){
  const btn = document.getElementById('btnSyncNow');
  if (!btn || btn.__bound) return;
  btn.__bound = true;

  btn.addEventListener('click', async ()=>{
    const info = document.getElementById('channelInfo');
    const errList = document.getElementById('chErrorList');

    const pushErr = (msg)=>{
      if (!errList) return;
      const li = document.createElement('li');
      li.textContent = msg;
      errList.prepend(li);
      while (errList.children.length > 10) errList.removeChild(errList.lastChild);
    };

    try{
      if (info) info.textContent = 'Synchronisiere … (Health-Check)';

      // Health/Ping – tolerant, falls Endpoint nicht existiert
      try { await hnsFetch('/ping'); }
      catch(e){ pushErr('Health-Check: '+ String(e)); }

      if (info) info.textContent = 'Ziehe Availability (14 Tage) …';
      await pullAvailabilityFromHns(new Date().toISOString().slice(0,10), 14);

      // last_sync in Settings aktualisieren
      const s = readChannelSettings();
      s.last_sync = new Date().toISOString();
      localStorage.setItem(CH_KEY, JSON.stringify(s));
      const el = document.getElementById('chLastSync');
      if (el) el.textContent = new Date(s.last_sync).toLocaleString('de-DE');

      // UI aktualisieren (vorsichtig, nur wenn Funktionen existieren)
      if (typeof loadKpisToday === 'function')        await loadKpisToday();
      if (typeof loadKpisNext === 'function')         await loadKpisNext();
      if (typeof loadAvailabilityMatrix === 'function') await loadAvailabilityMatrix();
      if (typeof loadReservations === 'function')     await loadReservations();

      // Mapping-Ampel/Monitoring refreshen (falls vorhanden)
      if (typeof renderMappingAmpel === 'function') { try { renderMappingAmpel(); } catch(e){} }

      if (info) info.textContent = 'Sync OK. Daten aktualisiert.';
    }catch(e){
      pushErr('Sync fehlgeschlagen: ' + String(e));
      if (info) info.textContent = 'Sync fehlgeschlagen: ' + String(e);
    }
  });
}

// Beim Öffnen des Channel-Modals binden
document.addEventListener('click', async (e)=>{
  const b = e.target.closest('#btnChannel');
  if (!b) return;
  setTimeout(bindChannelSync, 50);
});
})();


// --- Seeding für Default-Raten ---
function seedDefaultRatesIfEmpty(){
  try {
    const KEY = 'resTool.rates';
    const cur = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(cur) && cur.length) return;
    const now = new Date().toISOString();
    const hotels = Array.isArray(window.HOTELS) ? window.HOTELS : [];
    const seed = [];
    hotels.forEach(h => {
      seed.push({
        id:'r_'+(Date.now())+'_'+h.code+'_1',
        ratecode:'1001', ratetype:'Direct', hotel_code:h.code,
        categories:['*'],
        name:'Flex exkl. Frühstück',
        policy:'Bis zum Anreisetag 18:00 Uhr kostenfrei stornierbar.',
        price:89, mapped:true, created_at:now, updated_at:now
      });
      seed.push({
        id:'r_'+(Date.now()+1)+'_'+h.code+'_2',
        ratecode:'1002', ratetype:'Direct', hotel_code:h.code,
        categories:['*'],
        name:'Flex inkl. Frühstück',
        policy:'Bis zum Anreisetag 18:00 Uhr kostenfrei stornierbar.',
        price:109, mapped:true, created_at:now, updated_at:now
      });
    });
    localStorage.setItem(KEY, JSON.stringify(seed));
  } catch(e) { /* ignore */ }
}
seedDefaultRatesIfEmpty();

  makeMultiSelectFriendly(document.querySelector('#crCats')); // Neuanlage
  makeMultiSelectFriendly(document.querySelector('#erCats')); // Bearbeiten


  // --- Einstellungen / Admin ---
const ADMIN_PW = null;
const SETTINGS_KEY = "resTool.settings";
const LOG_KEY = "resTool.activityLog";

  // --- Log: Pagination State ---
const LOG_PAGE_SIZE = 50;
window.__logState = window.__logState || { page: 1, rows: [] };

const I18N = {
  de: {
    "settings.language": "Sprache",
    "settings.hue": "Farbton",
    "settings.save": "Einstellungen speichern",
    // Beispieltexte (füge bei Bedarf weitere hinzu)
    "ui.saved": "Einstellungen gespeichert",
    "ui.wrongpw": "Falsches Admin‑Passwort",
    "ui.needpw": "Bitte Admin‑Passwort eingeben"
  },
  en: {
    "settings.language": "Language",
    "settings.hue": "Hue",
    "settings.save": "Save settings",
    "ui.saved": "Settings saved",
    "ui.wrongpw": "Wrong admin password",
    "ui.needpw": "Please enter admin password"
  }
};

function t(key){ 
  const lang = (getSettings().lang || 'de');
  return (I18N[lang] && I18N[lang][key]) || I18N['de'][key] || key; 
}
function translateAll(){
  document.querySelectorAll('[data-i18n]').forEach(n=>{
    n.textContent = t(n.getAttribute('data-i18n'));
  });
  // Beispiel: Platzhalter in Inputs
  const s = getSettings().lang || 'de';
  const phSearch = s === 'en' ? 'Search… (text/meta)' : 'Suche… (Text/Meta)';
  const el = document.getElementById('logSearch'); if (el) el.placeholder = phSearch;
}
function getSettings(){
  try{ return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { lang:'de', hue: 180 }; }
  catch(e){ return { lang:'de', hue:180 }; }
}
function saveSettings(obj){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
  logActivity('settings','saved', {settings: obj});
}
function applySettings(){
  const s = getSettings();
  // Sprache – UI aktualisieren
  translateAll();
  // Hue → Theme Variablen (du kannst hier die Intensitäten tweaken)
  const h = Number(s.hue||180);
  const accent  = `hsl(${h} 100% 55%)`;
  const accent2 = `hsl(${h} 80% 65%)`;
  const glow    = `0 0 10px hsla(${h} 100% 60% / .35)`;
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-2', accent2);
  document.documentElement.style.setProperty('--glow', glow);
  // Controls spiegeln
  const sel = document.getElementById('selLang'); if (sel) sel.value = s.lang || 'de';
  const rng = document.getElementById('rngHue'); if (rng){ rng.value = h; const v=document.getElementById('hueVal'); if(v) v.textContent = h+'°'; }
}
function requireAdmin(onSuccess){
  // Passwortabfrage übersprungen
  onSuccess && onSuccess();
}
  
function logActivity(type, action, meta){
  const row = {
    ts: new Date().toISOString(),
    type, 
    action,
    meta: meta || {},
    // Platzhalter – sobald Benutzersystem da ist, hier User-ID/Name füllen:
    user: (window.__currentUser && window.__currentUser.name) || 'anonymous'
  };
  const list = readLog(); list.push(row);
  localStorage.setItem(LOG_KEY, JSON.stringify(list));
}
  
function readLog(){
  try{ return JSON.parse(localStorage.getItem(LOG_KEY)) || []; }
  catch(e){ return []; }
}
function filterLog({q='', type='', from='', to=''}){
  const data = readLog();
  const f = (d)=>{
    if (type && d.type !== type) return false;
    if (from && (new Date(d.ts) < new Date(from))) return false;
    if (to   && (new Date(d.ts) > new Date(to+'T23:59:59'))) return false;
    if (q){
      const blob = (d.action + ' ' + JSON.stringify(d.meta||{})).toLowerCase();
      if (!blob.includes(q.toLowerCase())) return false;
    }
    return true;
  };
  return data.filter(f).sort((a,b)=> new Date(b.ts) - new Date(a.ts));
}
function renderLogTable(rows){
  // 1) Rows in State ablegen
  window.__logState.rows = Array.isArray(rows) ? rows : [];
  const total = window.__logState.rows.length;

  // 2) Seite innerhalb Grenzen halten
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE));
  window.__logState.page = Math.min(Math.max(1, window.__logState.page || 1), pages);

  // 3) Slice berechnen
  const start = (window.__logState.page - 1) * LOG_PAGE_SIZE;
  const pageRows = window.__logState.rows.slice(start, start + LOG_PAGE_SIZE);

  // 4) Tabelle rendern
  const tbody = document.querySelector('#logTable tbody'); 
  if (!tbody) return;
  tbody.innerHTML = '';
  pageRows.forEach(r=>{
    const tr = document.createElement('tr');
    const details = JSON.stringify(r.meta||{}, null, 0);
    tr.innerHTML = `
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td>${r.user || '—'}</td>
      <td>${r.type}</td>
      <td>${r.action}</td>
      <td><code style="white-space:nowrap">${details.length>120 ? (details.slice(0,120)+'…') : details}</code></td>
    `;
    tbody.appendChild(tr);
  });

  // 5) Pager-UI aktualisieren
  const info = document.getElementById('logPageInfo');
  const prev = document.getElementById('logPrev');
  const next = document.getElementById('logNext');
  if (info) info.textContent = `Seite ${window.__logState.page} / ${pages} · ${total} Einträge`;
  if (prev && !prev.__bound){
    prev.__bound = true;
    prev.addEventListener('click', ()=>{
      if (window.__logState.page > 1){
        window.__logState.page--;
        renderLogTable(window.__logState.rows);
      }
    });
  }
  if (next && !next.__bound){
    next.__bound = true;
    next.addEventListener('click', ()=>{
      const pgs = Math.max(1, Math.ceil((window.__logState.rows.length||0)/LOG_PAGE_SIZE));
      if (window.__logState.page < pgs){
        window.__logState.page++;
        renderLogTable(window.__logState.rows);
      }
    });
  }
}
async function fetchNetworkInfo(){
  const setTxt = (id, v, tip) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = v ?? '—';
    if (tip) el.setAttribute('title', tip);
  };

  // OS / Browser
  try{
    const os = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '—';
    const ua = navigator.userAgent || '';
    const browser =
      /Edg\//.test(ua) ? 'Edge' :
      /Chrome\//.test(ua) ? 'Chrome' :
      (/Safari\//.test(ua) && !/Chrome\//.test(ua)) ? 'Safari' :
      /Firefox\//.test(ua) ? 'Firefox' : 'Browser';
    setTxt('netOs', `${os} / ${browser}`);
  }catch{ setTxt('netOs','—'); }

  // Öffentliche IP (WAN)
  try{
    const r = await fetch('https://api.ipify.org?format=json',{cache:'no-store'});
    const j = await r.json();
    setTxt('netIp', j.ip);
  }catch{ setTxt('netIp','—'); }

  // Lokale private IPv4 – nur echte LAN-Ranges anzeigen; sonst klar markieren
  function getPrivateIPv4(timeoutMs=2500){
    return new Promise(resolve=>{
      const ips = new Set();
      const isV4 = ip => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
      const isPrivate = ip =>
        /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);

      let done = false;
      const finish = () => { if (done) return; done = true; resolve([...ips].find(isPrivate) || null); };

      const pcs = [
        new RTCPeerConnection({ iceServers: [], iceCandidatePoolSize: 1 }),
        new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], iceCandidatePoolSize: 1 })
      ];

      pcs.forEach(pc=>{
        try{ pc.createDataChannel('x'); }catch{}
        pc.onicecandidate = e=>{
          const c = e.candidate && e.candidate.candidate; // e.g. "candidate:... <ip> <port> typ host ..."
          if (!c) return;
          const parts = c.split(' ');
          const ip = parts[4];
          if (ip && isV4(ip)) ips.add(ip);
        };
        pc.createOffer().then(o=>pc.setLocalDescription(o)).catch(()=>{});
      });

      setTimeout(()=>{
        pcs.forEach(pc=>{ try{pc.close();}catch{} });
        finish();
      }, timeoutMs);
    });
  }

  try{
    const priv = await getPrivateIPv4(2600);
    if (priv) {
      setTxt('netIpv4', priv, 'Lokale IPv4 (LAN)');
    } else {
      setTxt('netIpv4', '— (vom Browser verborgen)', 'Viele Browser maskieren LAN-IPs via mDNS/Privacy.');
    }
  }catch{
    setTxt('netIpv4','—','Fehler beim Erfassen der LAN-IP');
  }

  // Standort (nur Anzeige)
  try{
    const r = await fetch('https://ipapi.co/json/',{cache:'no-store'});
    const j = await r.json();
    const loc = [j.city, j.region, j.country_name].filter(Boolean).join(', ');
    setTxt('netLoc', loc || '—');
  }catch{ setTxt('netLoc','—'); }
}

// ===== Channel Settings (Tabs + Persistenz) =====
(function channelSettings(){
  const KEY = 'resTool.channelSettings';

  function readChannel(){ try{ return JSON.parse(localStorage.getItem(KEY)) || {}; } catch{ return {}; } }
  function saveChannel(obj){ localStorage.setItem(KEY, JSON.stringify(obj||{})); logActivity('channel','save', obj); }
  function setTxt(id, v){ const n=document.getElementById(id); if(n) n.textContent = v ?? '—'; }
  function setVal(id, v){ const n=document.getElementById(id); if(n) n.value = v ?? ''; }

  // Tabs switch
  function switchChannelTab(name){
    document.querySelectorAll('.channel-tab').forEach(b=>{
      b.classList.toggle('active', b.dataset.channelTab === name);
    });
    document.querySelectorAll('#channelContent .channel-page').forEach(p=>{
      p.classList.toggle('hidden', p.id !== ('chPage_'+name));
    });
  }

  // Status-Chips im Monitoring spiegeln (HNS rot bis echte Anbindung)
  function updateMonitorChips(){
    const chipH = document.getElementById('chChipHns');
    const chipSb= document.getElementById('chChipSb');
    chipH?.classList.remove('lvl-0','lvl-1','lvl-2'); chipH?.classList.add('lvl-2'); // HNS noch nicht verdrahtet
    // SB spiegle aktuellen Statuschip vom Header (falls vorhanden)
    const sbHeader = document.getElementById('chipSb');
    if (sbHeader){
      const ok = sbHeader.classList.contains('lvl-0');
      chipSb?.classList.remove('lvl-0','lvl-1','lvl-2');
      chipSb?.classList.add(ok ? 'lvl-0' : 'lvl-1');
    }
  }

  // Hotel-Active Liste rendern
  function renderHotelActive(list){
    const box = document.getElementById('chHotelActiveList'); if (!box) return;
    box.innerHTML = '';
    (window.HOTELS||[]).forEach(h=>{
      const id = 'chActive_'+h.code;
      const wrap = document.createElement('label');
      wrap.className = 'input';
      wrap.style.cssText = 'display:flex; gap:8px; align-items:center; padding:8px; border-radius:8px;';
      wrap.innerHTML = `<input type="checkbox" id="${id}"> <span>${h.group} – ${h.name.replace(/^.*? /,'')}</span>`;
      box.appendChild(wrap);
      const chk = wrap.querySelector('input');
      chk.checked = !list || list.includes(h.code); // Default: aktiv
    });
  }

  // Mapping-Summary Dummy (zeigt, ob JSON valide ist)
  function refreshMappingSummary(){
    const el = document.getElementById('chMappingSummary'); if (!el) return;
    let okA=true, okB=true, okC=true;
    try{ JSON.parse(document.getElementById('chHotelMap').value || '{}'); }catch{ okA=false; }
    try{ JSON.parse(document.getElementById('chCatMap').value   || '{}'); }catch{ okB=false; }
    try{ JSON.parse(document.getElementById('chRateMap').value  || '{}'); }catch{ okC=false; }
    el.innerHTML = `
      <div>Hotel-Mapping: <b style="color:${okA?'#35e08a':'#ff4d6d'}">${okA?'OK':'Fehler'}</b></div>
      <div>Kategorien-Mapping: <b style="color:${okB?'#35e08a':'#ff4d6d'}">${okB?'OK':'Fehler'}</b></div>
      <div>Raten-Mapping: <b style="color:${okC?'#35e08a':'#ff4d6d'}">${okC?'OK':'Fehler'}</b></div>
    `;
    
  try{ renderMappingAmpel(); }catch(e){}
}


  // Export/Import
  function doExport(){
    const data = readChannel();
    download('channel-settings.json','application/json;charset=utf-8', JSON.stringify(data,null,2));
  }
  function doImport(file){
    const r = new FileReader();
    r.onload = () => {
      try{
        const obj = JSON.parse(r.result);
        saveChannel(obj); applyToUi(obj);
        document.getElementById('channelInfo').textContent = 'Import erfolgreich.';
      }catch(e){
        document.getElementById('channelInfo').textContent = 'Import fehlgeschlagen: '+e.message;
      }
    };
    r.readAsText(file);
  }

  // Settings in UI füllen
  function applyToUi(s){
    setVal('chApiKey',   s.api_key);
    setVal('chApiSecret',s.api_secret);
    setVal('chHnsProd',  s.hns_prod);
    setVal('chHnsTest',  s.hns_test);
    setVal('chTimeout',  s.timeout_ms ?? 15000);
    setVal('chRetry',    s.retry_count ?? 2);
    setVal('chHotelMap', JSON.stringify(s.hotel_map || {}, null, 2));
    setVal('chCatMap',   JSON.stringify(s.cat_map   || {}, null, 2));
    setVal('chRateMap',  JSON.stringify(s.rate_map  || {}, null, 2));
    setVal('chMode',     s.mode || 'sandbox');
    setVal('chCancelPolicy', s.cancel_policy || '');
    setTxt('chLastSync', s.last_sync ? new Date(s.last_sync).toLocaleString('de-DE') : '—');
    renderHotelActive(s.hotels_active);
    updateMonitorChips();
    refreshMappingSummary();
  }
  // ===== Mapping-Ampel (Monitoring) =====
function cls(ok){ return ok ? 'lvl-0' : 'lvl-2'; }
function warn(ok){ return ok ? 'lvl-0' : 'lvl-1'; }

function renderMappingAmpel(){
  const box = document.getElementById('chMapAmpel'); 
  if (!box) return;

  const s = (()=>{
    try{ return JSON.parse(localStorage.getItem('resTool.channelSettings')) || {}; }
    catch{ return {}; }
  })();

  const hotelsActive = Array.isArray(s.hotels_active) ? s.hotels_active : [];
  const hotelMap = s.hotel_map || {};
  const catMap   = s.cat_map   || {};
  const rateMap  = s.rate_map  || {};

  const apiOk  = !!( (s.api_key && s.api_secret) && (s.hns_prod || s.hns_test) );
  const hMapOk = hotelsActive.length > 0 && hotelsActive.every(code => !!hotelMap[code]);
  const cMapOk = Object.keys(catMap).length > 0;
  const rMapOk = Object.keys(rateMap).length > 0;

  // Kopf-Ampeln
  const head = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:8px;">
      <div class="pill ${cls(apiOk)}">API konfiguriert</div>
      <div class="pill ${warn(hMapOk)}">Hotel-Mapping</div>
      <div class="pill ${warn(cMapOk)}">Kategorie-Mapping</div>
      <div class="pill ${warn(rMapOk)}">Raten-Mapping</div>
    </div>
  `;

  // pro Hotel
  const rows = (window.HOTELS || []).map(h=>{
    const active = !hotelsActive.length || hotelsActive.includes(h.code); // wenn leer → Default aktiv
    const mapped = !!hotelMap[h.code];
    const ok = active ? mapped : true; // nicht aktiv → neutral grün
    const label = `${h.group} – ${h.name.replace(/^.*? /,'')}`;
    return `
      <div class="row" style="display:flex; align-items:center; gap:8px; justify-content:space-between;">
        <div class="tiny">${label} <span class="muted">(${h.code})</span></div>
        <div class="pill ${ok?'lvl-0':(mapped?'lvl-1':'lvl-2')}">
          ${active ? (mapped ? 'aktiv · gemappt' : 'aktiv · fehlt Mapping') : 'inaktiv'}
        </div>
      </div>
    `;
  }).join('');

  box.innerHTML = head + `<div class="divider" style="height:1px;background:var(--line,#1e2b31);margin:8px 0;"></div>` + rows;
}


  // Aus UI lesen
  function readFromUi(){
    const hotelsActive = Array.from(document.querySelectorAll('#chHotelActiveList input[type="checkbox"]'))
      .filter(chk=>chk.checked).map(chk=>chk.id.replace('chActive_',''));

    const parse = (id) => { try{ return JSON.parse(document.getElementById(id).value || '{}'); } catch{ return {}; } };

    return {
      api_key:      document.getElementById('chApiKey').value || null,
      api_secret:   document.getElementById('chApiSecret').value || null,
      hns_prod:     document.getElementById('chHnsProd').value || null,
      hns_test:     document.getElementById('chHnsTest').value || null,
      timeout_ms:   Number(document.getElementById('chTimeout').value || 0) || 15000,
      retry_count:  Number(document.getElementById('chRetry').value || 0) || 2,
      hotel_map:    parse('chHotelMap'),
      cat_map:      parse('chCatMap'),
      rate_map:     parse('chRateMap'),
      hotels_active,
      mode:         document.getElementById('chMode').value || 'sandbox',
      cancel_policy:document.getElementById('chCancelPolicy').value || '',
      last_sync:    readChannel().last_sync || null // bleibt unverändert
    };
  }

  // Buttons/Events binden wenn Modal geöffnet wird
  function bindOnce(){
    const tabs = document.getElementById('channelTabs');
    if (!tabs || tabs.__bound) return;
    tabs.__bound = true;

    tabs.addEventListener('click', (e)=>{
      const btn = e.target.closest('.channel-tab'); if (!btn) return;
      switchChannelTab(btn.dataset.channelTab);
    });

    document.getElementById('btnSaveChannel')?.addEventListener('click', ()=>{
      const data = readFromUi();
      saveChannel(data);
      document.getElementById('channelInfo').textContent = 'Einstellungen gespeichert.';
    });

    document.getElementById('chExport')?.addEventListener('click', doExport);
    document.getElementById('chImportFile')?.addEventListener('change', (e)=> e.target.files?.[0] && doImport(e.target.files[0]));

    document.getElementById('chAddHotel')?.addEventListener('click', ()=>{
      const code  = (document.getElementById('chNewHotelCode').value||'').trim();
      const name  = (document.getElementById('chNewHotelName').value||'').trim();
      const group = (document.getElementById('chNewHotelGroup').value||'').trim();
      if (!code || !name || !group){ alert('Bitte Code, Name und Gruppe ausfüllen.'); return; }
      try{
        // HOTELS ist konstantes Array – wir hängen nur für die Session an (persistente Pflege später separat).
        window.HOTELS.push({ group, name, code });
        renderHotelActive(readChannel().hotels_active);
        document.getElementById('channelInfo').textContent = `Hotel ${code} hinzugefügt (Session).`;
      }catch(e){}
    });

    document.getElementById('btnSyncNow')?.addEventListener('click', async ()=>{
      // Simulierter Sync – hier später echte HNS-Calls
      const info = document.getElementById('channelInfo');
      info.textContent = 'Synchronisiere …';
      await new Promise(r=>setTimeout(r,800));
      const data = readChannel();
      data.last_sync = new Date().toISOString();
      saveChannel(data);
      setTxt('chLastSync', new Date(data.last_sync).toLocaleString('de-DE'));
      info.textContent = 'Sync OK.';
      // Minimaler Error-Eintrag-Beispiel für Monitoring
      const UL = document.getElementById('chErrorList');
      if (UL && UL.children.length < 1){
        const li = document.createElement('li');
        li.textContent = 'Keine Fehler gemeldet.';
        UL.appendChild(li);
      }
    });

    // Live-Summary für Mapping
    ['chHotelMap','chCatMap','chRateMap'].forEach(id=>{
      document.getElementById(id)?.addEventListener('input', refreshMappingSummary);
    });
  }

  // Wenn Settings-Modal geöffnet wird, UI füllen
  const btnChannel = document.getElementById('btnChannel');
  if (btnChannel){
    btnChannel.addEventListener('click', ()=>{
      setTimeout(()=>{
        try{
          bindOnce();
          switchChannelTab('api');
          applyToUi(readChannel());
          try{ renderMappingAmpel(); }catch(e){}
        }catch(e){}
      }, 0);
    });
  }
})();

document.addEventListener('DOMContentLoaded', ()=>{
  // Controls referenzieren
  const selLang = document.getElementById('selLang');
  const rngHue  = document.getElementById('rngHue');
  const hueVal  = document.getElementById('hueVal');
  const btnSave = document.getElementById('btnSaveSettings');
  const btnChannel = document.getElementById('btnChannel');
  const btnLog  = document.getElementById('btnLog');
  const btnUserPrefs = document.getElementById('btnUserPrefs');

  // Settings anwenden (lädt & setzt UI)
  applySettings();

  // Sprache ändern (live)
  if (selLang){
    selLang.addEventListener('change', ()=>{
      const s = getSettings(); s.lang = selLang.value; saveSettings(s); applySettings();
    });
  }
  // Hue Slider (live)
  if (rngHue){
    rngHue.addEventListener('input', ()=>{
      const h = Number(rngHue.value||0);
      if (hueVal) hueVal.textContent = h + '°';
      const s = getSettings(); s.hue = h; saveSettings(s); applySettings();
    });
  }
  // Speichern Button (extra „OK“-Feedback)
  if (btnSave){
    btnSave.addEventListener('click', ()=>{
      const s = getSettings(); saveSettings(s); applySettings();
      alert(t('ui.saved'));
    });
  }
  // Channel – Einstellungen (admin)
  if (btnChannel){
    btnChannel.addEventListener('click', ()=>{
      requireAdmin(()=> openModal('modalChannel'));
      logActivity('channel','open_settings');
    });
  }
  // Log Activity (admin)
  if (btnLog){
    btnLog.addEventListener('click', ()=>{
      requireAdmin(()=>{
        // Filter reset + render
        document.getElementById('logSearch').value = '';
        document.getElementById('logType').value = '';
        document.getElementById('logFrom').value = '';
        document.getElementById('logTo').value = '';

        // << NEU: immer auf Seite 1 starten >>
        window.__logState.page = 1;
        
        renderLogTable(filterLog({}));
        openModal('modalLog');
      });
      logActivity('system','open_log');
    });
  }

    // UserPrefs modal
  if (btnUserPrefs){
  btnUserPrefs.addEventListener('click', async ()=>{
    openModal('modalUserPrefs');
    try { await loadUsers(); } catch(e){}
  });
}
  // === Benutzereinstellungen Modal – direkte UI-Bindings ===
(function bindUserPrefsUi(){
  const box   = document.getElementById('usrCreate');
  const tgl   = document.getElementById('btnUserFormToggle');
  const create= document.getElementById('btnUserCreate');
  const refresh = document.getElementById('btnUsersRefresh');
  const search  = document.getElementById('usrSearch');
  const roleF   = document.getElementById('usrRoleFilter');
  const tbody   = document.getElementById('usrBody');

  // Toggle "Neuer Benutzer"
  tgl?.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    if (!box) return;
    const hidden = box.classList.toggle('hidden');
    if (!hidden) document.getElementById('usrName')?.focus();
  });

  // Neuer Benutzer anlegen
  create?.addEventListener('click', async (e)=>{
    e.preventDefault(); e.stopPropagation();
    const name   = (document.getElementById('usrName')?.value||'').trim();
    const email  = (document.getElementById('usrEmail')?.value||'').trim();
    const role   = document.getElementById('usrRole')?.value || 'agent';
    const active = (document.getElementById('usrActive')?.value||'true') !== 'false';
    const info   = document.getElementById('usrInfo');

    if (!name){ if (info) info.textContent = 'Bitte Name angeben.'; return; }
    if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)){
      if (info) info.textContent = 'E-Mail ist optional – wenn angegeben, dann gültig.'; return;
    }

    try{
      create.disabled = true;
     await createUser({ name, email, role, active });

// Passwort übernehmen (oder E-Mail als Fallback)
const pwField  = document.getElementById('usrPw');
const inputPw  = (pwField?.value || '').trim();
const chosenPw = inputPw || (email || '').trim();

if (!chosenPw || chosenPw.length < 4){
  if (info) info.textContent = 'Bitte Passwort (≥4) eingeben – oder E-Mail ausfüllen (wird als Passwort verwendet).';
  t.disabled = false;
  return;
}

// 1) unter LOGIN-NAME speichern
await setUserPassword(name, chosenPw);

// 2) optionaler Alias: auch unter E-Mail (lowercase) speichern,
//    damit Login mit E-Mail funktioniert (wenn vorhanden)
if (email) {
  await setUserPassword(email.toLowerCase(), chosenPw);
}

// Felder leeren
if (pwField) pwField.value = '';
document.getElementById('usrName').value='';
document.getElementById('usrEmail').value='';
document.getElementById('usrRole').value='agent';
document.getElementById('usrActive').value='true';

if (info) info.textContent = 'Benutzer erstellt.';
await loadUsers();

    } catch(err){
      console.error(err);
      if (info) info.textContent = 'Fehler beim Erstellen.';
    } finally {
      create.disabled = false;
    }
  });

  // Liste aktualisieren
  refresh?.addEventListener('click', async (e)=>{
    e.preventDefault(); e.stopPropagation();
    await loadUsers();
  });

  // Suche/Filter live
  search?.addEventListener('input',  ()=> debounce(()=>renderUsers(),200)());
  roleF?.addEventListener('change', ()=> renderUsers());

  // Tabellen-Aktionen (nur im Body), mit stopPropagation
  tbody?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    e.preventDefault(); e.stopPropagation();

    if (btn.dataset.usrToggle){
      await toggleUserActive(btn.dataset.usrToggle);
      return;
    }
    if (btn.dataset.usrDel){
      if (confirm('Benutzer wirklich löschen?')) await deleteUser(btn.dataset.usrDel);
      return;
    }
    if (btn.dataset.usrCode){
      try{
        const map = (function(){ try { return JSON.parse(localStorage.getItem('resTool.userAccessCodes')||'{}'); } catch { return {}; } })();
        map[btn.dataset.usrCode] = String(Math.floor(100000 + Math.random()*900000));
        localStorage.setItem('resTool.userAccessCodes', JSON.stringify(map));
        alert('Zugangscode gesetzt.');
      }catch(_){}
      return;
    }
    if (btn.dataset.usrCodeDel){
      try{
        const map = (function(){ try { return JSON.parse(localStorage.getItem('resTool.userAccessCodes')||'{}'); } catch { return {}; } })();
        delete map[btn.dataset.usrCodeDel];
        localStorage.setItem('resTool.userAccessCodes', JSON.stringify(map));
        alert('Zugangscode gelöscht.');
      }catch(_){}
      return;
    }
 if (btn.dataset.usrPass){
  const id = btn.dataset.usrPass;
  const u  = (__users||[]).find(x=>x.id===id);
  if (!u){ alert('User nicht gefunden'); return; }

  const pw = prompt(`Neues Passwort für "${u.name}" (min. 4 Zeichen):`);
  if (!pw || pw.length<4) return;

  try{
    // Hash unter Login-Name …
    await setUserPassword(u.name, pw);
    // … und unter E-Mail (lowercase) speichern
    if (u.email) await setUserPassword(String(u.email).toLowerCase(), pw);
    // Admin-Spezialfall: beide Alias-Keys schreiben
    if (u.name && u.name.toLowerCase()==='admin'){
      await setUserPassword('Admin', pw);
      await setUserPassword('admin', pw);
    }
    alert('Passwort gesetzt.');
  }catch(e){
    alert('Konnte Passwort nicht setzen.');
  }
  return;
}


    if (btn.dataset.usrPassDel){
      if (!confirm('Passwort wirklich löschen?')) return;
      try{ await setUserPassword(btn.dataset.usrPassDel, null); alert('Passwort gelöscht.'); }catch(e){ alert('Konnte Passwort nicht löschen.'); }
      return;
    }
  });
})();


  // Log Filter Events
  const btnApply = document.getElementById('logApply');
  const btnClear = document.getElementById('logClear');
  if (btnApply){
    btnApply.addEventListener('click', ()=>{
      const q   = document.getElementById('logSearch').value.trim();
      const type= document.getElementById('logType').value;
      const from= document.getElementById('logFrom').value;
      const to  = document.getElementById('logTo').value;
      renderLogTable(filterLog({q,type,from,to}));
    });
  }
  if (btnClear){
    btnClear.addEventListener('click', ()=>{
      document.getElementById('logSearch').value = '';
      document.getElementById('logType').value   = '';
      document.getElementById('logFrom').value   = '';
      document.getElementById('logTo').value     = '';
      renderLogTable(filterLog({}));
    });
  }
});
  // --- Mini-Analytics robust starten ---
(function initMiniAnalyticsSafe(){
  // 1) beim Laden
  window.addEventListener('load', () => {
    try { buildMiniAnalytics(); } catch(e){ console.warn('mini chart load', e); }
  });

  // 2) nach relevanten Aktionen neu aufbauen
  window.addEventListener('priceplan:saved', () => {
    try { buildMiniAnalytics(); } catch(e){}
  });
  window.addEventListener('reservation:changed', () => {
    try { buildMiniAnalytics(); } catch(e){}
  });

  // 3) Fallback alle 60s (nur wenn Dock existiert)
  setInterval(() => {
    if (document.getElementById('miniAnalyticsDock')) {
      try { buildMiniAnalytics(); } catch(e){}
    }
  }, 60000);
})();



// ===== Hilfsfunktion aus Liste (wegen Scope) =====
function safeDisplayFromRow(row){
  const h = HOTELS.find(x=>x.code===row.hotel_code);
  if (h) return displayHotel(h);
  const raw = String(row.hotel_name||'').replace(/^[\s·•\-–—]+/,'').trim();
  if (!raw) return row.hotel_code || '—';
  for (const p of BRAND_PREFIXES){
    if (raw.startsWith(p+' ')) return `${p} - ${raw.slice(p.length+1)}`;
  }
  return raw;
}
  /* =========================
   RATES MODULE v2 (single source of truth)
   ========================= */
window.__rsType = window.__rsType || 'Direct'; // no redeclare errors

// --- Storage helpers ---
function readRates(){ try{return JSON.parse(localStorage.getItem(RATES_KEY))||[]}catch{return[]} }
function writeRates(list){ localStorage.setItem(RATES_KEY, JSON.stringify(list||[])); }
function upsertRate(rate){
  const list = readRates();
  const i = list.findIndex(r=>r.id===rate.id);
  if (i>=0) list[i]=rate; else list.push(rate);
  writeRates(list);
}
function deleteRate(id){ writeRates(readRates().filter(r=>r.id!==id)); }
function catsForHotel(code){
  // bevorzugt die V2-Kategorieverwaltung
  if (typeof getCategoriesForHotel === 'function') {
    const list = getCategoriesForHotel(code) || [];
    if (list.length) return list.map(c => c.name); // Werte = Namen (kompatibel zum bestehenden Rates-Filter)
  }
  // Fallback: Dummy-Listen
  return (HOTEL_CATEGORIES?.[code] || HOTEL_CATEGORIES?.default || []);
}

  function catOptionsFor(hotelCode){
  const list = (typeof getCategoriesForHotel === 'function')
    ? (getCategoriesForHotel(hotelCode) || [])
    : (catsForHotel(hotelCode) || []).map(n => ({ name:n, code:'', maxPax:'' }));
  // Label reichhaltig, Wert = Name (Kompatibilität)
  return list.map(c => ({
    label: c.code ? `${c.name} (${c.code}${c.maxPax?` · max ${c.maxPax}`:''})` : c.name,
    value: c.name
  }));
}
function buildCatSelect(hotelCode, value=''){
  const sel = document.createElement('select');
  sel.className = 'input';
  const opts = catOptionsFor(hotelCode);
  sel.innerHTML = `<option value="">— auswählen —</option>` +
    opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  if (value) sel.value = value;
  return sel;
}
function addCatRow(container, hotelCode, value=''){
  const row = document.createElement('div');
  row.className = 'cat-row';
  const sel = buildCatSelect(hotelCode, value);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn sm ghost icon';
  remove.title = 'Entfernen';
  remove.textContent = '–';
  remove.addEventListener('click', ()=> {
    row.remove();
  });
  row.append(sel, remove);
  container.appendChild(row);
  return row;
}
function renderCatStack(containerId, hotelCode, selectedList){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';
  const vals = (selectedList||[]).filter(v=>v && v!=='*');
  if (vals.length === 0) addCatRow(wrap, hotelCode, '');
  else vals.forEach(v => addCatRow(wrap, hotelCode, v));
}
function gatherCatStack(containerId){
  const wrap = document.getElementById(containerId);
  if (!wrap) return [];
  const values = Array.from(wrap.querySelectorAll('select')).map(s => (s.value||'').trim()).filter(Boolean);
  // Doppelte entfernen, Reihenfolge behalten
  return [...new Set(values)];
}


function getMappedRatesFor(hotelCode, category=null, type=null){
  return readRates().filter(r =>
    (!!r.mapped) &&
    (!hotelCode || r.hotel_code === hotelCode) &&
    (!type || r.ratetype === type) &&
    (!category || (Array.isArray(r.categories) && (r.categories.includes(category) || r.categories.includes('*'))))
  );
}
  
document.getElementById('rsBody')?.addEventListener('click', (e) => {
  const tr = e.target.closest('tr.row');
  if (!tr) return;
  const id = tr.dataset.rateId;
  if (id) openRateEditor(id);
});

// --- Tiny DOM utils relying on your q/qa/el ---
function fillHotelSelectOptions(sel){
  if (!sel) return;
  sel.innerHTML='';
  HOTELS.forEach(h => sel.append(el('option',{value:h.code}, `${h.group} - ${h.name.replace(/^.*? /,'')}`)));
}
function loadCatsIntoSelect(sel, hotelCode){
  if (!sel) return;
  const cats = ['*', ...catsForHotel(hotelCode)];
  sel.innerHTML = cats.map(c => `<option value="${c}">${c==='*'?'Alle':c}</option>`).join('');
  makeMultiSelectFriendly(sel); // re-init ticks
}
  // --- Daily-Price Loader: nimmt Preisplan, sonst Fallback auf rate_price ---
function enumerateNights(arrISO, depISO){
  const out = [];
  if (!arrISO || !depISO) return out;
  let d = new Date(arrISO + 'T00:00:00');
  const end = new Date(depISO + 'T00:00:00'); // exkl.
  while (d < end){ out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); }
  return out;
}

/**
 * Liefert Map<reservation_id|date, price> für ein Fenster.
 * Quelle 1: Supabase-Tabellen mit Daily-Prices (wir versuchen mehrere übliche Namen)
 * Quelle 2: Feld am Reservation-Objekt (price_plan / daily_prices)
 * Fallback: rate_price pro Nacht
 */
async function loadDailyPricesWindow(startISO, endISO, hotelCodeOrAll='all'){
  const start = new Date(startISO + 'T00:00:00');
  const end   = new Date(endISO   + 'T00:00:00'); // inkl. Grenze
  const endEx = new Date(end); endEx.setDate(endEx.getDate()+1);
  const DAY   = 86400000;

  // 1) Kandidaten-Reservierungen, die das Fenster berühren
  let q = SB.from('reservations')
    .select('id,hotel_code,arrival,departure,status,rate_price,priceplan')
    .neq('status','canceled')
    .lte('arrival', endISO)
    .gte('departure', startISO);
  if (hotelCodeOrAll !== 'all') q = q.eq('hotel_code', hotelCodeOrAll);

  // zusätzlich offene Departures zulassen
  let qOpen = SB.from('reservations')
    .select('id,hotel_code,arrival,departure,status,rate_price,priceplan')
    .neq('status','canceled')
    .lte('arrival', endISO)
    .is('departure', null);
  if (hotelCodeOrAll !== 'all') qOpen = qOpen.eq('hotel_code', hotelCodeOrAll);

  const [r1, r2] = await Promise.all([q, qOpen]);
  const byId = new Map();
  (r1.data||[]).forEach(x=>byId.set(x.id,x));
  (r2.data||[]).forEach(x=>byId.set(x.id,x));
  const rows = Array.from(byId.values());

  // 2) Daily-Overrides aus Supabase (wenn vorhanden)
  async function tryLoadDaily(table){
    const ids = rows.map(r=>r.id);
    if (!ids.length) return [];
    return SB.from(table)
      .select('reservation_id,date,price')
      .in('reservation_id', ids)
      .gte('date', startISO)
      .lte('date', endISO);
  }

  let overrides = [];
  for (const t of ['reservation_prices','reservation_daily_prices','price_plan']){
    try{
      const r = await tryLoadDaily(t);
      if (!r.error && r.data?.length){ overrides = r.data; break; }
    }catch(e){/* ignore */}
  }
  const ovKey = d=>`${d.reservation_id}|${d.date}`;
  const ovMap = new Map(overrides.map(d=>[ovKey(d), Number(d.price)||0]));

  // 3) Zusammenbauen: Priorität Overrides > price_plan/daily_prices am Objekt > Fallback rate_price
  const result = new Map(); // key = 'YYYY-MM-DD', value = Summe €
  let bookingsCount = 0;

  rows.forEach(r=>{
    const arr = new Date(r.arrival + 'T00:00:00');
    const dep = r.departure ? new Date(r.departure + 'T00:00:00') : endEx;
    const ovStart = new Date(Math.max(arr.getTime(), start.getTime()));
    const ovEndEx = new Date(Math.min(dep.getTime(), endEx.getTime()));
    const nights = Math.max(0, Math.round((ovEndEx - ovStart)/DAY));
    if (nights <= 0) return;

    bookingsCount++;

    // neu (unterstützt r.priceplan UND die alten Keys als Fallback)
const objPlan = Array.isArray(r.priceplan)     ? r.priceplan
             : Array.isArray(r.price_plan)     ? r.price_plan
             : Array.isArray(r.daily_prices)   ? r.daily_prices
             : null;

    const dates = [];
    for (let d=new Date(ovStart); d<ovEndEx; d.setDate(d.getDate()+1)){
      dates.push(isoDateLocal(d));
    }

    dates.forEach(date=>{
      let price = null;

      // Overrides aus Tabelle?
      const k = `${r.id}|${date}`;
      if (ovMap.has(k)) price = ovMap.get(k);

      // Falls kein Override: Objekt-Plan
      if (price==null && objPlan){
        const f = objPlan.find(p =>
  (p.incl !== false) && (
    (p.from && p.from === date) ||           // dein Nacht-Objekt
    (p.date && p.date === date)              // evtl. altes Format
  )
);
        if (f) price = Number(f.price)||0;
      }

      // Fallback: pauschale Rate je Nacht
      if (price==null) price = Number(r.rate_price)||0;

      result.set(date, (result.get(date)||0) + price);
    });
  });

  // Rückgabe: Tagesumsatz-Map + #Buchungen mit >=1 Nacht im Fenster
  return { byDay: result, bookings: bookingsCount };
}

/** Summiert Tage aus einer Map<date->€> für N Tage ab startISO (inkl.) */
function sumWindow(map, startISO, days){
  let total = 0;
  const d = new Date(startISO + 'T00:00:00');
  for (let i=0;i<days;i++){
    const key = d.toISOString().slice(0,10);
    total += map.get(key)||0;
    d.setDate(d.getDate()+1);
  }
  return total;
}


// --- Multi-select: click to toggle + ✓ prefix ---
function makeMultiSelectFriendly(sel){
  if (!sel || sel.__friendly) return;
  sel.__friendly = true;
  const renderTicks = ()=>{
    Array.from(sel.options).forEach(o=>{
      const plain = o.textContent.replace(/^✓\s+/,'');
      o.textContent = (o.selected ? '✓ ' : '') + plain;
    });
  };
  sel.addEventListener('mousedown', (e)=>{
    const opt = e.target.closest('option'); if (!opt) return;
    e.preventDefault();
    opt.selected = !opt.selected;
    if (opt.value === '*') Array.from(sel.options).forEach(o=>{ if(o!==opt) o.selected=false; });
    else Array.from(sel.options).forEach(o=>{ if(o.value==='*') o.selected=false; });
    renderTicks();
    sel.dispatchEvent(new Event('change',{bubbles:true}));
  });
  sel.addEventListener('change', renderTicks);
  renderTicks();
}

// --- Step 3 policy hook ---
function setSelectedRatePolicy(txt){
  const el = document.getElementById('ratePolicyPreview');
  if (el) el.textContent = (txt && String(txt).trim()) || '—';
}
function refreshNewResRates(){
  const selRate = q('#newRate'); if (!selRate) return;
  const hotel   = q('#newHotel')?.value || '';
  const cat     = q('#newCat')?.value || '';

  // Alle lokalen Raten lesen
  const all = readRates();

  // Nur gemappte Raten, die zum Hotel passen und Kategorie "*"
  // ODER die gewählte Kategorie enthalten
  const filtered = all.filter(r=>{
    if (!r.mapped) return false;
    if (r.hotel_code !== hotel) return false;
    const cats = Array.isArray(r.categories) ? r.categories : ['*'];
    return cats.includes('*') || (cat && cats.includes(cat));
  });

  // Fallback: Dummy‑Raten, wenn noch nichts angelegt
  const list = filtered.length ? filtered : (HOTEL_RATES['default']||[]).map((x,i)=>({
    ratecode: `D${i+1}`,
    name: x.name,
    price: x.price,
    policy: 'Bis 18:00 Uhr am Anreisetag kostenfrei stornierbar.'
  }));

  selRate.innerHTML = list.map(r=>{
    const price = Number(r.price||0);
    const pol   = r.policy || '';
    return `<option value="${r.name}" data-price="${price}" data-policy="${pol}">${r.name} (${EUR.format(price)})</option>`;
  }).join('');

  // Preis + Policy spiegeln
  const first = selRate.selectedOptions[0];
  if (first && q('#newPrice')) q('#newPrice').value = first.dataset.price || 0;
  setSelectedRatePolicy(first?.dataset.policy || '—');
}

// --- Rate settings list (tabs/search/filter) ---
function rsFillHotelFilter(){
  const sel = q('#rsHotelFilter'); if (!sel) return;
  sel.innerHTML = '';
  sel.append(el('option',{value:'all'},'Alle Hotels'));
  HOTELS.forEach(h => sel.append(el('option',{value:h.code}, `${h.group} - ${h.name.replace(/^.*? /,'')}`)));
}
function rsSetType(type){
  window.__rsType = type;
  q('#rsTitle') && (q('#rsTitle').textContent = `Raten – ${type}`);
  rsRender();
}
  function rsRender(){
  const tbody = q('#rsBody'); if (!tbody) return;

  const qStr  = (q('#rsSearch')?.value || '').trim().toLowerCase();
  const hCode = q('#rsHotelFilter')?.value || 'all';

  const list = readRates()
    .filter(r => r.ratetype === window.__rsType)
    .filter(r => hCode === 'all' ? true : r.hotel_code === hCode)
    .filter(r => !qStr ? true : (`${r.ratecode} ${r.name}`.toLowerCase().includes(qStr)))
    .sort((a,b) => (a.hotel_code + a.name).localeCompare(b.hotel_code + b.name));

  tbody.innerHTML = '';
  if (!list.length){
    tbody.append(el('tr', {}, el('td', { colspan:'6' }, 'Keine Raten gefunden.')));
    return;
  }

  list.forEach(r=>{
    const hotel = HOTELS.find(h=>h.code===r.hotel_code);
    const nameHotel = hotel ? `${hotel.group} - ${hotelCity(hotel.name)}` : r.hotel_code || '—';
    const cats = (r.categories && r.categories.length ? r.categories : ['*']).join(', ');
    const mappedTxt = r.mapped ? 'Ja' : 'Nein';

    const tr = el('tr', { class:'row' },
      el('td', {}, r.ratecode || '—'),
      el('td', {}, r.name || '—'),
      el('td', {}, nameHotel),
      el('td', {}, cats),
      el('td', {}, EUR.format(Number(r.price||0))),
      el('td', {}, mappedTxt)
    );
      tr.dataset.rateId = r.id;                    // ID an die Zeile hängen
      tr.addEventListener('click', () => openRateEditor(r.id));  // Editor öffnen
    tbody.append(tr);
    
  });
}

// --- Edit flow (Ratename editierbar; Typ/Hotel/Ratecode fix) ---
window.__rateEditId = window.__rateEditId || null;

function openRateEditor(id){
  const r = readRates().find(x=>x.id===id);
  if (!r) return;
  window.__rateEditId = id;

  fillHotelSelectOptions(q('#erHotel'));
  q('#erHotel').value = r.hotel_code || '';
  q('#erHotel').disabled = true;

  renderCatStack('erCatsWrap', r.hotel_code, (r.categories||[]));
(() => { const b = document.getElementById('erAddCatRow'); if (!b) return; const clone = b.cloneNode(true); b.replaceWith(clone); clone.addEventListener('click', () => { addCatRow(document.getElementById('erCatsWrap'), r.hotel_code, ''); }); })();
q('#erCode').value = r.ratecode || '';    q('#erCode').disabled = true;
  q('#erType').value = r.ratetype || 'Direct'; q('#erType').disabled = true;
  q('#erName').value = r.name || '';        q('#erName').disabled = false;
  q('#erPolicy').value = r.policy || '';
  q('#erPrice').value = r.price ?? 0;
  if (q('#erMapped').tagName==='SELECT') q('#erMapped').value = r.mapped ? 'true':'false';
  else q('#erMapped').checked = !!r.mapped;

  q('#btnRateCreate') && (q('#btnRateCreate').style.display='none');
  q('#btnRateUpdate') && (q('#btnRateUpdate').style.display='');
  q('#btnRateDelete') && (q('#btnRateDelete').style.display='');

  const upd = q('#btnRateUpdate'); if (upd) upd.replaceWith(upd.cloneNode(true));
  const del = q('#btnRateDelete'); if (del) del.replaceWith(del.cloneNode(true));

  q('#btnRateUpdate')?.addEventListener('click', ()=>{
    const list = readRates();
    const i = list.findIndex(x=>x.id===window.__rateEditId);
    if (i<0) return;

    const cats = gatherCatStack('erCatsWrap');
    list[i] = {
      ...list[i],
      name:   (q('#erName').value||'').trim(),
      policy: (q('#erPolicy').value||'').trim(),
      price:  Number(q('#erPrice').value||0),
      mapped: (q('#erMapped').tagName==='SELECT') ? (q('#erMapped').value==='true') : !!q('#erMapped').checked,
      categories: cats.length?cats:['*'],
      updated_at: new Date().toISOString()
    };
    writeRates(list);
    rsRender(); refreshNewResRates();
    closeModal('modalRateEdit');
  });

  q('#btnRateDelete')?.addEventListener('click', ()=>{
    if (!confirm('Rate wirklich löschen?')) return;
    deleteRate(window.__rateEditId);
    window.__rateEditId = null;
    rsRender(); refreshNewResRates();
    closeModal('modalRateEdit');
  });

  document.getElementById('backdrop')?.addEventListener('click', () => closeModal());

  const title = document.getElementById('rateEditTitle');
  if (title) title.textContent = 'Rate bearbeiten';
  if (typeof fitRateModals === 'function') fitRateModals();
  openModal('modalRateEdit');
}
function openRateCreate(){
  // --- Sichtbarkeit für Create-Mode sicherstellen
(function(){
  const show = (id, on) => { const n = document.getElementById(id); if (n) n.style.display = on ? '' : 'none'; };
  show('btnRateCreate', true);  // Create-Button sichtbar
  show('btnRateUpdate', false); // Edit-spezifische Buttons verstecken
  show('btnRateDelete', false);
})();

  // Felder resetten
  const code = (id)=>document.getElementById(id);
  code('crCode').value = '';
  code('crType').value = '';
  code('crName').value = '';
  code('crPolicy').value = 'Bis zum Anreisetag 18:00 Uhr kostenfrei stornierbar.';
  code('crPrice').value = 0;
  code('crMapped').value = 'false';

  // Hotels füllen
  fillHotelSelectOptions(code('crHotel'));

 // Kategorien: Stack aufbauen, sobald ein Hotel gewählt ist
const crWrap = document.getElementById('crCatsWrap');
const crAddRaw = document.getElementById('crAddCatRow');
function resetCreateCats(){
const hotel_code = code('crHotel').value;
  renderCatStack('crCatsWrap', hotel_code, []);
}
code('crHotel').addEventListener('change', resetCreateCats);
(() => { if (!crAddRaw) return; const crAdd = crAddRaw.cloneNode(true); crAddRaw.replaceWith(crAdd); crAdd.addEventListener('click', () => { addCatRow(crWrap, code('crHotel').value, ''); }); })();
// Create-Button neu binden (Duplicate-Listener vermeiden)
  const btn = code('btnRateCreate');
  btn.replaceWith(btn.cloneNode(true));
  document.getElementById('btnRateCreate').addEventListener('click', ()=>{
    const ratecode = (code('crCode').value||'').trim();
    const ratetype = code('crType').value;
    const hotel_code = code('crHotel').value;
    const name = (code('crName').value||'').trim();
    const policy = (code('crPolicy').value||'').trim();
    const price  = Number(code('crPrice').value||0);
    const mapped = code('crMapped').value === 'true';
    const catsSel = gatherCatStack('crCatsWrap');

    if (!/^\d+$/.test(ratecode)) return alert('Ratecode muss nur Zahlen enthalten.');
    if (!ratetype) return alert('Bitte Ratentyp wählen.');
    if (!hotel_code) return alert('Bitte Hotel wählen.');
    if (!name) return alert('Bitte Ratennamen angeben.');

    const now = new Date().toISOString();
    upsertRate({
      id:'r_'+Date.now(),
      ratecode, ratetype, hotel_code,
      categories: catsSel.length ? catsSel : ['*'],
      name, policy, price, mapped,
      created_at: now, updated_at: now
    });

    // UI aktualisieren
    rsRender();
    try{ refreshNewResRates(); }catch(e){}
    closeModal('modalRateCreate');
  });

  openModal('modalRateCreate');
}

// --- Openers / bindings ---
q('#btnRates')     ?.addEventListener('click', ()=>{
  rsFillHotelFilter(); rsSetType('Direct'); openModal('modalRates');
  // Button „Neue Rate“ nach oben in die Toolbar ziehen (sichtbar ohne Scroll)
  const tb = document.querySelector('#modalRates .rs-toolbar');
  const nb = document.getElementById('rsNewRate');
  if (tb && nb && !tb.contains(nb)) tb.prepend(nb);
});
q('#rsTabDirect')  ?.addEventListener('click', ()=> rsSetType('Direct'));
q('#rsTabCorp')    ?.addEventListener('click', ()=> rsSetType('Corp'));
q('#rsTabIds')     ?.addEventListener('click', ()=> rsSetType('IDS'));
q('#rsSearch')     ?.addEventListener('input', rsRender);
q('#rsHotelFilter')?.addEventListener('change', rsRender);
q('#rsNewRate')    ?.addEventListener('click', ()=> openRateCreate());

// --- Wizard: wenn du eine zentrale Step-Umschaltfunktion hast, ruf dort bei Step 3 refreshNewResRates() auf.
// Fallback: einmal initial anstoßen
setTimeout(()=>{ try{ refreshNewResRates(); }catch(e){} }, 0);

 /* === Step 3: Rate/Preis/Policy-Handling, sauber gekapselt === */
(function ratesStep3(){
  // Mapped Rates für Step 3 neu aufbauen (inkl. data-policy)
  window.refreshNewResRates = function(){
    const code = document.querySelector('#newHotel')?.value || '';
    const cat  = document.querySelector('#newCat')?.value   || '';
    const sel  = document.querySelector('#newRate'); if (!sel) return;

    const list = (typeof getMappedRatesFor === 'function') ? (getMappedRatesFor(code, cat) || []) : [];

    sel.innerHTML = list.map(r =>
      `<option value="${r.name}" data-price="${r.price}" data-policy="${(r.policy||'').replace(/"/g,'&quot;')}">
         ${r.name} (${EUR.format(r.price)})
       </option>`
    ).join('');

    if (list.length){
      sel.value = list[0].name;
      const priceNode = document.querySelector('#newPrice');
      if (priceNode) priceNode.value = list[0].price;
      (typeof setSelectedRatePolicy === 'function') && setSelectedRatePolicy(list[0].policy||'');
    } else {
      sel.innerHTML = `<option value="">— keine gemappte Rate —</option>`;
      const priceNode = document.querySelector('#newPrice');
      if (priceNode) priceNode.value = 0;
      (typeof setSelectedRatePolicy === 'function') && setSelectedRatePolicy('');
    }

    try { typeof validateStep === 'function' && validateStep('3'); } catch(e){}
    try { typeof updateSummary === 'function' && updateSummary('#summaryFinal'); } catch(e){}
  };

  // Event-Hooks (ohne Duplikate)
  document.querySelector('#newHotel')?.addEventListener('change', window.refreshNewResRates);
  document.querySelector('#newCat')  ?.addEventListener('change', window.refreshNewResRates);
  document.querySelector('#newRate') ?.addEventListener('change', (e)=>{
    const opt = e.target.selectedOptions[0]; if (!opt) return;
    const priceNode = document.querySelector('#newPrice');
    if (priceNode) priceNode.value = opt.dataset.price || 0;
    (typeof setSelectedRatePolicy === 'function') && setSelectedRatePolicy(opt.dataset.policy || '');
  });

  // Initial füllen
  setTimeout(()=>{ try{ window.refreshNewResRates(); }catch(e){} }, 0);

})();
})();


// --- Safe delegation for '+ weitere Kategorie' buttons (Create/Edit) ---
document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('#crAddCatRow, #erAddCatRow');
  if (!btn) return;
  e.preventDefault();
  const isCreate = btn.id === 'crAddCatRow';
  const wrapId = isCreate ? 'crCatsWrap' : 'erCatsWrap';
  const hotelSel = isCreate ? document.getElementById('crHotel') : document.getElementById('erHotel');
  const hotelCode = hotelSel ? hotelSel.value : '';
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  try { addCatRow(wrap, hotelCode, ''); } catch(e){ console.warn('addCatRow failed', e); }
});



// Guard: when Create modal becomes open, ensure '+ weitere Kategorie' is enabled
(function(){
  const el = document.getElementById('modalRateCreate');
  if (!el) return;
  const obs = new MutationObserver(()=>{
    if (el.classList.contains('open')){
      const wrap = document.getElementById('crCatsWrap');
      const add  = document.getElementById('crAddCatRow');
      if (wrap) wrap.removeAttribute('data-disabled');
      if (add) { add.disabled = false; add.removeAttribute('disabled'); }
    }
  });
  obs.observe(el, { attributes:true, attributeFilter:['class'] });

  // Zentrale Re-Calc Funktion
window.invalidateKpis = function(){
  loadKpisToday();
  loadKpisNext();
};

// Globaler Listener: jedes Preisplan-Save feuert dieses Event
window.addEventListener('priceplan:saved', ()=> window.invalidateKpis());
})();



// ===== Small UI helpers =====
function showToast(msg, ms=1800){
  const el = document.getElementById('appToast');
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(el.__t);
  el.__t = setTimeout(()=>{
    el.classList.remove('show');
    setTimeout(()=>{ el.classList.add('hidden'); }, 200);
  }, ms);
}
async function copyToClipboard(txt){
  try { await navigator.clipboard.writeText(txt); showToast('Kopiert.'); }
  catch(e){ console.warn('Clipboard',e); showToast('Konnte nicht kopieren'); }
}


(function enhanceReservationList(){
  const STORAGE_KEY = 'resTool.filters.v2';
  const get = sel => document.querySelector(sel);
  const saveFilters = () => {
    const data = {
      q:  get('#searchInput')?.value || '',
      h:  get('#filterHotel')?.value || '',
      s:  get('#filterStatus')?.value || '',
      rn: get('#filterResNo')?.value || '',
      f:  get('#filterFrom')?.value || '',
      t:  get('#filterTo')?.value || ''
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e){}
  };
  const loadFilters = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (get('#searchInput'))   get('#searchInput').value = d.q || '';
      if (get('#filterHotel'))   get('#filterHotel').value = d.h || '';
      if (get('#filterStatus'))  get('#filterStatus').value = d.s || 'active';
      if (get('#filterResNo'))   get('#filterResNo').value = d.rn || '';
      if (get('#filterFrom'))    get('#filterFrom').value = d.f || '';
      if (get('#filterTo'))      get('#filterTo').value = d.t || '';
    } catch(e){}
  };

  document.addEventListener('DOMContentLoaded', loadFilters);
  const debLoad = debounce(()=> { saveFilters(); try{ loadReservations && loadReservations(); }catch(e){} }, 350);

  ['#searchInput','#filterHotel','#filterStatus','#filterResNo','#filterFrom','#filterTo'].forEach(sel => {
    const el = get(sel); if (!el) return;
    const ev = (el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'input';
    el.addEventListener(ev, debLoad);
  });

  // --- DATE HELPERS (local ISO, z.B. 2025-10-09)
function isoDateLocal(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}


  // === Availability UI binden ===
(function initAvailabilityUI(){
  const from = document.getElementById('availFrom');
  const days = document.getElementById('availDays');
  const run  = document.getElementById('availRun');
  const only = document.getElementById('availActiveOnly');

  if (!from || !days || !run) return;

  // Defaults
  if (!from.value){
    from.value = (typeof isoDateLocal === 'function' ? isoDateLocal : isoDate)(new Date());
  }
  // safe wrapper – greift erst auf window.runAvailability zu, wenn vorhanden
const callAvail = () => { if (typeof window.runAvailability === 'function') window.runAvailability(); };
run.addEventListener('click',   callAvail);
days.addEventListener('change', callAvail);
only?.addEventListener('change',callAvail);

  // Bei Öffnen des Modals direkt rendern
  document.getElementById('btnAvail')?.addEventListener('click', ()=>{
    setTimeout(runAvailability, 50);
  });
})();


  get('#btnClearFilters')?.addEventListener('click', () => {
    ['#searchInput','#filterHotel','#filterStatus','#filterResNo','#filterFrom','#filterTo'].forEach(sel => {
      const el = get(sel); if (!el) return;
      if (el.tagName === 'SELECT') { el.selectedIndex = 0; }
      else el.value = '';
    });
    saveFilters();
    try{ loadReservations && loadReservations(); }catch(e){}
  });

  get('#resExportCsv')?.addEventListener('click', () => {
    const table = document.getElementById('resTable');
    if (!table) { showToast('Keine Tabelle gefunden'); return; }
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows.map(tr => Array.from(tr.children).map(td => {
      let t = td.textContent.replace(/\s+/g,' ').replace(/\n/g,' ').trim();
      return '"' + t.replace(/"/g,'""') + '"';
    }).join(',')).join('\n');
    download('reservierungen.csv', 'text/csv;charset=utf-8', csv);
    showToast('CSV exportiert');
  });
})();



(function persistDock(){
  const KEY='resTool.dock.collapsed';
  const dock = document.querySelector('.analytics-dock');
  const btn = document.getElementById('dockToggle');
  if (!dock || !btn) return;
  const apply = (v)=>{ dock.style.display = v ? 'none' : ''; btn.textContent = v ? '+' : '–'; };
  try { apply(localStorage.getItem(KEY) === '1'); } catch(e){}
  btn.addEventListener('click', ()=>{
    const collapsed = dock.style.display !== 'none';
    apply(collapsed);
    try{ localStorage.setItem(KEY, collapsed ? '1':'0'); }catch(e){}
  });
})();



(function enhanceConfirmModal(){
  const byId = id => document.getElementById(id);
  byId('btnCopyEmail')?.addEventListener('click', ()=>{
    const v = byId('confirmEmailTo')?.value || '';
    if (!v) return showToast('Keine E-Mail eingetragen');
    copyToClipboard(v);
  });
  byId('btnCopyConfirmation')?.addEventListener('click', ()=>{
    const v = byId('confirmEmailBody')?.value || '';
    if (!v) return showToast('Kein Text vorhanden');
    copyToClipboard(v);
  });
})();

/* ===========================
   GruppenResa — Prototype v1
   Storage: localStorage (resTool.groups / resTool.groupBookings)
   =========================== */
(function(){
  // Guard
  if (window.__RESTOOL_GROUPS__) return; window.__RESTOOL_GROUPS__ = true;

  const LS_GROUPS  = 'resTool.groups';
  const LS_BOOKS   = 'resTool.groupBookings'; // bookings per groupId
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));

  // --- Data helpers ---
  const getHotels = () => (window.HOTELS || []).map(h => ({ code: h.code || h.hotel_code || h.id, name: h.display_name || h.name || h.code }));
  const hotelByCode = (code) => getHotels().find(h => h.code === code);

  const loadGroups = () => JSON.parse(localStorage.getItem(LS_GROUPS) || '[]');
  const saveGroups = (list) => localStorage.setItem(LS_GROUPS, JSON.stringify(list));
  const loadBooks  = () => JSON.parse(localStorage.getItem(LS_BOOKS)  || '{}');
  const saveBooks  = (obj) => localStorage.setItem(LS_BOOKS,  JSON.stringify(obj));

  const uid = () => Math.random().toString(36).slice(2,9);

  // --- KPIs for a group ---
  function calcKPIs(rows){
    // rows: [{arr, dep, price, ...}]
    let rooms = rows.length;
    let rn = 0, rev = 0;
    for (const r of rows){
      const arr = new Date(r.arr); const dep = new Date(r.dep);
      const nights = Math.max( (dep - arr) / (1000*60*60*24), 0 );
      rn += nights;
      rev += (Number(r.price)||0) * nights;
    }
    const adr = rn > 0 ? (rev / rn) : 0;
    return { rooms, rn, rev, adr };
  }

  // --- DOM refs (lazy on open) ---
  let els = {};
  function cacheEls(){
    els = {
      modalList:     $('#modalGroups'),
      modalEdit:     $('#modalGroupEdit'),
      hotelFilter:   $('#grpHotelFilter'),
      search:        $('#grpSearch'),
      body:          $('#grpBody'),
      btnNew:        $('#btnNewGroup'),

      geName:   $('#geName'),
      geHotel:  $('#geHotel'),
      geNotes:  $('#geNotes'),
      fbLast:   $('#fbLast'), fbFirst: $('#fbFirst'), fbPax: $('#fbPax'),
      fbArr:    $('#fbArr'),  fbDep:   $('#fbDep'),
      fbRate:   $('#fbRate'), fbPrice: $('#fbPrice'),
      fbAdd:    $('#fbAdd'),  fbBody:  $('#fbBody'),
      gkRooms:  $('#gkRooms'), gkRN: $('#gkRN'), gkRev: $('#gkRev'), gkADR: $('#gkADR'),
      btnSave:  $('#btnGroupSave'), btnDel: $('#btnGroupDelete'),
    };
  }

  // --- State ---
  let groups = loadGroups(); // [{id,name,hotel,notes,createdAt}]
  let books  = loadBooks();  // { [groupId]: [ {last,first,pax,arr,dep,rate,price} ] }
  let currentId = null;

  // --- Render helpers ---
  function fillHotels(selectEl){
    const hotels = getHotels();
    selectEl.innerHTML = hotels.map(h => `<option value="${h.code}">${h.name || h.code}</option>`).join('');
  }

  function renderList(){
    const q = (els.search?.value || '').toLowerCase();
    const hf = els.hotelFilter?.value || '';
    const hotels = getHotels();

    const rows = groups
      .filter(g => (!hf || g.hotel === hf))
      .filter(g => !q || (g.name?.toLowerCase().includes(q) || g.notes?.toLowerCase().includes(q)))
      .map(g => {
        const rws = books[g.id] || [];
        const { rooms, rn, rev, adr } = calcKPIs(rws);
        const hName = (hotels.find(h => h.code === g.hotel)?.name) || g.hotel || '—';
        return `
          <tr data-id="${g.id}">
            <td><b>${g.name||'—'}</b><div class="muted tiny">${g.notes||''}</div></td>
            <td>${hName}</td>
            <td>${rooms}</td>
            <td>${rn}</td>
            <td>${fmtEUR(rev)}</td>
            <td>${fmtEUR(adr)}</td>
            <td><button class="btn sm" data-edit="${g.id}">Bearbeiten</button></td>
          </tr>`;
      }).join('');

    els.body.innerHTML = rows || `<tr><td colspan="7" class="muted tiny">Keine Gruppen gefunden.</td></tr>`;
  }

  function renderEdit(){
    const g = groups.find(x => x.id === currentId);
    if (!g) return;

    els.geName.value  = g.name || '';
    els.geHotel.value = g.hotel || '';
    els.geNotes.value = g.notes || '';

    const rws = books[g.id] || [];
    els.fbBody.innerHTML = rws.map((r,idx)=>`
  <tr>
    <td>${esc(r.last)}</td><td>${esc(r.first)}</td>
    <td>${Number(r.pax)||1}</td>
    <td>${r.arr}</td><td>${r.dep}</td>
    <td>${esc(r.cat||'')}</td>
    <td>${esc(r.rate||'')}</td>
    <td>${fmtEUR(r.price||0)}</td>
    <td><button class="btn sm" data-delrow="${idx}">×</button></td>
  </tr>
`).join('');


    const { rooms, rn, rev, adr } = calcKPIs(rws);
    els.gkRooms.textContent = String(rooms);
    els.gkRN.textContent    = String(rn);
    els.gkRev.textContent   = fmtEUR(rev);
    els.gkADR.textContent   = fmtEUR(adr);
  }

  // --- Utils ---
  const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function fmtEUR(v){ const n = Number(v)||0; return n.toLocaleString('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}); }

  // --- Openers ---
  function openGroups(){
    cacheEls();
    fillHotels(els.hotelFilter);
    renderList();
    window.openModal('modalGroups'); // nutzt deinen Modal-Core
  }

  function openEdit(id){
    cacheEls();
    // Neuer Datensatz?
    if (!id){
      const defHotel = $('#grpHotelFilter')?.value || (getHotels()[0]?.code || '');
      const g = { id: uid(), name: '', hotel: defHotel, notes: '', createdAt: new Date().toISOString() };
      groups.unshift(g); currentId = g.id; saveGroups(groups);
      if (!books[g.id]) { books[g.id] = []; saveBooks(books); }
    } else {
      currentId = id;
    }
    fillHotels(els.geHotel);
    renderEdit();
    window.openModal('modalGroupEdit');

    // Raten passend zum aktuellen Hotel füllen
fillRatesDropdown(document.getElementById('fbRateSel'), els.geHotel.value);

    // Kategorien passend zum aktuellen Hotel füllen
fillFastBookerCats(els.geHotel.value);

// Beim Ratenwechsel Preis spiegeln
document.getElementById('fbRateSel')?.addEventListener('change', (e)=>{
  const p = e.target.selectedOptions[0]?.dataset.price;
  if (p != null) els.fbPrice.value = Number(p);
});

// Wenn das Gruppen-Hotel geändert wird → Raten neu füllen + Preis setzen
els.geHotel?.addEventListener('change', (e)=>{
  // Raten neu
  fillRatesDropdown(document.getElementById('fbRateSel'), e.target.value);
  const p = document.getElementById('fbRateSel')?.selectedOptions?.[0]?.dataset.price;
  if (p != null) els.fbPrice.value = Number(p);

  // Kategorien neu
  fillFastBookerCats(e.target.value);
});



    // === Rates robust holen (lokal gespeicherte Raten → Fallback Dummy) ===
function getRatesForHotel(hotelCode){
  // Versuche: readRates() (aus Ratentool) → nur dieses Hotel
  try{
    if (typeof readRates === 'function'){
      const list = (readRates() || []).filter(r => r.hotel_code === hotelCode);
      if (list.length){
        return list.map(r => ({
          name:  r.name || r.rate_name || r.ratecode || 'Rate',
          price: Number(r.price || r.rate_price || 0)
        }));
      }
    }
    // Fallback: direkter Zugriff auf LocalStorage (RATES_KEY)
    const key = (typeof window !== 'undefined' && window.RATES_KEY) ? window.RATES_KEY : 'resTool.rates';
    const raw = JSON.parse(localStorage.getItem(key) || '[]')
                  .filter(r => r.hotel_code === hotelCode);
    if (raw.length){
      return raw.map(r => ({
        name:  r.name || r.rate_name || r.ratecode || 'Rate',
        price: Number(r.price || r.rate_price || 0)
      }));
    }
  }catch(e){ /* ignore */ }

  // Finaler Fallback: Dummy
  return (window.HOTEL_RATES?.default || []).map(r => ({
    name: r.name, price: Number(r.price||0)
  }));
}

function fillRatesDropdown(sel, hotelCode){
  if (!sel) return;
  const list = getRatesForHotel(hotelCode);
  sel.innerHTML = list.map(r =>
    `<option value="${r.name}" data-price="${r.price}">${r.name} (${r.price.toLocaleString('de-DE')} €)</option>`
  ).join('');
}
    // REPLACE: function fillFastBookerCats(hotelCode){ ... }
function fillFastBookerCats(hotelCode){
  const sel = document.getElementById('fbCatSel');
  if (!sel) return;

  // 1) Kategorien holen (V2)
  let cats = [];
  try {
    cats = (typeof getCategoriesForHotel === 'function')
      ? (getCategoriesForHotel(hotelCode) || [])
      : [];
  } catch(_) { cats = []; }

  // 2) Fallback, wenn noch nichts in V2 liegt → aus HOTEL_CATEGORIES ableiten + in V2 persistieren
  if (!cats || cats.length === 0){
    const names = (window.HOTEL_CATEGORIES?.[hotelCode] || window.HOTEL_CATEGORIES?.default || []);
    cats = names.map(n => {
      const code = (n||'').normalize('NFD').replace(/[^\w]/g,'').toUpperCase().slice(0,3) || 'CAT';
      const maxPax = /suite/i.test(n) ? 4 : 2;
      return { name:n, code, maxPax };
    });
    try {
      const map = (typeof readCatsV2 === 'function') ? readCatsV2() : {};
      map[hotelCode] = cats;
      if (typeof writeCatsV2 === 'function') writeCatsV2(map);
      if (typeof refreshCategoryDependents === 'function') refreshCategoryDependents(hotelCode);
    } catch(_) {}
  }

  // 3) Dropdown rendern
  sel.innerHTML = cats.map(c =>
    `<option value="${c.name}" data-code="${c.code}" data-max="${c.maxPax}">
       ${c.name} (${c.code} · max ${c.maxPax})
     </option>`
  ).join('');
}




// Preis auf Rate ändern
document.getElementById('fbRateSel')?.addEventListener('change', (e)=>{
  const p = e.target.selectedOptions[0]?.dataset.price;
  if (p != null) els.fbPrice.value = Number(p);
});

// Wenn das Gruppen-Hotel geändert wird → Raten neu
els.geHotel?.addEventListener('change', (e)=>{
  fillRatesDropdown(document.getElementById('fbRateSel'), e.target.value);
  const p = document.getElementById('fbRateSel')?.selectedOptions?.[0]?.dataset.price;
  if (p != null) els.fbPrice.value = Number(p);
});
  }

  // --- Event wiring (once) ---
  document.getElementById('btnGroups')?.addEventListener('click', openGroups);

  document.addEventListener('click', async (e)=>{
    const t = e.target;

    // Öffnen über Liste
    const editId = t.closest('[data-edit]')?.getAttribute('data-edit');
    if (editId){ e.preventDefault(); openEdit(editId); return; }

    // Neue Gruppe
    if (t.id === 'btnNewGroup'){ e.preventDefault(); openEdit(null); return; }

   // Fast-Booker: hinzufügen (→ echte Reservierung in Supabase + lokale Gruppenzuordnung)
if (t.id === 'fbAdd'){
  e.preventDefault();
  const g = groups.find(x => x.id === currentId); if (!g) return;

  const hotel = els.geHotel.value;
  const last  = els.fbLast.value.trim();
  const first = els.fbFirst.value.trim();
  const pax   = Number(els.fbPax.value)||1;
  const arr   = els.fbArr.value;
  const dep   = els.fbDep.value;
  const rateN = document.getElementById('fbRateSel')?.value || els.fbRate.value.trim(); // Fallback
  const price = Number(els.fbPrice.value)||0;

  const catSel = document.getElementById('fbCatSel');
  const catName = catSel?.value || null;
  const catCode = catSel?.selectedOptions?.[0]?.dataset.code || null;

  if (!hotel || !arr || !dep || !last){
    alert('Bitte mind. Hotel, An-/Abreise und Nachname ausfüllen.'); return;
  }

  // 1) sofort Supabase einsetzen
const hUI = (window.HOTELS||[]).find(h => h.code===hotel);
const payload = {
  reservation_number: 'G'+Date.now().toString(36).toUpperCase(),
  status: 'active',
  hotel_code: hotel,
  hotel_name: hUI ? `${hUI.group} - ${hUI.name.replace(/^.*? /,'')}` : hotel,
  arrival: arr,
  departure: dep,
  guests: pax,
  guests_adults: pax,
  guests_children: 0,
  category: catName,          // nur Name, kein category_code mitschicken
  rate_name: rateN,
  rate_price: price,
  guest_first_name: first || null,
  guest_last_name:  last  || null,
  notes: `Gruppe: ${g.name || g.id}`
  // KEIN group_id, KEIN category_code
};

  try {
  const { error } = await SB.from('reservations').insert(payload);
  if (error) {
    console.warn('Supabase insert error:', error);  // zeigt message/hint/details
    alert('Speichern fehlgeschlagen.');
    return;
  }
} catch(e) {
  console.error('Supabase insert exception:', e);
  alert('Speichern fehlgeschlagen.');
  return;
}

  // 2) lokale Roomingliste mitführen (für KPIs der Gruppe)
  (books[g.id] ||= []).push({
  last:first?last:last, first, pax, arr, dep,
  cat: catName, rate: rateN, price
});
  saveBooks(books);

  // 3) UI -> Reset & Refresh
  els.fbLast.value = els.fbFirst.value = '';
  els.fbPax.value = 1;
  // rate & price auf Dropdown-Default lassen
  renderEdit(); renderList();

  // 4) globale Listen/KPIs aktualisieren
  try { await autoRollPastToDone(); await loadReservations(); await loadKpisToday(); await loadKpisNext(); } catch(_){}
  window.dispatchEvent(new Event('reservation:changed'));
  return;
}

    // Fast-Booker: Zeile löschen
    const delIdx = t.closest('[data-delrow]')?.getAttribute('data-delrow');
    if (delIdx != null){
      const g = groups.find(x => x.id === currentId); if (!g) return;
      (books[g.id] ||= []).splice(Number(delIdx),1);
      saveBooks(books);
      renderEdit(); renderList();
      return;
    }

    // Gruppe speichern
    if (t.id === 'btnGroupSave'){
      const g = groups.find(x => x.id === currentId); if (!g) return;
      g.name  = els.geName.value.trim();
      g.hotel = els.geHotel.value;
      g.notes = els.geNotes.value.trim();
      saveGroups(groups);
      renderList();
      window.closeModal('modalGroupEdit');
      return;
    }

    // Gruppe löschen
    if (t.id === 'btnGroupDelete'){
      const g = groups.find(x => x.id === currentId); if (!g) return;
      if (confirm(`Gruppe „${g.name||g.id}“ wirklich löschen?`)){
        groups = groups.filter(x => x.id !== g.id); saveGroups(groups);
        delete books[g.id]; saveBooks(books);
        renderList();
        window.closeModal('modalGroupEdit');
      }
      return;
    }
        // Einstellungen → Benutzereinstellungen öffnen
    if (t.id === 'btnUserPrefs'){ 
      openModal('modalUserPrefs'); 
      try { await loadUsers(); } catch(_){}
      return;
    }

    // Benutzer erstellen
    if (t.id === 'btnUserCreate'){
      const name  = (document.getElementById('usrName')?.value||'').trim();
      const email = (document.getElementById('usrEmail')?.value||'').trim();
      const role  = document.getElementById('usrRole')?.value || 'agent';
      const active= (document.getElementById('usrActive')?.value||'true') !== 'false';
      const info  = document.getElementById('usrInfo');

        const pw    = (document.getElementById('usrPw')?.value||'').trim();
  const chosenPw = pw || email; // wenn leer, nutzen wir die E-Mail als Passwort
  if (!chosenPw || chosenPw.length < 4){
    if (info) info.textContent = 'Bitte Passwort (≥4) eingeben – oder E-Mail ausfüllen (wird als Passwort verwendet).';
    return;
  }


     if (!name){
  if (info) info.textContent = 'Bitte Name angeben.'; 
  return;
}
if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)){
  if (info) info.textContent = 'E-Mail ist optional – wenn angegeben, dann gültig.'; 
  return;
}
      t.disabled = true;
      try{
        await createUser({ name, email, role, active });

        // Passwort übernehmen (oder E-Mail als Fallback)
const pwField  = document.getElementById('usrPw');
const inputPw  = (pwField?.value || '').trim();
const chosenPw = inputPw || (email || '').trim();

if (!chosenPw || chosenPw.length < 4){
  if (info) info.textContent = 'Bitte Passwort (≥4) eingeben – oder E-Mail ausfüllen (wird als Passwort verwendet).';
  return;
}

// 1) unter LOGIN-NAME speichern
await setUserPassword(name, chosenPw);

// 2) optionaler Alias: auch unter E-Mail (lowercase) speichern,
//    damit Login mit E-Mail funktioniert (wenn vorhanden)
if (email) {
  await setUserPassword(email.toLowerCase(), chosenPw);
}

// Felder leeren
if (pwField) pwField.value = '';

        await setUserPassword(name, chosenPw);  // Passworthash unter LOGIN-NAME speichern
        document.getElementById('usrName').value='';
        if (email) { await setUserPassword(email.toLowerCase(), chosenPw); } // Alias: Login über E-Mail erlauben
        document.getElementById('usrEmail').value='';
        document.getElementById('usrRole').value='agent';
        document.getElementById('usrActive').value='true';
{ const el = document.getElementById('usrPw'); if (el) el.value = ''; }
        if (info) info.textContent = 'Benutzer erstellt.';
        await loadUsers();
      }catch(e){
        console.error(e);
        if (info) info.textContent = 'Fehler beim Erstellen.';
      }finally{
        t.disabled = false;
      }
      return;
    }

    // Benutzerliste: Refresh
    if (t.id === 'btnUsersRefresh'){ await loadUsers(); return; }

    // Benutzerliste: Toggle Aktiv
    const tid = t.getAttribute('data-usr-toggle');
    if (tid){ await toggleUserActive(tid); return; }

    // Benutzerliste: Löschen
    const did = t.getAttribute('data-usr-del');
    if (did){ 
      if (confirm('Benutzer wirklich löschen?')) await deleteUser(did);
      return; 
    }
       // Benutzerliste: Passwort SETZEN
const pid = t.getAttribute && t.getAttribute('data-usr-pass');
if (pid){
  const u = (__users||[]).find(x=>x.id===pid);
  if (!u){ alert('User nicht gefunden'); return; }

   const pw = prompt(`Neues Passwort für ${u.name} eingeben:`, '');
  if (!pw || pw.trim().length < 4){
    alert('Abbruch – Passwort muss mindestens 4 Zeichen haben.');
    return;
  }
  const val = pw.trim();

  // Unter Login-Name speichern
  await setUserPassword(u.name, val);

  // E-Mail-Alias (lowercase) zusätzlich speichern, falls vorhanden
  if (u.email) {
    await setUserPassword(String(u.email).toLowerCase(), val);
  }

  // Admin-Spezialfall: beide Keys (Groß/klein) schreiben
if (u.name && u.name.toLowerCase() === 'admin') {
  await setUserPassword('Admin', val);
  await setUserPassword('admin', val);
}

  alert('Passwort gesetzt.');
  return;
}
  }, { passive:false });

  // Filter / Suche live
  document.addEventListener('input', (e)=>{
    if (e.target?.id === 'grpHotelFilter' || e.target?.id === 'grpSearch'){
      renderList();
    }
  });

})();



(function keyboardShortcuts(){
  document.addEventListener('keydown', (e)=>{
    if (e.target && (/INPUT|TEXTAREA|SELECT/).test(e.target.tagName)) return;
    if (e.key === '/') {
      const s = document.getElementById('searchInput'); if (s){ e.preventDefault(); s.focus(); }
    } else if (e.key.toLowerCase() === 'n') {
      const b = document.getElementById('btnNew'); if (b){ e.preventDefault(); b.click(); }
    }
    // --- Auth Inline-Label im Header aktualisieren (optional) ---
(function(){
  function setInlineUser(u){
    const el = document.getElementById('authUserInline');
    if (!el) return;
    el.textContent = u ? `User: ${u.id}` : '';
  }

  window.addEventListener('auth:ready',  e => setInlineUser(e.detail.user));
  window.addEventListener('auth:login',  e => setInlineUser(e.detail.user));
  window.addEventListener('auth:logout', e => setInlineUser(null));

  // Falls die Seite schon geladen ist und ein User existiert:
  try { setInlineUser(window.getCurrentUser && window.getCurrentUser()); } catch {}
})();

  });
})();
