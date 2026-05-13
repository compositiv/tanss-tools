# tanss-tools

Userscripts and helpers for the [TANSS](https://www.tanss.de) ticket system.

> **Note:** Scripts in this repository are created with the help of AI.

## Tampermonkey userscripts

All userscripts live in [`tampermonkey/`](./tampermonkey).

### tanss-checklist-rightside

Moves TANSS checklists out of the ticket flow into a fixed, resizable sidebar on
the right side of the screen. The ticket area on the left becomes independently
scrollable, so long checklists no longer push the ticket content out of view.

Features:

- Fixed right-hand sidebar with all checklists of the current ticket
- Drag-resizable (width persisted in `localStorage`)
- Auto-collapses on tickets without checklists, auto-expands when they appear (manual toggle overrides until the next ticket)
- Only activates on the ticket view (`section=bug&sub=view&bugID=...`)

Install: [tanss-checklist-rightside.user.js](./tampermonkey/tanss-checklist-rightside.user.js)

### tanss-comments-markdown

Renders Markdown inside TANSS ticket comments. Plain comments are left
untouched; only comments that actually look like Markdown are converted, so
ordinary text is not reformatted.

Features:

- GitHub Flavored Markdown via [marked](https://github.com/markedjs/marked)
  (tables, task lists, strikethrough, fenced code, etc.)
- HTML sanitized with [DOMPurify](https://github.com/cure53/DOMPurify) before
  insertion
- Preserves the original line structure from TANSS (`<br>`, `<div>`, `<p>`)
- Only activates on the ticket view (`section=bug&sub=view&bugID=...`)

Install: [tanss-comments-markdown.user.js](./tampermonkey/tanss-comments-markdown.user.js)

### Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open the raw script link above for the script you want.
3. Tampermonkey will prompt to install it.

### Configuring your TANSS URL

The scripts ship with a placeholder `@match`
(`https://your-tanss-host.example.com/*`). You **must** replace this with your
own TANSS instance URL before a script will do anything. Edit the `@match` line
in the userscript header:

```js
// @match        https://ticket.example.com/*
```

You can add multiple `@match` lines if you use several TANSS instances:

```js
// @match        https://ticket.example.com/*
// @match        https://tanss.mycompany.de/*
```

Tampermonkey lets you edit the script directly from its dashboard
(*Installed Userscripts → \<script name\> → Edit*).

## License

See [LICENSE](./LICENSE).
