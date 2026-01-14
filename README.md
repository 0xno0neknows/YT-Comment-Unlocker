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

## 🚀 Quick Start

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

## 🚢 Deployment

### Backend
Deploy to Railway, Render, or any Node.js hosting:
1. Connect your GitHub repo
2. Set `DATABASE_URL` environment variable
3. Deploy

### Database
Use a managed PostgreSQL service:
- [Neon](https://neon.tech) - Free tier available
- [Supabase](https://supabase.com) - Free tier available
- [Railway](https://railway.app) - Integrated option

### Extension
1. Create [Chrome Web Store Developer](https://chrome.google.com/webstore/devconsole) account ($5)
2. Zip the `extension` folder
3. Upload and submit for review

## 🔒 Security

- Passwords are hashed using bcrypt
- No sensitive data stored in the extension
- Environment variables for all secrets
- Ownership validation for edit/delete

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

---

Made with ❤️ by [0xno0neknows](https://github.com/0xno0neknows)
