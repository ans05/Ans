// Lock In — page shown in place of a blocked site during a session.

const params = new URLSearchParams(location.search);
const from = params.get('from') || '';

const siteEl = document.getElementById('site');
const timerEl = document.getElementById('timer');
const subEl = document.getElementById('sub');
const endButton = document.getElementById('end');

try {
  const host = new URL(from).hostname.replace(/^www\./, '');
  siteEl.textContent = `${host} is blocked`;
} catch (e) {
  siteEl.textContent = 'This site is blocked';
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

function sendMessage(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

let tickInterval = null;

function renderSession(session) {
  clearInterval(tickInterval);
  if (!session || !session.active) {
    timerEl.textContent = 'Done';
    subEl.textContent = 'Your session is over. You can go back now.';
    endButton.hidden = true;
    return;
  }
  endButton.hidden = Boolean(session.strict);
  const tick = () => {
    const remaining = session.endsAt - Date.now();
    timerEl.textContent = formatTime(remaining);
    if (remaining <= 0) {
      clearInterval(tickInterval);
      renderSession(null);
    }
  };
  tick();
  tickInterval = setInterval(tick, 1000);
}

function renderTasks(tasks) {
  const list = document.getElementById('task-list');
  list.innerHTML = '';
  if (!tasks || tasks.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No tasks written down. Add some from the popup.';
    list.appendChild(li);
    return;
  }
  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.textContent = task.text;
    if (task.done) li.classList.add('done');
    list.appendChild(li);
  });
}

document.getElementById('back').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else chrome.tabs.getCurrent((tab) => tab && chrome.tabs.remove(tab.id));
});

endButton.addEventListener('click', async () => {
  if (!confirm('End your lock-in session early?')) return;
  const response = await sendMessage({ type: 'END_LOCK_IN' });
  if (response && !response.ok) {
    alert(response.error);
    return;
  }
  if (from) location.replace(from);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.session) renderSession(changes.session.newValue);
  if (area === 'sync' && changes.tasks) renderTasks(changes.tasks.newValue);
});

(async () => {
  const response = await sendMessage({ type: 'GET_SESSION' });
  renderSession(response && response.session);
  chrome.storage.sync.get({ tasks: [] }, (data) => renderTasks(data.tasks));
})();
