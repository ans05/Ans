// Lock In — popup script. All session logic lives in background.js; the popup just renders state.

const $ = (id) => document.getElementById(id);

const timerEl = $('timer');
const noteEl = $('session-note');
const statusPill = $('status-pill');
const setupEl = $('setup');
const runningEl = $('running');
const progressBar = $('progress-bar');
const endButton = $('end-lock-in');

let tickInterval = null;
let selectedMinutes = 50;

// ---------- helpers ----------

function sendMessage(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function normalizeSite(input) {
  let value = String(input || '').trim().toLowerCase();
  value = value.replace(/^[a-z]+:\/\//, '');
  value = value.split(/[/?#]/)[0];
  value = value.replace(/^www\./, '');
  return value;
}

// ---------- session UI ----------

function renderSession(session) {
  clearInterval(tickInterval);

  if (!session || !session.active) {
    setupEl.hidden = false;
    runningEl.hidden = true;
    statusPill.textContent = 'Idle';
    statusPill.classList.remove('live');
    timerEl.textContent = formatTime(selectedMinutes * 60 * 1000);
    noteEl.textContent = 'Pick a length and lock in.';
    return;
  }

  setupEl.hidden = true;
  runningEl.hidden = false;
  statusPill.textContent = session.strict ? 'Locked in · strict' : 'Locked in';
  statusPill.classList.add('live');
  endButton.disabled = Boolean(session.strict);
  endButton.title = session.strict ? 'Strict mode: this session cannot be ended early.' : '';
  noteEl.textContent = `${session.durationMin} minute session`;

  const tick = () => {
    const remaining = session.endsAt - Date.now();
    timerEl.textContent = formatTime(remaining);
    const total = session.endsAt - session.startedAt;
    const pct = Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
    progressBar.style.width = pct + '%';
    if (remaining <= 0) {
      clearInterval(tickInterval);
      refreshSession();
    }
  };
  tick();
  tickInterval = setInterval(tick, 1000);
}

async function refreshSession() {
  const response = await sendMessage({ type: 'GET_SESSION' });
  renderSession(response && response.session);
}

document.querySelectorAll('.chip[data-minutes]').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    $('custom-minutes').value = '';
    selectedMinutes = Number(chip.dataset.minutes);
    timerEl.textContent = formatTime(selectedMinutes * 60 * 1000);
  });
});

$('custom-minutes').addEventListener('input', (event) => {
  const value = Number(event.target.value);
  if (value >= 1) {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    event.target.parentElement.classList.add('active');
    selectedMinutes = Math.min(600, value);
    timerEl.textContent = formatTime(selectedMinutes * 60 * 1000);
  }
});

$('start-lock-in').addEventListener('click', async () => {
  const strict = $('strict-mode').checked;
  if (strict && !confirm(`Strict mode: you will NOT be able to end this ${selectedMinutes} minute session early. Lock in?`)) {
    return;
  }
  const response = await sendMessage({ type: 'START_LOCK_IN', durationMin: selectedMinutes, strict });
  renderSession(response && response.session);
});

endButton.addEventListener('click', async () => {
  const response = await sendMessage({ type: 'END_LOCK_IN' });
  if (response && !response.ok) {
    alert(response.error);
    return;
  }
  await refreshSession();
  await loadStats();
});

// ---------- tasks ----------

const taskList = $('task-list');

function getTasks() {
  return new Promise((resolve) => chrome.storage.sync.get({ tasks: [] }, (data) => resolve(data.tasks || [])));
}

function saveTasks(tasks) {
  return new Promise((resolve) => chrome.storage.sync.set({ tasks }, resolve));
}

function renderTasks(tasks) {
  taskList.innerHTML = '';
  if (tasks.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No tasks yet.';
    taskList.appendChild(li);
    return;
  }
  tasks.forEach((task) => {
    const li = document.createElement('li');
    if (task.done) li.classList.add('done');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(task.done);
    checkbox.addEventListener('change', async () => {
      const current = await getTasks();
      const updated = current.map((t) => (t.id === task.id ? { ...t, done: checkbox.checked } : t));
      await saveTasks(updated);
      renderTasks(updated);
    });

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = task.text;
    label.title = task.text;

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = '×';
    remove.title = 'Remove task';
    remove.addEventListener('click', async () => {
      const current = await getTasks();
      const updated = current.filter((t) => t.id !== task.id);
      await saveTasks(updated);
      renderTasks(updated);
    });

    li.append(checkbox, label, remove);
    taskList.appendChild(li);
  });
}

$('task-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('new-task');
  const text = input.value.trim();
  if (!text) return;
  const tasks = await getTasks();
  tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, done: false });
  await saveTasks(tasks);
  input.value = '';
  renderTasks(tasks);
});

$('clear-done').addEventListener('click', async () => {
  const tasks = (await getTasks()).filter((t) => !t.done);
  await saveTasks(tasks);
  renderTasks(tasks);
});

// ---------- blocked sites ----------

const blockedList = $('blocked-list');
const PRESET_SITES = [
  'youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
  'reddit.com', 'facebook.com', 'netflix.com', 'twitch.tv',
];

function getBlockedSites() {
  return new Promise((resolve) =>
    chrome.storage.sync.get({ blockedSites: [] }, (data) => resolve(data.blockedSites || []))
  );
}

function saveBlockedSites(blockedSites) {
  return new Promise((resolve) => chrome.storage.sync.set({ blockedSites }, resolve));
}

function renderBlockedSites(sites) {
  blockedList.innerHTML = '';
  if (sites.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Nothing blocked yet.';
    blockedList.appendChild(li);
    return;
  }
  sites.forEach((site) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = site;

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = '×';
    remove.title = 'Unblock';
    remove.addEventListener('click', async () => {
      const updated = (await getBlockedSites()).filter((s) => s !== site);
      await saveBlockedSites(updated);
      renderBlockedSites(updated);
    });

    li.append(label, remove);
    blockedList.appendChild(li);
  });
}

async function addSites(candidates) {
  const current = await getBlockedSites();
  const additions = candidates.map(normalizeSite).filter((s) => s && !current.includes(s));
  const updated = [...current, ...additions];
  await saveBlockedSites(updated);
  renderBlockedSites(updated);
  return additions.length;
}

$('block-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('block-url');
  const site = normalizeSite(input.value);
  if (!site) return;
  const added = await addSites([site]);
  if (added === 0) alert(`${site} is already blocked.`);
  input.value = '';
});

$('add-presets').addEventListener('click', () => addSites(PRESET_SITES));

$('clear-blocked-list').addEventListener('click', async () => {
  if (!confirm('Remove every blocked site?')) return;
  await saveBlockedSites([]);
  renderBlockedSites([]);
});

// ---------- stats ----------

async function loadStats() {
  chrome.storage.local.get({ stats: { sessionsCompleted: 0, minutesLocked: 0 } }, (data) => {
    $('stat-sessions').textContent = data.stats.sessionsCompleted;
    $('stat-minutes').textContent = data.stats.minutesLocked;
  });
}

// Re-render if the background changes the session (e.g. it finishes while the popup is open).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.session) renderSession(changes.session.newValue);
  if (area === 'local' && changes.stats) loadStats();
});

// ---------- init ----------

(async () => {
  await refreshSession();
  renderTasks(await getTasks());
  renderBlockedSites(await getBlockedSites());
  await loadStats();
})();
