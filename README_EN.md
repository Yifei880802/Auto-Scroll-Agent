# Auto Scroll Agent

[English](README_EN.md) | [中文](README.md)

A Chrome extension that auto-scrolls any element on any website to keep the page active. Works with training platforms, long articles, dashboards — anywhere you need simulated scrolling activity.

## Features

- **Smart scan** — automatically finds all scrollable containers on the page (elements with native scrollbars)
- **Visual markers** — each scrollable element gets a red border and numbered badge floating above all page content
- **Full Page scroll** — scroll the entire page via `window.scrollBy`, always available as the first option
- **Popup-driven** — all operations happen inside the extension popup: scan, pick a target by number, start scrolling
- **State recovery** — close and reopen the popup anytime; the Stop button and timer resume seamlessly
- **Configurable** — adjustable scroll speed, interval, mouse/keyboard simulation, and focus hijacking

## Installation

### From source (developer mode)

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the extension folder

### From Chrome Web Store

*(Coming soon)*

## How to use

1. Navigate to any web page
2. Click the **Auto Scroll Agent** icon in your toolbar
3. The popup opens and automatically scans the page
4. You'll see a list of scrollable targets:
   - **Full Page** — scrolls the entire window (always available)
   - **Numbered elements** — inner scrollable containers with visible scrollbars
5. Click the target you want to scroll
6. Adjust settings if needed (speed, interval, etc.)
7. Click **Start** — the selected target begins auto-scrolling
8. Close the popup if you want; reopen it anytime to stop

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Speed (px) | 30 | Pixels to scroll per tick |
| Interval (s) | 2 | Seconds between each scroll tick |
| Simulate mouse | On | Periodically fires mousemove/click events on the target |
| Hijack focus | On | Prevents the page from detecting tab switches or window blur |

## Architecture

```
manifest.json      — Manifest V3, permissions: activeTab, storage, scripting
popup.html         — Extension popup UI with step indicator, element list, controls
popup.js           — Popup logic: inject content script, scan, render list, start/stop
content.js         — Page-side logic: scan DOM, create fixed overlays, auto-scroll
icons/             — Extension icons (16/48/128px)
```

### Key design decisions

- **No background script** — all state lives in content.js + chrome.storage for popup recovery
- **Fixed overlays** — red borders and number badges are rendered as `position: fixed` + `z-index: 99999999` elements, completely independent of page DOM and stacking contexts
- **Dynamic injection** — content.js is injected on demand via `chrome.scripting.executeScript`, not pre-loaded on every page
- **Scrollbar detection** — only elements with `overflow: auto/scroll` AND content overflow > 20px are identified, minimizing false positives

## Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Access the current tab to inject the scroll script |
| `storage` | Persist settings and running state across popup open/close |
| `scripting` | Dynamically inject content.js into the active page |

No data is collected, stored externally, or transmitted. Everything runs locally.

## Browser compatibility

Tested on Chrome 120+. Should work on any Chromium-based browser (Edge, Brave, Opera, Arc) that supports Manifest V3.

## License

MIT
