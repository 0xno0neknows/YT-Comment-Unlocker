# Codebase Documentation

Technical reference for the YouTube Comments Extension codebase.

---

## Project Structure

```
YTCommentsExt/
├── extension/               # Chrome Extension files
│   ├── manifest.json        # Extension configuration
│   ├── background.js        # Service worker (API calls)
│   ├── content.js           # Injected into YouTube pages
│   ├── popup.html           # Extension popup UI
│   ├── popup.js             # Popup logic
│   ├── popup.css            # Popup styles (dark pixelated theme)
│   ├── styles.css           # Content script styles
│   └── icons/               # Extension icons
│
├── server/                  # Backend server
│   ├── index.js             # Express server & API routes
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   ├── package.json         # Dependencies
│   ├── .env                 # Environment variables (gitignored)
│   └── DATABASE_SETUP.md    # Database setup guide
│
├── DEPLOYMENT_GUIDE.md      # How to deploy to production
└── CODEBASE_DOCS.md         # This file
```

---

## Extension Files

### manifest.json
Extension configuration file.
- **Permissions**: `storage`, `activeTab`
- **Content scripts**: Injects `content.js` + `styles.css` on YouTube
- **Background**: Service worker `background.js`

---

### background.js
Service worker that handles all API communication.

| Function | Description |
|----------|-------------|
| `handleMessage(request, isIncognito)` | Routes messages to appropriate handlers |
| `checkUsername(username)` | Checks if username is available |
| `registerUser(...)` | Registers new user, stores in chrome.storage |
| `loginUser(username, password, isIncognito)` | Authenticates user |
| `logoutUser(isIncognito)` | Clears user from storage |
| `getCurrentUser(isIncognito)` | Gets logged-in user from storage |
| `getComments(videoId)` | Fetches comments for a video |
| `addComment(videoId, userId, content)` | Posts a new comment |
| `addReply(commentId, userId, content)` | Posts a reply to comment |
| `getUserComments(userId)` | Gets all comments by a user |
| `getStorage(isIncognito)` | Returns session storage (incognito) or local storage |

**Key Concept**: Uses `chrome.storage.session` for incognito mode (clears when browser closes) and `chrome.storage.local` for normal windows (persisted).

---

### content.js
Injected into YouTube pages, detects disabled comments and shows custom panel.

| Function | Description |
|----------|-------------|
| `init()` | Entry point, gets user and starts monitoring |
| `startMonitoring()` | Checks every 1s for disabled comments (max 20s) |
| `areCommentsDisabled()` | Detects if comments are disabled on current video |
| `getVideoId()` | Extracts video ID from URL |
| `injectCommentsPanel()` | Creates and inserts the comments UI |
| `createCommentsPanel()` | Generates the HTML for comments panel |
| `setupPanelEvents(panel)` | Attaches event listeners to panel elements |
| `loadComments()` | Fetches and renders comments from API |
| `renderComment(comment, isReply)` | Generates HTML for a single comment |
| `setupCommentEvents(container)` | Attaches reply/cancel handlers |
| `setupNavigationListener()` | Detects YouTube SPA navigation |

**Message Handlers**:
- `userRegistered`: Refreshes panel when user logs in
- `userLoggedOut`: Refreshes panel to show login prompt

---

### popup.js
Handles the extension popup UI logic.

| Function | Description |
|----------|-------------|
| `getCurrentUser()` | Gets user from background script |
| `checkServerHealth()` | Checks if backend is online |
| `showAuth()` | Shows login/register form |
| `showProfile(user)` | Shows profile section with user data |
| `switchAuthTab(tabId)` | Switches between login/register tabs |
| `switchTab(tabId)` | Switches profile/comments tabs |
| `loadUserComments()` | Loads user's comment history |
| `notifyContentScript(user)` | Tells content script user logged in |

**Event Listeners**:
- Username input: Real-time availability check with debounce
- Login form submit: Validates and calls `loginUser`
- Register form submit: Validates and calls `registerUser`
- Logout button: Clears user and notifies content script

---

### popup.css
Dark pixelated theme styles.

**CSS Variables** (defined in `:root`):
- `--bg-primary`: `#0a0a0a` (main background)
- `--bg-secondary`: `#111111` (cards)
- `--accent-green`: `#00ff00` (primary accent)
- `--accent-cyan`: `#00ffff` (secondary accent)
- `--font-pixel`: `'Press Start 2P'` (headings)
- `--font-mono`: `'JetBrains Mono'` (body)

---

### styles.css
Content script styles for YouTube comments panel.

Uses CSS variables scoped to `#yt-comments-ext-panel`:
- Supports both dark and light YouTube themes
- Clean, minimal design that blends with YouTube

---

## Server Files

### index.js
Express server with all API endpoints.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/check-username/:username` | GET | Check username availability |
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login user |
| `/api/users/:userId` | GET | Get user by ID |
| `/api/videos/:videoId/comments` | GET | Get comments for video |
| `/api/videos/:videoId/comments` | POST | Add comment to video |
| `/api/comments/:commentId/replies` | POST | Reply to comment |
| `/api/users/:userId/comments` | GET | Get user's comments |
| `/api/health` | GET | Health check |

**Key Logic in GET /comments**:
1. Fetches all comments for video with user info
2. Builds tree structure (parent → replies)
3. Returns nested comment array

---

### prisma/schema.prisma
Database schema using Prisma ORM.

**Models**:

```prisma
User {
  id        String    (UUID, primary key)
  username  String    (unique)
  password  String    (bcrypt hashed)
  firstName String
  lastName  String
  createdAt DateTime
  comments  Comment[]
}

Comment {
  id        String    (UUID, primary key)
  videoId   String    (YouTube video ID)
  content   String
  createdAt DateTime
  userId    String    (foreign key → User)
  parentId  String?   (foreign key → Comment, for replies)
  replies   Comment[] (self-relation)
}
```

**Indexes**: `videoId`, `userId`, `parentId` for query performance

---

## Data Flow

### User Registration
```
Popup → background.js → POST /api/auth/register → Prisma → PostgreSQL
                     ← { user } ← 
       → chrome.storage.local.set({ user })
       → sendMessage to content.js → refresh panel
```

### Adding a Comment
```
Content.js → background.js → POST /api/videos/:id/comments → Prisma → PostgreSQL
                          ← { comment } ←
          → loadComments() → re-render panel
```

### Detecting Disabled Comments
```
YouTube Page → content.js monitors for:
  1. "Comments are turned off" message
  2. Empty #comments section
→ If detected, injectCommentsPanel()
```

---

## Making Changes

### Add a new API endpoint
1. Add route in `server/index.js`
2. Add message handler in `extension/background.js`
3. Call via `chrome.runtime.sendMessage({ action: 'yourAction' })`

### Modify database schema
1. Edit `server/prisma/schema.prisma`
2. Run `npm run db:push` (development)
3. Run `npm run db:migrate` (production - creates migration)

### Change UI styling
- **Popup**: Edit `extension/popup.css`
- **Comments panel**: Edit `extension/styles.css`

### Add new feature to popup
1. Add HTML in `extension/popup.html`
2. Add logic in `extension/popup.js`
3. Add styles in `extension/popup.css`
