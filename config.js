const CONFIG = {
    // ── Leaderboard (unchanged) ───────────────────────────────────
    SHEET_NAME:              'Volunteers',
    EVENTS_SHEET_NAME:       'Events',
    CURRICULUM_SHEET_NAME:   'Curriculum',
    ANNOUNCEMENTS_SHEET_NAME:'Announcements',
    EXCEPTIONS_SHEET_NAME: 'Exceptions',
    ROSTER_SHEET_NAME: 'Roster',
    ORG_NAME: 'Curio Crate',
    REFRESH_INTERVAL: 60,
    SHOW_DISCORD: true,
    JOIN_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSd6iFIbmLERmHtN7eigAIqTQX6aqdnssGX2uxGCXcvpIRmWsA/viewform?usp=sharing&ouid=106234786547754035782',
    // Paste your Google Drive link to the blank YMCA volunteer form here
    YMCA_FORM_URL: 'https://drive.google.com/file/d/14FCrojbG6hbm3ea8QSaXb1uNfLMh8GZC/view?usp=sharing',
    INSTAGRAM_URL: 'https://www.instagram.com/ckf.curiocrate/',

    // ── Portal: New Sheet Names ─────────────────────────────────
    CHAPTERS_SHEET: 'Chapters',
    DIRECTORS_SHEET: 'Directors',

    // ── Portal: Auth ──────────────────────────────────────────────
    // 0-based column index in Volunteers sheet that holds the email address.
    // Default 4 = column E. Adjust if your form puts email elsewhere.
    EMAIL_COL: 4,

    // ── Portal: New Sheet Names ───────────────────────────────────
    // Volunteers sheet columns A–L:
    // A=Name B=Discord C=School D=Avatar E=Email
    // F=Track G=Tier H=Lead I=CyclesCompleted
    // J=SelectYourMainSpecialty K=OnTimeRate L=LastContact M=TotalHours
    CALENDAR_SHEET: 'Calendar', // Monthly calendar (Date | Notes)
    TASKS_SHEET: 'Tasks', // Task assignments
    SESSIONS_SHEET: 'Sessions', // In-person sessions (Operations)
    DEBRIEFS_SHEET: 'SessionDebriefs',
    WINS_SHEET: 'WinsBoard', // Recognition feed
    NOTIFS_SHEET: 'Notifications',
    NOMINATIONS_SHEET: 'Nominations', // Tier-up nominations
    CYCLES_SHEET: 'Cycles', // Two-week cycle registry
    CONTENT_CAL_SHEET: 'ContentCalendar', // Publicity content calendar

    // ── Google OAuth ──────────────────────────────────────────────
    GOOGLE_CLIENT_ID: '1009212045762-e6kcfjh3iva58bclegmqb1eq3oea6iso.apps.googleusercontent.com',

    // ── Org Structure ─────────────────────────────────────────────
    PRESIDENT_NAME: 'Jumbo Jo',
    DIRECTORS: {
        doc:         { title: 'Director of Curriculum',  track: 'Curriculum'   },
        doo:         { title: 'Director of Operations',  track: 'Operations'   },
        dop:         { title: 'Director of Publicity',   track: 'Media/Design' },
        president:   { title: 'President',               track: 'All'          },
        cef:         { title: 'Chief Executive Fellow',  track: 'All'          },
        vp:          { title: 'Vice President',          track: 'All'          },
        sec:         { title: 'Secretary',               track: 'All'          },
        tres:        { title: 'Treasurer',               track: 'All'          },
        cpo:         { title: 'Chief Product Officer',   track: 'All'          },
        hr:          { title: 'Human Resources',         track: 'All'          },
        mr:          { title: 'MR',                      track: 'All'          },
        trial:       { title: 'Trial Director',          track: 'All'          },
        chapter_rep: { title: 'Chapter Representative',  track: 'All'          },
    },

    TRACKS: {
        'Curriculum': { color: '#14b8a6', glow: 'rgba(20,184,166,.25)', icon: '\uD83D\uDCDA', role: 'doc', cls: 'teal' },
        'Operations': { color: '#8b5cf6', glow: 'rgba(139,92,246,.25)', icon: '\uD83C\uDF93', role: 'doo', cls: 'violet' },
        'Media/Design': { color: '#f87171', glow: 'rgba(248,113,113,.25)', icon: '\uD83C\uDFA8', role: 'dop', cls: 'media-design' },
    },

    TIERS: {
        1: { name: 'Explorer', color: '#64748b', icon: '\uD83C\uDF31', cycles: 0 },
        2: { name: 'Builder', color: '#0ea5e9', icon: '\uD83D\uDD28', cycles: 2 },
        3: { name: 'Lead', color: '#7c3aed', icon: '\u2B50', cycles: 5 },
        4: { name: 'Architect', color: '#d97706', icon: '\uD83C\uDFDB\uFE0F', cycles: 10 },
        Exec: { name: 'Executive', color: '#fbbf24', icon: '\uD83D\uDC51', cycles: 999 },
    },

    CYCLE_DAYS: 14,
};
