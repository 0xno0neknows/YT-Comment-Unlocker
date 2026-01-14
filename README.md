# 🎬 YT Comment Unlocker

A Chrome extension that enables community comments on YouTube videos where comments are disabled (kids content, etc.).

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

- **💬 Community Comments** - Add comments on any YouTube video, even when disabled
- **🔐 User Authentication** - Register/login with username and password
- **👍 Like/Dislike** - Vote on comments with visual feedback
- **↩️ Replies** - Reply to other users' comments
- **✏️ Edit Comments** - Edit your comments within 1 hour of posting
- **🗑️ Delete Comments** - Remove your own comments
- **🔄 Sorting** - Sort by Newest, Oldest, or Top comments
- **🎨 Theme Support** - Automatically matches YouTube's dark/light theme
- **🔃 Refresh Button** - Manually refresh comments without page reload

## 📸 Screenshots

| Dark Mode | Light Mode |
|-----------|------------|
| Dark theme matching YouTube | Light theme matching YouTube |

## 🛠️ Tech Stack

### Extension
- Vanilla JavaScript
- Chrome Extension Manifest V3
- CSS with CSS Variables for theming

### Backend
- Node.js + Express.js
- PostgreSQL database
- Prisma ORM

## 🚀 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Chrome browser

### Backend Setup

1. Clone the repository:
```bash
git clone https://github.com/0xno0neknows/YT-Comment-Unlocker.git
cd YT-Comment-Unlocker
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Create `.env` file:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/ytcomments"
PORT=3000
```

4. Push database schema:
```bash
npm run db:push
```

5. Start the server:
```bash
npm run dev
```

### Extension Setup

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder

## 📁 Project Structure

```
YT-Comment-Unlocker/
├── extension/
│   ├── manifest.json      # Extension configuration
│   ├── background.js      # Service worker (API calls)
│   ├── content.js         # Injects comment panel
│   ├── popup.html/js/css  # Extension popup UI
│   ├── styles.css         # Comment panel styles
│   └── icons/             # Extension icons
├── server/
│   ├── index.js           # Express server + API
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   ├── package.json
│   └── .env.example
└── README.md
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/videos/:videoId/comments` | Get comments for video |
| POST | `/api/videos/:videoId/comments` | Add comment |
| PUT | `/api/comments/:id` | Edit comment (1hr limit) |
| DELETE | `/api/comments/:id` | Delete comment |
| POST | `/api/comments/:id/vote` | Like/dislike comment |
| POST | `/api/comments/:id/replies` | Reply to comment |

## 🎨 Theme Support

The extension automatically detects YouTube's theme:
- Uses `html[dark]` attribute for dark mode detection
- CSS variables for easy theme customization
- Seamless transition when switching themes

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | 3000 |

## 🚢 Deployment

### Backend (Railway/Render)
1. Connect your GitHub repo
2. Set `DATABASE_URL` environment variable
3. Deploy

### Extension (Chrome Web Store)
1. Create developer account ($5 one-time fee)
2. Zip the `extension` folder
3. Upload to Chrome Web Store

## 📝 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ by [0xno0neknows](https://github.com/0xno0neknows)
