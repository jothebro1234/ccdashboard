/**
 * Curio Crate Volunteer Portal — Google Apps Script Backend
 *
 * SETUP:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Paste this entire file into Code.gs (replace existing content)
 * 3. Deploy as Web App (Execute as: Me, Anyone can access) → copy /exec URL → paste into config.js APPS_SCRIPT_URL
 * 4. Add form-submit trigger: Triggers (clock icon) → + Add Trigger
 *    Function: onFormSubmit | From spreadsheet | On form submit
 * 5. Run setupTriggers() once: function dropdown (top toolbar) → setupTriggers → ▶ Run.
 *    Approve the extra permission prompt (it now also reads/writes Forms, not just Sheets).
 *    This installs the two remaining triggers that make edited form responses actually sync
 *    to the sheet — see the big comment above reconcileFormResponse() for how all three fit
 *    together. Re-running setupTriggers() later is safe; it won't create duplicates.
 *
 * VOLUNTEERS SHEET columns (A–O, plus an appended Timezone column at V):
 *   A=Name  B=Discord  C=School  D=Avatar  E=Email
 *   F=Track  G=Tier  H=Lead  I=CyclesCompleted
 *   J=SelectYourMainSpecialty  K=OnTimeRate  L=LastContact  M=TotalHours  N=HoursGoal
 *   O=YMCAFormURL
 *   V=Timezone (IANA zone, e.g. "America/New_York") — set via the Google Form's Timezone
 *   question (see onFormSubmit/normalizeTimezone below, which normalizes free-text answers
 *   like "Eastern (ET)" into a canonical IANA zone in place). This backend still finds/writes
 *   it by header name via findOrAddColumn (safe regardless of exact position), but the
 *   frontend reads it from the fixed column V specifically — see portal.js. Every date/time a
 *   volunteer sees anywhere in the portal is converted into this zone — that's the actual
 *   per-volunteer auto-conversion. There is no in-portal way to set this anymore; it comes
 *   from the form only.
 *
 * CURRICULUM SHEET columns (A–U):
 *   A=AssignmentName  B=DueDate  C=Hours  D=Contributors
 *   E=SlidesLink  F=StartDate(LockDate)  G=MaxVolunteers  H=RegisteredVolunteers
 *   I=Instructions  J=CardColor  K=CardDeco  L=CardLabel  M=ChapterLabel
 *   N=DurationDays(working-period mode)  O=TriggeredAt(when the duration countdown started)
 *   P=PostedAt(creation timestamp — used to sort lists by posted recency)
 *   Q=Timezone (IANA zone the assignment was originally posted in — used to redisplay the
 *            edit form in the same zone; NOT used for viewer-side conversion, see below)
 *   R=DueInstant  S=StartInstant  T=TriggeredInstant — gviz-safe shadow copies, see below.
 *   U=Topic — one of the CURRICULUM_TOPICS science-subject labels (portal.js), lets
 *            volunteers filter "Volunteer Opportunities" by subject area.
 *
 * EVENTS SHEET columns (A–S):
 *   A=EventName  B=Date  C=Hours  D=Attendees  E=IsAssembly  F=IsLeadership
 *   G=MaxVolunteers  H=RegisteredList  I=SignupCloseDate  J=Instructions  K=ChapterLabel
 *   L=CardColor  M=CardDeco  N=CardLabel  O=RequiresYMCA
 *   P=PostedAt(creation timestamp — used to sort lists by posted recency)
 *   Q=Timezone (IANA zone the event was originally posted in — same purpose as Curriculum!Q)
 *   R=EventInstant  S=CloseInstant — gviz-safe shadow copies, see below.
 *
 * DueDate/StartDate (Curriculum) and Date/SignupCloseDate (Events) are stored as real,
 * unambiguous instants — a plain epoch-milliseconds NUMBER (see setInstantValue/isRealInstant)
 * — computed from whatever wall-clock date/time + timezone the poster picked. NOT an ISO date
 * string: an earlier version stored those, and Sheets' gviz CSV export (the engine behind
 * /api/sheet — the ONLY way the frontend ever reads sheet data) infers a "date" type for these
 * columns from their header text and years of legacy date values, and silently returns EMPTY
 * in the CSV for any cell it can't represent as a plausible calendar date — confirmed true even
 * for a genuine, correctly-formatted plain NUMBER cell holding an epoch-ms value (wildly
 * out-of-range as a spreadsheet date serial). Fixing that required a second write: the DueInstant/
 * StartInstant/TriggeredInstant/EventInstant/CloseInstant "shadow" columns hold the SAME value
 * text-encoded as "E"+the number (see setShadowInstant) — a shape gviz has no basis to treat as
 * a date at all, so it always survives the CSV round-trip intact. The main column is what THIS
 * BACKEND reads for lock/deadline enforcement (it reads the sheet directly — gviz never enters
 * into it), so it keeps the plain number; the shadow column exists purely for the frontend,
 * which copies it back into the slot it already reads from (see normalizeCurriculumRows/
 * normalizeEventRows in portal.js) before anything else touches the row. The frontend then
 * converts the instant into each individual viewer's own saved timezone (Volunteers!Timezone,
 * or their browser zone as a fallback) for display. Rows written before timezone support
 * existed are plain naive "YYYY-MM-DDTHH:MM" strings with no instant meaning and no shadow
 * column value — both sides detect that and keep treating those literally, unconverted,
 * exactly as before.
 *
 * CHAPTERS SHEET columns (A–L):
 *   A=Email  B=Name  C=School  D=Logo  E=State  F=City
 *   G=PresidentPhoto  H=VicePresident  I=Treasurer  J=Secretary  K=SocialMedia
 *   L=AuthorizedDirectors (comma-separated emails — grants those emails chapter-scoped
 *            director access; also auto-populated when a director request is approved)
 *
 * DIRECTORS SHEET columns (A–D):
 *   A=Email  B=Name
 *   C=Tier — exactly ONE access tier per person, one of:
 *            exec      → everything, including approving director requests.
 *            head      → same as director for now (kept separate for future differentiation).
 *            director  → full combined curriculum+operations permissions (post/give-hours for
 *                         both assignments and events — there's no more separate DOC vs DOO).
 *            pres      → chapter president: same combined permissions as director, PLUS the
 *                         special ability to request a director be granted for their chapter.
 *            Legacy pre-migration values (doc, doo, dop, president, cef, vp, sec, tres, cpo,
 *            hr, mr, trial) are still accepted and mapped forward automatically by the
 *            frontend (portal.js LEGACY_TIER_MAP) — no manual re-typing of old rows needed.
 *   D=Title — free-text display title (e.g. "Director of Curriculum", "VP of Engagement",
 *            "Chapter President — Lincoln High"). Display only; has no effect on permissions.
 *
 * DIRECTORREQUESTS SHEET columns (A–K) — chapter presidents request a director be granted for
 * their chapter here; an org-wide exec approves or denies from the portal:
 *   A=RequestId(uuid)  B=RequestedEmail  C=RequestedName  D=RequestedTitle(free text)
 *   E=RequestedByEmail  F=RequestedByName  G=ChapterSchool  H=Status(pending/approved/denied)
 *   I=RequestedAt  J=DecidedAt  K=DecidedBy
 *   On approval: the email is added/merged into the Directors sheet as tier "director" (never
 *   downgrading someone who already has more access) with the requested title in col D, and
 *   appended to the matching Chapters!AuthorizedDirectors so they're scoped to that chapter.
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

/* Sheet name constants */
const SHEET_VOLUNTEERS     = 'Volunteers';
const SHEET_CURRICULUM     = 'Curriculum';
const SHEET_EVENTS         = 'Events';
const SHEET_CHAPTERS       = 'Chapters';
const SHEET_DIRECTORS      = 'Directors';
const SHEET_DIR_REQUESTS   = 'DirectorRequests';

/* ── Sheet helpers ──────────────────────────────────────────── */
function getSheet(name) {
    let sh = SS.getSheetByName(name);
    if (!sh) {
        sh = SS.insertSheet(name);
        initSheetHeaders(sh, name);
    }
    return sh;
}

function initSheetHeaders(sh, name) {
    const headers = {
        Curriculum: ['AssignmentName','DueDate','Hours','Contributors','SlidesLink','StartDate','MaxVolunteers','RegisteredVolunteers','Instructions','CardColor','CardDeco','CardLabel','ChapterLabel','DurationDays','TriggeredAt','PostedAt','Timezone','DueInstant','StartInstant','TriggeredInstant','Topic'],
        Events:     ['EventName','Date','Hours','Attendees','IsAssembly','IsLeadership','MaxVolunteers','RegisteredList','SignupCloseDate','Instructions','ChapterLabel','CardColor','CardDeco','CardLabel','RequiresYMCA','PostedAt','Timezone','EventInstant','CloseInstant'],
        Chapters:   ['Email','Name','School','Logo','State','City','PresidentPhoto','VicePresident','Treasurer','Secretary','SocialMedia','AuthorizedDirectors'],
        Directors:  ['Email','Name','Tier','Title'],
        DirectorRequests: ['RequestId','RequestedEmail','RequestedName','RequestedTitle','RequestedByEmail','RequestedByName','ChapterSchool','Status','RequestedAt','DecidedAt','DecidedBy'],
    };
    if (headers[name]) sh.appendRow(headers[name]);
}

/* Returns the 1-based column index of headerName, creating it at the end if missing */
function findOrAddColumn(sh, headerName) {
    const lastCol = sh.getLastColumn();
    if (lastCol > 0) {
        const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        for (var i = 0; i < headers.length; i++) {
            if (headers[i].toString().trim() === headerName) return i + 1;
        }
    }
    const newCol = lastCol + 1;
    sh.getRange(1, newCol).setValue(headerName);
    return newCol;
}

/* Fills in any missing header cells for sheets that existed before new columns were added */
function ensureMissingHeaders(sh, name) {
    if (name === 'Events') {
        const expected = ['EventName','Date','Hours','Attendees','IsAssembly','IsLeadership','MaxVolunteers','RegisteredList','SignupCloseDate','Instructions','ChapterLabel','CardColor','CardDeco','CardLabel','RequiresYMCA','PostedAt','Timezone','EventInstant','CloseInstant'];
        const lastCol = Math.max(sh.getLastColumn(), expected.length);
        const current = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        expected.forEach(function(col, i) {
            if (!current[i] || current[i].toString().trim() === '') {
                sh.getRange(1, i + 1).setValue(col);
            }
        });
    } else if (name === 'Curriculum') {
        const expected = ['AssignmentName','DueDate','Hours','Contributors','SlidesLink','StartDate','MaxVolunteers','RegisteredVolunteers','Instructions','CardColor','CardDeco','CardLabel','ChapterLabel','DurationDays','TriggeredAt','PostedAt','Timezone','DueInstant','StartInstant','TriggeredInstant','Topic'];
        const lastCol = Math.max(sh.getLastColumn(), expected.length);
        const current = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        expected.forEach(function(col, i) {
            if (!current[i] || current[i].toString().trim() === '') {
                sh.getRange(1, i + 1).setValue(col);
            }
        });
    } else if (name === 'Volunteers') {
        findOrAddColumn(sh, 'YMCAFormURL');
        findOrAddColumn(sh, 'Timezone');
    } else if (name === 'Directors') {
        findOrAddColumn(sh, 'Title'); // col D — free-text title, added alongside the existing Email/Name/Tier
    }
}

/* Find a row by matching col (0-indexed); returns [rowIndex_1based, rowData] or null */
function findRow(sheetName, col, value) {
    const sh  = getSheet(sheetName);
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][col]).trim() === String(value).trim()) return [i + 1, data[i]];
    }
    return null;
}

/* Update a single cell. col is 0-indexed. */
function updateCell(sheetName, rowIdx, col, value) {
    getSheet(sheetName).getRange(rowIdx, col + 1).setValue(value);
}

/* Returns today as YYYY-MM-DD in the spreadsheet's timezone */
function todayStr() {
    const d = new Date();
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/* Returns yesterday as YYYY-MM-DD */
function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/* True when a stored value is a real, unambiguous instant — a plain epoch-milliseconds number
   (as a number or numeric text), or a genuine Date-typed cell — rather than a naive local
   "YYYY-MM-DDTHH:MM" string typed before timezone support existed.
   Deliberately NOT a date-shaped string (we used to store ISO-with-Z text): Sheets' gviz CSV
   export infers a "date" type for columns like DueDate/EventDate, and for any cell it can't
   represent using that inferred type — which includes a force-text cell holding an ISO
   string — it silently returns an EMPTY value in the CSV instead of the real content, even
   though the cell itself is correct. A plain number never triggers that inference and always
   round-trips correctly, which is why every write below uses setInstantValue()/plain numbers. */
function isRealInstant(val) {
    if (val instanceof Date) return true;
    return /^\d{12,}$/.test(String(val || '').trim());
}

/* Converts a real-instant value (Date object or epoch-ms number/text) to its epoch ms. */
function toEpochMs(val) {
    if (val instanceof Date) return val.getTime();
    return Number(val);
}

/* Extract just the date part (YYYY-MM-DD) from any stored date value. Real instants are
   converted into the script's home timezone first; legacy naive strings are read literally. */
function datePartStr(val) {
    if (!val) return '';
    if (isRealInstant(val)) {
        const ms = toEpochMs(val);
        return isNaN(ms) ? '' : Utilities.formatDate(new Date(ms), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    const s = String(val).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}

/* Whether a stored lock/close/due value has passed "now" — an exact instant comparison for
   real, timezone-converted values, or the legacy day-granularity comparison (locked from the
   next calendar day onward, in the script's home timezone) for naive pre-migration values. */
function isPastLock(val) {
    if (!val) return false;
    if (isRealInstant(val)) {
        const ms = toEpochMs(val);
        return !isNaN(ms) && ms < Date.now();
    }
    const datePart = datePartStr(val);
    return !!datePart && datePart < todayStr();
}

/* Writes a real-instant date field as a plain integer (epoch ms) — explicit "0" number format
   so Sheets never renders it with thousands separators or scientific notation. Falls back to a
   literal setValue for empty/legacy (non-numeric, e.g. a quick "yesterday" date-string) values,
   since those don't need — and shouldn't get — number formatting. */
function setInstantValue(range, value) {
    if (value === '' || value === null || value === undefined) { range.setValue(''); return; }
    const n = Number(value);
    if (isNaN(n)) { range.setValue(value); return; }
    range.setNumberFormat('0').setValue(n);
}

/* Writes a COPY of a real-instant epoch-ms value into a dedicated "shadow" column, encoded as
   text ("E" + the number) so it can never be mistaken for a date or number by gviz — the
   engine behind /api/sheet, the ONLY way the frontend ever reads sheet data. gviz infers a
   "date" type for columns like DueDate/EventDate from their header text and years of legacy
   date values, and silently returns EMPTY in the CSV for any cell in that column it can't
   represent as a plausible calendar date — which includes a huge, out-of-range epoch-ms
   number, even stored as a genuine NUMBER-typed cell (confirmed directly: a freshly-written
   plain number in DueDate round-tripped to empty via /api/sheet, while the sheet cell itself
   was correct). The main column (written by setInstantValue above) keeps holding the raw
   epoch number — that's fine, since backend logic here reads the sheet directly and never
   goes through gviz. This shadow column exists purely so the FRONTEND has a value gviz will
   actually deliver intact; the frontend copies it back into the slot it already reads from
   (see normalizeCurriculumRows/normalizeEventRows in portal.js). */
function setShadowInstant(range, value) {
    if (value === '' || value === null || value === undefined) { range.setValue(''); return; }
    const n = Number(value);
    if (isNaN(n)) { range.setValue(''); return; }
    range.setNumberFormat('@').setValue('E' + n);
}

/* ── doPost ─────────────────────────────────────────────────── */
function doPost(e) {
    try {
        ensureMissingHeaders(getSheet(SHEET_EVENTS),     'Events');
        ensureMissingHeaders(getSheet(SHEET_VOLUNTEERS), 'Volunteers');
        ensureMissingHeaders(getSheet(SHEET_CURRICULUM), 'Curriculum');
        ensureMissingHeaders(getSheet(SHEET_DIRECTORS),  'Directors');
        const body   = JSON.parse(e.postData.contents);
        const result = route(body);
        return ContentService.createTextOutput(JSON.stringify({ ok: true, result }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
    const action = (e && e.parameter && e.parameter.action) || '';

    if (action === 'get_chapters') return getChapters();

    if (action === 'get_updates') {
        var updatesSheet = SS.getSheetByName('Updates');
        if (!updatesSheet) {
            return ContentService
                .createTextOutput(JSON.stringify({ ok: false, error: 'No Updates sheet' }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        var rows = updatesSheet.getDataRange().getValues();
        var updates = [];
        for (var i = 1; i < rows.length; i++) {
            var r = rows[i];
            if (!r[2]) continue;
            var dateVal = r[0];
            var dateStr = (dateVal instanceof Date)
                ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd')
                : String(dateVal);
            updates.push({
                date:     dateStr,
                category: String(r[1] || ''),
                title:    String(r[2] || ''),
                body:     String(r[3] || ''),
                image:    String(r[4] || ''),
            });
        }
        return ContentService
            .createTextOutput(JSON.stringify({ ok: true, updates: updates }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
        .createTextOutput(JSON.stringify({ ok: true, msg: 'Curio Crate Apps Script running.' }))
        .setMimeType(ContentService.MimeType.JSON);
}

function getChapters() {
    try {
        const sheet = SS.getSheetByName(SHEET_CHAPTERS);
        if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Chapters sheet not found' }))
            .setMimeType(ContentService.MimeType.JSON);
        const rows = sheet.getDataRange().getValues();
        const chapters = rows.slice(1)
            .filter(function(r) { return String(r[2]).trim(); })
            .map(function(r) {
                return {
                    email:                String(r[0]  || '').trim(),
                    president:            String(r[1]  || '').trim(),
                    school:               String(r[2]  || '').trim(),
                    logo:                 String(r[3]  || '').trim(),
                    state:                String(r[4]  || '').trim(),
                    city:                 String(r[5]  || '').trim(),
                    presidentPhoto:       String(r[6]  || '').trim(),
                    vicePresident:        String(r[7]  || '').trim(),
                    treasurer:            String(r[8]  || '').trim(),
                    secretary:            String(r[9]  || '').trim(),
                    socialMedia:          String(r[10] || '').trim(),
                    authorizedDirectors:  String(r[11] || '').trim(),
                };
            });
        return ContentService.createTextOutput(JSON.stringify({ ok: true, chapters: chapters }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

/* ── Router ─────────────────────────────────────────────────── */
function route(body) {
    switch (body.action) {
        /* Curriculum */
        case 'create_curriculum':      return createCurriculum(body);
        case 'edit_curriculum':        return editCurriculum(body);
        case 'register_curriculum':    return registerCurriculum(body);
        case 'unregister_curriculum':  return unregisterCurriculum(body);
        case 'start_curriculum':       return startCurriculum(body);
        case 'give_hours':             return giveHours(body);
        /* Events */
        case 'record_event':           return recordEvent(body);
        case 'create_event':           return createEvent(body);
        case 'edit_event':             return editEvent(body);
        case 'register_event':         return registerEvent(body);
        case 'unregister_event':       return unregisterEvent(body);
        case 'give_event_hours':       return giveEventHours(body);
        /* Volunteers */
        case 'update_tier':            return updateTier(body);
        case 'set_hours_goal':         return setHoursGoal(body);
        case 'upload_ymca_form':       return uploadYMCAForm(body);
        /* Director requests (chapter president → DOC/DOO grant) */
        case 'request_director':          return requestDirector(body);
        case 'approve_director_request':  return approveDirectorRequest(body);
        case 'deny_director_request':     return denyDirectorRequest(body);
        default:
            throw new Error('Unknown action: ' + body.action);
    }
}

/* ── CURRICULUM ─────────────────────────────────────────────── */

function createCurriculum(b) {
    const sh = getSheet(SHEET_CURRICULUM);
    sh.appendRow([
        b.assignmentName,
        b.dueDate              || '',
        b.hours                || '',
        b.contributors         || '',
        b.slidesLink           || '',
        b.startDate            || '',
        b.maxVolunteers        || '',
        b.registeredVolunteers || '',
        b.instructions         || '',
        b.cardColor            || '',
        b.cardDeco             || '',
        b.cardLabel            || '',
        b.chapterLabel         || '',
        b.durationDays         || '',
        '',   // TriggeredAt — set by registerCurriculum (auto-fill) or startCurriculum (manual)
        new Date(),   // PostedAt — used to sort lists by posted recency
        b.timezone              || '',
        '', '', '', // DueInstant/StartInstant/TriggeredInstant — set below
        b.topic                 || '',
    ]);
    // Re-set DueDate/StartDate as a real number, plus write the gviz-safe shadow copies — see
    // the comment on setShadowInstant for why both are needed.
    const newRow = sh.getLastRow();
    setInstantValue(sh.getRange(newRow, 2), b.dueDate || '');
    setInstantValue(sh.getRange(newRow, 6), b.startDate || '');
    setShadowInstant(sh.getRange(newRow, 18), b.dueDate || '');
    setShadowInstant(sh.getRange(newRow, 19), b.startDate || '');
    return 'Curriculum assignment created: ' + b.assignmentName;
}

function editCurriculum(b) {
    const sh = SS.getSheetByName(SHEET_CURRICULUM);
    if (!sh) throw new Error('Curriculum sheet not found.');
    const data = sh.getDataRange().getValues();

    let rowIdx = -1;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.assignmentName || '').trim()) { rowIdx = i + 1; break; }
    }
    if (rowIdx < 0) throw new Error('Assignment not found: ' + b.assignmentName);

    const f = b.fields || {};
    if (f.dueDate       !== undefined) { setInstantValue(sh.getRange(rowIdx, 2), f.dueDate); setShadowInstant(sh.getRange(rowIdx, 18), f.dueDate); }
    if (f.hours         !== undefined) sh.getRange(rowIdx, 3).setValue(f.hours);
    if (f.slidesLink    !== undefined) sh.getRange(rowIdx, 5).setValue(f.slidesLink);
    if (f.startDate     !== undefined) { setInstantValue(sh.getRange(rowIdx, 6), f.startDate); setShadowInstant(sh.getRange(rowIdx, 19), f.startDate); }
    if (f.maxVolunteers !== undefined) sh.getRange(rowIdx, 7).setValue(f.maxVolunteers);
    if (f.instructions  !== undefined) sh.getRange(rowIdx, 9).setValue(f.instructions);
    if (f.cardColor     !== undefined) sh.getRange(rowIdx, 10).setValue(f.cardColor);
    if (f.cardDeco      !== undefined) sh.getRange(rowIdx, 11).setValue(f.cardDeco);
    if (f.cardLabel     !== undefined) sh.getRange(rowIdx, 12).setValue(f.cardLabel);
    if (f.chapterLabel  !== undefined) sh.getRange(rowIdx, 13).setValue(f.chapterLabel);
    if (f.durationDays  !== undefined) sh.getRange(rowIdx, 14).setValue(f.durationDays);
    if (f.timezone      !== undefined) sh.getRange(rowIdx, 17).setValue(f.timezone);
    if (f.topic         !== undefined) sh.getRange(rowIdx, 21).setValue(f.topic);
    return 'Updated: ' + b.assignmentName;
}

function registerCurriculum(b) {
    const sh   = SS.getSheetByName(SHEET_CURRICULUM);
    if (!sh) throw new Error('Curriculum sheet not found.');
    const data = sh.getDataRange().getValues();

    let rowIdx = -1, rowData = null;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.assignmentName || '').trim()) {
            rowIdx = i + 1; rowData = data[i]; break;
        }
    }
    if (rowIdx < 0) throw new Error('Assignment not found: ' + b.assignmentName);

    if (rowData[14]) throw new Error('Registration is locked — this assignment has already started.');

    if (isPastLock(rowData[5])) {
        throw new Error('Registration is locked — the start date has passed.');
    }

    const maxVols = parseInt(rowData[6]) || 0;
    const regList = (rowData[7] || '').split(',').map(function(n) { return n.trim(); }).filter(Boolean);
    if (maxVols > 0 && regList.length >= maxVols) {
        throw new Error('This assignment is full (' + maxVols + '/' + maxVols + ' slots).');
    }

    const lower = (b.volunteerName || '').toLowerCase();
    if (!regList.some(function(n) { return n.toLowerCase() === lower; })) {
        regList.push(b.volunteerName);
        sh.getRange(rowIdx, 8).setValue(regList.join(', '));
    }

    // Auto-trigger the duration-based deadline once every spot is filled
    const durationDays = parseFloat(rowData[13]) || 0;
    if (durationDays > 0 && maxVols > 0 && regList.length >= maxVols) {
        const now = new Date();
        const due = new Date(now.getTime() + durationDays * 86400000);
        setInstantValue(sh.getRange(rowIdx, 15), now.getTime());
        setInstantValue(sh.getRange(rowIdx, 2), due.getTime());
        setShadowInstant(sh.getRange(rowIdx, 20), now.getTime());
        setShadowInstant(sh.getRange(rowIdx, 18), due.getTime());
    }

    return 'Registered: ' + b.volunteerName;
}

function unregisterCurriculum(b) {
    const sh   = SS.getSheetByName(SHEET_CURRICULUM);
    if (!sh) throw new Error('Curriculum sheet not found.');
    const data = sh.getDataRange().getValues();

    let rowIdx = -1, rowData = null;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.assignmentName || '').trim()) {
            rowIdx = i + 1; rowData = data[i]; break;
        }
    }
    if (rowIdx < 0) throw new Error('Assignment not found: ' + b.assignmentName);

    if (rowData[14]) throw new Error('This assignment has already started — contact your DOC to be removed.');

    if (isPastLock(rowData[5])) {
        throw new Error('Registration is locked — contact your DOC to be removed.');
    }

    const lower = (b.volunteerName || '').toLowerCase();
    const regList = (rowData[7] || '').split(',').map(function(n) { return n.trim(); }).filter(Boolean);
    const filtered = regList.filter(function(n) { return n.toLowerCase() !== lower; });
    sh.getRange(rowIdx, 8).setValue(filtered.join(', '));
    return 'Unregistered: ' + b.volunteerName;
}

function startCurriculum(b) {
    const sh   = SS.getSheetByName(SHEET_CURRICULUM);
    if (!sh) throw new Error('Curriculum sheet not found.');
    const data = sh.getDataRange().getValues();

    let rowIdx = -1, rowData = null;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.assignmentName || '').trim()) {
            rowIdx = i + 1; rowData = data[i]; break;
        }
    }
    if (rowIdx < 0) throw new Error('Assignment not found: ' + b.assignmentName);

    if (rowData[14]) throw new Error('This assignment has already started.');

    const durationDays = parseFloat(rowData[13]) || 0;
    if (!durationDays) throw new Error('This assignment does not have a working-period duration set.');

    const now = new Date();
    const due = new Date(now.getTime() + durationDays * 86400000);
    setInstantValue(sh.getRange(rowIdx, 15), now.getTime());
    setInstantValue(sh.getRange(rowIdx, 2), due.getTime());
    setShadowInstant(sh.getRange(rowIdx, 20), now.getTime());
    setShadowInstant(sh.getRange(rowIdx, 18), due.getTime());
    return 'Started: ' + b.assignmentName;
}

function giveHours(b) {
    const sh   = SS.getSheetByName(SHEET_CURRICULUM);
    if (!sh) throw new Error('Curriculum sheet not found.');
    const data = sh.getDataRange().getValues();

    let rowIdx = -1;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.assignmentName || '').trim()) {
            rowIdx = i + 1; break;
        }
    }
    if (rowIdx < 0) throw new Error('Assignment not found: ' + b.assignmentName);

    const attendees = b.attendees !== undefined ? b.attendees : (data[rowIdx - 1][7] || '');
    sh.getRange(rowIdx, 4).setValue(attendees);
    return 'Hours given for: ' + b.assignmentName;
}

/* ── EVENTS ─────────────────────────────────────────────────── */

function recordEvent(b) {
    const sh = getSheet(SHEET_EVENTS);
    sh.appendRow([
        b.eventName,
        b.date,
        b.hours,
        b.attendees,
        b.isAssembly    || 'FALSE',
        b.isLeadership  || 'FALSE',
        '',   // G=MaxVolunteers (empty = ad-hoc, not upcoming)
        '',   // H=RegisteredList
        '',   // I=SignupCloseDate
        '',   // J=Instructions
        '',   // K=ChapterLabel
    ]);
    return 'Event recorded: ' + b.eventName;
}

function createEvent(b) {
    const sh = getSheet(SHEET_EVENTS);
    ensureMissingHeaders(sh, 'Events');
    sh.appendRow([
        b.eventName,
        b.eventDate       || '',
        b.hours           || '',
        '',   // D=Attendees (empty until give_event_hours)
        b.isAssembly      || 'FALSE',
        b.isLeadership    || 'FALSE',
        b.maxVolunteers   || '',
        b.registeredList  || '',
        b.signupCloseDate || '',
        b.instructions    || '',
        b.chapterLabel    || '',
        b.cardColor       || '',
        b.cardDeco        || '',
        b.cardLabel       || '',
        b.requiresYMCA    || 'FALSE',
        new Date(),   // PostedAt — used to sort lists by posted recency
        b.timezone        || '',
    ]);
    // Re-set Date/SignupCloseDate as a real number, plus write the gviz-safe shadow copies —
    // see the comment on setShadowInstant for why both are needed.
    const newRow = sh.getLastRow();
    setInstantValue(sh.getRange(newRow, 2), b.eventDate || '');
    setInstantValue(sh.getRange(newRow, 9), b.signupCloseDate || '');
    setShadowInstant(sh.getRange(newRow, 18), b.eventDate || '');
    setShadowInstant(sh.getRange(newRow, 19), b.signupCloseDate || '');
    return 'Event created: ' + b.eventName;
}

function editEvent(b) {
    const sh = SS.getSheetByName(SHEET_EVENTS);
    if (!sh) throw new Error('Events sheet not found.');
    ensureMissingHeaders(sh, 'Events');
    const data = sh.getDataRange().getValues();

    let rowIdx = -1;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.eventName || '').trim()) { rowIdx = i + 1; break; }
    }
    if (rowIdx < 0) throw new Error('Event not found: ' + b.eventName);

    const f = b.fields || {};
    if (f.eventDate       !== undefined) { setInstantValue(sh.getRange(rowIdx, 2), f.eventDate); setShadowInstant(sh.getRange(rowIdx, 18), f.eventDate); }
    if (f.hours           !== undefined) sh.getRange(rowIdx, 3).setValue(f.hours);
    if (f.isAssembly      !== undefined) sh.getRange(rowIdx, 5).setValue(f.isAssembly);
    if (f.isLeadership    !== undefined) sh.getRange(rowIdx, 6).setValue(f.isLeadership);
    if (f.maxVolunteers   !== undefined) sh.getRange(rowIdx, 7).setValue(f.maxVolunteers);
    if (f.signupCloseDate !== undefined) { setInstantValue(sh.getRange(rowIdx, 9), f.signupCloseDate); setShadowInstant(sh.getRange(rowIdx, 19), f.signupCloseDate); }
    if (f.instructions    !== undefined) sh.getRange(rowIdx, 10).setValue(f.instructions);
    if (f.chapterLabel    !== undefined) sh.getRange(rowIdx, 11).setValue(f.chapterLabel);
    if (f.cardColor       !== undefined) sh.getRange(rowIdx, 12).setValue(f.cardColor);
    if (f.cardDeco        !== undefined) sh.getRange(rowIdx, 13).setValue(f.cardDeco);
    if (f.cardLabel       !== undefined) sh.getRange(rowIdx, 14).setValue(f.cardLabel);
    if (f.requiresYMCA    !== undefined) sh.getRange(rowIdx, 15).setValue(f.requiresYMCA);
    if (f.timezone        !== undefined) sh.getRange(rowIdx, 17).setValue(f.timezone);
    return 'Event updated: ' + b.eventName;
}

function registerEvent(b) {
    const sh = SS.getSheetByName(SHEET_EVENTS);
    if (!sh) throw new Error('Events sheet not found.');
    const data = sh.getDataRange().getValues();

    let rowIdx = -1, rowData = null;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.eventName || '').trim()) {
            rowIdx = i + 1; rowData = data[i]; break;
        }
    }
    if (rowIdx < 0) throw new Error('Event not found: ' + b.eventName);

    const requiresYMCA = (rowData[14] || '').toString().trim().toUpperCase() === 'TRUE';
    if (requiresYMCA) {
        const volFound = findRow(SHEET_VOLUNTEERS, 0, b.volunteerName);
        const ymcaUrl = volFound ? (volFound[1][14] || '').trim() : '';
        if (!ymcaUrl) throw new Error('This event requires a signed YMCA volunteer form. Please upload your form in the portal (My Progress → Required Forms) before registering.');
    }

    if (isPastLock(rowData[8])) {
        throw new Error('Event registration is closed.');
    }

    const maxVols = parseInt(rowData[6]) || 0;
    const regList = (rowData[7] || '').split(',').map(function(n) { return n.trim(); }).filter(Boolean);
    if (maxVols > 0 && regList.length >= maxVols) {
        throw new Error('This event is full (' + maxVols + '/' + maxVols + ' slots).');
    }

    const lower = (b.volunteerName || '').toLowerCase();
    if (!regList.some(function(n) { return n.toLowerCase() === lower; })) {
        regList.push(b.volunteerName);
        sh.getRange(rowIdx, 8).setValue(regList.join(', '));
    }
    return 'Registered for event: ' + b.volunteerName;
}

function unregisterEvent(b) {
    const sh = SS.getSheetByName(SHEET_EVENTS);
    if (!sh) throw new Error('Events sheet not found.');
    const data = sh.getDataRange().getValues();

    let rowIdx = -1, rowData = null;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.eventName || '').trim()) {
            rowIdx = i + 1; rowData = data[i]; break;
        }
    }
    if (rowIdx < 0) throw new Error('Event not found: ' + b.eventName);

    if (isPastLock(rowData[8])) {
        throw new Error('Event registration is closed — contact your DOO to be removed.');
    }

    const lower = (b.volunteerName || '').toLowerCase();
    const regList = (rowData[7] || '').split(',').map(function(n) { return n.trim(); }).filter(Boolean);
    const filtered = regList.filter(function(n) { return n.toLowerCase() !== lower; });
    sh.getRange(rowIdx, 8).setValue(filtered.join(', '));
    return 'Unregistered from event: ' + b.volunteerName;
}

function giveEventHours(b) {
    const sh = SS.getSheetByName(SHEET_EVENTS);
    if (!sh) throw new Error('Events sheet not found.');
    const data = sh.getDataRange().getValues();

    let rowIdx = -1;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.eventName || '').trim()) {
            rowIdx = i + 1; break;
        }
    }
    if (rowIdx < 0) throw new Error('Event not found: ' + b.eventName);

    sh.getRange(rowIdx, 4).setValue(b.attendees || '');
    return 'Event hours given for: ' + b.eventName;
}

/* ── VOLUNTEERS ─────────────────────────────────────────────── */

function updateTier(b) {
    const found = findRow(SHEET_VOLUNTEERS, 0, b.volunteerName);
    if (!found) throw new Error('Volunteer not found: ' + b.volunteerName);
    updateCell(SHEET_VOLUNTEERS, found[0], 6, b.newTier);
    return 'Tier updated: ' + b.volunteerName + ' → ' + b.newTier;
}

function setHoursGoal(b) {
    const found = findRow(SHEET_VOLUNTEERS, 0, b.volunteerName);
    if (!found) throw new Error('Volunteer not found: ' + b.volunteerName);
    updateCell(SHEET_VOLUNTEERS, found[0], 13, b.goal);
    return 'Hours goal set: ' + b.volunteerName + ' → ' + b.goal;
}

function uploadYMCAForm(b) {
    if (!b.fileData) throw new Error('No file data provided.');
    ensureMissingHeaders(getSheet(SHEET_VOLUNTEERS), 'Volunteers');
    const decoded = Utilities.newBlob(
        Utilities.base64Decode(b.fileData),
        b.mimeType || 'application/pdf',
        b.fileName || 'ymca_form.pdf'
    );
    let folder;
    try {
        const it = DriveApp.getFoldersByName('YMCA Forms');
        folder = it.hasNext() ? it.next() : DriveApp.createFolder('YMCA Forms');
    } catch(_) {
        folder = DriveApp.getRootFolder();
    }
    const file = folder.createFile(decoded);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = file.getUrl();
    const found = findRow(SHEET_VOLUNTEERS, 0, b.volunteerName);
    if (!found) throw new Error('Volunteer not found: ' + b.volunteerName);
    const ymcaCol = findOrAddColumn(getSheet(SHEET_VOLUNTEERS), 'YMCAFormURL');
    updateCell(SHEET_VOLUNTEERS, found[0], ymcaCol - 1, url);
    return url;
}

/* ── DIRECTOR REQUESTS (chapter president → DOC/DOO grant) ────── */

function requestDirector(b) {
    const email = String(b.requestedEmail || '').trim().toLowerCase();
    if (!email) throw new Error('Requested email is required.');
    const title = String(b.requestedTitle || '').trim();
    if (!title) throw new Error('A title is required.');

    const sh = getSheet(SHEET_DIR_REQUESTS);
    const id = Utilities.getUuid();
    sh.appendRow([
        id,
        email,
        b.requestedName || '',
        title,
        String(b.byEmail || '').trim().toLowerCase(),
        b.byName || '',
        b.chapterSchool || '',
        'pending',
        new Date(),
        '',
        '',
    ]);
    return 'Request submitted for ' + email;
}

function approveDirectorRequest(b) {
    const found = findRow(SHEET_DIR_REQUESTS, 0, b.requestId);
    if (!found) throw new Error('Request not found.');
    const rowIdx = found[0], rowData = found[1];
    if (String(rowData[7] || '').trim().toLowerCase() !== 'pending') {
        throw new Error('This request has already been decided.');
    }
    const email          = String(rowData[1] || '').trim().toLowerCase();
    const requestedName  = String(rowData[2] || '').trim();
    const title           = String(rowData[3] || '').trim();
    const chapterSchool  = String(rowData[6] || '').trim();

    // Grant "director" tier — never downgrade someone who already has more access (exec/head).
    // Only fill in the title if they don't already have one, so an existing custom title sticks.
    const dirSh   = getSheet(SHEET_DIRECTORS);
    ensureMissingHeaders(dirSh, 'Directors');
    const dirFound = findRow(SHEET_DIRECTORS, 0, email);
    if (dirFound) {
        const existingTier = String(dirFound[1][2] || '').trim().toLowerCase();
        if (existingTier !== 'exec' && existingTier !== 'head') {
            dirSh.getRange(dirFound[0], 3).setValue('director');
        }
        if (title && !String(dirFound[1][3] || '').trim()) {
            dirSh.getRange(dirFound[0], 4).setValue(title);
        }
    } else {
        dirSh.appendRow([email, requestedName, 'director', title]);
    }

    // Scope them to the requesting chapter via Chapters!AuthorizedDirectors
    if (chapterSchool) {
        const chapSh   = getSheet(SHEET_CHAPTERS);
        const chapData = chapSh.getDataRange().getValues();
        for (let i = 1; i < chapData.length; i++) {
            if (String(chapData[i][2] || '').trim().toLowerCase() === chapterSchool.toLowerCase()) {
                const existing = String(chapData[i][11] || '')
                    .split(',').map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean);
                if (existing.indexOf(email) < 0) {
                    existing.push(email);
                    chapSh.getRange(i + 1, 12).setValue(existing.join(', '));
                }
                break;
            }
        }
    }

    const sh = getSheet(SHEET_DIR_REQUESTS);
    sh.getRange(rowIdx, 8).setValue('approved');
    sh.getRange(rowIdx, 10).setValue(new Date());
    sh.getRange(rowIdx, 11).setValue(b.decidedBy || '');
    return 'Approved: ' + email + ' → director (' + title + ')';
}

function denyDirectorRequest(b) {
    const found = findRow(SHEET_DIR_REQUESTS, 0, b.requestId);
    if (!found) throw new Error('Request not found.');
    const rowIdx = found[0], rowData = found[1];
    if (String(rowData[7] || '').trim().toLowerCase() !== 'pending') {
        throw new Error('This request has already been decided.');
    }
    const sh = getSheet(SHEET_DIR_REQUESTS);
    sh.getRange(rowIdx, 8).setValue('denied');
    sh.getRange(rowIdx, 10).setValue(new Date());
    sh.getRange(rowIdx, 11).setValue(b.decidedBy || '');
    return 'Denied request for ' + rowData[1];
}

/* ── FORM SUBMIT TRIGGER ────────────────────────────────────── */
// The Google Form automatically writes the new row.
// This trigger fills in derived fields (Track, Tier defaults)
// on the row the form just created.
//
// Set up via: Triggers → + Add Trigger
//   Function: onFormSubmit | From spreadsheet | On form submit
function onFormSubmit(e) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        const row = e.range.getRow();
        const sh  = e.range.getSheet();

        const specialty = sh.getRange(row, 10).getValue();
        const track     = specialtyToTrack(specialty);

        if (track) sh.getRange(row, 6).setValue(track);
        sh.getRange(row, 7).setValue('1');
        sh.getRange(row, 8).setValue('FALSE');
        sh.getRange(row, 9).setValue('0');

        // If the form has a question titled "Timezone" (add one with the exact answer choices
        // below), normalize whatever text the volunteer picked into a canonical IANA zone, in
        // place, in the dedicated Timezone column — this is what drives per-volunteer date
        // conversion across the portal. No-op if the question/column doesn't exist yet.
        const tzCol = findOrAddColumn(sh, 'Timezone');
        const rawTz = sh.getRange(row, tzCol).getValue();
        const normTz = normalizeTimezone(rawTz);
        if (normTz) sh.getRange(row, tzCol).setValue(normTz);
    } finally {
        lock.releaseLock();
    }
}

function specialtyToTrack(specialty) {
    const s = (specialty || '').toLowerCase();
    if (s.includes('curriculum'))                                                     return 'Curriculum';
    if (s.includes('operation') || s.includes('in-person') || s.includes('session')) return 'Operations';
    if (s.includes('media') || s.includes('design') || s.includes('content') || s.includes('publicity')) return 'Media/Design';
    return '';
}

/* Normalizes a raw Google Form timezone answer (e.g. "Eastern (ET)", "Eastern Time") into a
   canonical IANA zone. Keep in sync with the TZ_OPTIONS list in portal.js — suggested exact
   Google Form multiple-choice answers: Eastern (ET), Central (CT), Mountain (MT),
   Arizona (no DST), Pacific (PT), Alaska (AKT), Hawaii (HST), UTC. */
function normalizeTimezone(raw) {
    const s = (raw || '').toString().toLowerCase();
    if (!s) return '';
    if (s.indexOf('hawaii') >= 0) return 'Pacific/Honolulu';
    if (s.indexOf('alaska') >= 0) return 'America/Anchorage';
    if (s.indexOf('arizona') >= 0) return 'America/Phoenix';
    if (s.indexOf('pacific') >= 0 || /\bpt\b/.test(s) || /\bpst\b/.test(s) || /\bpdt\b/.test(s)) return 'America/Los_Angeles';
    if (s.indexOf('mountain') >= 0 || /\bmt\b/.test(s) || /\bmst\b/.test(s) || /\bmdt\b/.test(s)) return 'America/Denver';
    if (s.indexOf('central') >= 0 || /\bct\b/.test(s) || /\bcst\b/.test(s) || /\bcdt\b/.test(s)) return 'America/Chicago';
    if (s.indexOf('eastern') >= 0 || /\bet\b/.test(s) || /\best\b/.test(s) || /\bedt\b/.test(s)) return 'America/New_York';
    if (s.indexOf('utc') >= 0 || s.indexOf('gmt') >= 0) return 'UTC';
    return '';
}

/* ── FORM RESPONSE EDIT SYNC ────────────────────────────────────────────────────────────
   Google's "Edit after submit" is supposed to update the linked spreadsheet row when a
   volunteer edits their response, but that sync is known to be unreliable — it commonly
   just silently doesn't happen (especially on sheets with scripts/triggers attached, like
   this one). Three layers work around it, from most to least immediate:

   1. onFormSubmit(e)       — the SPREADSHEET-bound trigger above. Google's own row-append
      for a BRAND NEW submission already works reliably; this just fills in derived defaults
      (Track/Tier/Lead/CyclesCompleted) on the row it created. Unchanged in what it does.
   2. onFormSubmitOrEdit(e) — a FORM-bound trigger (installed by setupTriggers(), not the
      plain Triggers UI, since it needs a live Form object handle). A form-bound submit event
      fires for edits too, unlike the spreadsheet-bound one — this is what actually catches
      edits, live, right when they happen.
   3. syncFormResponses()   — an hourly time-driven backstop. Same reconciliation as #2, but
      sweeps every response instead of reacting to one event, so a misfired trigger or a
      manual sheet edit that drifted out of sync gets repaired within the hour regardless.

   Run setupTriggers() ONCE from the Apps Script editor (function dropdown → setupTriggers →
   ▶ Run) to install #2 and #3 — keep your existing onFormSubmit trigger (#1) as-is. */

function setupTriggers() {
    const formUrl = SS.getFormUrl();
    if (!formUrl) throw new Error('This spreadsheet is not linked to a Form — nothing to set up.');
    const form = FormApp.openByUrl(formUrl);
    const existing = ScriptApp.getProjectTriggers();

    const hasEditTrigger = existing.some(function(t) {
        return t.getHandlerFunction() === 'onFormSubmitOrEdit' && t.getTriggerSourceId() === form.getId();
    });
    if (!hasEditTrigger) ScriptApp.newTrigger('onFormSubmitOrEdit').forForm(form).onFormSubmit().create();

    const hasSyncTrigger = existing.some(function(t) { return t.getHandlerFunction() === 'syncFormResponses'; });
    if (!hasSyncTrigger) ScriptApp.newTrigger('syncFormResponses').timeBased().everyHours(1).create();

    return 'Triggers ready: onFormSubmitOrEdit (live edit sync) + syncFormResponses (hourly backstop). ' +
        'Your existing onFormSubmit trigger still handles brand-new submissions — leave it in place.';
}

function onFormSubmitOrEdit(e) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        reconcileFormResponse(getSheet(SHEET_VOLUNTEERS), e.response);
    } finally {
        lock.releaseLock();
    }
}

function syncFormResponses() {
    const formUrl = SS.getFormUrl();
    if (!formUrl) return; // this spreadsheet isn't form-linked — nothing to sync
    const form = FormApp.openByUrl(formUrl);
    const sh = getSheet(SHEET_VOLUNTEERS);
    if (sh.getLastRow() < 2) return;

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        form.getResponses().forEach(function(resp) { reconcileFormResponse(sh, resp); });
    } finally {
        lock.releaseLock();
    }
}

/* Shared by the live edit trigger and the hourly backstop: matches a Form response to its
   sheet row by a stable response ID (stamped here on first match, since a response's ID
   never changes even when its answers are edited — unlike Google's own row-sync, which
   drops edits), falling back to email for rows that don't have an ID stamped yet. Then
   overwrites any raw answer cell that's out of date, propagates a Name change into every
   Curriculum/Events registration & credit list so history doesn't orphan under the old
   name, and re-derives Track/Timezone from whatever the answers now say. */
function reconcileFormResponse(sh, resp) {
    if (!resp) return;
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return;

    const EMAIL_COL_IDX = 4; // 0-indexed column E — matches config.js CONFIG.EMAIL_COL
    const idCol = findOrAddColumn(sh, 'FormResponseId');
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
    const data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const id = resp.getId();
    let rowIdx = null;
    for (let i = 0; i < data.length; i++) {
        if (String(data[i][idCol - 1] || '').trim() === id) { rowIdx = i + 2; break; }
    }
    if (!rowIdx) {
        const email = (resp.getRespondentEmail() || '').trim().toLowerCase();
        if (email) {
            for (let i = 0; i < data.length; i++) {
                if (String(data[i][EMAIL_COL_IDX] || '').trim().toLowerCase() === email) { rowIdx = i + 2; break; }
            }
        }
        if (!rowIdx) return; // genuinely new submission — the create-path (onFormSubmit) handles it
        sh.getRange(rowIdx, idCol).setValue(id); // backfill so ID-matching works next time
    }

    const oldName = String(sh.getRange(rowIdx, 1).getValue() || '').trim();

    resp.getItemResponses().forEach(function(itemResp) {
        const title = itemResp.getItem().getTitle().trim();
        const colIdx = headers.indexOf(title); // sheet's own header text is the source of truth
        if (colIdx < 0) return; // question isn't mapped to a tracked column — skip
        const newVal = itemResp.getResponse();
        const cell = sh.getRange(rowIdx, colIdx + 1);
        if (String(cell.getValue()) !== String(newVal)) cell.setValue(newVal);
    });

    const newName = String(sh.getRange(rowIdx, 1).getValue() || '').trim();
    if (oldName && newName && oldName !== newName) renameVolunteerEverywhere(oldName, newName);

    // Re-derive Track from whatever's now in SelectYourMainSpecialty (col J)
    const track = specialtyToTrack(sh.getRange(rowIdx, 10).getValue());
    if (track) sh.getRange(rowIdx, 6).setValue(track);

    // Re-normalize Timezone from whatever's now in the Timezone question/column
    const tzCol = findOrAddColumn(sh, 'Timezone');
    const rawTz = sh.getRange(rowIdx, tzCol).getValue();
    const normTz = normalizeTimezone(rawTz);
    if (normTz && normTz !== rawTz) sh.getRange(rowIdx, tzCol).setValue(normTz);
}

/* Registrations and hours-credited are tracked as comma-separated NAMES (not emails) in
   Curriculum/Events — if a volunteer's name changes, propagate the rename into every list it
   appears in so their history doesn't silently orphan under the old name. Matches whole
   comma-separated tokens only (case-insensitive), never substrings. */
function renameVolunteerEverywhere(oldName, newName) {
    const oldLower = oldName.trim().toLowerCase();
    [
        { sheet: SHEET_CURRICULUM, cols: [4, 8] },  // D=Contributors, H=RegisteredVolunteers
        { sheet: SHEET_EVENTS,     cols: [4, 8] },  // D=Attendees, H=RegisteredList
    ].forEach(function(target) {
        const sh = SS.getSheetByName(target.sheet);
        if (!sh) return;
        const lastRow = sh.getLastRow();
        if (lastRow < 2) return;
        target.cols.forEach(function(col) {
            const range = sh.getRange(2, col, lastRow - 1, 1);
            const values = range.getValues();
            let changed = false;
            const updated = values.map(function(row) {
                const cell = String(row[0] || '');
                if (!cell) return row;
                const names = cell.split(',').map(function(n) { return n.trim(); }).filter(Boolean);
                const renamed = names.map(function(n) { return n.toLowerCase() === oldLower ? newName : n; });
                if (renamed.join(', ') !== names.join(', ')) changed = true;
                return [renamed.join(', ')];
            });
            if (changed) range.setValues(updated);
        });
    });
}
