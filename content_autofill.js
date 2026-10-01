// content_autofill.js — injected on demand, fills job application forms

if (!window.__autofillListenerAttached) {
  window.__autofillListenerAttached = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'AUTOFILL_JOB') return;
    const filled = autofill(msg.profile);
    sendResponse({ filled });
  });
}

function autofill(p) {
  // Map of common field name/id/label patterns → profile value
  const rules = [
    { patterns: ['first.?name', 'firstname', 'fname', 'given.?name'], value: firstName(p['j-name']) },
    { patterns: ['last.?name', 'lastname', 'lname', 'family.?name', 'surname'], value: lastName(p['j-name']) },
    { patterns: ['full.?name', 'name', 'applicant.?name', 'your.?name'], value: p['j-name'] },
    { patterns: ['email', 'e-mail'], value: p['j-email'] },
    { patterns: ['phone', 'mobile', 'cell', 'telephone'], value: p['j-phone'] },
    { patterns: ['linkedin'], value: p['j-linkedin'] },
    { patterns: ['github', 'portfolio', 'website', 'personal.?url', 'homepage'], value: p['j-website'] },
    { patterns: ['city', 'location', 'address', 'where.?are.?you'], value: p['j-location'] },
    { patterns: ['years?.?of?.?exp', 'experience', 'yoe'], value: p['j-experience'] },
  ];

  let count = 0;

  // Collect all visible text inputs, email inputs, tel inputs, and textareas
  const inputs = [...document.querySelectorAll('input[type=text], input[type=email], input[type=tel], input[type=url], input:not([type]), textarea')];

  inputs.forEach(el => {
    if (!isVisible(el)) return;
    const hint = fieldHint(el);
    for (const rule of rules) {
      if (!rule.value) continue;
      if (rule.patterns.some(pat => new RegExp(pat, 'i').test(hint))) {
        if (!el.value) {
          setNativeValue(el, rule.value);
          count++;
        }
        break;
      }
    }
  });

  // Simplify.jobs uses React — also try to fill by aria-label / placeholder on any missed inputs
  inputs.forEach(el => {
    if (!isVisible(el) || el.value) return;
    const hint = fieldHint(el);
    for (const rule of rules) {
      if (!rule.value) continue;
      if (rule.patterns.some(pat => new RegExp(pat, 'i').test(hint))) {
        setNativeValue(el, rule.value);
        count++;
        break;
      }
    }
  });

  return count;
}

function fieldHint(el) {
  const parts = [
    el.name || '',
    el.id || '',
    el.placeholder || '',
    el.getAttribute('aria-label') || '',
    el.getAttribute('data-testid') || '',
    labelText(el),
  ];
  return parts.join(' ');
}

function labelText(el) {
  if (el.labels && el.labels.length) return el.labels[0].textContent;
  if (el.id) {
    const lbl = document.querySelector(`label[for="${el.id}"]`);
    if (lbl) return lbl.textContent;
  }
  // Try closest label ancestor
  const ancestor = el.closest('label');
  return ancestor ? ancestor.textContent : '';
}

// React-friendly value setter — triggers onChange synthetic event
function setNativeValue(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function isVisible(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function firstName(full) {
  if (!full) return '';
  return full.trim().split(/\s+/)[0];
}

function lastName(full) {
  if (!full) return '';
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}
