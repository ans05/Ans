# Lock In

A Chrome extension for locking in. Start a focus session, and every site on your block list
is redirected to a "you're locked in" page until the timer runs out.

## Features

- **Lock In sessions** – 25 / 50 / 90 minute presets or a custom length. The countdown runs in
  the background, so it keeps going after you close the popup, and the toolbar badge shows the
  minutes remaining.
- **Site blocking during sessions** – blocked sites open a full-page "locked in" screen that
  shows the time left and your task list, instead of just closing the tab. Already-open tabs
  on blocked sites are redirected the moment you start.
- **Strict mode** – optional. When on, the session cannot be ended early from anywhere.
- **Tasks** – a persistent to-do list, synced with your Chrome profile.
- **Stats** – completed sessions and total minutes locked in.
- **One-click presets** – add YouTube, X/Twitter, Instagram, TikTok, Reddit and friends in one go.

## Install (unpacked)

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick this folder.
5. Pin the extension and hit **Lock In**.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest (Manifest V3). |
| `background.js` | Service worker: owns session state, alarms, badge, and site blocking. |
| `popup.html/css/js` | The toolbar popup: start/end sessions, tasks, block list, stats. |
| `blocked.html/css/js` | Page shown in place of a blocked site during a session. |

## How blocking works

Sites are matched by hostname. Entering `youtube.com` blocks `youtube.com`, `www.youtube.com`
and `m.youtube.com`. Blocking is only active while a session is running; outside a session
you can browse normally.
