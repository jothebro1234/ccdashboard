const CONFIG = {
    // ── Leaderboard (unchanged) ───────────────────────────────────
    SHEET_ID:                '1VOGj6vehl2Fzko6YBEynopzqLnlj3vWy1CkLi0P6l5Y',
    SHEET_NAME:              'Volunteers',
    EVENTS_SHEET_NAME:       'Events',
    CURRICULUM_SHEET_NAME:   'Curriculum',
    ANNOUNCEMENTS_SHEET_NAME:'Announcements',
    EXCEPTIONS_SHEET_NAME:   'Exceptions',
    ROSTER_SHEET_NAME:       'Roster',
    ORG_NAME:                'Curio Crate',
    REFRESH_INTERVAL:        60,
    SHOW_DISCORD:            true,
    JOIN_URL:   'https://docs.google.com/forms/d/e/1FAIpQLSd6iFIbmLERmHtN7eigAIqTQX6aqdnssGX2uxGCXcvpIRmWsA/viewform?usp=sharing&ouid=106234786547754035782',
    INSTAGRAM_URL: 'https://www.instagram.com/ckf.curiocrate/',
    ADMIN_CODE: 'ccadmin2025',

    // ── Portal: Director Access Codes ────────────────────────────
    // Each role has its own code. Change these before sharing with directors.
    DIRECTOR_CODES: {
        doc:       'ccdoc2025',
        doo:       'ccdoo2025',
        dop:       'ccdop2025',
        president: 'ccadmin2025',
        cef:       'cccef2025',
        vp:        'ccvp2025',
        sec:       'ccsec2025',
        tres:      'cctres2025',
        cpo:       'cccpo2025',
        hr:        'cchr2025',
        mr:        'ccmr2025',
        trial:     'cctrial2025',
    },

    // ── Portal: New Sheet Names ─────────────────────────────────
    CHAPTERS_SHEET:  'Chapters',
    DIRECTORS_SHEET: 'Directors',

    // ── Portal: Auth ──────────────────────────────────────────────
    // 0-based column index in Volunteers sheet that holds the email address.
    // Default 4 = column E. Adjust if your form puts email elsewhere.
    EMAIL_COL: 4,

    // ── Portal: New Sheet Names ───────────────────────────────────
    // Volunteers sheet columns A–L:
    //   A=Name  B=Discord  C=School  D=Avatar  E=Email
    //   F=Track  G=Tier  H=Lead  I=CyclesCompleted
    //   J=SelectYourMainSpecialty  K=OnTimeRate  L=LastContact  M=TotalHours
    CALENDAR_SHEET:    'Calendar',     // Monthly calendar (Date | Notes)
    TASKS_SHEET:       'Tasks',        // Task assignments
    SESSIONS_SHEET:    'Sessions',     // In-person sessions (Operations)
    DEBRIEFS_SHEET:    'SessionDebriefs',
    WINS_SHEET:        'WinsBoard',    // Recognition feed
    NOTIFS_SHEET:      'Notifications',
    NOMINATIONS_SHEET: 'Nominations',  // Tier-up nominations
    CYCLES_SHEET:      'Cycles',       // Two-week cycle registry
    CONTENT_CAL_SHEET: 'ContentCalendar', // Publicity content calendar

    // ── Portal: Write Endpoint ────────────────────────────────────
    // Deploy appsscript.gs as a Web App (Execute as: Me, Anyone can access)
    // then paste the /exec URL here. Leave blank for read-only mode.
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxMLYVSDKm6R3P-jCxEEySC6qU6ShoAYJxc-Snz15ZpjnSmEhj-2mIg5aqmTzIOv4Tk/exec',

    // ── Google OAuth ──────────────────────────────────────────────
    GOOGLE_CLIENT_ID: '1009212045762-e6kcfjh3iva58bclegmqb1eq3oea6iso.apps.googleusercontent.com',

    // ── Org Structure ─────────────────────────────────────────────
    PRESIDENT_NAME: 'Jumbo Jo',
    DIRECTORS: {
        doc:       { name: 'Sourish Mehta, Chloe Koo, Megan Yao', title: 'Director of Curriculum',   track: 'Curriculum'    },
        doo:       { name: 'Jamie Song, Pragya Jain',              title: 'Director of Operations',   track: 'Operations'   },
        dop:       { name: 'Daniel Kim',                           title: 'Director of Publicity',    track: 'Media/Design' },
        president: { name: 'Daniel Son',                           title: 'President',                track: 'All'          },
        cef:       { name: '',                                     title: 'Chief Executive Fellow',   track: 'All'          },
        vp:        { name: '',                                     title: 'Vice President',            track: 'All'          },
        sec:       { name: '',                                     title: 'Secretary',                 track: 'All'          },
        tres:      { name: '',                                     title: 'Treasurer',                 track: 'All'          },
        cpo:       { name: '',                                     title: 'Chief Product Officer',     track: 'All'          },
        hr:        { name: '',                                     title: 'Human Resources',           track: 'All'          },
        mr:        { name: '',                                     title: 'MR',                        track: 'All'          },
        trial:     { name: '',                                     title: 'Trial Director',            track: 'All'          },
        chapter_rep:{ name: '',                                    title: 'Chapter Representative',    track: 'All'          },
    },

    TRACKS: {
        'Curriculum':   { color: '#14b8a6', glow: 'rgba(20,184,166,.25)',  icon: '📚', role: 'doc', cls: 'teal'         },
        'Operations':   { color: '#8b5cf6', glow: 'rgba(139,92,246,.25)',  icon: '🎓', role: 'doo', cls: 'violet'       },
        'Media/Design': { color: '#f87171', glow: 'rgba(248,113,113,.25)', icon: '🎨', role: 'dop', cls: 'media-design' },
    },

    TIERS: {
        1:    { name: 'Explorer',  color: '#64748b', icon: '🌱', cycles: 0   },
        2:    { name: 'Builder',   color: '#0ea5e9', icon: '🔨', cycles: 2   },
        3:    { name: 'Lead',      color: '#7c3aed', icon: '⭐', cycles: 5   },
        4:    { name: 'Architect', color: '#d97706', icon: '🏛️', cycles: 10  },
        Exec: { name: 'Executive', color: '#fbbf24', icon: '👑', cycles: 999 },
    },

    CYCLE_DAYS: 14,
};
