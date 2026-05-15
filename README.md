# 🛒 FairBuy — Cross-Store Price Comparison

FairBuy lets you search for any product and instantly see real-time prices from **Amazon, Flipkart, Blinkit, Zepto, Swiggy Instamart, BigBasket, Myntra, and Ajio** — all on one page.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔍 **Multi-store search** | Searches 8 stores simultaneously using Firecrawl |
| 💰 **Verbatim prices** | Prices shown exactly as scraped — no rounding, no math |
| 🗂️ **Grouped results** | Similar products from different stores grouped together |
| 📋 **Sort & filter** | Sort by price, rating, name; filter by store |
| ❤️ **Watchlist** | Save products and track them with in-app notifications |
| 🛒 **Cart** | Add items from multiple stores to a single cart |
| 🔒 **Auth** | Register, login, forgot password, reset via email |
| 📧 **Email alerts** | Password reset links + welcome emails via Gmail |

---

## 🗂️ Project Structure

```
fairbuy/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── Index.jsx           — Landing / home page
│       │   ├── SearchResults.jsx   — Search results with sort/filter/grouping
│       │   ├── Cart.jsx            — Shopping cart
│       │   ├── Watchlist.jsx       — Saved products
│       │   ├── Login.jsx           — Login page
│       │   ├── Register.jsx        — Register page
│       │   ├── ForgotPassword.jsx  — Send password reset email
│       │   └── UpdatePassword.jsx  — Set new password (token or logged-in)
│       ├── components/
│       │   ├── ProductCard.jsx     — Product card with price, rating, actions
│       │   ├── Navbar.jsx          — Top navigation bar
│       │   ├── WatchButton.jsx     — Watch/unwatch toggle
│       │   └── NotificationBell.jsx— In-app notification dropdown
│       └── hooks/
│           ├── useAuth.jsx         — Auth context (login, signup, reset password)
│           └── useCart.jsx         — Cart context
│
└── server/                  # Express backend
    ├── server.js             — Entry point, route mounting
    ├── config/
    │   ├── db.js             — MongoDB connection
    │   └── platforms.config.js — Toggle which stores are scraped
    ├── routes/
    │   ├── apiRoutes.js      — POST /api/search, GET /api/platforms
    │   ├── authRoutes.js     — signup, login, forgot/reset password
    │   ├── watchlistRoutes.js— CRUD for watchlist items
    │   └── notificationRoutes.js — In-app notifications
    ├── services/
    │   ├── scraper.js        — Firecrawl scraper + Cheerio extractor + grouping
    │   └── notification.js   — Nodemailer email templates
    └── models/
        ├── User.js           — User schema (email + bcrypt password)
        ├── WatchlistItem.js  — Watchlist item schema
        └── Notification.js   — In-app notification schema
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ ([download](https://nodejs.org))
- **MongoDB** — a free [MongoDB Atlas](https://cloud.mongodb.com) cluster works fine
- **Firecrawl API key** — get one at [firecrawl.dev](https://firecrawl.dev)
- **Gmail App Password** — for sending password reset emails (see below)

---

### 1. Clone & install

```bash
git clone <your-repo-url>
cd fairbuy
npm install           # installs both client and server (workspaces)
```

---

### 2. Configure environment variables

Copy `.env.example` to `.env` (or edit `.env` directly in the project root):

```env
PORT=4000
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/fairbuy
JWT_SECRET=some_long_random_secret_here
EMAIL_USER=yourname@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx      # 16-char Gmail App Password
CLIENT_URL=http://localhost:5173
```

> **How to get a Gmail App Password:**
> 1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
> 2. Enable **2-Step Verification** if not already on
> 3. Search for **"App Passwords"**
> 4. Create a new app password → copy the 16-character code into `EMAIL_PASS`

---

### 3. Enable / disable stores

Edit `server/config/platforms.config.js` to toggle which stores are scraped:

```js
export const ENABLED_PLATFORMS = {
  amazon:    true,   // always recommended
  flipkart:  true,
  blinkit:   true,   // set false to skip and save Firecrawl credits
  zepto:     true,
  instamart: true,
  bigbasket: true,
  myntra:    true,   // fashion — disable for grocery-only searches
  ajio:      true,
};
```

---

### 4. Run in development

Open **two terminals**:

```bash
# Terminal 1 — backend (port 4000)
cd fairbuy/server
npm run dev

# Terminal 2 — frontend (port 5173)
cd fairbuy/client
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

The frontend Vite dev server proxies `/api` calls to `localhost:4000` automatically.

---

### 5. Build for production

```bash
# Build the frontend
cd fairbuy/client
npm run build          # outputs to client/dist/

# Start the server (serves built frontend + API)
cd fairbuy/server
npm start
```

Open [http://localhost:4000](http://localhost:4000).

---

## 🔑 Auth & Email Flow

| Action | Endpoint | Email sent? |
|---|---|---|
| Register | `POST /api/auth/signup` | ✅ Welcome email |
| Login | `POST /api/auth/login` | — |
| Forgot password | `POST /api/auth/forgot-password` | ✅ Reset link (1 hr expiry) |
| Reset password (from link) | `POST /api/auth/reset-password` | — |
| Update password (logged in) | `PATCH /api/auth/update-password` | — |

The reset link looks like:
```
http://localhost:5173/update-password?token=<token>
```
When the user clicks it, they land on `/update-password`, which detects the `token` query param and calls the reset endpoint instead of the logged-in update endpoint.

---

## 🕷️ How Scraping Works

1. For each enabled store, `firecrawl.scrape(storeSearchUrl, { formats: ['markdown','html'] })` is called in **parallel**.
2. The HTML response is parsed with **Cheerio** using store-specific selectors (most accurate).
3. If Cheerio returns 0 products, the **markdown** response is parsed as a fallback.
4. Prices are extracted **verbatim** — `₹` symbol + digits, no rounding, no math applied.
5. Product URLs are built safely — if the href already contains `https://`, no domain is prepended (fixes the double-URL bug).
6. Products are **grouped** by Jaccard word similarity (threshold 0.35). Switch to "Group similar products" sort to see cross-store clusters.

---

## 🐛 Known Limitations

- **Zepto / Instamart / BigBasket** render heavily with JavaScript; Firecrawl may return limited results depending on your plan.
- **Price accuracy** depends on whether Firecrawl can bypass the store's bot detection. If a store consistently shows wrong prices, disable it in `platforms.config.js`.
- Reset tokens are stored **in memory** — they are lost on server restart. For production, store them in MongoDB.

---

## 🛠️ Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Sonner (toasts)

**Backend:** Node.js, Express, MongoDB + Mongoose, JWT auth, Bcrypt, Nodemailer

**Scraping:** Firecrawl (`@mendable/firecrawl-js`), Cheerio

---

## 📄 License

MIT
