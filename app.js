const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CATEGORY_ICONS = {
  "General": "🌿", "Trees": "🌳", "Shrubs": "🌸", "Edibles": "🍓",
  "Evergreens": "🌲", "Ferns": "🌿", "Grasses": "🌾", "Vine": "🍃",
  "Ground Covers": "🍀", "Perennials": "💐"
};

let data = {};
let images = {};
let currentView = "stack";
let gridMonth = new Date().getMonth(); // 0-indexed
let gridYear = new Date().getFullYear();

// State
function stateKey(year, month, plant) {
  return `wg_${year}_${month}_${plant}`;
}
function getState(year, month, plant) {
  return localStorage.getItem(stateKey(year, month, plant)) || "pending";
}
function setState(year, month, plant, state) {
  localStorage.setItem(stateKey(year, month, plant), state);
}

// Current month tasks (stack view always uses real current month)
const NOW = new Date();
const CURRENT_MONTH = MONTHS[NOW.getMonth()];
const CURRENT_YEAR = NOW.getFullYear();

function getMonthTasks(year, month0) {
  // Returns [{plant, data, state}] for plants with tasks in given month (0-indexed)
  const monthName = MONTHS[month0];
  return Object.entries(data)
    .filter(([, d]) => d.tasks[monthName])
    .map(([plant, d]) => ({
      plant,
      data: d,
      task: d.tasks[monthName],
      state: getState(year, month0, plant)
    }));
}

// ── Stack view ───────────────────────────────────────────────
let stackItems = [];     // [{plant, data, task, state}]
let stackIndex = 0;      // current top card index

function initStack() {
  const all = getMonthTasks(CURRENT_YEAR, NOW.getMonth());
  // pending + later first, done/wont_do at end (already dismissed)
  const pending = all.filter(i => i.state === "pending" || i.state === "later");
  const done    = all.filter(i => i.state === "done" || i.state === "wont_do");
  stackItems = [...pending, ...done];
  stackIndex = 0;
  renderStack();
}

function renderStack() {
  const view = document.getElementById("stack-view");

  const pending = stackItems.filter(i => i.state !== "done" && i.state !== "wont_do");
  const done    = stackItems.filter(i => i.state === "done" || i.state === "wont_do");
  const total   = stackItems.length;
  const remaining = pending.length;

  // Progress
  document.querySelector(".progress-fill").style.width =
    total ? `${((total - remaining) / total) * 100}%` : "0%";

  // Meta line
  view.querySelector(".stack-meta .remaining").textContent =
    remaining > 0 ? `${remaining} of ${total} remaining` : `All ${total} tasks addressed`;

  // Card stage
  const stage = view.querySelector(".card-stage");
  stage.innerHTML = "";

  if (remaining === 0) {
    stage.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <div class="empty-state-title">All done for ${CURRENT_MONTH}!</div>
        <div class="empty-state-text">Check the grid view to review past months or see what's coming up.</div>
      </div>`;
  } else {
    // Render top 3 pending cards (for stacking depth effect)
    const cards = pending.slice(0, 3);
    // Render in reverse so top card is first in DOM (highest z-index via explicit z-index)
    [...cards].reverse().forEach((item, revIdx) => {
      const card = buildCard(item, revIdx === cards.length - 1);
      stage.prepend(card);
    });
    // Top card is firstChild (prepended last = highest in DOM order = z-index 10)
    attachSwipe(stage.firstChild, pending[0]);
  }

  // Done list
  const doneSection = view.querySelector(".done-section");
  if (done.length === 0) {
    doneSection.innerHTML = "";
    return;
  }
  doneSection.innerHTML = `
    <div class="done-section-title">Addressed</div>
    <div class="done-list">
      ${done.map(item => {
        const img = images[item.plant];
        const icon = CATEGORY_ICONS[item.data.category] || "🌿";
        const initial = item.plant[0];
        const imgEl = img
          ? `<img class="done-card-img" src="${img}" alt="${item.plant}" loading="lazy">`
          : `<div class="done-card-img" style="display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#059669;">${initial}</div>`;
        const statusLabel = item.state === "done"
          ? `<span class="status-done">✓ Done</span>`
          : `<span class="status-wont">✗ Won't do</span>`;
        return `
          <div class="done-card">
            ${imgEl}
            <div class="done-card-info">
              <div class="done-card-name">${item.plant}</div>
              <div class="done-card-status">${statusLabel}</div>
            </div>
          </div>`;
      }).join("")}
    </div>`;
}

function buildCard(item, isTop) {
  const img = images[item.plant];
  const initial = item.plant[0];
  const icon = CATEGORY_ICONS[item.data.category] || "🌿";

  const photoEl = img
    ? `<img class="card-photo" src="${img}" alt="${item.plant}" draggable="false" loading="lazy">`
    : `<div class="card-photo-placeholder">${icon}</div>`;

  const sciEl = item.data.scientific
    ? `<div class="card-scientific">${item.data.scientific}</div>`
    : "";

  const card = document.createElement("div");
  card.className = "card";
  card.style.zIndex = isTop ? 10 : "";
  card.innerHTML = `
    <div class="swipe-indicator done-label">DONE</div>
    <div class="swipe-indicator skip-label">SKIP</div>
    ${photoEl}
    <div class="card-body">
      <span class="card-badge">${item.data.category}</span>
      <div class="card-name">${item.plant}</div>
      ${sciEl}
      <div class="card-task">${item.task}</div>
    </div>
    <div class="card-actions">
      <button class="action-btn btn-done"  data-action="done" ><span class="btn-icon">✓</span>Done</button>
      <button class="action-btn btn-later" data-action="later"><span class="btn-icon">↩</span>Later</button>
      <button class="action-btn btn-skip"  data-action="wont_do"><span class="btn-icon">✗</span>Won't Do</button>
    </div>`;

  card.querySelectorAll(".action-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      handleAction(item, btn.dataset.action);
    });
  });

  return card;
}

function handleAction(item, action) {
  setState(CURRENT_YEAR, NOW.getMonth(), item.plant, action);
  item.state = action;

  const stage = document.querySelector(".card-stage");
  const topCard = stage.firstChild;

  if (action === "later") {
    // Remove from current position, add to end of pending
    const idx = stackItems.indexOf(item);
    if (idx !== -1) stackItems.splice(idx, 1);
    stackItems.push(item);
    // Dramatic arc-to-back animation
    if (topCard && topCard.classList.contains("card")) {
      topCard.classList.add("animate-to-back");
      // Flash the card behind to give physical depth cue
      topCard.style.zIndex = "10";
      topCard.addEventListener("animationend", () => renderStack(), { once: true });
    } else {
      renderStack();
    }
  } else {
    if (topCard && topCard.classList.contains("card")) {
      topCard.classList.add(action === "done" ? "swipe-right" : "swipe-left");
      topCard.addEventListener("animationend", () => renderStack(), { once: true });
    } else {
      renderStack();
    }
  }
}

// ── Touch/mouse swipe ────────────────────────────────────────
function attachSwipe(card, item) {
  if (!card || !item) return;

  let startX = 0, startY = 0, deltaX = 0;
  let active = false;
  let direction = null; // 'h' | 'v' | null — locked after LOCK_PX
  const THRESHOLD = 80;
  const LOCK_PX = 8; // pixels of movement before locking direction

  const doneLabel = card.querySelector(".done-label");
  const skipLabel = card.querySelector(".skip-label");

  function start(x, y) {
    startX = x; startY = y; deltaX = 0;
    active = true; direction = null;
  }

  function move(x, y) {
    if (!active) return;
    const dx = x - startX;
    const dy = y - startY;

    // Lock direction once we have enough movement
    if (!direction && Math.hypot(dx, dy) > LOCK_PX) {
      direction = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }
    if (direction !== "h") return; // vertical — let the browser handle it

    deltaX = dx;
    card.classList.add("is-swiping");
    card.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.05}deg)`;

    const pct = Math.min(Math.abs(deltaX) / THRESHOLD, 1);
    doneLabel.style.opacity = deltaX > 0 ? pct : 0;
    skipLabel.style.opacity = deltaX < 0 ? pct : 0;
  }

  function end() {
    if (!active) return;
    active = false;
    card.classList.remove("is-swiping");
    card.style.transform = "";
    doneLabel.style.opacity = 0;
    skipLabel.style.opacity = 0;

    if (direction === "h") {
      if (deltaX >  THRESHOLD) handleAction(item, "done");
      else if (deltaX < -THRESHOLD) handleAction(item, "wont_do");
    }
    direction = null;
  }

  // Mouse
  card.addEventListener("mousedown", e => {
    if (e.target.closest(".action-btn")) return;
    e.preventDefault();
    start(e.clientX, e.clientY);
  });
  const onMouseMove = e => move(e.clientX, e.clientY);
  const onMouseUp   = () => end();
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup",   onMouseUp);

  // Touch — non-passive so we can preventDefault on horizontal swipes
  card.addEventListener("touchstart", e => {
    if (e.target.closest(".action-btn")) return;
    start(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  card.addEventListener("touchmove", e => {
    if (!active) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    // Lock as horizontal? Block scroll so card tracks finger
    if (direction === "h" || (dx > dy && dx > LOCK_PX)) {
      e.preventDefault();
    }
    move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  card.addEventListener("touchend",    () => end());
  card.addEventListener("touchcancel", () => end());
}

// ── Grid view ────────────────────────────────────────────────
let gridFilterCat = "All";

function renderGrid() {
  const view = document.getElementById("grid-view");
  const tasks = getMonthTasks(gridYear, gridMonth);
  const monthName = MONTHS[gridMonth];
  const isCurrentMonth = gridMonth === NOW.getMonth() && gridYear === NOW.getFullYear();

  // Month nav label
  const label = view.querySelector(".month-nav-label");
  label.innerHTML = isCurrentMonth
    ? `<span class="month-nav-current">${monthName} ${gridYear}</span>`
    : `${monthName} ${gridYear}`;

  // Prev/next
  view.querySelector(".prev-month").disabled = (gridYear === CURRENT_YEAR - 1 && gridMonth === 0);
  view.querySelector(".next-month").disabled = (gridMonth === NOW.getMonth() && gridYear === NOW.getFullYear());

  // Filter chips
  const cats = ["All", ...new Set(tasks.map(t => t.data.category))];
  const chipContainer = view.querySelector(".grid-filter");
  chipContainer.innerHTML = cats.map(c => `
    <button class="filter-chip ${c === gridFilterCat ? "active" : ""}" data-cat="${c}">${c}</button>
  `).join("");
  chipContainer.querySelectorAll(".filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      gridFilterCat = btn.dataset.cat;
      renderGrid();
    });
  });

  // Cards
  const filtered = gridFilterCat === "All" ? tasks : tasks.filter(t => t.data.category === gridFilterCat);
  const grid = view.querySelector(".grid-cards");

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);font-size:14px;">No tasks for ${gridFilterCat} in ${monthName}.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const img = images[item.plant];
    const icon = CATEGORY_ICONS[item.data.category] || "🌿";
    const photoEl = img
      ? `<img class="mini-card-photo" src="${img}" alt="${item.plant}" loading="lazy">`
      : `<div class="mini-card-placeholder">${icon}</div>`;

    let badgeHtml = "";
    if (item.state === "done")    badgeHtml = `<div class="mini-card-status-badge badge-done">✓</div>`;
    if (item.state === "wont_do") badgeHtml = `<div class="mini-card-status-badge badge-wont_do">✗</div>`;
    if (item.state === "later")   badgeHtml = `<div class="mini-card-status-badge badge-later">↩</div>`;

    return `
      <div class="mini-card state-${item.state}" data-plant="${item.plant}">
        ${photoEl}
        <div class="mini-card-body">
          <div class="mini-card-name">${item.plant}</div>
          <div class="mini-card-task">${item.task}</div>
        </div>
        ${badgeHtml}
      </div>`;
  }).join("");

  grid.querySelectorAll(".mini-card").forEach(card => {
    card.addEventListener("click", () => {
      const plantName = card.dataset.plant;
      const item = tasks.find(t => t.plant === plantName);
      if (item) openModal(item, isCurrentMonth);
    });
  });
}

// ── Modal ────────────────────────────────────────────────────
function openModal(item, interactive) {
  const overlay = document.getElementById("modal-overlay");
  const sheet = overlay.querySelector(".modal-sheet");
  const img = images[item.plant];
  const icon = CATEGORY_ICONS[item.data.category] || "🌿";

  const photoEl = img
    ? `<img class="modal-photo" src="${img}" alt="${item.plant}">`
    : `<div class="modal-placeholder">${icon}</div>`;

  const sciEl = item.data.scientific
    ? `<div class="modal-scientific">${item.data.scientific}</div>`
    : "";

  let actionsEl = "";
  if (interactive) {
    actionsEl = `
      <div class="modal-actions">
        <button class="action-btn btn-done"  data-action="done" ><span class="btn-icon">✓</span>Done</button>
        <button class="action-btn btn-later" data-action="later"><span class="btn-icon">↩</span>Later</button>
        <button class="action-btn btn-skip"  data-action="wont_do"><span class="btn-icon">✗</span>Won't Do</button>
      </div>`;
  }

  sheet.innerHTML = `
    <div class="modal-handle"></div>
    ${photoEl}
    <div class="modal-content">
      <div class="modal-badge">${item.data.category}</div>
      <div class="modal-name">${item.plant}</div>
      ${sciEl}
      <div class="modal-task">${item.task}</div>
    </div>
    ${actionsEl}`;

  if (interactive) {
    sheet.querySelectorAll(".action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        handleAction(item, btn.dataset.action);
        closeModal();
        renderGrid();
        renderStack();
      });
    });
  }

  overlay.classList.add("open");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}

// ── View switching ───────────────────────────────────────────
function setView(v) {
  currentView = v;
  document.getElementById("stack-view").style.display = v === "stack" ? "block" : "none";
  document.getElementById("grid-view").style.display  = v === "grid"  ? "block" : "none";
  document.querySelectorAll(".view-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));
  if (v === "grid") renderGrid();
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  // Load data
  const [dataRes, imgRes] = await Promise.all([
    fetch("data.json").then(r => r.json()).catch(() => ({})),
    fetch("images.json").then(r => r.json()).catch(() => ({})),
  ]);
  data = dataRes;
  images = imgRes;

  // Header month
  document.querySelector(".header-month").textContent =
    `${MONTHS[NOW.getMonth()]} ${NOW.getFullYear()}`;

  // View toggle
  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  // Grid month nav
  document.querySelector(".prev-month").addEventListener("click", () => {
    if (gridMonth === 0) { gridMonth = 11; gridYear--; }
    else gridMonth--;
    gridFilterCat = "All";
    renderGrid();
  });
  document.querySelector(".next-month").addEventListener("click", () => {
    if (gridMonth === 11) { gridMonth = 0; gridYear++; }
    else gridMonth++;
    gridFilterCat = "All";
    renderGrid();
  });

  // Modal close
  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Initial render
  initStack();
  setView("stack");
}

document.addEventListener("DOMContentLoaded", init);
