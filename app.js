const STORAGE_KEY = "habit_tracker_v1";

const $ = (id) => document.getElementById(id);
const todayISO = () => new Date().toISOString().slice(0, 10);


function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeekSunday(d) {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function levelFromCount(count) {
  // 0..4 intensity levels
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4; // 4+ completions
}

function renderHeatmap(state, days = 120) {
  const heatmap = document.getElementById("heatmap");
  if (!heatmap) return;

  heatmap.innerHTML = "";

  const end = new Date(); // today
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  // align to week grid (Sunday start)
  const gridStart = startOfWeekSunday(start);

  const totalDays = Math.ceil((end - gridStart) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = toISODate(d);

    const count = state.done[iso] ? Object.keys(state.done[iso]).length : 0;
    const lv = levelFromCount(count);

    const cell = document.createElement("div");
    cell.className = `cell lv${lv}`;

    // tooltip
    cell.title = `${iso}: ${count} completed`;

    heatmap.appendChild(cell);
  }
}





function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : { habits: [], done: {} }; // done[date][habitId]=true
}
function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getLastNDates(n) {
  const dates = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  return dates;
}

function calcStreak(state) {
  // streak = consecutive days (from today backwards) where user completed at least one habit
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    const hasAny = state.done[key] && Object.keys(state.done[key]).length > 0;
    if (!hasAny) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function render() {
  const state = load();
  const t = todayISO();

  $("today").textContent = t;
  $("streak").textContent = calcStreak(state);

  const list = $("list");
  list.innerHTML = "";

  state.done[t] ||= {};

  for (const h of state.habits) {
    const item = document.createElement("div");
    item.className = "item";

    const left = document.createElement("div");
    left.innerHTML = `<div><b>${escapeHtml(h.name)}</b></div><div class="meta">${h.freq}</div>`;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "10px";
    right.style.alignItems = "center";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!state.done[t][h.id];
    chk.onchange = () => {
      state.done[t] ||= {};
      if (chk.checked) state.done[t][h.id] = true;
      else delete state.done[t][h.id];
      save(state);
      render();
      renderHeatmap(state, 120);
    };

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.style.background = "rgba(255,255,255,0.10)";
    del.onclick = () => {
      state.habits = state.habits.filter(x => x.id !== h.id);
      // remove from all days
      for (const day of Object.keys(state.done)) {
        if (state.done[day][h.id]) delete state.done[day][h.id];
      }
      save(state);
      render();
    };

    right.appendChild(chk);
    right.appendChild(del);

    item.appendChild(left);
    item.appendChild(right);
    list.appendChild(item);
  }

  const history = $("history");
  history.innerHTML = "";
  const days = getLastNDates(7).reverse();

  for (const day of days) {
    const count = state.done[day] ? Object.keys(state.done[day]).length : 0;
    const el = document.createElement("div");
    el.className = "day";
    el.textContent = `${day}: ${count ? "✅ " + count : "❌ 0"}`;
    history.appendChild(el);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// Add habit
$("addBtn").onclick = () => {
  const name = $("habitName").value.trim();
  const freq = $("freq").value;
  if (!name) return;

  const state = load();
  state.habits.push({ id: crypto.randomUUID(), name, freq });
  save(state);

  $("habitName").value = "";
  render();
};

// Export
$("exportBtn").onclick = () => {
  const state = load();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "habit-tracker-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
};

$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.habits) || typeof data.done !== "object") {
    alert("Invalid file format.");
    return;
  }
  save(data);
  render();
  e.target.value = "";
});

$("resetBtn").onclick = () => {
  localStorage.removeItem("habit_tracker_v1");
  render();
};

render();
