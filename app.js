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

function getMonthCompletion(year, month0) {
  const tasks = getMonthTasks(year, month0);
  if (tasks.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = tasks.filter(t => t.state === "done" || t.state === "wont_do").length;
  return { done, total: tasks.length, pct: done / tasks.length };
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

// ── Timeline ─────────────────────────────────────────────────
function renderTimeline() {
  const container = document.querySelector(".month-timeline");
  const abbrevs   = ["J","F","M","A","M","J","J","A","S","O","N","D"];
  const currentM  = NOW.getMonth();

  container.innerHTML = abbrevs.map((abbr, i) => {
    let cls = "tl-dot";
    if      (i < currentM)  { const { pct } = getMonthCompletion(CURRENT_YEAR, i); cls += pct >= 0.6 ? " tl-past-good" : " tl-past-low"; }
    else if (i === currentM) cls += " tl-current";
    else                     cls += " tl-future";
    return `<div class="${cls}" data-month="${i}"><div class="tl-circle"></div><span class="tl-abbr">${abbr}</span></div>`;
  }).join("");

  container.querySelectorAll(".tl-dot").forEach(dot => {
    const m = parseInt(dot.dataset.month);
    if (m <= currentM) {
      dot.addEventListener("click", () => {
        gridMonth = m; gridYear = CURRENT_YEAR; gridFilterCat = "All";
        setView("grid");
      });
    }
  });
}

// ── Later shelf ──────────────────────────────────────────────
function renderLaterShelf() {
  const shelf      = document.querySelector(".later-shelf");
  const laterItems = stackItems.filter(i => i.state === "later");

  if (laterItems.length === 0) {
    shelf.style.display = "none";
    shelf.innerHTML = "";
    return;
  }

  shelf.style.display = "block";
  shelf.innerHTML = `
    <div class="later-shelf-label">Revisit today</div>
    <div class="later-shelf-scroll">
      ${laterItems.map(item => {
        const img      = images[item.plant];
        const catColor = getCategoryColor(item.data.category);
        const thumb    = img
          ? `<img src="${img}" alt="${item.plant}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="later-card-color" style="background:${catColor};display:none">${item.plant[0]}</div>`
          : `<div class="later-card-color" style="background:${catColor}">${item.plant[0]}</div>`;
        return `
          <div class="later-card" data-plant="${item.plant}">
            <div class="later-card-thumb">${thumb}</div>
            <div class="later-card-name">${item.plant}</div>
          </div>`;
      }).join("")}
    </div>`;

  shelf.querySelectorAll(".later-card").forEach(card => {
    card.addEventListener("click", () => {
      const item = stackItems.find(i => i.plant === card.dataset.plant);
      if (!item) return;
      setState(CURRENT_YEAR, NOW.getMonth(), item.plant, "pending");
      item.state = "pending";
      const idx = stackItems.indexOf(item);
      if (idx !== -1) stackItems.splice(idx, 1);
      stackItems.unshift(item);
      renderStack();
    });
  });
}

// ── Onboarding ───────────────────────────────────────────────
function showOnboarding() {
  if (localStorage.getItem("wg_onboarded")) return;
  const overlay = document.getElementById("onboarding");
  overlay.style.display = "flex";
  document.getElementById("onboarding-dismiss").addEventListener("click", () => {
    overlay.style.display = "none";
    localStorage.setItem("wg_onboarded", "1");
  });
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

  renderTimeline();
  renderLaterShelf();

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
      const isTop = revIdx === cards.length - 1;
      const card = buildCard(item, isTop, isTop ? `${remaining} of ${total}` : null);
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

function buildCard(item, isTop, counterText) {
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
    ${counterText ? `<div class="card-counter">${counterText}</div>` : ''}
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
  const isFutureMonth  = gridYear > NOW.getFullYear() || (gridYear === NOW.getFullYear() && gridMonth > NOW.getMonth());

  // Month nav label
  const label = view.querySelector(".month-nav-label");
  label.innerHTML = isCurrentMonth
    ? `<span class="month-nav-current">${monthName} ${gridYear}</span>`
    : `${monthName} ${gridYear}`;

  // Prev / next bounds
  view.querySelector(".prev-month").disabled = (gridYear === CURRENT_YEAR - 1 && gridMonth === 0);
  view.querySelector(".next-month").disabled = (gridMonth === NOW.getMonth() && gridYear === NOW.getFullYear());

  // Progress bar (past + current months only)
  let progressHtml = "";
  if (!isFutureMonth && tasks.length > 0) {
    const { done, total, pct } = getMonthCompletion(gridYear, gridMonth);
    progressHtml = `
      <div class="grid-progress">
        <div class="grid-progress-meta">
          <span>${done} of ${total} complete</span>
          <span>${Math.round(pct * 100)}%</span>
        </div>
        <div class="grid-progress-track">
          <div class="grid-progress-fill" style="width:${Math.round(pct * 100)}%"></div>
        </div>
      </div>`;
  }

  // Inject or update progress bar
  let progressEl = view.querySelector(".grid-progress");
  if (progressEl) progressEl.remove();
  const filterEl = view.querySelector(".grid-filter");
  filterEl.insertAdjacentHTML("beforebegin", progressHtml);

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
    if (!isFutureMonth) {
      if (item.state === "done")    badgeHtml = `<div class="mini-card-status-badge badge-done">✓</div>`;
      if (item.state === "wont_do") badgeHtml = `<div class="mini-card-status-badge badge-wont_do">✗</div>`;
      if (item.state === "later")   badgeHtml = `<div class="mini-card-status-badge badge-later">↩</div>`;
    }

    const futureCls  = isFutureMonth ? " is-future" : "";
    const futureTag  = isFutureMonth ? `<div class="mini-card-future-tag">Upcoming</div>` : "";

    return `
      <div class="mini-card state-${item.state}${futureCls}" data-plant="${item.plant}">
        ${photoEl}
        ${futureTag}
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
  } else if (item.state !== "pending") {
    const msg = item.state === "done"    ? "✓ Marked as done" :
                item.state === "wont_do" ? "✗ Skipped this month" :
                item.state === "later"   ? "↩ Deferred" : "";
    if (msg) actionsEl = `<div style="padding:0 20px 28px"><div class="modal-past-status">${msg}</div></div>`;
  }
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

// ── Inline data (no server required) ────────────────────────
const INLINE_DATA = {"Weather Alerts":{"scientific":"","category":"General","tasks":{"February":"HARD FREEZE WATCH","March":"HAIL WATCH,","April":"LAST FROST w3","September":"Expect dryness","November":"FIRST FROST w1"}},"Hardscape":{"scientific":"","category":"General","tasks":{"April":"Pressure washing","May":"Irrigation + fountain turn-on, clean, repair, Pressure washing","August":"Deck re-finishing","October":"Irrigation + fountain winterization"}},"Soil":{"scientific":"","category":"General","tasks":{"January":"Mulching","April":"Warm for nematodes","November":"Leaf raking/processing","December":"Mulching"}},"Lawns":{"scientific":"","category":"General","tasks":{"February":"Schedule lawn renovations (for march)","March":"Lawn renovations","May":"aerate and overseed. Apply beneficial nematodes when soil temperatures go above 60. Apply to wet lawn and water in.","September":"Aerate and overseed."}},"Bulbs":{"scientific":"","category":"General","tasks":{"July":"Order bulbs.","November":"Last chance to plant bulbs."}},"Irrigation":{"scientific":"","category":"General","tasks":{"March":"Irrigation Turn ON","October":"Irrigation turn off"}},"Midwinter Fire Dogwood":{"scientific":"Cornus sanguinea 'Midwinter Fire'","category":"Shrubs","tasks":{"April":"Cut down all stems when spring growth is under way. PRUNE to reduce branch crossing and crowding.","June":"Check for crowding and crossing and remove."}},"Panicle Hydrangea":{"scientific":"Hydrangea paniculata","category":"Shrubs","tasks":{"March":"Once buds have swelled, PRUNE all branches to the bud pair closest to the center. Cut all weak, damaged, or crowded canes to the ground.","April":"PRUNE, Fertilize","May":"Begin staking support---REBAR","June":"Beging staking support- Rebar","August":"No prune","October":"Leave branches to antique for winter display."}},"Nootka Rose":{"scientific":"Rosa nutkana","category":"Shrubs","tasks":{"February":"PRUNE (Presidents day). remove all dead branches and any smaller than a pencil. Remove crowding and crossing.","March":"Fertilize.","April":"Plant in bare root additions.","May":"Deadhead.","June":"Deadhead.","July":"Deadhead.","August":"Deadhead.","September":"Leave remaining roses to form hips for winter display and tea.","October":"Remove dead or damaged canes.","November":"light prune to protect from wind damage"}},"Blueberries":{"scientific":"Vaccinium corymbosum","category":"Edibles","tasks":{"February":"Remove dead, damaged, diseased, crossing canes. Cut all canes 1\" or more in diameter to the ground. Select the 6 strongest new shoots and remove the rest.","March":"Fertilize.","June":"HARVEST.","July":"HARVEST.","August":"HARVEST."}},"Mexican Orange":{"scientific":"Choisya ternata 'Sundance'","category":"Evergreens","tasks":{"May":"PRUNE for form after bloom.","June":"PRUNE for form after bloom."}},"Pacific Wax Myrtle":{"scientific":"Myrica californica","category":"Evergreens","tasks":{"March":"PRUNE for form and airflow."}},"Dwarf Pittosporum":{"scientific":"Pittosporum tobira 'Nanum'","category":"Evergreens","tasks":{"March":"Prune for shape and to remove any dead or damaged branches. This encourages bushier growth.","June":"Water regularly but ensure good drainage to keep away root rot.","October":"Mulch around the base to help retain moisture and protect roots during the winter."}},"Garden Sage":{"scientific":"Salvia officinalis 'Berggarten'","category":"Edibles","tasks":{"May":"PRUNE back to two nodes of new growth.","June":"HARVEST regularly.","July":"HARVEST regularly.","August":"HARVEST regularly.","September":"HARVEST regularly.","October":"let rest.","November":"let rest."}},"Common Thyme":{"scientific":"Thymus vulgaris","category":"Edibles","tasks":{"March":"PRUNE back. divide when 3-4 years old.","April":"HARVEST. take the top 5-6 inches just before flowering for best flavor. Leave at least 5\" of growth above the wood.","June":"HARVEST and soft PRUNE after blooming","July":"HARVEST and soft PRUNE after blooming","October":"Plant out new starts w2. Hard prune mature plants after first frost."}},"Maple":{"scientific":"Acer circinatum / griseum / palmatum","category":"Trees","tasks":{"January":"PRUNE for form when bare and dormant","March":"PRUNE crossing or dense branches when first spring growth appears."}},"Apple":{"scientific":"Malus x domestica","category":"Trees","tasks":{"February":"PRUNE crossing, damaged, or dense branches. Prune fruiting branches to closest outward facing nodes.","March":"Spray with Copper Fungicide"}},"Chocolate Vine":{"scientific":"Akebia quinata","category":"Vine","tasks":{"January":"Don't panic if the vine loses some or all its leaves in severe cold.","March":"Prune lightly to remove deadwood and shape the vine as desired.","June":"Water regularly to maintain consistant soil moisture."}},"Deer Fern":{"scientific":"Blechnum spicant","category":"Ferns","tasks":{"March":"Remove dead or damaged fronds.","October":"Remove any dead or damaged fronds."}},"Western Sword Fern":{"scientific":"Polystichum munitum","category":"Ferns","tasks":{"February":"Remove last years fronds when new fronds start to swell at the base.","March":"Remove last years fronds when new fronds start to swell at the base."}},"Karl Foerster Grass":{"scientific":"Calamagrostis x acutiflora 'Karl Foerster'","category":"Grasses","tasks":{"March":"Cut back old foliage when new foliage begins to show at the bottom.","October":"Leave seed stems to antique and provide winter interest.","December":"Remove any damaged seed heads."}},"Creeping Jenny":{"scientific":"Lysimachia nummularia 'Aurea'","category":"Ground Covers","tasks":{"March":"Apply a layer of compost as new growth emerges to provide nutrients and maintain moisture through the summer.","April":"If needed, divide larger plants to rejuvinate growth.","July":"If flagging, water more regularly. It prefers consistently damp soil.","August":"If flagging, water more regularly. It prefers consistently damp soil.","September":"If flagging, water more regularly. It prefers consistently damp soil.","October":"Trim back foliage to 6\" to prepare for dormancy. Mulch over root bases to protect from winter temperatures."}},"Kinnikinnick":{"scientific":"Arctostaphylos uva-ursi","category":"Ground Covers","tasks":{"April":"If needed, lightly prune out dead or damage branches and to maintain shape.","July":"Water sparingly, alllowing to dry out between waterings.","October":"Mulch ~2\" to protect base from winter freeze."}},"Strawberries":{"scientific":"Fragaria x","category":"Ground Covers","tasks":{"January":"Remove dead sections and runners. Thin healthiest plants to 6\" for edible strawberries.","April":"Remove shoots to contain spread and encourage bushy growth.","June":"Remove shoots to contain spread and encourage bushy growth.","August":"Remove shoots to contain spread and encourage bushy growth.","October":"Remove shoots to contain spread and encourage bushy growth."}},"Golden Oregano":{"scientific":"Origanum vulgare 'Aureum'","category":"Edibles","tasks":{"May":"Cut back generously to encourage bushier growth and continues greenery. Mulch to help retain moisture and protect during hot weather.","June":"Cut and harvest regularly to promote bushier growth and the best flavor.","July":"Cut and harvest regularly to promote bushier growth and the best flavor.","August":"Cut and harvest regularly to promote bushier growth and the best flavor."}},"Japanese Pachysandra":{"scientific":"Pachysandra terminalis","category":"Ground Covers","tasks":{"March":"Remove damaged or dead foliage to encourage growth and shape."}},"Mt. Vernon Cherry Laurel":{"scientific":"Prunus laurocerasus 'Mt. Vernon'","category":"Ground Covers","tasks":{"April":"Prune for shape after flowering is finished.","October":"Reduce watering as weather cools to prepare for winter weather. Mulch around base to retain moisture and protect surface roots from freeze."}},"Irish Moss":{"scientific":"Sagina subulata","category":"Ground Covers","tasks":{"April":"Remove dead or weak growth.","September":"Keep debris off of each clump to keep it healthy."}},"Creeping Thyme":{"scientific":"Thymus praecox 'Purple Carpet'","category":"Ground Covers","tasks":{"July":"PRUNE back all spent bloom to reinvigorate."}},"Redwood Sorrel":{"scientific":"Oxalis oregana","category":"Ground Covers","tasks":{"April":"Divide to propogate new plants if desired."}},"Bleeding Heart":{"scientific":"Dicentra formosa","category":"Perennials","tasks":{"May":"If needed, divide and transplant as soon as you see new growth.","November":"Cut back foliage after first frost."}},"Purple Coneflower":{"scientific":"Echinacea purpurea 'Magnus'","category":"Perennials","tasks":{"May":"Chelsea chop (remove 1/2)","June":"HARVEST regularly.","July":"HARVEST regularly.","August":"HARVEST regularly.","September":"HARVEST last flowers. Leave some flowers to develop seed. sow any additional seed for new spring additions.","November":"sow for stratification"}},"Seaside Daisy":{"scientific":"Erigeron glaucus","category":"Perennials","tasks":{"June":"Deadhead.","July":"Deadhead.","August":"Deadhead.","September":"Deadhead.","October":"Deadhead."}},"Joe Pye Weed":{"scientific":"Eupatorium maculatum","category":"Perennials","tasks":{"October":"Cut down spent foliage to the ground."}},"Cranesbill Geranium":{"scientific":"Geranium macrorrhizum 'Album'","category":"Perennials","tasks":{"July":"Cut back to reinvigorate bloom and form.","October":"Cut back spent foliage."}},"Culver's Root":{"scientific":"Veronicastrum virginicum 'Challenger'","category":"Perennials","tasks":{"February":"Cut dead stems to the ground and apply mulch.","June":"Deadhead spent flowers to encourage more blooms. Cut stems to the ground after flowering for new coliage growth.","July":"Deadhead spent flowers to encourage more blooms. Cut stems to the ground after flowering for new coliage growth.","August":"Deadhead spent flowers to encourage more blooms. Cut stems to the ground after flowering for new coliage growth.","September":"Divide and transplant older clumping plants to rejuvinate and multiply them.","November":"You can choose to leave fading stems to provide food for winter birds or shelter for pollinators."}},"Bowles' Mauve Wallflower":{"scientific":"Erysimum x 'Bowles' Mauve'","category":"Perennials","tasks":{"April":"After initial bloom, prune spent flowers to encocourage reblooming and a bushier habit.","June":"Deadhead spent flowers to continue bloom.","July":"Deadhead spent flowers to continue bloom.","August":"Deadhead spent flowers to continue bloom."}},"Euphorbia":{"scientific":"Euphorbia","category":"Perennials","tasks":{"March":"Remove any damaged or old foliage.","June":"Deadhead.","July":"Deadhead.","August":"Deadhead.","September":"Deadhead."}},"Lenten Rose":{"scientific":"Helleborus x glandorfensis","category":"Perennials","tasks":{"January":"Cut old leaves when flowers 5-6\"","February":"Cut old leaves when flowers 5-6\"","March":"Once goes to seed, cut back","April":"Cut back hellebore flowers","October":"Remove leaves once flowers are 6\" or taller.","December":"Remove crowded or diseased blooms."}},"Common Chives":{"scientific":"Allium schoenoprasum","category":"Edibles","tasks":{"March":"Divide if overly large or hollowing out in the center. Plant divisions or any new plants.","May":"If flagging, apply a nitrogen rich fertilizer.","June":"Harvest blooms regularly to control self-seeding and to continue bloom. HARVEST blades that are not plant stems for eating.","July":"Harvest blooms regularly to control self-seeding and to continue bloom. HARVEST blades that are not plant stems for eating.","August":"Harvest blooms regularly to control self-seeding and to continue bloom. HARVEST blades that are not plant stems for eating.","September":"Harvest blooms regularly to control self-seeding and to continue bloom. HARVEST blades that are not plant stems for eating.","October":"Apply a thick layer of mulch to protect from winter freeze. If flagging, cut back to a few inches above the ground before first frost."}},"Edible Strawberries":{"scientific":"Fragaria x","category":"Edibles","tasks":{"January":"Thin healthiest plants to 6\"","February":"Mulch with pine straw. Fertilize with blood and bone meal.","June":"HARVEST berries.","July":"HARVEST berries."}},"Italian Oregano":{"scientific":"Origanum vulgare 'Italian'","category":"Edibles","tasks":{"May":"plant out new starts. HARVEST established plants just before flowering for best flavor. cut down to 4\" to encourage root strength and bushiness. Dry and store.","June":"HARVEST regularly to encourage bushiness.","July":"HARVEST regularly to encourage bushiness.","August":"HARVEST regularly to encourage bushiness."}},"Raspberry":{"scientific":"Rubus idaeus 'NR7'","category":"Edibles","tasks":{"February":"PRUNE canes that have already fruited all the way to the ground. Remove any new canes that are too crowded. Remove suckers where crowding.","March":"Incorporate balanced fertilizer, leaving 2-3\" space around stems to keep from burning the roots","April":"HARVEST leaves.","June":"HARVEST berries.","July":"HARVEST berries.","August":"HARVEST berries.","September":"HARVEST berries.","October":"Once harvest is complete, remove all second-year canes (those that fruited), leaving first-year canes to fruit in the fall. Remove any weak canes."}}};

const INLINE_IMAGES = {"Midwinter Fire Dogwood":"https://upload.wikimedia.org/wikipedia/commons/1/12/Cornus_sanguinea_%27Wisley_Form%27_%28Cultivar_of_Bloodtwig_Dogwood%29_%2832157868530%29.jpg","Panicle Hydrangea":"https://upload.wikimedia.org/wikipedia/commons/e/e0/Hydrangea_paniculata_10.JPG","Nootka Rose":"https://upload.wikimedia.org/wikipedia/commons/7/72/Rosa_nutkana_07513.JPG","Blueberries":"https://upload.wikimedia.org/wikipedia/commons/1/17/Vaccinium_corymbosum%2801%29.jpg","Mexican Orange":"https://upload.wikimedia.org/wikipedia/commons/e/e1/Choisya_Inflorescence_FR_2013.jpg","Pacific Wax Myrtle":"https://upload.wikimedia.org/wikipedia/commons/6/67/Myrica_californica_kz2.jpg","Dwarf Pittosporum":"https://upload.wikimedia.org/wikipedia/commons/3/3e/Pittosporum_Tobira_JPG0.jpg","Garden Sage":"https://upload.wikimedia.org/wikipedia/commons/1/18/Salvia_officinalis_L._3355742911.jpg","Common Thyme":"https://upload.wikimedia.org/wikipedia/commons/4/4a/Thymian_%28Thymus_vulgaris%29%2C_Nationalpark_Hohe_Tauern.jpg","Maple":"https://upload.wikimedia.org/wikipedia/commons/8/88/Vine_Maple_leaves_and_flowers.jpg","Apple":"https://upload.wikimedia.org/wikipedia/commons/1/1a/Malus_domestica_%27Stark%27s_Earliest%27._Locatie_De_Kruidhof_02.JPG","Chocolate Vine":"https://upload.wikimedia.org/wikipedia/commons/e/e7/Akebia_quinata_001.JPG","Deer Fern":"https://upload.wikimedia.org/wikipedia/commons/1/1e/Blechnum_spicant_%28fertile_and_sterile_fronts%29.jpg","Western Sword Fern":"https://upload.wikimedia.org/wikipedia/commons/8/8d/Polystichum_munitum_%28Jami_Dwyer%29_001.jpg","Karl Foerster Grass":"https://upload.wikimedia.org/wikipedia/commons/2/2c/Calamagrostis_x_acutiflora_%27Karl_Foerster%27.jpg","Creeping Jenny":"https://upload.wikimedia.org/wikipedia/commons/8/89/Lysimachia_nummularia_128788213.jpg","Kinnikinnick":"https://upload.wikimedia.org/wikipedia/commons/f/f2/Arctostaphylos_uva-ursi_4_RF.jpg","Strawberries":"https://upload.wikimedia.org/wikipedia/commons/c/c1/Fragaria_vesca_-_metsmaasikas.jpg","Golden Oregano":"https://upload.wikimedia.org/wikipedia/commons/e/ef/Origanum_vulgare_Aureum_BotGardBln07122011E.jpg","Japanese Pachysandra":"https://upload.wikimedia.org/wikipedia/commons/6/61/Pachysandra_terminalis_%27Compacta%27_kz01.jpg","Mt. Vernon Cherry Laurel":"https://upload.wikimedia.org/wikipedia/commons/4/47/Prunus_laurocerasus_-_Taflan%2C_Giresun_2017-07-05_01-11.jpg","Irish Moss":"https://upload.wikimedia.org/wikipedia/commons/8/8f/Sagina_subulata_Aurea_2015_04.jpg","Creeping Thyme":"https://upload.wikimedia.org/wikipedia/commons/2/20/Thymus_praecox.JPG","Redwood Sorrel":"https://upload.wikimedia.org/wikipedia/commons/8/85/Oxalis_oregana_--_VanDusen_Botanical_Garden_--_Vancouver%2C_BC.jpg","Bleeding Heart":"https://upload.wikimedia.org/wikipedia/commons/7/7e/Dicentra_formosa_6899.JPG","Purple Coneflower":"https://upload.wikimedia.org/wikipedia/commons/8/88/Echinacea_purpurea%2C_Jard%C3%ADn_Bot%C3%A1nico%2C_M%C3%BAnich%2C_Alemania%2C_2013-09-08%2C_DD_01.jpg","Seaside Daisy":"https://upload.wikimedia.org/wikipedia/commons/4/40/Erigeron_Glaucus.jpg","Joe Pye Weed":"https://upload.wikimedia.org/wikipedia/commons/9/9e/Eupatorium_maculatum_R01.jpg","Cranesbill Geranium":"https://upload.wikimedia.org/wikipedia/commons/b/b1/2018-05-13_%28129%29_Geranium_macrorrhizum_%28Rock_Crane%27s-bill%29_at_Bichlh%C3%A4usl_in_Frankenfels%2C_Austria.jpg","Culver's Root":"https://upload.wikimedia.org/wikipedia/commons/e/e1/Veronicastrum_virginicum_kz02.jpg","Euphorbia":"https://upload.wikimedia.org/wikipedia/commons/d/da/Euphorbia_characias_%28habitus%29.jpg","Lenten Rose":"https://upload.wikimedia.org/wikipedia/commons/e/ee/Helleborus_orientalis_02.JPG","Common Chives":"https://upload.wikimedia.org/wikipedia/commons/4/4e/Allium_schoenoprasum_001.JPG","Italian Oregano":"https://upload.wikimedia.org/wikipedia/commons/5/53/Origanum_vulgare_149176132.jpg","Raspberry":"https://upload.wikimedia.org/wikipedia/commons/a/a2/Raspberries_%28Rubus_Idaeus%29.jpg"};

// ── Init ─────────────────────────────────────────────────────
async function init() {
  // Use inline data so the app works without a local server
  data   = INLINE_DATA;
  images = INLINE_IMAGES;

  // Header
  document.querySelector(".header-greeting").textContent    = getGreeting();
  document.querySelector(".header-month-name").textContent  = `${MONTHS[NOW.getMonth()]} Garden Tasks`;

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
  showOnboarding();
}

document.addEventListener("DOMContentLoaded", init);
