// Lock In — background service worker.
// Owns the focus session state so the countdown keeps running after the popup closes.
//
// Storage layout
//   chrome.storage.local.session  -> { active, startedAt, endsAt, durationMin, strict }
//   chrome.storage.local.stats    -> { sessionsCompleted, minutesLocked }
//   chrome.storage.sync.blockedSites -> ["youtube.com", "twitter.com", ...]

const ALARM_NAME = 'lockin-session-end';
const DEFAULT_SESSION = { active: false, startedAt: 0, endsAt: 0, durationMin: 0, strict: false };
const DEFAULT_STATS = { sessionsCompleted: 0, minutesLocked: 0 };

// ---------- helpers ----------

function getLocal(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
}

function setLocal(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function getBlockedSites() {
  return new Promise((resolve) =>
    chrome.storage.sync.get({ blockedSites: [] }, (data) => resolve(data.blockedSites || []))
  );
}

// Normalise a user-entered site ("https://www.YouTube.com/feed") to a bare host ("youtube.com").
function normalizeSite(input) {
  let value = String(input || '').trim().toLowerCase();
  if (!value) return '';
  value = value.replace(/^[a-z]+:\/\//, ''); // strip protocol
  value = value.split(/[/?#]/)[0]; // strip path
  value = value.replace(/^www\./, '');
  return value;
}

function urlIsBlocked(url, blockedSites) {
  if (!url || blockedSites.length === 0) return false;
  let host;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return false; // never touch chrome://, extension pages, etc.
    host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return false;
  }
  return blockedSites.some((site) => {
    const blocked = normalizeSite(site);
    return blocked && (host === blocked || host.endsWith('.' + blocked));
  });
}

function blockedPageUrl(originalUrl) {
  return chrome.runtime.getURL('blocked.html') + '?from=' + encodeURIComponent(originalUrl);
}

async function sessionIsActive() {
  const { session } = await getLocal({ session: DEFAULT_SESSION });
  if (!session.active) return false;
  if (Date.now() >= session.endsAt) {
    // Alarm was missed (e.g. machine asleep); finish the session now.
    await finishSession(true);
    return false;
  }
  return true;
}

// Redirect every open tab that is on a blocked site.
async function sweepOpenTabs() {
  const blockedSites = await getBlockedSites();
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id !== undefined && urlIsBlocked(tab.url, blockedSites)) {
        chrome.tabs.update(tab.id, { url: blockedPageUrl(tab.url) });
      }
    });
  });
}

// ---------- session lifecycle ----------

async function startSession(durationMin, strict) {
  const minutes = Math.max(1, Math.min(600, Number(durationMin) || 25));
  const now = Date.now();
  const session = {
    active: true,
    startedAt: now,
    endsAt: now + minutes * 60 * 1000,
    durationMin: minutes,
    strict: Boolean(strict),
  };
  await setLocal({ session });
  chrome.alarms.create(ALARM_NAME, { when: session.endsAt });
  chrome.action.setBadgeBackgroundColor({ color: '#e53935' });
  updateBadge(session);
  await sweepOpenTabs();
  return session;
}

async function finishSession(completed) {
  const { session, stats } = await getLocal({ session: DEFAULT_SESSION, stats: DEFAULT_STATS });
  if (!session.active) return;

  const elapsedMin = Math.round(Math.max(0, Math.min(Date.now(), session.endsAt) - session.startedAt) / 60000);
  const newStats = {
    sessionsCompleted: stats.sessionsCompleted + (completed ? 1 : 0),
    minutesLocked: stats.minutesLocked + elapsedMin,
  };

  await setLocal({ session: { ...DEFAULT_SESSION }, stats: newStats });
  chrome.alarms.clear(ALARM_NAME);
  chrome.action.setBadgeText({ text: '' });

  if (completed) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/spotlight.png',
      title: 'Lock In complete',
      message: `Nice. You stayed locked in for ${session.durationMin} minutes. Take a break.`,
    });
  }
}

function updateBadge(session) {
  if (!session || !session.active) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const minutesLeft = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 60000));
  chrome.action.setBadgeText({ text: String(minutesLeft) });
}

// ---------- event wiring ----------

chrome.runtime.onInstalled.addListener(async () => {
  const { session } = await getLocal({ session: DEFAULT_SESSION });
  updateBadge(session);
  // Keep the badge minute count fresh while a session runs.
  chrome.alarms.create('lockin-badge-tick', { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create('lockin-badge-tick', { periodInMinutes: 1 });
  if (await sessionIsActive()) {
    const { session } = await getLocal({ session: DEFAULT_SESSION });
    chrome.alarms.create(ALARM_NAME, { when: session.endsAt });
    updateBadge(session);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await finishSession(true);
  } else if (alarm.name === 'lockin-badge-tick') {
    const { session } = await getLocal({ session: DEFAULT_SESSION });
    if (session.active && Date.now() >= session.endsAt) {
      await finishSession(true);
    } else {
      updateBadge(session);
    }
  }
});

// Block navigation to distracting sites while locked in.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (!url) return;
  if (!(await sessionIsActive())) return;
  const blockedSites = await getBlockedSites();
  if (urlIsBlocked(url, blockedSites)) {
    chrome.tabs.update(tabId, { url: blockedPageUrl(url) });
  }
});

// If the block list changes mid-session, apply it immediately.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' && changes.blockedSites && (await sessionIsActive())) {
    await sweepOpenTabs();
  }
});

// Messages from the popup and the blocked page.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message && message.type) {
      case 'START_LOCK_IN': {
        const session = await startSession(message.durationMin, message.strict);
        sendResponse({ ok: true, session });
        break;
      }
      case 'END_LOCK_IN': {
        const { session } = await getLocal({ session: DEFAULT_SESSION });
        if (session.active && session.strict) {
          sendResponse({ ok: false, error: 'Strict mode is on. This session cannot be ended early.' });
          break;
        }
        await finishSession(false);
        sendResponse({ ok: true });
        break;
      }
      case 'GET_SESSION': {
        await sessionIsActive(); // finalises an expired session if needed
        const { session } = await getLocal({ session: DEFAULT_SESSION });
        sendResponse({ ok: true, session });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message' });
    }
  })();
  return true; // keep the message channel open for the async response
});
