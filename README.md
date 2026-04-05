# Craft Docs — Raycast Extension

Control [Craft](https://www.craft.do) from Raycast on **Windows & macOS** — without ever opening the app.

---

## Table of Contents

1. [Features](#features)
2. [Requirements](#requirements)
3. [Setup](#setup)
   - [Get Your API Keys](#1-get-your-api-keys)
   - [Install the Extension](#2-install-the-extension)
   - [Configure Preferences](#3-configure-preferences)
4. [Commands](#commands)
   - [Quick Note](#quick-note)
   - [Append to Daily Note](#append-to-daily-note)
   - [Open Daily Note](#open-daily-note)
   - [View Tasks](#view-tasks)
   - [Create Task](#create-task)
   - [Search Documents](#search-documents)
   - [Add to List](#add-to-list)
   - [Craft Scratchpad](#craft-scratchpad)
5. [Architecture](#architecture)
6. [API Reference Summary](#api-reference-summary)
7. [Development Guide](#development-guide)
8. [Troubleshooting](#troubleshooting)

---

## Features

| Command | Description |
|---|---|
| **Quick Note** | Create a note instantly in any folder |
| **Append to Daily Note** | Add a bullet/block to today's daily note (top or bottom) |
| **Open Daily Note** | View any of the last 14 daily notes inside Raycast |
| **View Tasks** | Browse Inbox / Active / Upcoming / Logbook, mark done, delete |
| **Create Task** | New task with optional schedule and due dates |
| **Search Documents** | Full-text search across your entire Craft space |
| **Add to List** | Pin documents (grocery list, ideas doc, etc.) and quickly append to them |
| **Craft Scratchpad** | Draft-persistent notepad that saves to Craft on submit |

---

## Requirements

- **Raycast** — [raycast.com](https://www.raycast.com) (v1.26+), Windows or macOS
- **Node.js** v22+ and npm v7+
- A **Craft** account with API access (Craft Pro or above)

---

## Setup

### 1. Get Your API Keys

Craft uses "secret link IDs" for API authentication — no Bearer tokens, just a secret segment in the URL.

You need **two separate** API connections:

**Documents API** (for all documents, folders, search):
1. Open Craft → **Settings** (⌘,) → **API** tab
2. Click **+ New Connection**
3. Choose **"All Documents"** scope
4. Copy the **Secret Link ID** from the generated URL:
   `https://connect.craft.do/links/YOUR-SECRET-LINK-ID/api/v1`
   The ID is the alphanumeric string between `/links/` and `/api/v1`.

**Daily Notes & Tasks API**:
1. Same flow as above, but choose **"Daily Notes and Tasks"** scope
2. Copy its separate Secret Link ID

> ⚠️ Keep these IDs private — they grant full read/write access to your Craft space.

---

### 2. Install the Extension

**Development mode (sideload):**

```bash
git clone https://github.com/vedant-aggarwal/craft-raycast-extension.git
cd craft-raycast-extension
npm install
npm run dev
```

Raycast will detect the extension in developer mode. Open Raycast and search for any command name (e.g. "Quick Note").

**Production build:**

```bash
npm run build
```

Then import via Raycast's **Import Extension** command.

---

### 3. Configure Preferences

On first use, Raycast will prompt for:

| Preference | Where to find it | Required |
|---|---|---|
| **Documents API Secret Link ID** | Craft → Settings → API → All Documents | ✅ |
| **Daily Notes & Tasks API Secret Link ID** | Craft → Settings → API → Daily Notes and Tasks | ✅ |

You can also open preferences any time via **⌘ ,** inside any command.

**Per-command preference:**

| Command | Preference | Default |
|---|---|---|
| Quick Note | Default Folder ID | Unsorted |

To find a folder's ID: use **Search Documents** → select a document in the folder → **Copy Document ID** (⌘⇧C). The parent folder ID can be found via `GET /folders` (see API docs or the Search Documents folder filter).

---

## Commands

### Quick Note

**Raycast search:** `Quick Note`

Creates a new document in Craft instantly.

| Field | Description |
|---|---|
| Title | Required. The document title. |
| Content | Optional markdown. Inserted as the first text block. |
| Save to Folder | Dropdown loaded from your Craft folders. Defaults to the folder set in preferences (or Unsorted). |

After creation, a toast appears with an **Open in Craft** action that launches the document directly.

**Tips:**
- Assign a Raycast global hotkey to this command for true quick-capture
- Enable drafts — your in-progress note is auto-saved between opens

---

### Append to Daily Note

**Raycast search:** `Append to Daily Note`

Adds a single block to **today's** Craft daily note without opening Craft.

| Field | Description |
|---|---|
| Content | The text to insert |
| Block Style | Plain text / Bullet / Numbered / To-Do checkbox |
| Insert At | Bottom (default) or Top of the daily note |

Uses the **Daily Notes & Tasks API** (`POST /blocks` with `position.date = "today"`).

---

### Open Daily Note

**Raycast search:** `Open Daily Note`

Shows a list of the **last 14 daily notes** (Today, Yesterday, then dates). Select any to view its full markdown content inside Raycast's Detail view.

**Actions available:**
- **Open in Craft** (⌘O) — opens the daily note directly in the Craft app
- **Copy Markdown** (⌘C) — copies the raw markdown to clipboard

---

### View Tasks

**Raycast search:** `View Tasks`

Lists tasks from your Craft space with a scope filter:

| Scope | Description |
|---|---|
| Inbox | Unscheduled open tasks |
| Active | Scheduled for today or overdue |
| Upcoming | Scheduled for future dates |
| Logbook | Completed / canceled tasks |

**Actions per task:**
- **Mark as Done** (⌘D) — moves to Logbook
- **Reopen** (⌘D on completed tasks) — returns to open state
- **Delete** (⌘⌫) — permanently removes the task with confirmation
- **Refresh** (⌘R) — re-fetches the task list

Overdue tasks are highlighted in red in the accessories column.

---

### Create Task

**Raycast search:** `Create Task`

Form to create a new Craft task:

| Field | Description |
|---|---|
| Task | Required. The task title. |
| Schedule Date | Optional. When to work on it. |
| Due Date | Optional. Hard deadline. |

Tasks created without dates go to **Inbox**.

---

### Search Documents

**Raycast search:** `Search Documents`

Full-text search across your entire Craft space with a 350ms debounce. Results are ranked by relevance (top 20 matches).

**Filter:** Use the folder dropdown (⌘P) to narrow results to a specific folder.

**Actions per result:**
- **Open in Craft** (⌘O) — opens the document in the app
- **Copy Title** (⌘C)
- **Copy Document ID** (⌘⇧C) — useful for pinning lists or setting preferences

---

### Add to List

**Raycast search:** `Add to List`

Quickly append items to any pinned Craft document (grocery list, ideas list, reading list, etc.).

**How to pin a document:**
1. Run **Search Documents** and find the document you want to use as a list
2. Copy its **Document ID** (⌘⇧C)
3. Run **Add to List** → "Pin a Document" → paste the ID and give it a name

**How to append:**
1. Run **Add to List**
2. Pick the list from the dropdown
3. Type your item, choose a style (bullet/todo/etc.), and choose position
4. Submit — the item appears immediately in Craft

Pinned lists are stored in Raycast's **LocalStorage** — they persist across sessions.

---

### Craft Scratchpad

**Raycast search:** `Craft Scratchpad`

A persistent, draft-enabled notepad. Unlike Quick Note, the scratchpad keeps your content alive between opens — ideal for capturing thoughts over time before committing.

| Field | Description |
|---|---|
| Title | Optional. Defaults to current timestamp. |
| Content | Your note. Drafts auto-saved. Markdown supported. |

On submit (⌘↵), a new Craft document is created with the content. After saving, an **Open in Craft** action appears in the toast.

**Tip:** Assign a hotkey in Raycast → Extensions → Craft Docs → Craft Scratchpad → Record Hotkey.

---

## Architecture

```
raycast-craft-docs-extension/
├── src/
│   ├── api/
│   │   ├── types.ts          # Shared TypeScript interfaces
│   │   ├── craft-docs.ts     # Documents API client (documents, folders, blocks, search)
│   │   └── craft-tasks.ts    # Daily Notes & Tasks API client (tasks, blocks, daily notes)
│   ├── quick-note.tsx        # Command: Quick Note
│   ├── daily-note.tsx        # Command: Append to Daily Note
│   ├── open-daily-note.tsx   # Command: Open Daily Note
│   ├── view-tasks.tsx        # Command: View Tasks
│   ├── create-task.tsx       # Command: Create Task
│   ├── search-documents.tsx  # Command: Search Documents
│   ├── add-to-list.tsx       # Command: Add to List
│   └── scratchpad.tsx        # Command: Craft Scratchpad
├── assets/
│   └── extension-icon.png    # 512×512 PNG (add your own)
├── package.json              # Raycast manifest + npm config
├── tsconfig.json
├── .eslintrc.json
└── README.md
```

**Two API clients, two secret link IDs:**

```
Craft Settings → API → All Documents       → docsSecretLinkId
                     → Daily Notes & Tasks  → tasksSecretLinkId
```

Both use `https://connect.craft.do/links/{secretLinkId}/api/v1` as base URL. Authentication is purely via the secret in the URL path — no headers required.

---

## API Reference Summary

### Documents API (`craft-docs.ts`)

| Function | HTTP | Description |
|---|---|---|
| `listDocuments()` | GET /documents | List all documents |
| `searchDocuments()` | GET /documents/search | Full-text search |
| `createDocument()` | POST /documents | Create document |
| `deleteDocument()` | DELETE /documents | Soft-delete to trash |
| `listFolders()` | GET /folders | List all folders |
| `getBlocks()` | GET /blocks | Fetch document blocks |
| `getBlocksAsMarkdown()` | GET /blocks | Fetch as markdown string |
| `insertBlocks()` | POST /blocks | Insert blocks into a document |
| `deleteBlocks()` | DELETE /blocks | Delete blocks by ID |
| `getConnectionInfo()` | GET /connection | Space ID + deep link templates |
| `buildDocumentDeepLink()` | — | Build `craftdocs://open?...` URL |

### Daily Notes & Tasks API (`craft-tasks.ts`)

| Function | HTTP | Description |
|---|---|---|
| `getTasks()` | GET /tasks | Get tasks by scope |
| `createTask()` | POST /tasks | Create a task |
| `updateTasks()` | PUT /tasks | Update state/title/dates |
| `deleteTasks()` | DELETE /tasks | Delete tasks |
| `getDailyNoteBlocks()` | GET /blocks | Get daily note blocks by date |
| `getDailyNoteMarkdown()` | GET /blocks | Get daily note as markdown |
| `appendToDailyNote()` | POST /blocks | Insert block into daily note |
| `searchDailyNotes()` | GET /daily-notes/search | Search across daily notes |

---

## Development Guide

### Prerequisites

```bash
node --version   # 22+
npm --version    # 7+
```

### Start Development

```bash
npm install
npm run dev
```

Raycast picks up the extension automatically in developer mode. Hot-reload is active — save a file and the command refreshes instantly.

### File to Edit First

**`package.json`** — update the `"author"` field to your Raycast handle before publishing.

### Adding a New Command

1. Create `src/my-command.tsx` with a default export React component
2. Add an entry to the `"commands"` array in `package.json`:

```json
{
  "name": "my-command",
  "title": "My Command",
  "description": "What it does",
  "mode": "view"
}
```

3. Raycast registers it immediately in dev mode.

### Adding a Preference

**Extension-level** (shared across commands) — add to the top-level `"preferences"` array in `package.json`:

```json
{
  "name": "myPref",
  "title": "My Setting",
  "description": "Used for…",
  "type": "textfield",
  "required": false,
  "default": ""
}
```

**Command-level** — add a `"preferences"` array inside the command object.

Read in code:

```typescript
import { getPreferenceValues } from "@raycast/api";
const prefs = getPreferenceValues<{ myPref: string }>();
```

### Extension Icon

Add a **512×512 PNG** named `extension-icon.png` to the `assets/` folder. Raycast displays this in the store and launcher. The Craft logo works well — download from [craft.do](https://www.craft.do).

### Build for Production

```bash
npm run build
```

### Lint

```bash
npm run lint          # check
npm run fix-lint      # auto-fix
```

---

## Troubleshooting

### "Craft API 401" or "403" errors

Your secret link ID is wrong or expired.

1. Open Raycast Preferences → Extensions → Craft Docs → Extension Preferences
2. Re-paste the correct Secret Link ID from Craft → Settings → API

### "Craft API 404" — document not found

The document or block ID you used doesn't exist or belongs to a different space/API connection. Make sure the document ID was copied from within the same Craft space that your API key connects to.

### Folders not loading in Quick Note

The Documents API key may not have access to the space. Verify the key is from **"All Documents"** scope (not "Selected Documents").

### Tasks not showing

Tasks use the **separate Daily Notes & Tasks API key**. Make sure `tasksSecretLinkId` in preferences is set to the correct key.

### "No daily note for this date"

Craft only stores daily notes for days you've actually opened them. If a day has no daily note, the API returns an empty block list — the extension shows "*This daily note is empty.*"

### Deep links don't open Craft on Windows

Ensure Craft for Windows is installed and the `craftdocs://` URI scheme is registered. You can test by pasting a `craftdocs://` URL directly in your browser. If it doesn't work, reinstall Craft.

### Pinned Lists are gone after reinstall

Pinned lists are stored in Raycast's LocalStorage, which is tied to the extension. After reinstalling, re-pin your documents using their IDs (find them via Search Documents → Copy Document ID).

---

## Contributing

PRs welcome. Please open an issue first for major changes.

## License

MIT
