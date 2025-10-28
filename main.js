// ============================
// Global state
// ============================
const state = {
  items: [],
  target: { d: 0, a: 0, s: 0 },
  selected: [],
  rng: null,
  daily: { diffIndex: 0, round: 0 }, // 0-based
  solutionCount: 0
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
// Item pool
// ============================
const BASE_ITEMS = [
  { name: 'Sword', image: 'sword.png' },
  { name: 'Dagger', image: 'dagger.png' },
  { name: 'Heavy Shield', image: 'heavy shield.png' },
  { name: 'Leather Armor', image: 'leather armor.png' },
  { name: 'Cloak of Shade', image: 'cloak of shade.png' },
  { name: 'Warhammer', image: 'warhammer.png' },
  { name: 'Silent Boots', image: 'silent boots.png' },
  { name: 'Thorns Mail', image: 'thorn mail.png' },
  { name: 'Blessed Charm', image: 'blessed charm.png' },
  { name: 'Throwing Knives', image: 'throwing knives.png' },
  { name: 'Tower Shield', image: 'tower shield.png' },
  { name: 'Feather Cape', image: 'feather cape.png' },
  { name: 'Spiked Gauntlet', image: 'spiked gauntlet.png' },
  { name: 'Plain Ring', image: 'plain ring.png' },
  { name: 'Adept Band', image: 'adept band.png' }
];

// ============================
// Difficulty config
// ============================
const DIFF_ORDER = ['Easy', 'Medium', 'Hard'];

const DIFFICULTY_SETTINGS = {
  Easy:  { poolSize: 6, solutionSizeRange: [3,3], statRange: [-3,3], allowMult: false },
  Medium:{ poolSize: 6, solutionSizeRange: [3,4], statRange: [-3,3], allowMult: true, multChance: .25 },
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
// Save / Load Puzzle (Persistence)
// ============================
function savePuzzleState(){
  try {
    const data = {
      items: state.items,
      target: state.target,
      difficulty: state.daily.diffIndex,
      round: state.daily.round,
      solutionCount: state.solutionCount
    };
    localStorage.setItem('dungeonVendorPuzzle', JSON.stringify(data));
  } catch(e){ console.warn('Save failed', e); }
}

function loadSavedPuzzle(){
  try {
    const raw = localStorage.getItem('dungeonVendorPuzzle');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch(e){
    console.warn('Load failed', e);
    return null;
  }
}

function clearSavedPuzzle(){
  localStorage.removeItem('dungeonVendorPuzzle');
}

// ============================
// Build a solvable round
// ============================
function buildSolvableFromHiddenSolution(cfg) {
  const rng = state.rng || Math.random;

  const diffKey = (typeof cfg === 'string') ? cfg : (cfg.name || curDiffName());
  const settings = DIFFICULTY_SETTINGS[cfg.name || cfg];
  const subset = pickItems(BASE_ITEMS, settings.poolSize, rng);

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
  const [minSol, maxSol] = settings.solutionSizeRange;
  const solLen = roll(minSol, maxSol, rng);
  const solution = pickItems(withStats, solLen, rng);
  state.solutionCount = solLen;

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

  savePuzzleState(); // ✅ save automatically
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

function advanceAfterSuccess() {
  const logEl = document.getElementById('log');

  // ---- Advance to next round or difficulty ----
  if (state.daily.round < 2) {
    state.daily.round += 1;
  } else if (state.daily.diffIndex < DIFF_ORDER.length - 1) {
    state.daily.diffIndex += 1;
    state.daily.round = 0;
  } else {
    if (logEl) logEl.textContent = '🏆 All difficulties complete! Daily done!';
    clearSavedPuzzle();
    return;
  }

  // ---- Clear and generate a fresh puzzle with the new difficulty ----
  clearSavedPuzzle();
  nextDailyRound(false); // don't reset everything
  if (logEl) {
    logEl.textContent = `➡️ Advanced to ${curDiffName()} • Round ${state.daily.round + 1}/3`;
  }
}

function nextDailyRound(reset = false) {
  if (reset) {
    state.daily.diffIndex = 0;
    state.daily.round = 0;
  }

  const diffName = curDiffName();
  console.log(`Generating new puzzle: ${diffName} Round ${state.daily.round + 1}`);
  
  buildSolvableFromHiddenSolution({ name: diffName });
  state.selected = [];
  updateHeader();
  render();
}

// ============================
// CLICK SOUND (restored)
// ============================
window.addEventListener("DOMContentLoaded", () => {
  const clickSound = document.getElementById("clickSound");
  if (!clickSound) return;

  let audioUnlocked = false;

  // Unlock audio context on first user input
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

  // Static buttons
  const ids = ["btnSubmit", "btnClear", "btnSettings", "darkModeToggle", "howItWorksBtn"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", playClick);
  });

  // Dynamic elements (item cards)
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


// ============================
// FINAL DAILY RESET + SAFE BOOT FIX
// ============================

(function safeBoot() {
  // Wait until all functions (like render) are defined
  const checkReady = () => {
    if (typeof render !== "function" || typeof nextDailyRound !== "function") {
      // Try again in a bit if not ready
      return setTimeout(checkReady, 100);
    }

    // Once ready, hook into DOMContentLoaded
    window.addEventListener("DOMContentLoaded", () => {
      state.rng = Math.random;

      const today = new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" });
      let saved = null;

      try {
        const raw = localStorage.getItem("dungeonVendorPuzzle");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.date === today) {
            saved = parsed;
          } else {
            console.log("🕛 New day detected — clearing previous puzzle data");
            clearSavedPuzzle();
          }
        }
      } catch (e) {
        console.warn("⚠️ Error reading saved puzzle:", e);
        clearSavedPuzzle();
      }

      if (saved && saved.items && saved.items.length) {
        console.log("Restoring saved puzzle:", saved);
        state.items = saved.items;
        state.target = saved.target;
        state.daily.diffIndex = saved.difficulty ?? 0;
        state.daily.round = saved.round ?? 0;
        state.solutionCount = saved.solutionCount ?? "?";
        updateHeader();
        render();
      } else {
        console.log("🔄 Building new daily puzzle...");
        state.daily.diffIndex = 0;
        state.daily.round = 0;
        nextDailyRound(true);
      }

      const submitBtn = document.getElementById("btnSubmit");
      if (submitBtn) {
        submitBtn.addEventListener("click", function(){
          const logEl = document.getElementById("log");
          if (isSolved()){
            if (logEl) logEl.textContent = "✅ Correct! Advancing…";
            advanceAfterSuccess();
          } else {
            if (logEl) logEl.textContent = "❌ Not quite. Keep tweaking your loadout.";
          }
        });
      }

      const clearBtn = document.getElementById("btnClear");
      if (clearBtn) {
        clearBtn.addEventListener("click", function(){
          state.selected = [];
          document.querySelectorAll(".item-card.selected").forEach(el => el.classList.remove("selected"));
          updateTotals();
        });
      }
    });
  };

  checkReady();
})();
