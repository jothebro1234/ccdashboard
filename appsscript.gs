/**
 * Curio Crate Volunteer Portal — Google Apps Script Backend
 *
 * SETUP:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Paste this entire file into Code.gs (replace existing content)
 * 3. Deploy as Web App (Execute as: Me, Anyone can access) → copy /exec URL → paste into config.js APPS_SCRIPT_URL
 * 4. Add form-submit trigger: Triggers (clock icon) → + Add Trigger
 *    Function: onFormSubmit | From spreadsheet | On form submit
 *
 * VOLUNTEERS SHEET columns (A–O):
 *   A=Name  B=Discord  C=School  D=Avatar  E=Email
 *   F=Track  G=Tier  H=Lead  I=CyclesCompleted
 *   J=SelectYourMainSpecialty  K=OnTimeRate  L=LastContact  M=TotalHours  N=HoursGoal
 *   O=YMCAFormURL
 *
 * CURRICULUM SHEET columns (A–M):
 *   A=AssignmentName  B=DueDate  C=Hours  D=Contributors
 *   E=SlidesLink  F=StartDate(LockDate)  G=MaxVolunteers  H=RegisteredVolunteers
 *   I=Instructions  J=CardColor  K=CardDeco  L=CardLabel  M=ChapterLabel
 *
 * EVENTS SHEET columns (A–O):
 *   A=EventName  B=Date  C=Hours  D=Attendees  E=IsAssembly  F=IsLeadership
 *   G=MaxVolunteers  H=RegisteredList  I=SignupCloseDate  J=Instructions  K=ChapterLabel
 *   L=CardColor  M=CardDeco  N=CardLabel  O=RequiresYMCA
 *
 * CHAPTERS SHEET columns (A–L):
 *   A=Email  B=Name  C=School  D=Logo  E=State  F=City
 *   G=PresidentPhoto  H=VicePresident  I=Treasurer  J=Secretary  K=SocialMedia
 *   L=AuthorizedDirectors (comma-separated emails)
 *
 * DIRECTORS SHEET columns (A–C):
 *   A=Email  B=Name  C=Role
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

/* Sheet name constants */
const SHEET_VOLUNTEERS  = 'Volunteers';
const SHEET_CURRICULUM  = 'Curriculum';
const SHEET_EVENTS      = 'Events';
const SHEET_CHAPTERS    = 'Chapters';
const SHEET_DIRECTORS   = 'Directors';

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
        Curriculum: ['AssignmentName','DueDate','Hours','Contributors','SlidesLink','StartDate','MaxVolunteers','RegisteredVolunteers','Instructions','CardColor','CardDeco','CardLabel','ChapterLabel'],
        Events:     ['EventName','Date','Hours','Attendees','IsAssembly','IsLeadership','MaxVolunteers','RegisteredList','SignupCloseDate','Instructions','ChapterLabel','CardColor','CardDeco','CardLabel','RequiresYMCA'],
        Chapters:   ['Email','Name','School','Logo','State','City','PresidentPhoto','VicePresident','Treasurer','Secretary','SocialMedia','AuthorizedDirectors'],
        Directors:  ['Email','Name','Role'],
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
        const expected = ['EventName','Date','Hours','Attendees','IsAssembly','IsLeadership','MaxVolunteers','RegisteredList','SignupCloseDate','Instructions','ChapterLabel','CardColor','CardDeco','CardLabel','RequiresYMCA'];
        const lastCol = Math.max(sh.getLastColumn(), expected.length);
        const current = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        expected.forEach(function(col, i) {
            if (!current[i] || current[i].toString().trim() === '') {
                sh.getRange(1, i + 1).setValue(col);
            }
        });
    } else if (name === 'Volunteers') {
        findOrAddColumn(sh, 'YMCAFormURL');
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

/* Extract just the date part (YYYY-MM-DD) from any stored date string */
function datePartStr(val) {
    if (!val) return '';
    const s = String(val).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}

/* ── doPost ─────────────────────────────────────────────────── */
function doPost(e) {
    try {
        ensureMissingHeaders(getSheet(SHEET_EVENTS),     'Events');
        ensureMissingHeaders(getSheet(SHEET_VOLUNTEERS), 'Volunteers');
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
    ]);
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
    if (f.dueDate       !== undefined) sh.getRange(rowIdx, 2).setValue(f.dueDate);
    if (f.hours         !== undefined) sh.getRange(rowIdx, 3).setValue(f.hours);
    if (f.slidesLink    !== undefined) sh.getRange(rowIdx, 5).setValue(f.slidesLink);
    if (f.startDate     !== undefined) sh.getRange(rowIdx, 6).setValue(f.startDate);
    if (f.maxVolunteers !== undefined) sh.getRange(rowIdx, 7).setValue(f.maxVolunteers);
    if (f.instructions  !== undefined) sh.getRange(rowIdx, 9).setValue(f.instructions);
    if (f.cardColor     !== undefined) sh.getRange(rowIdx, 10).setValue(f.cardColor);
    if (f.cardDeco      !== undefined) sh.getRange(rowIdx, 11).setValue(f.cardDeco);
    if (f.cardLabel     !== undefined) sh.getRange(rowIdx, 12).setValue(f.cardLabel);
    if (f.chapterLabel  !== undefined) sh.getRange(rowIdx, 13).setValue(f.chapterLabel);
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

    const startDatePart = datePartStr(rowData[5]);
    const today = todayStr();
    if (startDatePart && startDatePart < today) {
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

    const startDatePart = datePartStr(rowData[5]);
    const today = todayStr();
    if (startDatePart && startDatePart < today) {
        throw new Error('Registration is locked — contact your DOC to be removed.');
    }

    const lower = (b.volunteerName || '').toLowerCase();
    const regList = (rowData[7] || '').split(',').map(function(n) { return n.trim(); }).filter(Boolean);
    const filtered = regList.filter(function(n) { return n.toLowerCase() !== lower; });
    sh.getRange(rowIdx, 8).setValue(filtered.join(', '));
    return 'Unregistered: ' + b.volunteerName;
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
    ]);
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
    if (f.eventDate       !== undefined) sh.getRange(rowIdx, 2).setValue(f.eventDate);
    if (f.hours           !== undefined) sh.getRange(rowIdx, 3).setValue(f.hours);
    if (f.isAssembly      !== undefined) sh.getRange(rowIdx, 5).setValue(f.isAssembly);
    if (f.isLeadership    !== undefined) sh.getRange(rowIdx, 6).setValue(f.isLeadership);
    if (f.maxVolunteers   !== undefined) sh.getRange(rowIdx, 7).setValue(f.maxVolunteers);
    if (f.signupCloseDate !== undefined) sh.getRange(rowIdx, 9).setValue(f.signupCloseDate);
    if (f.instructions    !== undefined) sh.getRange(rowIdx, 10).setValue(f.instructions);
    if (f.chapterLabel    !== undefined) sh.getRange(rowIdx, 11).setValue(f.chapterLabel);
    if (f.cardColor       !== undefined) sh.getRange(rowIdx, 12).setValue(f.cardColor);
    if (f.cardDeco        !== undefined) sh.getRange(rowIdx, 13).setValue(f.cardDeco);
    if (f.cardLabel       !== undefined) sh.getRange(rowIdx, 14).setValue(f.cardLabel);
    if (f.requiresYMCA    !== undefined) sh.getRange(rowIdx, 15).setValue(f.requiresYMCA);
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

    const closeDatePart = datePartStr(rowData[8]);
    const today = todayStr();
    if (closeDatePart && closeDatePart < today) {
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

    const closeDatePart = datePartStr(rowData[8]);
    const today = todayStr();
    if (closeDatePart && closeDatePart < today) {
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

/* ── FORM SUBMIT TRIGGER ────────────────────────────────────── */
// The Google Form automatically writes the new row.
// This trigger fills in derived fields (Track, Tier defaults)
// on the row the form just created.
//
// Set up via: Triggers → + Add Trigger
//   Function: onFormSubmit | From spreadsheet | On form submit
function onFormSubmit(e) {
    const row = e.range.getRow();
    const sh  = e.range.getSheet();

    const specialty = sh.getRange(row, 10).getValue();
    const track     = specialtyToTrack(specialty);

    if (track) sh.getRange(row, 6).setValue(track);
    sh.getRange(row, 7).setValue('1');
    sh.getRange(row, 8).setValue('FALSE');
    sh.getRange(row, 9).setValue('0');
}

function specialtyToTrack(specialty) {
    const s = (specialty || '').toLowerCase();
    if (s.includes('curriculum'))                                                     return 'Curriculum';
    if (s.includes('operation') || s.includes('in-person') || s.includes('session')) return 'Operations';
    if (s.includes('media') || s.includes('design') || s.includes('content') || s.includes('publicity')) return 'Media/Design';
    return '';
}
