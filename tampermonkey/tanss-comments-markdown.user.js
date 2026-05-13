// Before installing: set the @match line below to your own TANSS ticket
// system URL. Examples:
//   // @match     https://ticket.example.com/*
//   // @match     https://tanss.mycompany.de/*
// Multiple @match lines are allowed if you use several TANSS instances.

// ==UserScript==
// @name         tanss-comments-markdown
// @namespace    https://github.com/compositiv/tanss-tools
// @version      2026-05-13.12-00
// @updateURL    https://raw.githubusercontent.com/compositiv/tanss-tools/main/tampermonkey/tanss-comments-markdown.user.js
// @downloadURL  https://raw.githubusercontent.com/compositiv/tanss-tools/main/tampermonkey/tanss-comments-markdown.user.js
// @homepageURL  https://github.com/compositiv/tanss-tools
// @supportURL   https://github.com/compositiv/tanss-tools/issues
// @description  Rendert Markdown in TANSS-Ticketkommentaren
// @match        https://your-tanss-host.example.com/*
// @require      https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js
// @require      https://cdn.jsdelivr.net/npm/dompurify@3.2.4/dist/purify.min.js
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

/* globals marked, DOMPurify */
(function () {
  "use strict";

  // --- Konfiguration ---

  const COMMENT_SELECTOR = ".tns-comment .entry-body-content > div";
  const PROCESSED_ATTR = "data-md-rendered";
  const DEBUG = false; // Timing-Ausgaben in der Konsole

  // --- Marked konfigurieren ---

  marked.setOptions({
    breaks: true, // Einzelne Zeilenumbrueche werden zu <br>
    gfm: true, // GitHub Flavored Markdown (Tabellen, Strikethrough, etc.)
  });

  // --- Styling ---

  GM_addStyle(`
    /* Basis-Styling fuer gerenderten Markdown in Kommentaren */
    [${PROCESSED_ATTR}] {
      line-height: 1.5;
      word-wrap: break-word;
    }

    [${PROCESSED_ATTR}] p {
      margin: 0.4em 0;
    }

    [${PROCESSED_ATTR}] p:first-child {
      margin-top: 0;
    }

    [${PROCESSED_ATTR}] p:last-child {
      margin-bottom: 0;
    }

    [${PROCESSED_ATTR}] code {
      background: rgba(0, 0, 0, 0.06);
      padding: 0.15em 0.35em;
      border-radius: 3px;
      font-size: 0.9em;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }

    [${PROCESSED_ATTR}] pre {
      background: rgba(0, 0, 0, 0.06);
      padding: 0.8em;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0.5em 0;
    }

    [${PROCESSED_ATTR}] pre code {
      background: none;
      padding: 0;
      font-size: 0.85em;
    }

    [${PROCESSED_ATTR}] blockquote {
      border-left: 3px solid #ccc;
      margin: 0.5em 0;
      padding: 0.2em 0.8em;
      color: #666;
    }

    [${PROCESSED_ATTR}] ul,
    [${PROCESSED_ATTR}] ol {
      margin: 0.3em 0;
      padding-left: 1.5em;
    }

    [${PROCESSED_ATTR}] li {
      margin: 0.15em 0;
    }

    [${PROCESSED_ATTR}] table {
      border-collapse: collapse;
      margin: 0.5em 0;
    }

    [${PROCESSED_ATTR}] th,
    [${PROCESSED_ATTR}] td {
      border: 1px solid #ddd;
      padding: 0.3em 0.6em;
    }

    [${PROCESSED_ATTR}] th {
      background: rgba(0, 0, 0, 0.04);
    }

    [${PROCESSED_ATTR}] img {
      max-width: 100%;
    }

    [${PROCESSED_ATTR}] a {
      color: #0366d6;
      text-decoration: none;
    }

    [${PROCESSED_ATTR}] a:hover {
      text-decoration: underline;
    }

    [${PROCESSED_ATTR}] hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 0.6em 0;
    }

    /* Checkbox-Listen (GFM task lists) */
    [${PROCESSED_ATTR}] ul.contains-task-list {
      list-style: none;
      padding-left: 0.5em;
    }

    [${PROCESSED_ATTR}] input[type="checkbox"] {
      margin-right: 0.4em;
    }
  `);

  // --- Kern-Logik ---

  /**
   * Extrahiert Text aus einem Element und bewahrt Zeilenumbrueche.
   * TANSS speichert Zeilen als <br>, <div> oder <p> — textContent
   * verliert diese Struktur, daher muessen wir sie manuell zu \n wandeln.
   */
  function extractText(el) {
    const clone = el.cloneNode(true);

    // <br> -> Newline
    clone.querySelectorAll("br").forEach((br) => {
      br.replaceWith("\n");
    });

    // Block-Elemente: Newline davor einfuegen (div, p, etc.)
    clone.querySelectorAll("div, p, li, tr, blockquote").forEach((block) => {
      block.before("\n");
    });

    return clone.textContent.replace(/\r\n/g, "\n").replace(/^\n+/, "").trimEnd();
  }

  /**
   * Prueft ob ein Text wahrscheinlich Markdown enthaelt.
   * Vermeidet unnoetige Konvertierung bei reinem Plaintext.
   */
  function looksLikeMarkdown(text) {
    return /(?:^#{1,6}\s|^[\-\*\+]\s|^>\s|^```|`[^`]+`|\*\*.+\*\*|_.+_|~~.+~~|\[.+\]\(.+\)|^\d+\.\s|^\|.+\||\- \[[ xX]\])/m.test(
      text
    );
  }

  /**
   * Rendert Markdown im gegebenen Element.
   */
  function renderMarkdown(el) {
    if (el.hasAttribute(PROCESSED_ATTR)) return;

    const raw = extractText(el);
    if (!raw || !raw.trim()) return;
    if (!looksLikeMarkdown(raw)) {
      el.setAttribute(PROCESSED_ATTR, "skip");
      return;
    }

    const html = DOMPurify.sanitize(marked.parse(raw));
    el.innerHTML = html;
    el.setAttribute(PROCESSED_ATTR, "true");
  }

  /**
   * Verarbeitet alle sichtbaren, noch nicht gerenderten Kommentare.
   */
  function isTicketView() {
    const params = new URLSearchParams(location.search);
    return params.get("section") === "bug" && params.get("sub") === "view" && params.has("bugID");
  }

  function processComments() {
    if (!isTicketView()) return;
    document.querySelectorAll(COMMENT_SELECTOR).forEach(renderMarkdown);
  }

  // --- MutationObserver fuer SPA-Navigation ---

  const t0 = DEBUG && performance.now();
  let debugTimer;

  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
    }
    if (shouldProcess) {
      processComments();
      if (DEBUG) {
        clearTimeout(debugTimer);
        debugTimer = setTimeout(() => {
          const count = document.querySelectorAll(`[${PROCESSED_ATTR}]`).length;
          const ms = performance.now() - t0;
          const duration = ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(1)} ms`;
          console.debug(`[TANSS-MD] ${count} Kommentare gerendert in ${duration}`);
        }, 500);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initiales Rendering
  processComments();
})();
