// Before installing: set the @match line below to your own TANSS ticket
// system URL. Examples:
//   // @match     https://ticket.example.com/*
//   // @match     https://tanss.mycompany.de/*
// Multiple @match lines are allowed if you use several TANSS instances.

// ==UserScript==
// @name         tanss-checklist-rightside
// @namespace    https://github.com/compositiv/tanss-tools
// @version      2026-05-13.12-00
// @updateURL    https://raw.githubusercontent.com/compositiv/tanss-tools/main/tampermonkey/tanss-checklist-rightside.user.js
// @downloadURL  https://raw.githubusercontent.com/compositiv/tanss-tools/main/tampermonkey/tanss-checklist-rightside.user.js
// @homepageURL  https://github.com/compositiv/tanss-tools
// @supportURL   https://github.com/compositiv/tanss-tools/issues
// @description  Verschiebt TANSS-Checklisten in eine fixierte, resizebare Seitenleiste rechts und macht das Ticket links unabhaengig scrollbar
// @match        https://your-tanss-host.example.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const SIDEBAR_ID = "tcr-sidebar";
  const TOGGLE_BTN_ID = "tcr-toggle";
  const RESIZER_ID = "tcr-resizer";
  const EMPTY_MSG_ID = "tcr-empty";
  const CHECKLIST_SELECTOR = ".tns-checklist-container";
  const LS_WIDTH = "tcr.width";
  const MIN_WIDTH = 280;
  const MAX_WIDTH = 1200;
  const DEFAULT_WIDTH = 420;
  const COLLAPSED_WIDTH = 28;

  GM_addStyle(`
    body.tcr-active {
      --tcr-width: ${DEFAULT_WIDTH}px;
    }
    body.tcr-active #v4_overallContainer {
      padding-right: var(--tcr-width);
      box-sizing: border-box;
      transition: padding-right 0.12s ease;
    }
    body.tcr-active.tcr-collapsed #v4_overallContainer {
      padding-right: ${COLLAPSED_WIDTH}px;
    }

    #${SIDEBAR_ID} {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: var(--tcr-width, ${DEFAULT_WIDTH}px);
      background: var(--tns-color-white, #fff);
      border-left: 1px solid var(--tns-color-grey-1, #ccc);
      z-index: 9000;
      display: none;
      flex-direction: column;
      box-shadow: -2px 0 6px rgba(0, 0, 0, 0.08);
      font-family: Inter, sans-serif;
      transition: width 0.12s ease;
    }
    body.tcr-active #${SIDEBAR_ID} {
      display: flex;
    }
    body.tcr-collapsed #${SIDEBAR_ID} {
      width: ${COLLAPSED_WIDTH}px;
    }

    #${SIDEBAR_ID} .tcr-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: #2a354b;
      color: #fff;
      border-bottom: 1px solid var(--tns-color-grey-1, #ccc);
      font-weight: 600;
      font-size: 12px;
      user-select: none;
      flex-shrink: 0;
    }
    body.tcr-collapsed #${SIDEBAR_ID} .tcr-header {
      padding: 6px 2px;
      justify-content: center;
    }
    body.tcr-collapsed #${SIDEBAR_ID} .tcr-title {
      display: none;
    }

    #${TOGGLE_BTN_ID} {
      background: var(--tns-color-white, #fff);
      border: 1px solid var(--tns-color-grey-1, #ccc);
      border-radius: 3px;
      cursor: pointer;
      padding: 1px 7px;
      font-size: 14px;
      line-height: 1;
      color: inherit;
    }
    #${TOGGLE_BTN_ID}:hover {
      background: var(--tns-color-grey-1, #ddd);
    }

    #${SIDEBAR_ID} .tcr-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    body.tcr-collapsed #${SIDEBAR_ID} .tcr-content {
      display: none;
    }

    #${EMPTY_MSG_ID} {
      color: var(--tns-color-grey-1, #888);
      font-style: italic;
      font-size: 12px;
      padding: 14px 8px;
      text-align: center;
    }

    #${RESIZER_ID} {
      position: absolute;
      left: -2px;
      top: 0;
      bottom: 0;
      width: 6px;
      cursor: ew-resize;
      background: transparent;
      z-index: 1;
    }
    #${RESIZER_ID}:hover,
    #${RESIZER_ID}.tcr-resizing {
      background: var(--tns-color-blue-1, #4a90e2);
      opacity: 0.6;
    }
    body.tcr-collapsed #${RESIZER_ID} {
      display: none;
    }

    /* Bei aktiver Seitenleiste das Resizing waehrend des Drags entkoppeln */
    body.tcr-resizing,
    body.tcr-resizing * {
      cursor: ew-resize !important;
      user-select: none !important;
    }
    body.tcr-resizing #${SIDEBAR_ID},
    body.tcr-resizing #v4_overallContainer {
      transition: none !important;
    }
  `);

  let sidebar = null;
  let content = null;
  let emptyMsg = null;
  let lastUrl = "";
  let userToggledThisTicket = false;
  let lastChecklistPresence = null;

  function isTicketView() {
    const p = new URLSearchParams(location.search);
    return p.get("section") === "bug" && p.get("sub") === "view" && p.has("bugID");
  }

  function applyStoredWidth() {
    const stored = parseInt(localStorage.getItem(LS_WIDTH), 10);
    const w = stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH;
    document.body.style.setProperty("--tcr-width", w + "px");
  }

  function updateToggleIcon() {
    const btn = document.getElementById(TOGGLE_BTN_ID);
    if (!btn) return;
    const collapsed = document.body.classList.contains("tcr-collapsed");
    btn.textContent = collapsed ? "‹" : "›";
    btn.title = collapsed ? "Checklisten einblenden" : "Checklisten ausblenden";
  }

  function toggleCollapsed() {
    userToggledThisTicket = true;
    const next = !document.body.classList.contains("tcr-collapsed");
    document.body.classList.toggle("tcr-collapsed", next);
    updateToggleIcon();
  }

  function applyAutoCollapsed(hasChecklists) {
    if (userToggledThisTicket) return;
    document.body.classList.toggle("tcr-collapsed", !hasChecklists);
    updateToggleIcon();
  }

  function setupResize(handle) {
    let startX = 0;
    let startWidth = 0;

    function onMove(e) {
      const delta = startX - e.clientX;
      let next = startWidth + delta;
      if (next < MIN_WIDTH) next = MIN_WIDTH;
      if (next > MAX_WIDTH) next = MAX_WIDTH;
      document.body.style.setProperty("--tcr-width", next + "px");
    }
    function onUp() {
      handle.classList.remove("tcr-resizing");
      document.body.classList.remove("tcr-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const cs = getComputedStyle(document.body).getPropertyValue("--tcr-width");
      const w = parseInt(cs, 10);
      if (w) localStorage.setItem(LS_WIDTH, String(w));
    }
    handle.addEventListener("mousedown", function (e) {
      if (document.body.classList.contains("tcr-collapsed")) return;
      e.preventDefault();
      handle.classList.add("tcr-resizing");
      document.body.classList.add("tcr-resizing");
      startX = e.clientX;
      const cs = getComputedStyle(document.body).getPropertyValue("--tcr-width");
      startWidth = parseInt(cs, 10) || DEFAULT_WIDTH;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function buildSidebar() {
    if (sidebar) return;

    sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;

    const resizer = document.createElement("div");
    resizer.id = RESIZER_ID;

    const header = document.createElement("div");
    header.className = "tcr-header";

    const title = document.createElement("span");
    title.className = "tcr-title";
    title.textContent = "Checklisten";

    const toggleBtn = document.createElement("button");
    toggleBtn.id = TOGGLE_BTN_ID;
    toggleBtn.type = "button";
    toggleBtn.addEventListener("click", toggleCollapsed);

    header.appendChild(title);
    header.appendChild(toggleBtn);

    content = document.createElement("div");
    content.className = "tcr-content";

    emptyMsg = document.createElement("div");
    emptyMsg.id = EMPTY_MSG_ID;
    emptyMsg.textContent = "Keine Checkliste in diesem Ticket.";
    content.appendChild(emptyMsg);

    sidebar.appendChild(resizer);
    sidebar.appendChild(header);
    sidebar.appendChild(content);

    document.body.appendChild(sidebar);

    setupResize(resizer);
    applyStoredWidth();
    updateToggleIcon();
  }

  function updateEmptyMsg() {
    if (!content || !emptyMsg) return;
    const hasChecklists = content.querySelector(CHECKLIST_SELECTOR) !== null;
    emptyMsg.style.display = hasChecklists ? "none" : "";
  }

  function moveChecklists() {
    if (!content) return;
    document.querySelectorAll(CHECKLIST_SELECTOR).forEach((cl) => {
      if (sidebar.contains(cl)) return;
      content.appendChild(cl);
    });
    updateEmptyMsg();
  }

  function clearSidebar() {
    if (!content) return;
    content.querySelectorAll(CHECKLIST_SELECTOR).forEach((el) => el.remove());
    updateEmptyMsg();
  }

  function update() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearSidebar();
      userToggledThisTicket = false;
      lastChecklistPresence = null;
    }
    if (isTicketView()) {
      const hasChecklists = document.querySelector(CHECKLIST_SELECTOR) !== null;
      if (hasChecklists !== lastChecklistPresence) {
        lastChecklistPresence = hasChecklists;
        applyAutoCollapsed(hasChecklists);
      }
      buildSidebar();
      document.body.classList.add("tcr-active");
      moveChecklists();
    } else {
      document.body.classList.remove("tcr-active");
    }
  }

  let scheduled = false;
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  }

  new MutationObserver(scheduleUpdate).observe(document.body, {
    childList: true,
    subtree: true,
  });

  update();
})();
