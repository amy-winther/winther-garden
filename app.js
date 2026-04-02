const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const CATEGORY_ICONS = {
  "General": "🌿", "Trees": "🌳", "Shrubs": "🌸", "Edibles": "🍓",
  "Evergreens": "🌲", "Ferns": "🌿", "Grasses": "🌾", "Vine": "🍃",
  "Ground Covers": "🍀", "Perennials": "💐"
};

const CATEGORY_COLORS = {
  "General":       "#8A8A72",
  "Trees":         "#2D6A4F",
  "Shrubs":        "#B8829A",
  "Edibles":       "#C8704A",
  "Evergreens":    "#3A7D44",
  "Ferns":         "#5C8A5A",
  "Grasses":       "#A08E5A",
  "Vine":          "#6B8E6B",
  "Ground Covers": "#7B9E87",
  "Perennials":    "#7C6FAD"
};

let data = {};
let images = {};
let currentView = "stack";
let gridMonth = new Date().getMonth();
let gridYear  = new Date().getFullYear();

// State
function stateKey(year, month, plant) { return `wg_${year}_${month}_${plant}`; }
function getState(year, month, plant) {
  return localStorage.getItem(stateKey(year, month, plant)) || "pending";
}
function setState(year, month, plant, state) {
  localStorage.setItem(stateKey(year, month, plant), state);
}

const NOW           = new Date();
const CURRENT_MONTH = MONTHS[NOW.getMonth()];
const CURRENT_YEAR  = NOW.getFullYear();

function getGreeting() {
  const h = NOW.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || "#8A8A72";
}

function getMonthTasks(year, month0) {
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
let stackItems = [];

function initStack() {
  const all     = getMonthTasks(CURRENT_YEAR, NOW.getMonth());
  const pending = all.filter(i => i.state === "pending" || i.state === "later");
  const done    = all.filter(i => i.state === "done" || i.state === "wont_do");
  stackItems    = [...pending, ...done];
  renderStack();
}

function bindStackActions(item) {
  const stackActions = document.querySelector(".stack-actions");
  if (!item) {
    stackActions.style.display = "none";
    return;
  }
  stackActions.style.display = "flex";
  // Replace buttons to remove stale listeners
  stackActions.querySelectorAll(".action-btn").forEach(btn => {
    const fresh = btn.cloneNode(true);
    btn.replaceWith(fresh);
    fresh.addEventListener("click", e => {
      e.stopPropagation();
      handleAction(item, fresh.dataset.action);
    });
  });
}

function renderStack() {
  const view      = document.getElementById("stack-view");
  const pending   = stackItems.filter(i => i.state !== "done" && i.state !== "wont_do");
  const done      = stackItems.filter(i => i.state === "done" || i.state === "wont_do");
  const total     = stackItems.length;
  const remaining = pending.length;

  // Counter
  view.querySelector(".remaining").textContent =
    remaining > 0 ? `${remaining} of ${total} remaining` : `All ${total} tasks completed`;

  // Card stage
  const stage = view.querySelector(".card-stage");
  stage.innerHTML = "";

  if (remaining === 0) {
    bindStackActions(null);
    stage.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🌱</span>
        <div class="empty-state-title">All done for ${CURRENT_MONTH}!</div>
        <div class="empty-state-text">Your garden is taken care of. Check the grid view to review past months or plan ahead.</div>
      </div>`;
  } else {
    const cards = pending.slice(0, 3);
    [...cards].reverse().forEach((item, revIdx) => {
      const card = buildCard(item, revIdx === cards.length - 1);
      stage.prepend(card);
    });
    attachSwipe(stage.firstChild, pending[0]);
    bindStackActions(pending[0]);
  }

  // Done stamps
  const doneSection = view.querySelector(".done-section");
  if (done.length === 0) {
    doneSection.innerHTML = "";
    return;
  }

  doneSection.innerHTML = `
    <div class="done-section-title">Completed · ${done.length}</div>
    <div class="done-stamps">
      ${done.map(item => {
        const img      = images[item.plant];
        const catColor = getCategoryColor(item.data.category);
        const icon     = item.state === "done" ? "✓" : "✗";
        const toggleLabel = item.state === "done" ? "✗ Skip" : "✓ Done";

        const thumbInner = img
          ? `<img src="${img}" alt="${item.plant}" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
             ><div class="stamp-color" style="background:${catColor};display:none">${item.plant[0]}</div>`
          : `<div class="stamp-color" style="background:${catColor}">${item.plant[0]}</div>`;

        return `
          <div class="stamp-card" data-plant="${item.plant}">
            <div class="stamp-thumb">
              ${thumbInner}
              <div class="stamp-badge-overlay">${icon}</div>
              <div class="done-hint reopen-hint">↩</div>
              <div class="done-hint toggle-hint">${toggleLabel}</div>
            </div>
            <div class="stamp-name">${item.plant}</div>
          </div>`;
      }).join("")}
    </div>`;

  doneSection.querySelectorAll(".stamp-card").forEach(el => {
    const item = done.find(i => i.plant === el.dataset.plant);
    if (item) attachDoneSwipe(el, item);
  });
}

function buildCard(item, isTop) {
  const img      = images[item.plant];
  const catColor = getCategoryColor(item.data.category);

  const photoEl = img
    ? `<img class="card-photo" src="${img}" alt="${item.plant}" draggable="false" loading="lazy"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
       ><div class="card-photo-placeholder" style="background:${catColor};display:none">${item.plant[0]}</div>`
    : `<div class="card-photo-placeholder" style="background:${catColor}">${item.plant[0]}</div>`;

  const sciEl = item.data.scientific
    ? `<div class="card-scientific">${item.data.scientific}</div>`
    : "";

  const card = document.createElement("div");
  card.className = "card";
  card.style.zIndex = isTop ? 10 : "";
  card.innerHTML = `
    <div class="swipe-indicator done-label">DONE ✓</div>
    <div class="swipe-indicator skip-label">SKIP ✗</div>
    ${photoEl}
    <div class="card-scrim"></div>
    <div class="card-wash"></div>
    <div class="card-overlay">
      <span class="card-badge" style="background:${catColor}cc">${item.data.category}</span>
      <div class="card-name">${item.plant}</div>
      ${sciEl}
      <div class="card-task">${item.task}</div>
    </div>`;

  return card;
}

function handleAction(item, action) {
  setState(CURRENT_YEAR, NOW.getMonth(), item.plant, action);
  item.state = action;

  const stage   = document.querySelector(".card-stage");
  const topCard = stage.firstChild;

  if (action === "later") {
    const idx = stackItems.indexOf(item);
    if (idx !== -1) stackItems.splice(idx, 1);
    stackItems.push(item);
    if (topCard && topCard.classList.contains("card")) {
      topCard.classList.add("animate-to-back");
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

// ── Touch / mouse swipe ──────────────────────────────────────
function attachSwipe(card, item) {
  if (!card || !item) return;

  let startX = 0, startY = 0, startTime = 0, deltaX = 0;
  let active = false;
  let direction = null;
  const THRESHOLD = 80;
  const LOCK_PX   = 8;

  const doneLabel = card.querySelector(".done-label");
  const skipLabel = card.querySelector(".skip-label");
  const cardWash  = card.querySelector(".card-wash");

  function start(x, y) {
    startX = x; startY = y; deltaX = 0;
    startTime = Date.now();
    active = true; direction = null;
  }

  function move(x, y) {
    if (!active) return;
    const dx = x - startX;
    const dy = y - startY;

    if (!direction && Math.hypot(dx, dy) > LOCK_PX) {
      direction = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }
    if (direction !== "h") return;

    deltaX = dx;
    card.classList.add("is-swiping");
    card.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.04}deg)`;

    const pct = Math.min(Math.abs(deltaX) / THRESHOLD, 1);
    doneLabel.style.opacity = deltaX > 0 ? pct : 0;
    skipLabel.style.opacity = deltaX < 0 ? pct : 0;

    // Color wash on card
    if (deltaX > 0) {
      cardWash.style.background = "rgba(45,106,79,0.32)";
      cardWash.style.opacity = pct;
    } else if (deltaX < 0) {
      cardWash.style.background = "rgba(185,28,28,0.28)";
      cardWash.style.opacity = pct;
    } else {
      cardWash.style.opacity = 0;
    }
  }

  function end() {
    if (!active) return;
    active = false;
    card.classList.remove("is-swiping");
    card.style.transform = "";
    doneLabel.style.opacity = 0;
    skipLabel.style.opacity = 0;
    cardWash.style.opacity  = 0;

    if (direction === "h") {
      const elapsed  = Date.now() - startTime;
      const velocity = Math.abs(deltaX) / (elapsed || 1);
      const commit   = velocity > 0.8 ? 40 : THRESHOLD;

      if (deltaX >  commit) handleAction(item, "done");
      else if (deltaX < -commit) handleAction(item, "wont_do");
    }
    direction = null;
  }

  card.addEventListener("mousedown", e => {
    if (e.target.closest(".action-btn")) return;
    e.preventDefault();
    start(e.clientX, e.clientY);
  });
  document.addEventListener("mousemove", e => move(e.clientX, e.clientY));
  document.addEventListener("mouseup",   () => end());

  card.addEventListener("touchstart", e => {
    if (e.target.closest(".action-btn")) return;
    start(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  card.addEventListener("touchmove", e => {
    if (!active) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (direction === "h" || (dx > dy && dx > LOCK_PX)) e.preventDefault();
    move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  card.addEventListener("touchend",    () => end());
  card.addEventListener("touchcancel", () => end());
}

// ── Done-stamp swipe (reopen / toggle) ──────────────────────
function attachDoneSwipe(el, item) {
  let startX = 0, startY = 0, deltaX = 0;
  let active = false, direction = null;
  const THRESHOLD = 50;
  const LOCK_PX   = 8;

  const reopenHint = el.querySelector(".reopen-hint");
  const toggleHint = el.querySelector(".toggle-hint");

  function start(x, y) {
    startX = x; startY = y; deltaX = 0;
    active = true; direction = null;
  }

  function move(x, y) {
    if (!active) return;
    const dx = x - startX;
    const dy = y - startY;
    if (!direction && Math.hypot(dx, dy) > LOCK_PX) {
      direction = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }
    if (direction !== "h") return;
    deltaX = dx;
    el.classList.add("is-swiping");
    el.style.transform = `translateX(${deltaX}px)`;
    const pct = Math.min(Math.abs(deltaX) / THRESHOLD, 1);
    reopenHint.style.opacity = deltaX > 0 ? pct : 0;
    toggleHint.style.opacity = deltaX < 0 ? pct : 0;
  }

  function end() {
    if (!active) return;
    active = false;
    el.classList.remove("is-swiping");
    el.style.transform = "";
    reopenHint.style.opacity = 0;
    toggleHint.style.opacity = 0;

    if (direction === "h") {
      if (deltaX > THRESHOLD) {
        setState(CURRENT_YEAR, NOW.getMonth(), item.plant, "pending");
        item.state = "pending";
        const idx = stackItems.indexOf(item);
        if (idx !== -1) stackItems.splice(idx, 1);
        stackItems.unshift(item);
        renderStack();
      } else if (deltaX < -THRESHOLD) {
        const next = item.state === "done" ? "wont_do" : "done";
        setState(CURRENT_YEAR, NOW.getMonth(), item.plant, next);
        item.state = next;
        renderStack();
      }
    }
    direction = null;
  }

  el.addEventListener("mousedown", e => { e.preventDefault(); start(e.clientX, e.clientY); });
  document.addEventListener("mousemove", e => move(e.clientX, e.clientY));
  document.addEventListener("mouseup",   () => end());

  el.addEventListener("touchstart", e => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  el.addEventListener("touchmove", e => {
    if (!active) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (direction === "h" || (dx > dy && dx > LOCK_PX)) e.preventDefault();
    move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  el.addEventListener("touchend",    () => end());
  el.addEventListener("touchcancel", () => end());
}

// ── Grid view ────────────────────────────────────────────────
let gridFilterCat = "All";

function renderGrid() {
  const view          = document.getElementById("grid-view");
  const tasks         = getMonthTasks(gridYear, gridMonth);
  const monthName     = MONTHS[gridMonth];
  const isCurrentMonth = gridMonth === NOW.getMonth() && gridYear === NOW.getFullYear();

  // Month nav label
  const label = view.querySelector(".month-nav-label");
  label.innerHTML = isCurrentMonth
    ? `<span class="month-nav-current">${monthName} ${gridYear}</span>`
    : `${monthName} ${gridYear}`;

  // Prev / next bounds
  view.querySelector(".prev-month").disabled = (gridYear === CURRENT_YEAR - 1 && gridMonth === 0);
  view.querySelector(".next-month").disabled = (gridMonth === NOW.getMonth() && gridYear === NOW.getFullYear());

  // Filter chips
  const cats          = ["All", ...new Set(tasks.map(t => t.data.category))];
  const chipContainer = view.querySelector(".grid-filter");
  chipContainer.innerHTML = cats.map(c =>
    `<button class="filter-chip ${c === gridFilterCat ? "active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");
  chipContainer.querySelectorAll(".filter-chip").forEach(btn => {
    btn.addEventListener("click", () => { gridFilterCat = btn.dataset.cat; renderGrid(); });
  });

  // Cards
  const filtered = gridFilterCat === "All" ? tasks : tasks.filter(t => t.data.category === gridFilterCat);
  const grid     = view.querySelector(".grid-cards");

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);font-size:14px;">No tasks for ${gridFilterCat} in ${monthName}.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const img      = images[item.plant];
    const catColor = getCategoryColor(item.data.category);

    const photoEl = img
      ? `<img class="mini-card-photo" src="${img}" alt="${item.plant}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
         ><div class="mini-card-placeholder" style="background:${catColor};display:none">
           <span style="font-size:24px;color:rgba(255,255,255,0.75)">${item.plant[0]}</span>
         </div>`
      : `<div class="mini-card-placeholder" style="background:${catColor}">
           <span style="font-size:24px;color:rgba(255,255,255,0.75)">${item.plant[0]}</span>
         </div>`;

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
      const item = tasks.find(t => t.plant === card.dataset.plant);
      if (item) openModal(item, isCurrentMonth);
    });
  });
}

// ── Modal ────────────────────────────────────────────────────
function openModal(item, interactive) {
  const overlay  = document.getElementById("modal-overlay");
  const sheet    = overlay.querySelector(".modal-sheet");
  const img      = images[item.plant];
  const catColor = getCategoryColor(item.data.category);

  const photoEl = img
    ? `<img class="modal-photo" src="${img}" alt="${item.plant}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
       ><div class="modal-placeholder" style="background:${catColor};display:none">${item.plant[0]}</div>`
    : `<div class="modal-placeholder" style="background:${catColor}">${item.plant[0]}</div>`;

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
  document.querySelectorAll(".view-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.view === v)
  );
  if (v === "grid") renderGrid();
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const [dataRes, imgRes] = await Promise.all([
    fetch("data.json").then(r => r.json()).catch(() => ({})),
    fetch("images.json").then(r => r.json()).catch(() => ({})),
  ]);
  data   = dataRes;
  images = imgRes;

  // Header
  document.querySelector(".header-greeting").textContent    = getGreeting();
  document.querySelector(".header-month-name").textContent  = MONTHS[NOW.getMonth()];

  // History button → switch to grid view
  document.getElementById("btn-history").addEventListener("click", () => setView("grid"));

  // View toggle
  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  // Grid month nav
  document.querySelector(".prev-month").addEventListener("click", () => {
    if (gridMonth === 0) { gridMonth = 11; gridYear--; } else gridMonth--;
    gridFilterCat = "All";
    renderGrid();
  });
  document.querySelector(".next-month").addEventListener("click", () => {
    if (gridMonth === 11) { gridMonth = 0; gridYear++; } else gridMonth++;
    gridFilterCat = "All";
    renderGrid();
  });

  // Modal close
  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal();
  });

  initStack();
  setView("stack");
}

document.addEventListener("DOMContentLoaded", init);
