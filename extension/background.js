chrome.action.onClicked.addListener(async (tab) => {
  const job = { title: tab.title || "", url: tab.url || "", text: "" };
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        text: (document.body?.innerText || "").slice(0, 20000),
      }),
    });
    if (res?.result) {
      job.title = res.result.title || job.title;
      job.text = res.result.text;
    }
  } catch (_) {
    // chrome:// and store pages can't be read; the tailor page still opens
  }
  await chrome.storage.local.set({ pendingJob: job });
  chrome.tabs.create({ url: chrome.runtime.getURL("tailor.html") });
});
