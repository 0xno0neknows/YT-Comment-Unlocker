# 🎬 YT Comment Unlocker

A Chrome extension that enables community comments on YouTube videos where comments are disabled (kids content, etc.).

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933)

## ✨ Features

- **💬 Community Comments** - Add comments on any YouTube video, even when disabled
- **🔐 User Authentication** - Secure registration and login
- **👍 Like/Dislike** - Vote on comments with visual feedback
- **↩️ Replies** - Reply to other users' comments
- **✏️ Edit Comments** - Edit your comments within 1 hour of posting
- **🗑️ Delete Comments** - Remove your own comments
- **🔄 Sorting** - Sort by Newest, Oldest, or Top comments
- **🎨 Theme Support** - Automatically matches YouTube's dark/light theme
- **🔃 Refresh Button** - Manually refresh comments without page reload

---

## 📖 How to Use

### Step 1: Install the Extension

#### Option 1: Chrome Web Store (Recommended)
> 🚧 **Coming Soon** - Pending Chrome Web Store approval

#### Option 2: Install using Developer Mode
1. Download or clone this repository
2. Open Chrome → `chrome://extensions`
3. Enable **"Developer mode"** (top right toggle)
4. Click **"Load unpacked"**
5. Select the `extension` folder from the downloaded repository

### Step 2: Sign In

1. Click the **extension icon** in Chrome toolbar
2. Choose **"Register"** to create a new account:
   - Enter username, password (min 6 chars), first name, last name
   - Click **Register**
3. Or **"Login"** if you already have an account

### Step 3: Start Commenting

1. Visit any YouTube video (works on videos with disabled comments too!)
2. Scroll down to see the **"Community Comments"** panel
3. Type your comment and click **Post**
4. Use the **sort dropdown** to change comment order
5. Click **↻** to refresh comments

### Step 4: Interact with Comments

- **👍 / 👎** - Like or dislike comments
- **↩️ Reply** - Reply to any comment
- **✏️ Edit** - Edit your own comments (within 1 hour)
- **🗑️ Delete** - Remove your own comments

---

## 🛠️ Tech Stack

### Extension
- Vanilla JavaScript
- Chrome Extension Manifest V3
- CSS with CSS Variables for theming

### Backend
- Node.js + Express.js
- PostgreSQL database
- Prisma ORM
- bcrypt for password hashing

---

## 🚀 Quick Start (For Developers)

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or cloud like [Neon](https://neon.tech))
- Chrome browser

### 1. Clone & Install

```bash
git clone https://github.com/0xno0neknows/YT-Comment-Unlocker.git
cd YT-Comment-Unlocker/server
npm install
```

### 2. Configure Environment

Create a `.env` file in the `server` directory:

```env
DATABASE_URL="your-postgresql-connection-string"
PORT=3000
```

### 3. Setup Database

```bash
npm run db:push
```

### 4. Start Server

```bash
npm run dev
```

### 5. Load Extension

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder

---

## 📁 Project Structure

```
YT-Comment-Unlocker/
├── extension/
│   ├── manifest.json      # Extension config
│   ├── background.js      # Service worker
│   ├── content.js         # UI injection
│   ├── popup.html/js/css  # Popup UI
│   ├── styles.css         # Panel styles
│   └── icons/
├── server/
│   ├── index.js           # Express API
│   ├── prisma/
│   │   └── schema.prisma  # DB schema
│   └── package.json
└── README.md
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register user |
| `POST` | `/api/auth/login` | Login user |
| `GET` | `/api/videos/:id/comments` | Get comments |
| `POST` | `/api/videos/:id/comments` | Add comment |
| `PUT` | `/api/comments/:id` | Edit comment |
| `DELETE` | `/api/comments/:id` | Delete comment |
| `POST` | `/api/comments/:id/vote` | Vote on comment |
| `POST` | `/api/comments/:id/replies` | Add reply |
| `GET` | `/api/health` | Health check |

---

## 🔒 Security

- Passwords are hashed using bcrypt
- No sensitive data stored in the extension
- Environment variables for all secrets
- Ownership validation for edit/delete

---

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

---

Made with ❤️ by [0xno0neknows](https://github.com/0xno0neknows)
