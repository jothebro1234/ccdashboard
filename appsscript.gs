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
 * VOLUNTEERS SHEET columns (A–M):
 *   A=Name  B=Discord  C=School  D=Avatar  E=Email
 *   F=Track  G=Tier  H=Lead  I=CyclesCompleted
 *   J=SelectYourMainSpecialty  K=OnTimeRate  L=LastContact  M=TotalHours
 *
 * CURRICULUM SHEET columns (A–I):
 *   A=AssignmentName  B=DueDate  C=Hours  D=Contributors
 *   E=SlidesLink  F=StartDate(LockDate)  G=MaxVolunteers  H=RegisteredVolunteers
 *   I=Instructions
 *
 * EVENTS SHEET columns (A–E):
 *   A=EventName  B=Date  C=Hours  D=Attendees  E=IsAssembly
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

/* Sheet name constants */
const SHEET_VOLUNTEERS  = 'Volunteers';
const SHEET_CURRICULUM  = 'Curriculum';
const SHEET_EVENTS      = 'Events';

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
        Curriculum: ['AssignmentName','DueDate','Hours','Contributors','SlidesLink','StartDate','MaxVolunteers','RegisteredVolunteers','Instructions'],
        Events:     ['EventName','Date','Hours','Attendees','IsAssembly'],
    };
    if (headers[name]) sh.appendRow(headers[name]);
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
        const body   = JSON.parse(e.postData.contents);
        const result = route(body);
        return ContentService.createTextOutput(JSON.stringify({ ok: true, result }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet() {
    return ContentService.createTextOutput(JSON.stringify({ ok: true, msg: 'Curio Crate Apps Script running.' }))
        .setMimeType(ContentService.MimeType.JSON);
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
        /* Volunteers */
        case 'update_tier':            return updateTier(body);
        default:
            throw new Error('Unknown action: ' + body.action);
    }
}

/* ── CURRICULUM ─────────────────────────────────────────────── */

function createCurriculum(b) {
    const sh = getSheet(SHEET_CURRICULUM);
    sh.appendRow([
        b.assignmentName,
        b.dueDate        || '',
        b.hours          || '',
        b.contributors   || '',
        b.slidesLink     || '',
        b.startDate      || '',
        b.maxVolunteers  || '',
        b.registeredVolunteers || '',
        b.instructions   || '',
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
    // col numbers are 1-based for getRange
    if (f.dueDate       !== undefined) sh.getRange(rowIdx, 2).setValue(f.dueDate);
    if (f.hours         !== undefined) sh.getRange(rowIdx, 3).setValue(f.hours);
    if (f.slidesLink    !== undefined) sh.getRange(rowIdx, 5).setValue(f.slidesLink);
    if (f.startDate     !== undefined) sh.getRange(rowIdx, 6).setValue(f.startDate);
    if (f.maxVolunteers !== undefined) sh.getRange(rowIdx, 7).setValue(f.maxVolunteers);
    if (f.instructions  !== undefined) sh.getRange(rowIdx, 9).setValue(f.instructions);
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

    // Check lock date using string comparison to avoid UTC timezone issues
    const startDatePart = datePartStr(rowData[5]);
    const today = todayStr();
    if (startDatePart && startDatePart < today) {
        throw new Error('Registration is locked — the start date has passed.');
    }

    // Check capacity
    const maxVols = parseInt(rowData[6]) || 0;
    const regList = (rowData[7] || '').split(',').map(function(n) { return n.trim(); }).filter(Boolean);
    if (maxVols > 0 && regList.length >= maxVols) {
        throw new Error('This assignment is full (' + maxVols + '/' + maxVols + ' slots).');
    }

    // Add if not already registered
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

    // Check lock date using string comparison
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

    let rowIdx = -1, rowData = null;
    for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').trim() === (b.assignmentName || '').trim()) {
            rowIdx = i + 1; rowData = data[i]; break;
        }
    }
    if (rowIdx < 0) throw new Error('Assignment not found: ' + b.assignmentName);

    const registered = rowData[7] || '';
    sh.getRange(rowIdx, 4).setValue(registered); // col D = Contributors
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
        b.isAssembly || 'FALSE',
    ]);
    return 'Event recorded: ' + b.eventName;
}

/* ── VOLUNTEERS ─────────────────────────────────────────────── */

function updateTier(b) {
    const found = findRow(SHEET_VOLUNTEERS, 0, b.volunteerName);
    if (!found) throw new Error('Volunteer not found: ' + b.volunteerName);
    updateCell(SHEET_VOLUNTEERS, found[0], 6, b.newTier); // col G (0-indexed 6)
    return 'Tier updated: ' + b.volunteerName + ' → ' + b.newTier;
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

    // Col J (column 10, 1-based) = "Select Your Main Specialty"
    const specialty = sh.getRange(row, 10).getValue();
    const track     = specialtyToTrack(specialty);

    if (track) sh.getRange(row, 6).setValue(track); // F: Track
    sh.getRange(row, 7).setValue('1');               // G: Tier = Explorer
    sh.getRange(row, 8).setValue('FALSE');           // H: Lead = false
    sh.getRange(row, 9).setValue('0');               // I: CyclesCompleted = 0
}

function specialtyToTrack(specialty) {
    const s = (specialty || '').toLowerCase();
    if (s.includes('curriculum'))                                                     return 'Curriculum';
    if (s.includes('operation') || s.includes('in-person') || s.includes('session')) return 'Operations';
    if (s.includes('media') || s.includes('design') || s.includes('content') || s.includes('publicity')) return 'Media/Design';
    return '';
}
