# Volunteer Leaderboard — Setup Guide

## 1. Create your Google Sheet

Create a new Google Sheet with these exact columns in **Row 1**:

| A    | B       | C     | D      | E      |
|------|---------|-------|--------|--------|
| Name | Discord | Hours | Events | Avatar |

- **Name** — Volunteer's full name *(required)*
- **Discord** — Discord username, no @ *(optional)*
- **Hours** — Total volunteer hours as a number, e.g. `12.5` *(required)*
- **Events** — Number of different events attended *(required)*
- **Avatar** — Full URL to a profile image *(optional, leave blank for auto-generated)*

Example data:

| Name          | Discord     | Hours | Events | Avatar |
|---------------|-------------|-------|--------|--------|
| Jane Smith    | janesmith   | 47.5  | 12     |        |
| Marcus Lee    | marcuslee99 | 38    | 9      | https://... |
| Priya Nair    | priya_n     | 35    | 11     |        |

---

## 2. Share the sheet (required)

The site fetches data directly — the sheet must be publicly readable.

1. Click **Share** (top right)
2. Under "General access", select **Anyone with the link**
3. Permission: **Viewer**
4. Click **Done**

---

## 3. Get your Sheet ID

Your sheet URL looks like:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit
```

The Sheet ID is the long string between `/d/` and `/edit`:
```
1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```

---

## 4. Update config.js

Open `config.js` and paste your Sheet ID:

```js
const CONFIG = {
    SHEET_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',  // ← your ID here
    SHEET_NAME: 'Sheet1',   // must match the tab name at the bottom of your sheet
    ORG_NAME: 'MY ORG',     // shown at the top of the leaderboard
    REFRESH_INTERVAL: 60,   // seconds between auto-refreshes
    SHOW_DISCORD: true,
};
```

---

## 5. Deploy to GitHub Pages

1. Create a new GitHub repository (public)
2. Push all files to the `main` branch:
   ```
   git init
   git add .
   git commit -m "init leaderboard"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch**
5. Branch: `main` / `/ (root)`
6. Click **Save**

Your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/` in ~1 minute.

---

## Later: Discord Bot Integration

When you're ready to wire up Discord so that receiving a role automatically updates the sheet:

- You'll need a small bot (Node.js / Python) running on a server (Railway free tier works)
- Bot listens for `guildMemberUpdate` events
- When a volunteer role is added/removed, it calls the **Google Sheets API** to update that person's row
- The leaderboard site picks up the change on the next auto-refresh (default: 60s)

This doesn't require changing anything in this site — just the sheet data changes, and the site picks it up automatically.
