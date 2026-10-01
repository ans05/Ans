// Pomodoro Timer
let timerInterval;
let timeLeft = 1500; // 25 minutes in seconds
const timerDisplay = document.getElementById('timer');

document.getElementById('start-timer').addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    } else {
      clearInterval(timerInterval);
      alert('Time is up! Take a break.');
    }
  }, 1000);
});

document.getElementById('reset-timer').addEventListener('click', () => {
  clearInterval(timerInterval);
  timeLeft = 1500;
  timerDisplay.textContent = '25:00';
});

// Task Manager
const taskList = document.getElementById('task-list');
document.getElementById('add-task').addEventListener('click', () => {
  const taskInput = document.getElementById('new-task');
  if (taskInput.value) {
    const taskItem = document.createElement('li');
    taskItem.textContent = taskInput.value;
    taskList.appendChild(taskItem);
    taskInput.value = '';
  }
});
// Website Blocker Elements
const blockedList = document.getElementById('blocked-list');
const blockInput = document.getElementById('block-url');
const blockButton = document.getElementById('block-site');
const clearBlockedButton = document.getElementById('clear-blocked-list');

// Function to block a website
blockButton.addEventListener('click', () => {
  const blockUrl = blockInput.value.trim();
  if (blockUrl) {
    // Add the URL to the storage array
    chrome.storage.sync.get({ blockedSites: [] }, (data) => {
      // Prevent duplicate entries
      if (!data.blockedSites.includes(blockUrl)) {
        const updatedSites = [...data.blockedSites, blockUrl];
        chrome.storage.sync.set({ blockedSites: updatedSites }, () => {
          displayBlockedSites();
          blockInput.value = ''; // Clear input field
        });
      } else {
        alert("This site is already blocked.");
      }
    });
  }
});

// Function to display the list of blocked sites
function displayBlockedSites() {
  chrome.storage.sync.get({ blockedSites: [] }, (data) => {
    // Clear the current list
    blockedList.innerHTML = '';
    // Populate the list with blocked sites
    data.blockedSites.forEach((site) => {
      const listItem = document.createElement('li');
      listItem.textContent = site;

      // Add a "Remove" button for each site
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.style.marginLeft = '10px';
      removeButton.addEventListener('click', () => {
        removeBlockedSite(site);
      });

      listItem.appendChild(removeButton);
      blockedList.appendChild(listItem);
    });
  });
}

// Function to remove a specific blocked site
function removeBlockedSite(site) {
  chrome.storage.sync.get({ blockedSites: [] }, (data) => {
    const updatedSites = data.blockedSites.filter((blockedSite) => blockedSite !== site);
    chrome.storage.sync.set({ blockedSites: updatedSites }, displayBlockedSites);
  });
}

// Function to clear all blocked sites
clearBlockedButton.addEventListener('click', () => {
  chrome.storage.sync.set({ blockedSites: [] }, () => {
    displayBlockedSites();
    alert('All blocked sites have been cleared.');
  });
});

// Initial display of blocked sites on popup load
displayBlockedSites();

// ── Tab navigation ──────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ── Job Autofill ─────────────────────────────────────────────
const profileFields = ['j-name','j-email','j-phone','j-linkedin','j-website','j-location','j-experience','j-resume'];

// Load saved profile into inputs
chrome.storage.sync.get({ jobProfile: {} }, ({ jobProfile }) => {
  profileFields.forEach(id => {
    const el = document.getElementById(id);
    if (el && jobProfile[id]) el.value = jobProfile[id];
  });
});

document.getElementById('save-profile').addEventListener('click', () => {
  const profile = {};
  profileFields.forEach(id => {
    profile[id] = document.getElementById(id).value.trim();
  });
  chrome.storage.sync.set({ jobProfile: profile }, () => {
    const s = document.getElementById('jobs-status');
    s.textContent = 'Profile saved!';
    setTimeout(() => { s.textContent = ''; }, 2000);
  });
});

document.getElementById('autofill-now').addEventListener('click', () => {
  const profile = {};
  profileFields.forEach(id => {
    profile[id] = document.getElementById(id).value.trim();
  });
  const s = document.getElementById('jobs-status');
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content_autofill.js']
    }, () => {
      chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL_JOB', profile }, (resp) => {
        s.textContent = resp?.filled ? `Filled ${resp.filled} field(s)!` : 'No fillable fields found.';
        setTimeout(() => { s.textContent = ''; }, 3000);
      });
    });
  });
});
