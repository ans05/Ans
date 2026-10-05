const POMODORO_SECONDS = 1500; // 25 minutes

// ---------- Pomodoro Timer ----------
// State lives in storage so it survives the popup closing; the background alarm notifies.
const timerDisplay = document.getElementById('timer');
let timerInterval;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' + s : s}`;
}

function renderTimer() {
  chrome.storage.local.get({ timerEnd: null }, ({ timerEnd }) => {
    if (!timerEnd) {
      clearInterval(timerInterval);
      timerDisplay.textContent = formatTime(POMODORO_SECONDS);
      return;
    }
    const left = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
    timerDisplay.textContent = formatTime(left);
  });
}

document.getElementById('start-timer').addEventListener('click', () => {
  const timerEnd = Date.now() + POMODORO_SECONDS * 1000;
  chrome.storage.local.set({ timerEnd }, () => {
    chrome.alarms.create('pomodoro', { when: timerEnd });
    clearInterval(timerInterval);
    timerInterval = setInterval(renderTimer, 1000);
    renderTimer();
  });
});

document.getElementById('reset-timer').addEventListener('click', () => {
  chrome.alarms.clear('pomodoro');
  chrome.storage.local.set({ timerEnd: null }, renderTimer);
});

chrome.storage.local.get({ timerEnd: null }, ({ timerEnd }) => {
  if (timerEnd) timerInterval = setInterval(renderTimer, 1000);
  renderTimer();
});

// ---------- Task Manager ----------
const taskList = document.getElementById('task-list');
const taskInput = document.getElementById('new-task');

function saveTasks(tasks) {
  chrome.storage.local.set({ tasks }, renderTasks);
}

function renderTasks() {
  chrome.storage.local.get({ tasks: [] }, ({ tasks }) => {
    taskList.innerHTML = '';
    tasks.forEach((task, i) => {
      const li = document.createElement('li');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.addEventListener('change', () => {
        tasks[i].done = checkbox.checked;
        saveTasks(tasks);
      });

      const label = document.createElement('span');
      label.textContent = ' ' + task.text;
      if (task.done) label.style.textDecoration = 'line-through';

      const remove = document.createElement('button');
      remove.textContent = 'Remove';
      remove.style.marginLeft = '10px';
      remove.addEventListener('click', () => {
        tasks.splice(i, 1);
        saveTasks(tasks);
      });

      li.append(checkbox, label, remove);
      taskList.appendChild(li);
    });
  });
}

function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;
  chrome.storage.local.get({ tasks: [] }, ({ tasks }) => {
    tasks.push({ text, done: false });
    taskInput.value = '';
    saveTasks(tasks);
  });
}

document.getElementById('add-task').addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTask();
});

// ---------- Website Blocker ----------
const blockedList = document.getElementById('blocked-list');
const blockInput = document.getElementById('block-url');

// Accepts "https://www.youtube.com/watch?v=1" or "youtube.com" and returns "youtube.com"
function normalizeSite(input) {
  try {
    const url = new URL(input.includes('://') ? input : 'https://' + input);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

document.getElementById('block-site').addEventListener('click', () => {
  const site = normalizeSite(blockInput.value.trim());
  if (!site) return;
  chrome.storage.sync.get({ blockedSites: [] }, ({ blockedSites }) => {
    if (blockedSites.includes(site)) {
      alert('This site is already blocked.');
      return;
    }
    chrome.storage.sync.set({ blockedSites: [...blockedSites, site] }, () => {
      displayBlockedSites();
      blockInput.value = '';
    });
  });
});

function displayBlockedSites() {
  chrome.storage.sync.get({ blockedSites: [] }, ({ blockedSites }) => {
    blockedList.innerHTML = '';
    blockedSites.forEach((site) => {
      const li = document.createElement('li');
      li.textContent = site;

      const remove = document.createElement('button');
      remove.textContent = 'Remove';
      remove.style.marginLeft = '10px';
      remove.addEventListener('click', () => {
        chrome.storage.sync.set(
          { blockedSites: blockedSites.filter((s) => s !== site) },
          displayBlockedSites
        );
      });

      li.appendChild(remove);
      blockedList.appendChild(li);
    });
  });
}

document.getElementById('clear-blocked-list').addEventListener('click', () => {
  chrome.storage.sync.set({ blockedSites: [] }, displayBlockedSites);
});

renderTasks();
displayBlockedSites();
