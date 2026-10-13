/* Math Quest frontend: auth, game loop, gamification. */
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = {
  user: null, stats: null, clientId: null, isParent: false,
  topic: null, tier: 0, problem: null, attempts: 0, hintsShown: 0,
  seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
  route: '', pendingRoute: '', completeTimer: null,
};

function rnd() {
  // mulberry32, reseeded per problem
  state.seed |= 0; state.seed = (state.seed + 0x6D2B79F5) | 0;
  let t = Math.imul(state.seed ^ (state.seed >>> 15), 1 | state.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ------------------------- answer parsing/checking ------------------------- */
function parseAnswer(s) {
  const raw = String(s).trim().toLowerCase().replace(/×/g, 'x').replace(/\*/g, 'x');
  if (raw.includes(',')) return { kind: 'text', v: raw }; // comma lists: 1,2,3
  s = raw.replace(/,/g, '');
  let m = s.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);           // mixed: 1 1/2
  if (m) { const w = +m[1], d = +m[3]; return { kind: 'fraction', n: w * d + (w < 0 ? -1 : 1) * +m[2], d }; }
  m = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);                        // fraction: 3/4
  if (m && +m[2] !== 0) return { kind: 'fraction', n: +m[1], d: +m[2] };
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return { kind: 'decimal', v: parseFloat(s) };
  return { kind: 'text', v: s };
}
const numVal = (p) => (p.kind === 'fraction' ? p.n / p.d : p.kind === 'decimal' ? p.v : NaN);
// numeric value, with a fallback for thousands-separated input like 100,000
function asNumber(parsed) {
  if (parsed.kind !== 'text') return numVal(parsed);
  const retry = parseAnswer(parsed.v.replace(/,/g, ''));
  return retry.kind === 'text' ? NaN : numVal(retry);
}

function normalizeText(s, mode) {
  s = String(s).toLowerCase().replace(/[\s:]/g, '').replace(/×/g, 'x').replace(/\*/g, 'x').replace(/−/g, '-');
  if (mode === 'factorlist') {
    const nums = (s.match(/\d+/g) || []).map(Number).sort((a, b) => a - b);
    return nums.join('x');
  }
  if (mode === 'numlist') {
    return (s.match(/\d+/g) || []).join(',');
  }
  if (mode === 'equation') {
    // y = mx + b: drop the "y=" prefix, collapse "+-" to "-"
    if (s.startsWith('y=')) s = s.slice(2);
    return s.replace(/\+-/g, '-');
  }
  if (mode === 'scinot') {
    // 4.5e4, 4.5x10^4, 4.5*10^4 -> 4.5e4
    return s.replace(/x10\^/g, 'e');
  }
  return s;
}
function answersMatch(parsed, spec) {
  if (spec.kind === 'int') {
    const v = asNumber(parsed);
    return !isNaN(v) && Math.abs(v - spec.v) < 1e-9;
  }
  if (spec.kind === 'decimal') {
    const v = asNumber(parsed);
    return !isNaN(v) && Math.abs(v - spec.v) <= (spec.tol || 0.01);
  }
  if (spec.kind === 'fraction') {
    if (parsed.kind === 'fraction') return parsed.n * spec.d === spec.n * parsed.d; // exact
    const v = asNumber(parsed);
    return !isNaN(v) && Math.abs(v - spec.n / spec.d) <= 1e-6; // decimal equivalent ok
  }
  if (spec.kind === 'text') {
    const got = normalizeText(parsed.kind === 'text' ? parsed.v : String(numVal(parsed)), spec.normalize);
    return spec.accept.some((a) => normalizeText(a, spec.normalize) === got);
  }
  return false;
}

/* ------------------------------- API layer ------------------------------- */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 401) { showScreen('signin'); initSignIn(); return { ok: false, auth: false }; }
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (e) { return { ok: false, error: 'bad-response' }; }
}

/* -------------------------------- screens -------------------------------- */
function showScreen(name) {
  $$('.screen').forEach((el) => el.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

/* -------------------------------- routing -------------------------------- */
// Hash routing: #/ home, #/play/<topicId>, #/family, #/signin.
// Hash (not path) routing so refresh and deep links never ask the server
// for a route it doesn't serve — the backend only serves /, /static/*, /api/*.
function parseRoute(hash) {
  const clean = String(hash || '').replace(/^#\/?/, '');
  if (!clean) return { screen: 'home' };
  if (clean === 'signin') return { screen: 'signin' };
  if (clean === 'family') return { screen: 'family' };
  const m = clean.match(/^play\/([a-z0-9-]+)$/);
  if (m && TOPICS.some((t) => t.id === m[1])) return { screen: 'play', topic: m[1] };
  return { screen: 'home' };
}
function navigate(route, push = true) {
  clearTimeout(state.completeTimer); // a manual move cancels any pending auto-advance
  if (push) history.pushState({ route }, '', '#/' + route);
  state.route = route;
  applyRoute(route);
}
function applyRoute(route) {
  const r = parseRoute('#/' + route);
  if (r.screen === 'signin') { showScreen('signin'); initSignIn(); return; }
  if (!state.user) { state.pendingRoute = route; showScreen('signin'); initSignIn(); return; }
  if (r.screen === 'home') { renderHome(); showScreen('home'); return; }
  if (r.screen === 'family') { showFamily(); return; }
  if (r.screen === 'play') { startTopic(r.topic, false); return; }
}
window.addEventListener('popstate', () => {
  const route = location.hash.replace(/^#\/?/, '');
  state.route = route;
  applyRoute(route);
});

/* --------------------------------- auth ---------------------------------- */
async function boot() {
  const cfg = await api('/math/api/config');
  state.clientId = cfg.google_client_id || null;
  const me = await api('/math/api/me');
  if (me && me.ok) {
    state.user = me.user; state.stats = me.stats; state.isParent = !!me.is_parent;
    // Restore the routed page on refresh / deep link; '' = home.
    applyRoute(location.hash.replace(/^#\/?/, ''));
  } else {
    state.pendingRoute = location.hash.replace(/^#\/?/, '') || '';
    showScreen('signin'); initSignIn();
  }
}

function initSignIn() {
  const box = $('#sso-box');
  if (!state.clientId) {
    box.innerHTML = `<div class="setup-card"><h3>⚙️ One-time setup needed</h3>
      <p>Sign-in isn't configured yet. The site owner needs to add a Google OAuth client ID:</p>
      <ol>
        <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud → Credentials</a></li>
        <li>Create Credentials → <b>OAuth client ID</b> → Web application</li>
        <li>Under <b>Authorized JavaScript origins</b>, add <code>https://mtayter.noip.me</code></li>
        <li>Copy the client ID into <code>config.json</code> as <code>google_client_id</code> and restart the service</li>
      </ol></div>`;
    return;
  }
  if (!window.google || !google.accounts) {
    box.innerHTML = `<p class="muted">Loading Google sign-in…</p>`;
    setTimeout(initSignIn, 800);
    return;
  }
  if (state.ssoInit) return; // google.accounts.id.initialize() must run once
  state.ssoInit = true;
  box.innerHTML = '';
  google.accounts.id.initialize({ client_id: state.clientId, callback: onGoogleCredential, ux_mode: 'popup' });
  google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', width: 280, text: 'signin_with' });
}

async function onGoogleCredential(resp) {
  const r = await api('/math/api/auth', { method: 'POST', body: JSON.stringify({ id_token: resp.credential }) });
  if (r && r.ok) {
    state.user = r.user; state.stats = r.stats; state.isParent = !!r.is_parent;
    // After sign-in, go where the deep link (or refresh) pointed, if anywhere.
    const pending = state.pendingRoute || '';
    state.pendingRoute = '';
    if (pending && pending !== 'signin') applyRoute(pending);
    else { renderHome(); showScreen('home'); }
  } else {
    $('#signin-error').textContent = 'Sign-in failed — please try again.';
  }
}

async function logout() {
  await api('/math/api/logout', { method: 'POST' });
  state.user = null; state.stats = null;
  navigate('signin');
}

/* ------------------------------ gamification ------------------------------ */
const BADGES = {
  first_steps:   { icon: '🌱', name: 'First Steps', desc: 'Answered your first problem' },
  streak_5:      { icon: '🔥', name: 'On Fire', desc: '5 correct in a row' },
  streak_10:     { icon: '🚀', name: 'Unstoppable', desc: '10 correct in a row' },
  level_3:       { icon: '⭐', name: 'Rising Star', desc: 'Reached level 3' },
  level_5:       { icon: '💫', name: 'Superstar', desc: 'Reached level 5' },
  topic_master:  { icon: '👑', name: 'Topic Master', desc: '90%+ mastery in any topic' },
  tier3_hero:    { icon: '🏆', name: 'Tier 3 Hero', desc: '8 correct at the hardest tier' },
  hundred:       { icon: '💯', name: 'Century', desc: '100 correct answers total' },
  helper:        { icon: '🧠', name: 'Smart Helper', desc: 'Used 10 hints (asking is smart!)' },
  persistent:    { icon: '📅', name: 'Week Warrior', desc: '7-day practice streak' },
};

function levelForXp(xp) { return Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2); }
function xpForLevel(n) { return Math.ceil(50 * n * (n - 1)); }

function renderHome() {
  const s = state.stats, u = state.user;
  $('#user-name').textContent = u.name.split(' ')[0];
  if (u.picture) { const img = $('#user-pic'); img.src = u.picture; img.style.display = ''; }
  const lvl = s.level;
  $('#level-badge').textContent = 'Lv ' + lvl;
  const cur = xpForLevel(lvl), next = xpForLevel(lvl + 1);
  const pct = Math.min(100, ((s.xp - cur) / Math.max(1, next - cur)) * 100);
  $('#xp-fill').style.width = pct + '%';
  $('#xp-text').textContent = `${s.xp} XP`;
  $('#streak-flame').textContent = s.day_streak > 0 ? `🔥 ${s.day_streak} day${s.day_streak === 1 ? '' : 's'}` : '🔥 start a streak!';
  $('#stat-correct').textContent = s.total_correct;
  $('#stat-streak').textContent = s.best_streak;

  // topic cards
  const grid = $('#topic-grid'); grid.innerHTML = '';
  for (const t of TOPICS) {
    const ts = (s.topics && s.topics[t.id]) || { tier: 0, mastery: 0, heat: 0.4, correct: 0 };
    const card = document.createElement('div');
    card.className = 'topic-card';
    const tierPills = t.tiers.map((tr, i) => {
      const unlocked = i <= ts.tier;
      return `<span class="tier-pill ${unlocked ? 'open' : 'locked'}" title="${tr.name}">${unlocked ? (i + 1) : '🔒'}</span>`;
    }).join('');
    const gMin = Math.min(...t.grades), gMax = Math.max(...t.grades);
    const gradeLabel = gMin === gMax ? `Grade ${gMin}` : `Grades ${gMin}–${gMax}`;
    const done = ts.completed ? `<span class="done-badge">✓ Completed</span>` : '';
    card.innerHTML = `
      <div class="topic-icon">${t.icon}</div>
      <div class="topic-name">${t.name} ${done}</div>
      <div class="topic-blurb">${t.blurb}</div>
      <div class="grade-label">📚 ${gradeLabel}</div>
      <div class="tier-row">${tierPills}<span class="tier-name">${t.tiers[ts.tier].name}</span></div>
      <div class="mastery"><div class="mastery-fill" style="width:${Math.round(ts.mastery)}%"></div></div>
      <button class="btn primary play-btn">Practice →</button>`;
    card.querySelector('.play-btn').onclick = () => startTopic(t.id);
    grid.appendChild(card);
  }

  // badges
  const bw = $('#badge-wall'); bw.innerHTML = '';
  for (const [id, b] of Object.entries(BADGES)) {
    const earned = s.badges.includes(id);
    const el = document.createElement('div');
    el.className = 'badge' + (earned ? ' earned' : '');
    el.title = b.desc;
    el.innerHTML = `<div class="badge-icon">${b.icon}</div><div class="badge-name">${b.name}</div>`;
    bw.appendChild(el);
  }

  $('#parent-link').style.display = state.isParent ? '' : 'none';
}

/* -------------------------------- game loop ------------------------------- */
function topicById(id) { return TOPICS.find((t) => t.id === id); }

function startTopic(id, push = true) {
  state.topic = topicById(id);
  const ts = (state.stats.topics && state.stats.topics[id]) || { tier: 0, heat: 0.4 };
  state.tier = Math.min(ts.tier, state.topic.tiers.length - 1);
  showScreen('play');
  $('#play-topic').textContent = `${state.topic.icon} ${state.topic.name}`;
  if (push) history.pushState({ route: 'play/' + id }, '', '#/play/' + id);
  newProblem();
}

function newProblem() {
  clearTimeout(state.completeTimer);
  const ts = (state.stats.topics && state.stats.topics[state.topic.id]) || { heat: 0.4 };
  state.seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const tierDef = state.topic.tiers[state.tier];
  state.problem = tierDef.gen(rnd, ts.heat == null ? 0.4 : ts.heat);
  state.attempts = 0; state.hintsShown = 0;
  $('#tier-label').textContent = `Tier ${state.tier + 1} · Grade ${state.topic.grades[state.tier]} · ${tierDef.name}`;
  $('#problem-prompt').innerHTML = state.problem.prompt;
  $('#answer-input').value = '';
  $('#answer-input').disabled = false;
  $('#check-btn').disabled = false;
  $('#feedback').innerHTML = '';
  $('#feedback').className = 'feedback';
  $('#hint-area').innerHTML = '';
  $('#hint-btn').style.display = '';
  $('#next-btn').style.display = 'none';
  $('#recap-card').style.display = 'none';
  renderAttemptDots();
  setTimeout(() => $('#answer-input').focus(), 60);
}

function renderAttemptDots() {
  const dots = [0, 1, 2].map((i) =>
    `<span class="dot ${i < state.attempts ? 'used' : ''}"></span>`).join('');
  $('#attempt-dots').innerHTML = dots + `<span class="attempt-label">${3 - state.attempts} ${3 - state.attempts === 1 ? 'try' : 'tries'} left</span>`;
}

async function checkAnswer() {
  if (!state.problem || $('#check-btn').disabled) return;
  const raw = $('#answer-input').value;
  if (!raw.trim()) { $('#answer-input').focus(); return; }
  const parsed = parseAnswer(raw);
  const ok = answersMatch(parsed, state.problem.answer);
  state.attempts++;
  renderAttemptDots();

  if (ok) {
    const r = await api('/math/api/attempt', {
      method: 'POST',
      body: JSON.stringify({ topic: state.topic.id, tier: state.tier, correct: true, attempts_used: state.attempts, hints_used: state.hintsShown }),
    });
    if (r && r.ok) { state.stats = r.stats; onCorrect(r); }
  } else if (state.attempts >= 3) {
    // Anti-guess: no more tries on THIS problem. Method recap, then a fresh problem.
    // The answer is never revealed — guessing can't converge.
    await api('/math/api/attempt', {
      method: 'POST',
      body: JSON.stringify({ topic: state.topic.id, tier: state.tier, correct: false, attempts_used: state.attempts, hints_used: state.hintsShown }),
    }).then((r) => { if (r && r.ok) state.stats = r.stats; });
    onLockedOut();
  } else {
    const fb = $('#feedback');
    fb.className = 'feedback wrong';
    fb.innerHTML = state.attempts === 2
      ? `Not quite — one try left. <button class="linkbtn" id="fb-hint">Want a hint?</button>`
      : `Not quite — try again! 💪`;
    const hb = $('#fb-hint');
    if (hb) hb.onclick = showHint;
    $('#problem-card').classList.remove('shake'); void $('#problem-card').offsetWidth;
    $('#problem-card').classList.add('shake');
  }
}

function nextIncompleteTopic(excludeId) {
  for (const t of TOPICS) {
    if (t.id === excludeId) continue;
    const ts = state.stats.topics && state.stats.topics[t.id];
    if (!ts || !ts.completed) return t;
  }
  return null;
}

function onTopicComplete() {
  // Celebration + auto-advance to the next uncompleted quest.
  const next = nextIncompleteTopic(state.topic.id);
  const fb = $('#feedback');
  fb.className = 'feedback right';
  fb.innerHTML = `🎉 <b>Section complete!</b> You finished ${state.topic.name}! ${next ? `Next up: ${next.icon} ${next.name}.` : 'You finished every quest!'}`;
  $('#answer-input').disabled = true;
  $('#check-btn').disabled = true;
  $('#hint-btn').style.display = 'none';
  $('#next-btn').style.display = 'none';
  const rc = $('#recap-card');
  rc.style.display = '';
  rc.innerHTML = `<h4>🏆 ${state.topic.name} — complete!</h4>
    <p>You answered 8 problems correctly at the hardest tier. ${next ? `Moving to <b>${next.name}</b> in a moment…` : 'Amazing — every quest is done!'}</p>
    <p>
      ${next ? `<button class="btn primary" id="goto-next">Next quest →</button> ` : `<button class="btn primary" id="goto-next">Back to quests</button> `}
      <button class="btn ghost" id="stay-here">Keep practicing here</button>
    </p>`;
  const go = () => { clearTimeout(state.completeTimer); if (next) startTopic(next.id); else navigate(''); };
  $('#goto-next').onclick = go;
  $('#stay-here').onclick = () => {
    clearTimeout(state.completeTimer);
    rc.style.display = 'none';
    fb.innerHTML = 'Staying here — keep going! 💪';
    const nb = $('#next-btn');
    nb.style.display = '';
    nb.onclick = newProblem;
  };
  clearTimeout(state.completeTimer);
  state.completeTimer = setTimeout(go, 5000);
}

function onCorrect(r) {
  const fb = $('#feedback');
  fb.className = 'feedback right';
  const msgs = ['Nice! 🎉', 'Exactly right! ✨', 'You got it! 💪', 'Brilliant! 🌟'];
  fb.innerHTML = `${msgs[Math.floor(Math.random() * msgs.length)]} <span class="xp-toast">+${r.xp_earned} XP</span>`;
  $('#answer-input').disabled = true;
  $('#check-btn').disabled = true;
  $('#hint-btn').style.display = 'none';
  $('#problem-card').classList.add('pop');
  setTimeout(() => $('#problem-card').classList.remove('pop'), 500);

  let extra = '';
  if (r.leveled_up) extra += `<div class="celebrate">🎊 Level ${r.stats.level}! 🎊</div>`;
  for (const b of r.new_badges || []) {
    const def = BADGES[b];
    if (def) extra += `<div class="celebrate">🏅 New badge: <b>${def.icon} ${def.name}</b> — ${def.desc}</div>`;
  }
  if (r.suggest && r.suggest.tier > state.tier) {
    extra += `<div class="celebrate">🚀 You unlocked <b>Tier ${r.suggest.tier + 1}</b> — harder problems ahead!</div>`;
    state.tier = r.suggest.tier;
  } else if (r.suggest && r.suggest.tier < state.tier) {
    extra += `<div class="celebrate">💡 Dropping to <b>Tier ${r.suggest.tier + 1}</b> for now — you'll climb back!</div>`;
    state.tier = r.suggest.tier;
  }
  if (extra) fb.innerHTML += extra;

  // Section complete beats the ordinary next-problem flow.
  if (r.topic_completed) { onTopicComplete(); return; }

  const nb = $('#next-btn');
  nb.style.display = '';
  nb.onclick = newProblem;
  setTimeout(() => { if ($('#next-btn').style.display !== 'none') newProblem(); }, 2600);
}

function onLockedOut() {
  $('#answer-input').disabled = true;
  $('#check-btn').disabled = true;
  $('#hint-btn').style.display = 'none';
  const h0 = state.problem.hints[0];
  const rc = $('#recap-card');
  rc.style.display = '';
  rc.innerHTML = `<h4>That was a tricky one — no worries! Here’s the method to remember:</h4>
    <div class="hint-body">${h0.html}</div>
    <p class="muted">Fresh problem coming up — same skills, new numbers. <b>The answer is never just given away here.</b></p>`;
  const fb = $('#feedback');
  fb.className = 'feedback info';
  fb.textContent = 'Out of tries on this one — fresh problem in a moment!';
  setTimeout(newProblem, 5200);
}

function showHint() {
  const hints = state.problem.hints;
  if (state.hintsShown >= hints.length) return;
  const h = hints[state.hintsShown++];
  const area = $('#hint-area');
  const el = document.createElement('div');
  el.className = 'hint-card';
  el.innerHTML = `<div class="hint-title">💡 ${h.t}</div><div class="hint-body">${h.html}</div>`;
  area.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (state.hintsShown >= hints.length) $('#hint-btn').style.display = 'none';
}

/* ------------------------------ parent view ------------------------------ */
async function showFamily() {
  const r = await api('/math/api/family');
  if (!r || !r.ok) return;
  const wrap = $('#family-table'); wrap.innerHTML = '';
  for (const u of r.users) {
    const rows = Object.entries(u.topics).map(([tid, t]) => {
      const top = topicById(tid);
      return `<tr><td>${top ? top.icon + ' ' + top.name : tid}</td>
        <td>${t.correct}/${t.attempted}</td><td>${Math.round(t.accuracy * 100)}%</td>
        <td>Tier ${t.tier + 1}</td></tr>`;
    }).join('');
    const card = document.createElement('div');
    card.className = 'family-card';
    card.innerHTML = `<h3>${u.name} <span class="muted">(${u.email})</span></h3>
      <p>Level ${u.level} · ${u.xp} XP · 🔥 ${u.day_streak}d streak · ${u.total_correct} correct</p>
      <table><tr><th>Topic</th><th>Correct</th><th>Accuracy</th><th>Tier</th></tr>${rows || '<tr><td colspan=4 class="muted">no attempts yet</td></tr>'}</table>`;
    wrap.appendChild(card);
  }
  showScreen('family');
}

/* --------------------------------- wiring --------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  $('#check-btn').onclick = checkAnswer;
  $('#answer-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAnswer(); });
  $('#hint-btn').onclick = showHint;
  $('#quit-btn').onclick = () => navigate('');
  $('#logout-btn').onclick = logout;
  $('#parent-link').onclick = () => navigate('family');
  $('#family-back').onclick = () => navigate('');
  boot();
});
