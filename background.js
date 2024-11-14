  // Listen for storage changes and update the list of blocked sites in real time
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.blockedSites) {
      chrome.tabs.query({}, (tabs) => {
        const blockedUrls = changes.blockedSites.newValue || [];
        tabs.forEach((tab) => {
          if (blockedUrls.some((url) => tab.url.includes(url))) {
            chrome.tabs.remove(tab.id);
          }
        });
      });
    }
  });
  
  // Listen for tab updates and block the website if it's in the blocked list
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    chrome.storage.sync.get({ blockedSites: [] }, (data) => {
      const blockedUrls = data.blockedSites || [];
      if (blockedUrls.some((url) => tab.url.includes(url))) {
        chrome.tabs.remove(tabId);
      }
    });
  });
  
  
  