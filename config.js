const CONFIG = {
    // ── REQUIRED ─────────────────────────────────────────────────────────────
    // Paste your Google Sheet ID here (the long string in the sheet URL)
    // Example URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit
    // Example ID:  1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
    SHEET_ID: '1VOGj6vehl2Fzko6YBEynopzqLnlj3vWy1CkLi0P6l5Y',

    // Name of the sheet tab (bottom of your spreadsheet)
    SHEET_NAME: 'Volunteers',

    // ── OPTIONAL ─────────────────────────────────────────────────────────────
    // Name shown at the top of the leaderboard
    ORG_NAME: 'VOLUNTEER',

    // Seconds between auto-refreshes (minimum: 30)
    REFRESH_INTERVAL: 60,

    // Set to false to hide Discord usernames
    SHOW_DISCORD: true,
};
