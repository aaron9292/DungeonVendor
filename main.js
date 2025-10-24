// ============================
// Global state
// ============================
const state = {
  items: [],
  target: { d: 0, a: 0, s: 0 },
  selected: [],
  rng: null,
  daily: { diffIndex: 0, round: 0 } // 0-based
};

// ============================
// Utilities
// ============================
function round2(x){ return Math.round(x * 100) / 100; }

function roll(min, max, rng) {
  const r = rng || state.rng || Math.random;
  return Math.floor(r() * (max - min + 1)) + min;
}

function pick(arr, rng) {
  const r = rng || state.rng || Math.random;
  return arr[Math.floor(r() * arr.length)];
}

function pickItems(pool, n, rng) {
  const r = rng || state.rng || Math.random;
  const copy = pool.slice();
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const j = Math.floor(r() * copy.length);
    out.push(copy.splice(j, 1)[0]);
  }
  return out;
}

function fmtMod(add, mult){
  const a = (add >= 0 ? '+' : '') + add;
  return mult === 1 ? a : a + ' ×' + mult;
}

function statRow(icon, add, mult){
  return '<div class="stat-row">' + icon + ' <b>' + fmtMod(add, mult) + '</b></div>';
}

// ============================
// Item pool (your originals)
// ============================
const BASE_ITEMS = [
  { name: 'Sword',            image: 'sword.png' },
  { name: 'Dagger',           image: 'dagger.png' },
  { name: 'Heavy Shield',     image: 'heavy shield.png' },
  { name: 'Leather Armor',    image: 'leather armor.png' },
  { name: 'Cloak of Shade',   image: 'cloak of shade.png' },
  { name: 'Warhammer',        image: 'warhammer.png' },
  { name: 'Silent Boots',     image: 'silent boots.png' },
  { name: 'Thorns Mail',      image: 'thorn mail.png' },
  { name: 'Blessed Charm',    image: 'blessed charm.png' },
  { name: 'Throwing Knives',  image: 'throwing knives.png' },
  { name: 'Tower Shield',     image: 'tower shield.png' },
  { name: 'Feather Cape',     image: 'feather cape.png' },
  { name: 'Spiked Gauntlet',  image: 'spiked gauntlet.png' },
  { name: 'Plain Ring',       image: 'plain ring.png' },
  { name: 'Adept Band',       image: 'adept band.png' }
];

// ============================
// Difficulty config
// ============================
const DIFF_ORDER = ['Easy', 'Medium', 'Hard'];

const DIFFICULTY_SETTINGS = {
  Easy:  { poolSize: 6, solutionSizeRange: [3,3], statRange: [-3,3], allowMult: false },
  Medium:{ poolSize: 9, solutionSizeRange: [4,5], statRange: [-3,3], allowMult: true, multChance: .25 },
  Hard:  { poolSize: 9, solutionSizeRange: [4,6], statRange: [-5,5], allowMult: true, multChance: .5 }
};

function curDiffName(){ return DIFF_ORDER[state.daily.diffIndex]; }

// ============================
// Target / Totals rendering
// ============================
function renderTargets(){
  const t = state.target || { d:0, a:0, s:0 };
  const TR = document.getElementById('targetsRow');
  if(!TR) return;
  TR.innerHTML =
    '<div class="stat">⚔️ <small>Damage</small> <b>'+t.d+'</b></div>' +
    '<div class="stat">🛡️ <small>Armor</small> <b>'+t.a+'</b></div>' +
    '<div class="stat">🕵️ <small>Stealth</small> <b>'+t.s+'</b></div>';

    const count = state.solutionCount || '?';
    const countDiv = document.createElement('div');
    countDiv.className = 'stat solution-count';
    countDiv.innerHTML = `🧩 <small>Items in Solution</small> <b>${count}</b>`;
  
    TR.appendChild(countDiv);
}

function computeTotals(selectedIds){
  const add = { d:0, a:0, s:0 };
  const mul = { d:1, a:1, s:1 };
  for (const id of (selectedIds || [])) {
    const it = state.items.find(x => x.id === id);
    if(!it) continue;
    add.d += it.add.d; add.a += it.add.a; add.s += it.add.s;
    mul.d *= it.mult.d; mul.a *= it.mult.a; mul.s *= it.mult.s;
  }
  return { d: round2(add.d*mul.d), a: round2(add.a*mul.a), s: round2(add.s*mul.s) };
}

function updateTotals(){
  const TR = document.getElementById('totalsRow');
  if(!TR) return;
  const t = computeTotals(state.selected);
  TR.innerHTML =
    '<div class="stat">⚔️ <small>Damage</small> <b>'+t.d+'</b></div>' +
    '<div class="stat">🛡️ <small>Armor</small> <b>'+t.a+'</b></div>' +
    '<div class="stat">🕵️ <small>Stealth</small> <b>'+t.s+'</b></div>';
}

function isSolved(){
  const t = state.target;
  const cur = computeTotals(state.selected);
  return (cur.d === t.d) && (cur.a === t.a) && (cur.s === t.s);
}

// ============================
// Build a solvable round
// ============================
function buildSolvableFromHiddenSolution(cfg) {
  const rng = state.rng || Math.random;
  const settings = DIFFICULTY_SETTINGS[cfg.name || cfg];

  // 1) Pick subset to show
  const subset = pickItems(BASE_ITEMS, settings.poolSize, rng);

  // 2) Assign stats to that subset
  const withStats = subset.map((item, i) => {
    let mult = { d:1, a:1, s:1 };
    if (settings.allowMult) {
      mult = {
        d: rng() < settings.multChance ? pick([2,3], rng) : 1,
        a: rng() < settings.multChance ? pick([2,3], rng) : 1,
        s: rng() < settings.multChance ? pick([2,3], rng) : 1
      };
    }
    return {
      id: i + 1,
      name: item.name,
      image: item.image,
      add: {
        d: roll(settings.statRange[0], settings.statRange[1], rng),
        a: roll(settings.statRange[0], settings.statRange[1], rng),
        s: roll(settings.statRange[0], settings.statRange[1], rng)
      },
      mult
    };
  });

  state.items = withStats;

  // 3) Hidden solution
  const [minSol, maxSol] = settings.solutionSizeRange;
  const solLen = roll(minSol, maxSol, rng);
  const solution = pickItems(withStats, solLen, rng);
  state.solutionCount = solLen;

  // 4) Compute the target
  const add = { d:0, a:0, s:0 };
  const mul = { d:1, a:1, s:1 };
  for (const it of solution) {
    add.d += it.add.d; add.a += it.add.a; add.s += it.add.s;
    mul.d *= it.mult.d; mul.a *= it.mult.a; mul.s *= it.mult.s;
  }
  state.target = {
    d: round2(add.d * mul.d),
    a: round2(add.a * mul.a),
    s: round2(add.s * mul.s)
  };
}

// ============================
// UI: header + render cards
// ============================
function updateHeader(){
  const el = document.getElementById('dailyStatus') || document.getElementById('gameTitle');
  if(!el) return;
  el.textContent = `Daily • ${curDiffName()} • Round ${state.daily.round+1}/3`;
}

function render(){
  renderTargets();
  const grid = document.getElementById('itemsGrid');
  if(!grid) return;
  grid.innerHTML = '';

  state.items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    if (state.selected.includes(item.id)) card.classList.add('selected');

    card.innerHTML =
      '<img src="images/'+item.image+'" class="item-img" alt="'+item.name+'" />' +
      '<h3>'+item.name+'</h3>' +
      '<div class="mods">' +
        statRow('⚔️', item.add.d, item.mult.d) +
        statRow('🛡️', item.add.a, item.mult.a) +
        statRow('🕵️', item.add.s, item.mult.s) +
      '</div>';

    card.onclick = () => {
      if (state.selected.includes(item.id)) {
        state.selected = state.selected.filter(i => i !== item.id);
        card.classList.remove('selected');
      } else {
        state.selected.push(item.id);
        card.classList.add('selected');
      }
      updateTotals();
      renderTargets();
    };

    grid.appendChild(card);
  });

  updateTotals();
}

// ============================
// Daily progression
// ============================
function nextDailyRound(reset=false){
  if (reset){ state.daily.diffIndex = 0; state.daily.round = 0; }
  buildSolvableFromHiddenSolution({ name: curDiffName() });
  state.selected = [];
  updateHeader();
  render();
}

function advanceAfterSuccess(){
  if (state.daily.round < 2){
    state.daily.round += 1;
  } else if (state.daily.diffIndex < DIFF_ORDER.length - 1){
    state.daily.diffIndex += 1;
    state.daily.round = 0;
  } else {
    const logEl = document.getElementById('log');
    if (logEl) logEl.textContent = 'Daily complete! 🎉';
    return;
  }
  nextDailyRound();
}

// ============================
// Wire buttons & boot
// ============================
window.addEventListener('DOMContentLoaded', () => {
  state.rng = Math.random;
  nextDailyRound(true);

  const submitBtn = document.getElementById('btnSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', function(){
      const logEl = document.getElementById('log');
      if (isSolved()){
        if (logEl) logEl.textContent = '✅ Correct! Advancing…';
        advanceAfterSuccess();
      } else {
        if (logEl) logEl.textContent = '❌ Not quite. Keep tweaking your loadout.';
      }
    });
  }

  const clearBtn = document.getElementById('btnClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function(){
      state.selected = [];
      document.querySelectorAll('.item-card.selected').forEach(el => el.classList.remove('selected'));
      updateTotals();
    });
  }
});

// ============================
// Settings toggle
// ============================
(function setupSettingsMenu(){
  const settingsBtn =
    document.getElementById('btnSettings') ||
    document.getElementById('settingsBtn') ||
    document.querySelector('.settings-btn');

  const settingsMenu =
    document.getElementById('settingsMenu') ||
    document.querySelector('.settings-menu');

  if (!settingsBtn || !settingsMenu) return;

  if (!settingsBtn.getAttribute('type')) settingsBtn.setAttribute('type', 'button');

  function toggleMenu(e){
    e.stopPropagation();
    settingsMenu.classList.toggle('is-open');
  }
  settingsBtn.addEventListener('click', toggleMenu);

  document.addEventListener('click', (e)=>{
    if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
      settingsMenu.classList.remove('is-open');
    }
  });

  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') settingsMenu.classList.remove('is-open');
  });
})();

// ============================
// Settings actions
// ============================
(function setupSettingsActions(){
  const themeBtn =
    document.getElementById('darkModeToggle') ||
    document.getElementById('btnTheme') ||
    document.getElementById('menuTheme') ||
    document.querySelector('[data-action="toggle-theme"]');

  const howBtn =
    document.getElementById('howItWorksBtn') ||
    document.getElementById('menuHow') ||
    document.querySelector('[data-action="how"]');

  // ------------- Dark Mode toggle -------------
  function applyTheme(theme){
    if (theme === 'dark'){
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
    }
    try { localStorage.setItem('theme', theme); } catch(e){}
  }

  (function initThemeFromStorage(){
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') applyTheme(saved);
    } catch(e){}
  })();

  if (themeBtn){
    if (!themeBtn.getAttribute('type')) themeBtn.setAttribute('type', 'button');
    themeBtn.addEventListener('click', function(e){
      e.stopPropagation();
      const cur = (document.documentElement.getAttribute('data-theme') || (document.body.classList.contains('dark') ? 'dark' : 'light'));
      applyTheme(cur === 'dark' ? 'light' : 'dark');
      // keep menu open
    });
  }

  // ------------- How it works modal -------------
  const hiwBtn = howBtn;
  const hiwPopup = document.getElementById('howItWorksPopup');

  if (hiwBtn && hiwPopup){
    hiwBtn.addEventListener('click', (e) => {
      e.stopPropagation();                 // avoid the global closer
      hiwPopup.classList.remove('hidden');
    });

    // Clicking anywhere closes it
    document.addEventListener('click', () => {
      if (!hiwPopup.classList.contains('hidden')) {
        hiwPopup.classList.add('hidden');
      }
    });

    // Escape closes it
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !hiwPopup.classList.contains('hidden')) {
        hiwPopup.classList.add('hidden');
      }
    });
  }

  // ============================
// CLICK SOUND FINAL FIX
// ============================
window.addEventListener("DOMContentLoaded", () => {
  const clickSound = document.getElementById("clickSound");
  if (!clickSound) return;

  let audioUnlocked = false;

  // Unlock audio context on the very first user click
  document.addEventListener("pointerdown", () => {
    if (!audioUnlocked) {
      const silent = clickSound.cloneNode(true);
      silent.volume = 0;
      silent.play().catch(() => {});
      audioUnlocked = true;
    }
  }, { once: true });

  function playClick() {
    const s = clickSound.cloneNode(true);
    s.volume = 0.4;
    s.play().catch(err => console.warn("Audio blocked:", err));
  }

  // Buttons
  const ids = ["btnSubmit", "btnClear", "btnSettings", "darkModeToggle", "howItWorksBtn"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", playClick);
  });

  // Dynamically created item cards
  const observer = new MutationObserver(() => {
    document.querySelectorAll(".item-card").forEach(el => {
      if (!el.dataset.clickBound) {
        el.addEventListener("click", playClick);
        el.dataset.clickBound = "true";
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

})();
