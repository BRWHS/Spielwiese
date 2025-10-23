/* === Res-Tool: Auth Overlay (add-on) ===
   Drop-in login with blur lock & user badge
   Default user: ID=Admin, PW=6764
*/
(function(){
  const STORAGE_KEY = 'resToolAuth';
  const ADMIN_ID = 'Admin';
  const ADMIN_PW = '6764';

  /** Utilities **/
  const qs = sel => document.querySelector(sel);
  const ce = (tag, props={}) => Object.assign(document.createElement(tag), props);

  function readAuth(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch{ return null; }
  }
  function writeAuth(obj){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || null));
  }
  function clearAuth(){ localStorage.removeItem(STORAGE_KEY); }

  function dispatch(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
  }

  // Build overlay if not present
  function ensureOverlay(){
    if(qs('#authOverlay')) return;

    const overlay = ce('div', { id: 'authOverlay' });
    const modal = ce('div', { id: 'authModal' });

    const title = ce('h3', { className: 'auth-title', textContent: 'Anmeldung' });
    const sub = ce('p', { className: 'auth-sub', textContent: 'Wie geht es dir heute ?' });

    const fUser = ce('div', { className: 'auth-field' });
    const lUser = ce('label', { className: 'auth-label', textContent: 'Benutzer-ID' });
    const iUser = ce('input', { className: 'auth-input', id: 'authUser', placeholder: 'z. B. Log-In', autocomplete: 'username' });
    fUser.append(lUser, iUser);

    const fPw = ce('div', { className: 'auth-field' });
    const lPw = ce('label', { className: 'auth-label', textContent: 'Passwort' });
    const iPw = ce('input', { className: 'auth-input', id: 'authPass', placeholder: '••••', type: 'password', autocomplete: 'current-password' });
    fPw.append(lPw, iPw);

    const err = ce('div', { id: 'authErr', className: 'auth-err', textContent: 'Ungültige Zugangsdaten' });

    const actions = ce('div', { className: 'auth-actions' });
    const btnLogin = ce('button', { className: 'auth-btn', textContent: 'Login' });
    const btnCancel = ce('button', { className: 'auth-btn', textContent: 'Abbrechen' });
    actions.append(btnLogin, btnCancel);

    modal.append(title, sub, fUser, fPw, err, actions);
    overlay.append(modal);
    document.body.append(overlay);

     // Overlay soll Eingaben zulassen, selbst wenn Body gesperrt ist
overlay.style.pointerEvents = 'auto';
overlay.style.userSelect = 'auto';

    // Events
    btnCancel.addEventListener('click', () => {
      iUser.value = ''; iPw.value = '';
      iUser.focus();
    });

   async function tryLogin(){
  const u = (iUser.value || '').trim();
  const p = iPw.value || '';

 // Passwort-Map zuerst lesen
let map = {};
try { map = JSON.parse(localStorage.getItem('resTool.userPw') || '{}'); } catch {}

// WICHTIG: Wenn für 'Admin' ein eigenes Passwort gesetzt ist,
// dann die 6764-Backdoor deaktivieren:
const adminOverridden = !!(map['Admin'] || map['admin']);
if (!adminOverridden && u === ADMIN_ID && p === ADMIN_PW){
  err.classList.remove('active');
  signIn({ id: u, role: 'admin' });
  return;
}

  // 2) Lokale Passwörter (SHA-256) – Name (case-insensitive) ODER E-Mail
try {
  // map aus oben weiterverwenden
  const uInput = (u || '').trim();
  const uLower = uInput.toLowerCase();

  // Userliste (wenn vorhanden) nur für Mapping nutzen
  let list = [];
  try { list = (window.__users || JSON.parse(localStorage.getItem('resTool.users')||'[]')) || []; } catch {}

  // passenden Datensatz über Name ODER E-Mail finden (case-insensitive)
  const rec = Array.isArray(list) ? list.find(x =>
    (x.name  && String(x.name).toLowerCase()  === uLower) ||
    (x.email && String(x.email).toLowerCase() === uLower)
  ) : null;

  // Kandidaten-Keys im Store bauen:
  const candidates = new Set();
  candidates.add(uInput); // exakt eingegebener String (falls PW unter der sichtbaren Eingabe abgelegt wurde)

  // case-insensitive Treffer direkt aus der Map suchen (falls Key-Kleinschreibung differt)
  const mapKeyCi = Object.keys(map).find(k => String(k).toLowerCase() === uLower);
  if (mapKeyCi) candidates.add(mapKeyCi);

  // aus Liste (falls vorhanden)
  if (rec?.name)  candidates.add(rec.name);
  if (rec?.email) candidates.add(String(rec.email).toLowerCase());

  // Hash der Eingabe berechnen
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
  const hex = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');

 // Match?
const okKey = [...candidates].find(k => map[k] && map[k] === hex);
if (okKey){
  const id = rec?.name || okKey;
  const role = String((rec?.role) || (String(id).toLowerCase() === 'admin' ? 'admin' : 'agent')).toLowerCase();
err.classList.remove('active');
signIn({ id, role });
  return;
}

} catch(_){}

  // 3) Fail
  err.classList.add('active');
}


    btnLogin.addEventListener('click', tryLogin);
    iPw.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') tryLogin(); });
  }

function ensureBadge(){
  if(document.getElementById('authUserBadge')) return;

  const badge = ce('div', { id:'authUserBadge' });
  const dot = ce('span', { id:'authUserDot' });
  const label = ce('span', { id:'authUserLabel', textContent: '' });
  badge.append(dot, label);

  // Ziel: in die Topbar rechts integrieren, sonst Fallback: body (fixed)
  const right = document.querySelector('.toolbar-right') || document.querySelector('header .toolbar-right');
  if (right) {
    badge.classList.add('in-toolbar');   // CSS schaltet auf "inline" um
    right.append(badge);
  } else {
    document.body.append(badge);         // Fallback: fixed oben rechts
  }

  badge.addEventListener('click', ()=>{
    if(confirm('Abmelden?')){ signOut(); }
  });
}


  function showOverlay(active){
  const overlay = qs('#authOverlay');
  if(!overlay) return;
  overlay.classList.toggle('active', !!active);

  // Overlay muss klick-/tippbar sein, auch wenn <html>/<body> auth-lock haben
  overlay.style.pointerEvents = active ? 'auto' : '';
  overlay.style.userSelect    = active ? 'auto' : '';

  if (active){
    // Fokus sicher auf das Username-Feld
    setTimeout(()=>{
      const iUser = qs('#authUser');
      if (iUser) { iUser.removeAttribute('disabled'); iUser.focus(); }
      const iPw = qs('#authPass');
      if (iPw) iPw.removeAttribute('disabled');
    }, 0);
  }
}

   // Fallback: setAppBlurred global absichern (falls noch nicht vorhanden)
if (typeof window.setAppBlurred !== 'function') {
  window.setAppBlurred = function(blur){
    const root = document.querySelector('#app') || document.querySelector('main') || document.querySelector('#root') || document.body;
    document.documentElement.classList.toggle('auth-lock', !!blur);
    document.body.classList.toggle('auth-lock', !!blur);
    if (root) root.classList.toggle('app-blurred', !!blur);
  };
}


  function updateBadge(user){
    ensureBadge();
    const badge = qs('#authUserBadge');
    const label = qs('#authUserLabel');
    if(user){
      badge.classList.add('active');
      label.textContent = user.id;
    }else{
      badge.classList.remove('active');
      label.textContent = '';
    }
  }

  function replaceAnonymousEverywhere(username){
    const targets = ['#activityLog', '.activity-log', '.log', '#logs', 'body'];
    const rx = /\banonymous\b/gi;

    function replaceInNode(node){
      if(node.nodeType === Node.TEXT_NODE){
        if(rx.test(node.nodeValue)){
          node.nodeValue = node.nodeValue.replace(rx, username);
        }
      }else{
        node.childNodes && node.childNodes.forEach(replaceInNode);
      }
    }

    targets.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => replaceInNode(el));
    });
  }

  /** Public-ish API **/
  window.getCurrentUser = function(){
    return readAuth();
  };

  // If the host app has a logger, wrap it to add user meta.
  function wrapLogger(){
    const w = window;
    ['logActivity','addActivity','pushActivity'].forEach(fn => {
      if(typeof w[fn] === 'function' && !w[fn]._wrappedByAuth){
        const orig = w[fn];
        w[fn] = function(){
          try{
            const user = readAuth();
            if(arguments.length){
              if(typeof arguments[0] === 'object' && arguments[0]){
                arguments[0].user = user?.id || 'anonymous';
              } else if (typeof arguments[0] === 'string'){
                arguments[0] = arguments[0] + ` (by ${user?.id || 'anonymous'})`;
              }
            }
          }catch{}
          return orig.apply(this, arguments);
        };
        w[fn]._wrappedByAuth = true;
      }
    });
  }

  function signIn(user){
    writeAuth(user);
    updateBadge(user);
    replaceAnonymousEverywhere(user.id);
    setAppBlurred(false);
    showOverlay(false);
     // --- BEGIN: Res-Tool Bridge (Rollen + Events + Logging) ---
try {
  // Rolle ableiten oder defaulten (falls im auth-Overlay keine Rolle gepflegt wird)
  const role = String(user.role || (user.id === 'Admin' ? 'admin' : 'agent')).toLowerCase();

  // Für app.js: globalen User setzen + Fallback-Speicher
  window.__AUTH_USER__ = { username: user.id, role };
  localStorage.setItem('resTool.user', JSON.stringify(window.__AUTH_USER__));

  // Zusätzliche (simple) Events, die app.js ebenfalls hört
  window.dispatchEvent(new Event('auth:login'));

  // Audit-Log (wenn bereits geladen)
  if (window.logActivity) window.logActivity('system', 'login', { username: user.id, role });
} catch(e){ console.warn('auth bridge (login) failed', e); }
// --- END: Res-Tool Bridge ---

    dispatch('auth:login', { user });
  }

  function signOut(){
    clearAuth();
    updateBadge(null);
    setAppBlurred(true);
    showOverlay(true);
     // --- BEGIN: Res-Tool Bridge (Logout) ---
try {
  window.__AUTH_USER__ = null;
  localStorage.removeItem('resTool.user');

  // Zusätzlicher (simpler) Event für app.js
  window.dispatchEvent(new Event('auth:logout'));

  if (window.logActivity) window.logActivity('system', 'logout', {});
} catch(e){ console.warn('auth bridge (logout) failed', e); }
// --- END: Res-Tool Bridge ---

    dispatch('auth:logout', {});
  }

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    ensureOverlay();
    ensureBadge();
    wrapLogger();

    const user = readAuth();
    if(user){
      updateBadge(user);
      setAppBlurred(false);
      showOverlay(false);
      dispatch('auth:ready', { user });
    } else {
      setAppBlurred(true);
      showOverlay(true);
      dispatch('auth:ready', { user: null });
    }

    // Expose a lightweight API for the host app
    window.ResToolAuth = {
      signIn, signOut, get user(){ return readAuth(); }
    };
  });
})();
