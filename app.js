'use strict';
/*
 * Life Quest: a gamified life reset tracker.
 *
 * All XP, streaks, push-up targets and badges are worked out fresh from the
 * raw daily logs every time something changes. That way undoing a log (or
 * fixing yesterday's step count) always gives the right totals.
 */
(() => {
  const STORE = 'lifequest:v1';
  const WATER_UNIT = 250; // ml per 5 XP

  const RANKS = [
    [1, 'Rookie'], [3, 'Initiate'], [5, 'Contender'], [8, 'Warrior'], [12, 'Champion'],
    [16, 'Elite'], [20, 'Titan'], [25, 'Legend'], [30, 'Mythic'], [40, 'Immortal'],
  ];

  const WORKOUTS = [
    { id: 'strength', icon: '🏋️', name: 'Strength' },
    { id: 'cardio', icon: '🏃', name: 'Cardio' },
    { id: 'hiit', icon: '⚡', name: 'HIIT' },
    { id: 'mobility', icon: '🧘', name: 'Mobility' },
    { id: 'sport', icon: '⚽', name: 'Sport' },
    { id: 'walk', icon: '🥾', name: 'Hike / walk' },
  ];

  const DEFAULT_HABITS = [
    { id: 'h_sleep', icon: '😴', name: '7+ hours sleep' },
    { id: 'h_veg', icon: '🥦', name: '5 portions of fruit & veg' },
    { id: 'h_clean', icon: '🚫', name: 'No junk food or alcohol' },
    { id: 'h_mind', icon: '🧠', name: '10 min reading or meditation' },
  ];

  // Badges. `t` gets the running counters after each day.
  const ACH = [
    { id: 'day1', icon: '🌱', name: 'Day One', desc: 'Log your first activity', xp: 50, t: c => c.any },
    { id: 'hyd1', icon: '💧', name: 'Hydrated', desc: 'Hit your water goal', xp: 50, t: c => c.waterGoals >= 1 },
    { id: 'hyd7', icon: '🌊', name: 'Tidal Wave', desc: '7-day water streak', xp: 200, t: c => c.sw >= 7 },
    { id: 'hyd30', icon: '🐋', name: 'Ocean Master', desc: '30-day water streak', xp: 600, t: c => c.sw >= 30 },
    { id: 'stp1', icon: '👟', name: 'On The Move', desc: 'Hit your step goal', xp: 50, t: c => c.stepGoals >= 1 },
    { id: 'stp7', icon: '🗺️', name: 'Explorer', desc: '7-day step streak', xp: 200, t: c => c.ss >= 7 },
    { id: 'stp250k', icon: '🏃', name: 'Marathoner', desc: '250,000 lifetime steps', xp: 300, t: c => c.lifeSteps >= 250000 },
    { id: 'stp1m', icon: '🌍', name: 'Globetrotter', desc: '1,000,000 lifetime steps', xp: 1000, t: c => c.lifeSteps >= 1e6 },
    { id: 'pu50', icon: '💪', name: 'Half Century', desc: '50 push-ups in one day', xp: 100, t: c => c.maxPush >= 50 },
    { id: 'pu100', icon: '🦾', name: 'Centurion', desc: '100 push-ups in one day', xp: 300, t: c => c.maxPush >= 100 },
    { id: 'pu1k', icon: '🪨', name: 'Rock Solid', desc: '1,000 lifetime push-ups', xp: 300, t: c => c.lifePush >= 1000 },
    { id: 'pu10k', icon: '⛰️', name: 'Mountain Mover', desc: '10,000 lifetime push-ups', xp: 1500, t: c => c.lifePush >= 10000 },
    { id: 'pr5', icon: '📈', name: 'Overloader', desc: 'Set 5 push-up PRs', xp: 250, t: c => c.prCount >= 5 },
    { id: 'wo1', icon: '🏋️', name: 'First Rep', desc: 'Log your first workout', xp: 50, t: c => c.workouts >= 1 },
    { id: 'wk1', icon: '📅', name: 'On Schedule', desc: 'Hit your weekly workout goal', xp: 150, t: c => c.weeksDone >= 1 },
    { id: 'wk4', icon: '🔥', name: 'Unstoppable', desc: '4 weeks in a row on goal', xp: 600, t: c => c.weekStreak >= 4 },
    { id: 'wo50', icon: '🏅', name: 'Iron Regular', desc: '50 workouts logged', xp: 750, t: c => c.workouts >= 50 },
    { id: 'pf1', icon: '⭐', name: 'Perfect Day', desc: 'Water, steps & push-ups in one day', xp: 100, t: c => c.perfectDays >= 1 },
    { id: 'pf7', icon: '🌟', name: 'Perfect Week', desc: '7-day perfect streak', xp: 500, t: c => c.spf >= 7 },
    { id: 'pf30', icon: '👑', name: 'Reset Complete', desc: '30-day perfect streak', xp: 2000, t: c => c.spf >= 30 },
    { id: 'hb1', icon: '✅', name: 'Clean Sweep', desc: 'Tick off every daily habit', xp: 100, t: c => c.allHabits >= 1 },
    { id: 'hb30', icon: '🧭', name: 'Creature of Habit', desc: 'Every habit on 30 days', xp: 750, t: c => c.allHabits >= 30 },
  ];

  /* ---------- helpers ---------- */
  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return dkey(d); };
  const weekOf = k => { const d = parse(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); }; // Monday
  const today = () => dkey(new Date());
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const fmt = n => Math.round(Number(n) || 0).toLocaleString();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = a => a.reduce((x, y) => x + y, 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pct = (v, g) => (g > 0 ? clamp((v / g) * 100, 0, 100) : 0);
  const int = (v, min, max, fallback) => { const n = parseInt(v, 10); return Number.isFinite(n) ? clamp(n, min, max) : fallback; };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not supported */ } };

  const need = L => Math.round(120 * Math.pow(L, 1.5)); // XP to go from level L to L+1
  function levelInfo(xp) {
    let L = 1, rem = xp;
    while (rem >= need(L)) { rem -= need(L); L++; }
    return { level: L, into: rem, need: need(L) };
  }
  const rank = L => RANKS.reduce((r, [l, n]) => (L >= l ? n : r), RANKS[0][1]);

  /* ---------- state ---------- */
  function defaults() {
    return {
      settings: { name: '', waterGoal: 2500, glass: 250, stepsGoal: 10000, weeklyGoal: 4, pushStart: 20, pushInc: 2, theme: 'auto' },
      habits: DEFAULT_HABITS.map(h => ({ ...h })),
      days: {},
      seenAch: {},
      level: 1,
      start: today(),
      onboarded: false,
    };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      if (s && typeof s.days === 'object') return normalise(s);
    } catch (e) { /* storage blocked or corrupt: start fresh */ }
    return defaults();
  }
  function normalise(s) {
    const d = defaults();
    const out = { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
    if (!Array.isArray(out.habits)) out.habits = d.habits;
    for (const k of Object.keys(out.days)) out.days[k] = { ...blankDay(out.settings), ...out.days[k] };
    return out;
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
  }
  const blankDay = st => ({ water: 0, steps: 0, push: [], workouts: [], habits: {}, wg: st.waterGoal, sg: st.stepsGoal });
  const peek = k => S.days[k] || blankDay(S.settings);
  const day = k => (S.days[k] ||= blankDay(S.settings));

  /* ---------- the game engine ---------- */
  function compute() {
    const st = S.settings, T = today();
    const keys = Object.keys(S.days).sort();
    let k = [S.start, keys[0], VIEW].filter(Boolean).sort()[0];
    if (k > T) k = T;

    const R = { days: {}, weeks: {}, ach: {}, total: 0 };
    const c = {
      any: false, waterGoals: 0, stepGoals: 0, sw: 0, ss: 0, sp: 0, spf: 0,
      lifeSteps: 0, lifeWater: 0, lifePush: 0, maxPush: 0, prCount: 0, workouts: 0,
      weeksDone: 0, weekStreak: 0, perfectDays: 0, allHabits: 0,
      best: { sw: 0, ss: 0, sp: 0, spf: 0, week: 0 },
    };
    const inc = Math.max(1, st.pushInc | 0);
    let target = Math.max(1, st.pushStart | 0), miss = 0, pr = 0;
    let wk = null, wCount = 0, wDone = false, streakBefore = 0;

    for (; k <= T; k = addDays(k, 1)) {
      const w = weekOf(k);
      if (w !== wk) {
        if (wk !== null) streakBefore = wDone ? streakBefore + 1 : 0;
        wk = w; wCount = 0; wDone = false;
        R.weeks[w] = { count: 0, done: false, streakBefore };
      }
      const d = peek(k);
      const wg = d.wg || st.waterGoal, sg = d.sg || st.stepsGoal;
      const pt = sum(d.push), tgt = target;
      const wMet = d.water >= wg, sMet = d.steps >= sg, pMet = pt >= tgt;
      const bd = []; let xp = 0;
      const add = (label, v) => { if (v > 0) { bd.push([label, v]); xp += v; } };

      add('Water intake', Math.min(Math.floor(d.water / WATER_UNIT), Math.ceil((wg * 1.5) / WATER_UNIT)) * 5);
      if (wMet) add('Water goal', 50);
      add('Steps', Math.min(Math.floor(d.steps / 1000), Math.floor(sg / 1000) * 2) * 10);
      if (sMet) add('Step goal', 50);
      add('Push-up reps', Math.min(pt, 300));
      if (pMet) add('Push-up target', 50);
      let isPR = false;
      if (pt > pr) { if (pr > 0) { isPR = true; c.prCount++; add('New push-up PR', 100); } pr = pt; }
      const nW = d.workouts.length;
      add('Workouts', Math.min(nW, 2) * 75);
      const hDone = S.habits.filter(h => d.habits[h.id]).length;
      add('Habits', hDone * 15);

      c.sw = wMet ? c.sw + 1 : 0;
      c.ss = sMet ? c.ss + 1 : 0;
      c.sp = pMet ? c.sp + 1 : 0;
      const perfect = wMet && sMet && pMet;
      c.spf = perfect ? c.spf + 1 : 0;
      if (perfect) {
        c.perfectDays++;
        add(c.spf > 1 ? `Perfect day (${c.spf}-day streak)` : 'Perfect day', 100 + Math.min(c.spf - 1, 10) * 10);
      }

      wCount += nW; R.weeks[w].count = wCount;
      if (!wDone && wCount >= st.weeklyGoal) {
        wDone = true; R.weeks[w].done = true; c.weeksDone++;
        add(streakBefore ? `Weekly goal (${streakBefore + 1}-week streak)` : 'Weekly workout goal', 250 + Math.min(streakBefore, 5) * 50);
      }
      c.weekStreak = streakBefore + (wDone ? 1 : 0);

      if (wMet) c.waterGoals++;
      if (sMet) c.stepGoals++;
      c.lifeSteps += d.steps; c.lifeWater += d.water; c.lifePush += pt; c.workouts += nW;
      c.maxPush = Math.max(c.maxPush, pt);
      if (S.habits.length && hDone === S.habits.length) c.allHabits++;
      if (d.water || d.steps || pt || nW || hDone) c.any = true;
      for (const s of ['sw', 'ss', 'sp', 'spf']) c.best[s] = Math.max(c.best[s], c[s]);
      c.best.week = Math.max(c.best.week, c.weekStreak);

      for (const a of ACH) if (!R.ach[a.id] && a.t(c)) { R.ach[a.id] = k; add(`Badge: ${a.name}`, a.xp); }

      R.days[k] = { xp, bd, target: tgt, pt, wMet, sMet, pMet, perfect, wg, sg, isPR, hDone, sw: c.sw, ss: c.ss, sp: c.sp, spf: c.spf };
      R.total += xp;

      // Progressive overload: hit the target and it goes up; miss two sessions in a row and it eases off.
      if (pt >= tgt) { target = tgt + inc; miss = 0; }
      else if (pt > 0 && ++miss >= 2) { target = Math.max(5, tgt - inc); miss = 0; }
    }
    R.c = c; R.pr = pr; R.lv = levelInfo(R.total);
    return R;
  }

  let S = load();
  let VIEW = today();
  let TAB = 'today';
  let R = compute();
  let lastToday = today();

  /* ---------- views ---------- */
  function vHero() {
    const { level, into, need: n } = R.lv;
    const dayN = daysBetween(S.start, today()) + 1;
    return `
    <section class="hero card">
      <div class="lvl"><small>LVL</small><b>${level}</b></div>
      <div class="hero-body">
        <div class="hero-top"><h1>${esc(S.settings.name || 'Hero')}</h1><span class="rank">${rank(level)}</span></div>
        <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${into}"><i style="width:${pct(into, n)}%"></i></div>
        <div class="xpmeta"><span>${fmt(into)} / ${fmt(n)} XP</span><span>Day ${dayN} of your reset</span></div>
      </div>
    </section>`;
  }

  function streakChip(n, label) {
    return `<span class="streak ${n ? 'hot' : ''}" title="${label}">🔥 ${n}</span>`;
  }

  function vToday() {
    const k = VIEW, T = today(), isT = k === T, st = S.settings;
    const d = peek(k), r = R.days[k], prev = R.days[addDays(k, -1)] || {};
    // A streak is still alive today until the day ends, so show yesterday's count if today isn't done yet.
    const live = (f, met) => (r[met] || !isT ? r[f] : prev[f] || 0);
    const label = parse(k).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    const relative = isT ? 'Today' : k === addDays(T, -1) ? 'Yesterday' : parse(k).toLocaleDateString(undefined, { weekday: 'long' });
    const perfectBonus = 100 + Math.min(prev.spf || 0, 10) * 10;

    // Water
    const glass = st.glass || 250;
    const cups = Math.min(Math.ceil(r.wg / glass), 16), full = Math.floor(d.water / glass);
    const cupRow = Array.from({ length: cups }, (_, i) => `<span class="cup ${i < full ? 'on' : ''}"></span>`).join('');

    // Push-ups
    const tgt = r.target, inc = Math.max(1, st.pushInc | 0);
    const sets = Math.max(3, Math.ceil(tgt / 15)), per = Math.ceil(tgt / sets);

    // Week
    const wk = weekOf(k), week = R.weeks[wk] || { count: 0, done: false, streakBefore: 0 };
    const weekStreak = week.streakBefore + (week.done ? 1 : 0);
    const dots = Array.from({ length: 7 }, (_, i) => {
      const dk = addDays(wk, i), n = peek(dk).workouts.length;
      const letter = parse(dk).toLocaleDateString(undefined, { weekday: 'narrow' });
      return `<div class="wd ${n ? 'on' : ''} ${dk === k ? 'cur' : ''} ${dk > T ? 'future' : ''}"><i>${n > 1 ? n : n ? '✓' : ''}</i><small>${letter}</small></div>`;
    }).join('');

    return `
    ${vHero()}
    <div class="datenav">
      <button class="icon-btn" data-a="day" data-v="-1" aria-label="Previous day">‹</button>
      <div class="dn-label"><b>${relative}</b><small>${label}</small></div>
      <button class="icon-btn" data-a="day" data-v="1" aria-label="Next day" ${isT ? 'disabled' : ''}>›</button>
    </div>
    ${!isT ? `<button class="back-today" data-a="go-today">Editing a past day · back to today</button>` : ''}

    <section class="card perfect ${r.perfect ? 'done' : ''}">
      <div class="row between">
        <h2>Perfect Day</h2>
        <span class="xp-pill">+${fmt(r.xp)} XP</span>
      </div>
      <div class="checks">
        ${check('💧', 'Water', r.wMet)}${check('👟', 'Steps', r.sMet)}${check('💪', 'Push-ups', r.pMet)}
      </div>
      <p class="muted small">${r.perfect
        ? `All three done. ${r.spf > 1 ? `${r.spf}-day perfect streak!` : 'Come back tomorrow to start a streak.'}`
        : `Finish all three for <b>+${perfectBonus} XP</b>. Every day in a row adds +10 (up to +200).`}</p>
    </section>

    <section class="card quest water ${r.wMet ? 'done' : ''}">
      <header>
        <div class="q-icon">💧</div>
        <div class="q-title"><h2>Hydration</h2><p>${fmt(d.water)} / ${fmt(r.wg)} ml</p></div>
        ${streakChip(live('sw', 'wMet'), 'Water streak')}
      </header>
      <div class="cups">${cupRow}</div>
      <div class="bar"><i style="width:${pct(d.water, r.wg)}%"></i></div>
      <div class="row">
        <button class="btn ghost sq" data-a="water" data-v="-${glass}" aria-label="Remove a glass">−</button>
        <button class="btn grow" data-a="water" data-v="${glass}">+ Glass (${glass} ml)</button>
        <button class="btn soft" data-a="water" data-v="500">+500</button>
      </div>
      <footer>5 XP per 250 ml · +50 XP for the goal</footer>
    </section>

    <section class="card quest steps ${r.sMet ? 'done' : ''}">
      <header>
        <div class="q-icon">👟</div>
        <div class="q-title"><h2>Steps</h2><p>${fmt(d.steps)} / ${fmt(r.sg)}</p></div>
        ${streakChip(live('ss', 'sMet'), 'Step streak')}
      </header>
      <div class="bar"><i style="width:${pct(d.steps, r.sg)}%"></i></div>
      <div class="row">
        <input id="steps" class="grow" type="number" inputmode="numeric" min="0" placeholder="Enter total steps" value="${d.steps || ''}" aria-label="Total steps">
        <button class="btn" data-a="steps-set">Save</button>
      </div>
      <div class="row">
        <button class="btn soft grow" data-a="steps-add" data-v="1000">+1k</button>
        <button class="btn soft grow" data-a="steps-add" data-v="2500">+2.5k</button>
        <button class="btn soft grow" data-a="steps-add" data-v="5000">+5k</button>
      </div>
      <footer>10 XP per 1,000 steps · +50 XP for the goal. Copy the total from your phone's health app.</footer>
    </section>

    <section class="card quest push ${r.pMet ? 'done' : ''}">
      <header>
        <div class="q-icon">💪</div>
        <div class="q-title"><h2>Push-ups</h2><p>Progressive overload</p></div>
        ${streakChip(live('sp', 'pMet'), 'Push-up streak')}
      </header>
      <div class="stats3">
        <div><small>Target</small><b>${tgt}</b></div>
        <div><small>Done</small><b>${r.pt}</b></div>
        <div><small>Best</small><b>${R.pr}</b></div>
      </div>
      <div class="bar"><i style="width:${pct(r.pt, tgt)}%"></i></div>
      <p class="hint">${r.pMet
        ? `Target beaten${r.isPR ? ' with a new PR 🏆' : ''}. Your next target is <b>${tgt + inc}</b>.`
        : `Try ${sets} sets of ${per}. Beat ${tgt} and your next target goes up to <b>${tgt + inc}</b>.`}</p>
      <div class="sets">${d.push.length
        ? d.push.map((n, i) => `<button class="set" data-a="push-del" data-v="${i}" aria-label="Remove set of ${n}">${n}<span>×</span></button>`).join('')
        : '<span class="muted small">No sets logged yet</span>'}</div>
      <div class="row">
        <input id="reps" class="grow" type="number" inputmode="numeric" min="1" placeholder="Reps in this set" aria-label="Reps">
        <button class="btn" data-a="push-add">Log set</button>
      </div>
      <div class="row">
        ${[5, 10, 15, 20, 25].map(n => `<button class="btn soft grow" data-a="push-quick" data-v="${n}">${n}</button>`).join('')}
      </div>
      <footer>1 XP per rep · +50 XP for the target · +100 XP for a new best</footer>
    </section>

    <section class="card quest work ${week.done ? 'done' : ''}">
      <header>
        <div class="q-icon">🏋️</div>
        <div class="q-title"><h2>Weekly Workouts</h2><p>${week.count} / ${st.weeklyGoal} this week</p></div>
        <span class="streak ${weekStreak ? 'hot' : ''}" title="Week streak">📅 ${weekStreak}w</span>
      </header>
      <div class="week">${dots}</div>
      <div class="wo-grid">
        ${WORKOUTS.map(w => `<button class="wo" data-a="wo-add" data-v="${w.id}"><span>${w.icon}</span>${w.name}</button>`).join('')}
      </div>
      <label class="mins">Duration
        <select id="mins">${[15, 20, 30, 45, 60, 90, 120].map(m => `<option value="${m}" ${m === 30 ? 'selected' : ''}>${m} min</option>`).join('')}</select>
      </label>
      ${d.workouts.length ? `<ul class="list">${d.workouts.map((w, i) => {
        const t = WORKOUTS.find(x => x.id === w.type) || { icon: '🏋️', name: w.type };
        return `<li><span>${t.icon} ${esc(t.name)} · ${w.min} min</span><button class="x" data-a="wo-del" data-v="${i}" aria-label="Remove workout">×</button></li>`;
      }).join('')}</ul>` : ''}
      <footer>75 XP per workout (2 a day max) · +250 XP for the weekly goal, +50 per week in a row</footer>
    </section>

    <section class="card quest habits">
      <header>
        <div class="q-icon">✅</div>
        <div class="q-title"><h2>Daily Habits</h2><p>${r.hDone} / ${S.habits.length} done</p></div>
      </header>
      <div class="habit-list">
        ${S.habits.map(h => {
          const on = !!d.habits[h.id];
          return `<button class="habit ${on ? 'on' : ''}" data-a="habit" data-v="${esc(h.id)}" aria-pressed="${on}">
            <span class="hi">${esc(h.icon)}</span><span class="hn">${esc(h.name)}</span><span class="tick">${on ? '✓' : ''}</span></button>`;
        }).join('') || '<p class="muted small">Add your own habits in Settings.</p>'}
      </div>
      <footer>15 XP each · edit these in Settings</footer>
    </section>

    <section class="card">
      <h2>${isT ? "Today's" : 'This day’s'} XP</h2>
      ${r.bd.length ? `<ul class="breakdown">${r.bd.map(([l, v]) => `<li><span>${esc(l)}</span><b>+${fmt(v)}</b></li>`).join('')}
        <li class="tot"><span>Total</span><b>+${fmt(r.xp)}</b></li></ul>` : '<p class="muted small">Nothing yet. Drink a glass of water to get going.</p>'}
    </section>`;
  }

  const check = (icon, label, on) => `<div class="chk ${on ? 'on' : ''}"><span>${on ? '✓' : icon}</span><small>${label}</small></div>`;

  function vProgress() {
    const c = R.c, T = today(), lv = R.lv;
    const tile = (label, value, sub = '') => `<div class="tile"><small>${label}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;

    const last14 = Array.from({ length: 14 }, (_, i) => addDays(T, i - 13));
    const maxXP = Math.max(100, ...last14.map(k => R.days[k]?.xp || 0));
    const xpBars = last14.map(k => {
      const v = R.days[k]?.xp || 0;
      return `<div class="b ${k === T ? 'cur' : ''}"><em>${v ? fmt(v) : ''}</em><i style="height:${(v / maxXP) * 100}%"></i><small>${parse(k).toLocaleDateString(undefined, { weekday: 'narrow' })}</small></div>`;
    }).join('');

    const last21 = Array.from({ length: 21 }, (_, i) => addDays(T, i - 20));
    const maxPu = Math.max(10, ...last21.map(k => Math.max(R.days[k]?.pt || 0, R.days[k]?.target || 0)));
    const puBars = last21.map(k => {
      const r = R.days[k];
      if (!r) return '<div class="b"><i style="height:0"></i></div>';
      return `<div class="b ${r.pMet ? 'hit' : ''}"><i style="height:${(r.pt / maxPu) * 100}%"></i><u style="bottom:${(r.target / maxPu) * 100}%"></u></div>`;
    }).join('');

    const gridStart = addDays(weekOf(T), -28);
    const cells = Array.from({ length: 35 }, (_, i) => {
      const k = addDays(gridStart, i), r = R.days[k];
      if (k > T) return '<i class="future"></i>';
      if (!r) return '<i class="l0"></i>';
      const n = (r.wMet ? 1 : 0) + (r.sMet ? 1 : 0) + (r.pMet ? 1 : 0);
      return `<i class="l${n} ${k === T ? 'cur' : ''}" title="${k}: ${n}/3 quests"></i>`;
    }).join('');

    return `
    ${vHero()}
    <section class="card">
      <h2>Stats</h2>
      <div class="tiles">
        ${tile('Level', lv.level, rank(lv.level))}
        ${tile('Total XP', fmt(R.total))}
        ${tile('Perfect days', fmt(c.perfectDays), `best streak ${c.best.spf}`)}
        ${tile('Push-up best', fmt(R.pr), `${fmt(c.lifePush)} lifetime`)}
        ${tile('Lifetime steps', fmt(c.lifeSteps), `best streak ${c.best.ss}`)}
        ${tile('Water drunk', `${(c.lifeWater / 1000).toFixed(1)} L`, `best streak ${c.best.sw}`)}
        ${tile('Workouts', fmt(c.workouts), `${c.weeksDone} goal weeks`)}
        ${tile('Badges', `${Object.keys(R.ach).length}/${ACH.length}`)}
      </div>
    </section>

    <section class="card">
      <h2>XP, last 14 days</h2>
      <div class="chart xp">${xpBars}</div>
    </section>

    <section class="card">
      <h2>Push-ups vs target</h2>
      <p class="muted small">Bars are reps done, lines are that day's target. Green means you beat it.</p>
      <div class="chart pu">${puBars}</div>
    </section>

    <section class="card">
      <h2>Last 5 weeks</h2>
      <p class="muted small">Darker squares mean more of water, steps and push-ups were done.</p>
      <div class="heat-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<small>${x}</small>`).join('')}</div>
      <div class="heat">${cells}</div>
    </section>`;
  }

  function vBadges() {
    const got = Object.keys(R.ach).length;
    return `
    <section class="card">
      <h2>Badges</h2>
      <p class="muted small">${got} of ${ACH.length} unlocked. Each one gives bonus XP.</p>
      <div class="bar"><i style="width:${pct(got, ACH.length)}%"></i></div>
    </section>
    <div class="badges">
      ${ACH.map(a => {
        const when = R.ach[a.id];
        return `<div class="badge ${when ? 'on' : ''}">
          <div class="bi">${when ? a.icon : '🔒'}</div>
          <b>${a.name}</b>
          <small>${a.desc}</small>
          <span class="bx">${when ? parse(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : `+${a.xp} XP`}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function vSettings() {
    const st = S.settings;
    const num = (id, label, v, min, max, step = 1, unit = '') => `
      <label class="field"><span>${label}</span>
        <span class="inp"><input id="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" step="${step}" value="${v}">${unit ? `<em>${unit}</em>` : ''}</span>
      </label>`;
    return `
    <section class="card">
      <h2>Profile & goals</h2>
      <label class="field"><span>Your name</span><span class="inp"><input id="s-name" type="text" maxlength="24" value="${esc(st.name)}" placeholder="Hero"></span></label>
      ${num('s-water', 'Daily water goal', st.waterGoal, 500, 6000, 250, 'ml')}
      ${num('s-glass', 'Glass size', st.glass, 100, 1000, 50, 'ml')}
      ${num('s-steps', 'Daily step goal', st.stepsGoal, 1000, 50000, 500, 'steps')}
      ${num('s-week', 'Workouts per week', st.weeklyGoal, 1, 14, 1, '/ week')}
      ${num('s-pstart', 'Push-up starting target', st.pushStart, 1, 500, 1, 'reps')}
      ${num('s-pinc', 'Add this many after each win', st.pushInc, 1, 20, 1, 'reps')}
      <label class="field"><span>Theme</span><span class="inp">
        <select id="s-theme">${[['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${st.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </span></label>
      <p class="muted small">Changing the push-up numbers recalculates your target history. Water and step goals apply from today.</p>
      <button class="btn wide" data-a="save-settings">Save settings</button>
    </section>

    <section class="card">
      <h2>Daily habits</h2>
      <ul class="list">
        ${S.habits.map((h, i) => `<li><span>${esc(h.icon)} ${esc(h.name)}</span><button class="x" data-a="habit-del" data-v="${i}" aria-label="Remove habit">×</button></li>`).join('')}
      </ul>
      <div class="row">
        <input id="h-icon" class="sq-in" type="text" maxlength="4" placeholder="🙂" aria-label="Habit emoji">
        <input id="h-name" class="grow" type="text" maxlength="40" placeholder="e.g. Cold shower" aria-label="Habit name">
        <button class="btn" data-a="habit-add">Add</button>
      </div>
    </section>

    <section class="card">
      <h2>How XP works</h2>
      <ul class="rules">
        <li><b>Water:</b> 5 XP per 250 ml, +50 for hitting your goal.</li>
        <li><b>Steps:</b> 10 XP per 1,000 steps, +50 for your goal.</li>
        <li><b>Push-ups:</b> 1 XP per rep, +50 for beating the target, +100 for a new best. Beat the target and it goes up by your step size next time. Miss it twice in a row and it eases back.</li>
        <li><b>Workouts:</b> 75 XP each (2 a day max). Hit your weekly goal for +250, plus +50 for each week in a row.</li>
        <li><b>Habits:</b> 15 XP each.</li>
        <li><b>Perfect day:</b> water, steps and push-ups all done gives +100, plus +10 per day in a row (up to +200).</li>
        <li><b>Badges:</b> one-off XP bonuses for milestones.</li>
        <li><b>Levels</b> get steadily harder: level 2 takes 120 XP, level 10 takes about 3,800.</li>
      </ul>
    </section>

    <section class="card">
      <h2>Your data</h2>
      <p class="muted small">Everything is saved on this device only. Export a backup now and then, especially before switching phones.</p>
      <div class="row">
        <button class="btn soft grow" data-a="export">Export backup</button>
        <button class="btn soft grow" data-a="import">Import backup</button>
      </div>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
      <button class="btn danger wide" data-a="reset">Reset everything</button>
    </section>`;
  }

  function vOnboard() {
    const st = S.settings;
    return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div class="modal-card onboard">
        <div class="ob-logo">⚡</div>
        <h2 id="ob-title">Start your life reset</h2>
        <p class="muted">Earn XP for the basics: water, steps, push-ups and workouts. Level up, keep your streaks alive and unlock badges.</p>
        <label class="field"><span>What should we call you?</span><span class="inp"><input id="o-name" type="text" maxlength="24" placeholder="Hero"></span></label>
        <label class="field"><span>Push-ups you can do comfortably today</span><span class="inp"><input id="o-push" type="number" inputmode="numeric" min="1" max="500" value="${st.pushStart}"><em>reps</em></span></label>
        <label class="field"><span>Daily step goal</span><span class="inp"><input id="o-steps" type="number" inputmode="numeric" min="1000" max="50000" step="500" value="${st.stepsGoal}"><em>steps</em></span></label>
        <label class="field"><span>Workouts per week</span><span class="inp"><input id="o-week" type="number" inputmode="numeric" min="1" max="14" value="${st.weeklyGoal}"><em>/ week</em></span></label>
        <button class="btn wide big" data-a="onboard">Begin Day 1</button>
      </div>
    </div>`;
  }

  /* ---------- rendering & feedback ---------- */
  function render() {
    $('#main').innerHTML = TAB === 'today' ? vToday() : TAB === 'progress' ? vProgress() : TAB === 'badges' ? vBadges() : vSettings();
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.v === TAB));
    const ob = document.querySelector('.modal.ob');
    if (!S.onboarded && !ob) {
      const wrap = document.createElement('div');
      wrap.innerHTML = vOnboard();
      wrap.firstElementChild.classList.add('ob');
      document.body.append(wrap.firstElementChild);
    }
  }

  function applyTheme() {
    const t = S.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }

  function toast(html, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.innerHTML = html;
    $('#toasts').append(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  function floatXP(n) {
    const el = document.createElement('div');
    el.className = 'float-xp';
    el.textContent = `+${fmt(n)} XP`;
    document.body.append(el);
    setTimeout(() => el.remove(), 1200);
    buzz(12);
  }

  function showLevelUp(L) {
    const colors = ['#ffd34d', '#8b6dff', '#2ec4b6', '#ff6b6b', '#4da3ff'];
    const bits = Array.from({ length: 36 }, (_, i) => {
      const x = (Math.random() * 2 - 1) * 160, y = -60 - Math.random() * 200, r = Math.random() * 720;
      return `<i style="--x:${x}px;--y:${y}px;--r:${r}deg;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.15}s"></i>`;
    }).join('');
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="modal-card levelup" role="dialog" aria-modal="true">
      <div class="confetti">${bits}</div>
      <small>LEVEL UP</small>
      <div class="big">${L}</div>
      <p>You are now <b>${rank(L)}</b> rank.</p>
      <p class="muted small">${fmt(need(L))} XP to level ${L + 1}.</p>
      <button class="btn wide" data-a="close-modal">Keep going</button>
    </div>`;
    document.body.append(m);
    buzz([30, 60, 30, 60, 80]);
  }

  function commit() {
    save();
    const before = R;
    R = compute();
    const gain = R.total - before.total;
    if (gain > 0) floatXP(gain);
    if (R.lv.level > S.level) showLevelUp(R.lv.level);
    S.level = R.lv.level;
    for (const id of Object.keys(R.ach)) {
      if (!S.seenAch[id]) {
        S.seenAch[id] = 1;
        const a = ACH.find(x => x.id === id);
        toast(`<span class="ti">${a.icon}</span><div><small>Badge unlocked</small><b>${a.name}</b> +${a.xp} XP</div>`, 'gold');
      }
    }
    save();
    render();
  }

  const mut = fn => { fn(day(VIEW)); commit(); };

  /* ---------- actions ---------- */
  const ACT = {
    tab: v => { TAB = v; render(); window.scrollTo(0, 0); },
    day: v => {
      const n = addDays(VIEW, +v);
      if (n > today() || n < addDays(S.start, -60)) return;
      VIEW = n; R = compute(); render();
    },
    'go-today': () => { VIEW = today(); R = compute(); render(); },
    water: v => mut(d => { d.water = clamp(d.water + Number(v), 0, 20000); }),
    'steps-set': () => {
      const x = int($('#steps').value, 0, 200000, NaN);
      if (Number.isNaN(x)) return;
      mut(d => { d.steps = x; });
    },
    'steps-add': v => mut(d => { d.steps = clamp(d.steps + Number(v), 0, 200000); }),
    'push-add': () => {
      const x = int($('#reps').value, 1, 1000, NaN);
      if (Number.isNaN(x)) return;
      mut(d => { d.push.push(x); });
    },
    'push-quick': v => mut(d => { d.push.push(Number(v)); }),
    'push-del': v => mut(d => { d.push.splice(Number(v), 1); }),
    'wo-add': v => {
      const min = int($('#mins')?.value, 5, 600, 30);
      mut(d => { d.workouts.push({ type: v, min }); });
      const w = WORKOUTS.find(x => x.id === v);
      toast(`<span class="ti">${w.icon}</span><div><small>Workout logged</small><b>${w.name}</b> · ${min} min</div>`);
    },
    'wo-del': v => mut(d => { d.workouts.splice(Number(v), 1); }),
    habit: v => mut(d => { d.habits[v] = !d.habits[v]; }),

    'save-settings': () => {
      const st = S.settings;
      st.name = $('#s-name').value.trim().slice(0, 24);
      st.waterGoal = int($('#s-water').value, 500, 6000, st.waterGoal);
      st.glass = int($('#s-glass').value, 100, 1000, st.glass);
      st.stepsGoal = int($('#s-steps').value, 1000, 50000, st.stepsGoal);
      st.weeklyGoal = int($('#s-week').value, 1, 14, st.weeklyGoal);
      st.pushStart = int($('#s-pstart').value, 1, 500, st.pushStart);
      st.pushInc = int($('#s-pinc').value, 1, 20, st.pushInc);
      st.theme = $('#s-theme').value;
      const t = S.days[today()];
      if (t) { t.wg = st.waterGoal; t.sg = st.stepsGoal; }
      applyTheme();
      commit();
      toast('Settings saved');
    },
    'habit-add': () => {
      const name = $('#h-name').value.trim().slice(0, 40);
      if (!name) return;
      const icon = $('#h-icon').value.trim().slice(0, 4) || '⭐';
      S.habits.push({ id: `h_${Date.now().toString(36)}`, icon, name });
      commit();
    },
    'habit-del': v => {
      const h = S.habits[Number(v)];
      if (h && confirm(`Remove "${h.name}"? XP already earned from it will be removed too.`)) {
        S.habits.splice(Number(v), 1);
        commit();
      }
    },
    export: () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `lifequest-backup-${today()}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import: () => $('#import-file').click(),
    reset: () => {
      if (!confirm('Delete all your progress, XP and badges? This cannot be undone.')) return;
      try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
      S = defaults(); VIEW = today(); TAB = 'today';
      R = compute(); applyTheme(); render();
    },
    onboard: () => {
      const st = S.settings;
      st.name = $('#o-name').value.trim().slice(0, 24);
      st.pushStart = int($('#o-push').value, 1, 500, st.pushStart);
      st.stepsGoal = int($('#o-steps').value, 1000, 50000, st.stepsGoal);
      st.weeklyGoal = int($('#o-week').value, 1, 14, st.weeklyGoal);
      S.onboarded = true;
      S.start = today();
      document.querySelector('.modal.ob')?.remove();
      commit();
      toast(`<span class="ti">⚡</span><div><small>Day 1</small><b>Your reset starts now</b></div>`, 'gold');
    },
    'close-modal': (v, el) => el.closest('.modal').remove(),
  };

  document.addEventListener('click', e => {
    // Tapping the dark area around a level-up popup closes it.
    if (e.target.classList?.contains('modal') && !e.target.classList.contains('ob')) { e.target.remove(); return; }
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = ACT[el.dataset.a];
    if (fn) fn(el.dataset.v, el);
  });

  // Enter key in the number boxes saves them.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const map = { steps: 'steps-set', reps: 'push-add', 'h-name': 'habit-add' };
    const a = map[e.target.id];
    if (a) { e.preventDefault(); ACT[a](); }
  });

  document.addEventListener('change', e => {
    if (e.target.id !== 'import-file' || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.days !== 'object') throw new Error('bad file');
        if (!confirm('Replace your current progress with this backup?')) return;
        S = normalise(data);
        VIEW = today();
        applyTheme();
        commit();
        toast('Backup imported');
      } catch (err) {
        toast("That file doesn't look like a Life Quest backup.");
      }
    };
    reader.readAsText(e.target.files[0]);
    e.target.value = '';
  });

  // Roll over to a new day if the app stays open past midnight.
  const checkDay = () => {
    const t = today();
    if (t !== lastToday) {
      if (VIEW === lastToday) VIEW = t;
      lastToday = t;
      R = compute(); render();
    }
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
  setInterval(checkDay, 60000);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  }

  S.level = R.lv.level;
  applyTheme();
  render();
})();
