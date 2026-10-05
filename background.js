// Returns true if the tab's hostname matches any blocked site (or a subdomain of it)
function isBlocked(url, blockedSites) {
  if (!url) return false;
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return blockedSites.some((site) => hostname === site || hostname.endsWith('.' + site));
}

// When the blocked list changes, close any open tabs that now match
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.blockedSites) {
    const blockedSites = changes.blockedSites.newValue || [];
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (isBlocked(tab.url, blockedSites)) chrome.tabs.remove(tab.id);
      });
    });
  }
});

// Close tabs that navigate to a blocked site
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  chrome.storage.sync.get({ blockedSites: [] }, (data) => {
    if (isBlocked(url, data.blockedSites)) chrome.tabs.remove(tabId);
  });
});

// Pomodoro: the alarm keeps running even when the popup is closed
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'pomodoro') return;
  chrome.storage.local.set({ timerEnd: null });
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/spotlight.png',
    title: 'Spotlight',
    message: 'Time is up! Take a break.',
  });
});
