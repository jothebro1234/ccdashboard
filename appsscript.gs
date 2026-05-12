/**
 * Curio Crate Volunteer Portal — Google Apps Script Backend
 *
 * SETUP:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Paste this entire file into Code.gs (replace default content)
 * 3. Deploy as Web App (Execute as: Me, Anyone can access) → copy /exec URL → paste into CONFIG.APPS_SCRIPT_URL
 * 4. Add form-submit trigger: Extensions → Apps Script → Triggers (clock icon) → + Add Trigger
 *    - Function: onFormSubmit  Event source: From spreadsheet  Event type: On form submit
 *
 * REQUIRED SHEETS: Tasks | Sessions | SessionDebriefs | WinsBoard | Notifications
 *                  Nominations | Cycles | ContentCalendar
 *
 * VOLUNTEERS SHEET columns A–L:
 *   A=Name  B=Discord  C=School  D=Avatar  E=Email
 *   F=Track  G=Tier  H=Lead  I=CyclesCompleted
 *   J=TeamBadges  K=OnTimeRate  L=LastContact
 *
 * FORM FIELD NAMES (must match exactly, case-insensitive checked):
 *   "Email Address" or "Email"  → column E
 *   "Full Name" or "Name"       → column A
 *   "School" or "University"    → column C
 *   "Discord" or "Discord Username" → column B
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

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
        Tasks:           ['TaskID','VolunteerName','TaskName','Description','TierLevel','CycleNumber','TemplateLink','DoneWhen','Deadline','ContactPerson','Status','SubmissionLink','DirectorNote','CreatedDate','SubmittedDate','ReviewedDate','Hours','Track'],
        Sessions:        ['SessionID','SessionName','PartnerOrg','Date','Time','Location','Kit','FacilitatorSpots','ObserverSpots','Lead','Status','Attendees','Hours','Notes'],
        SessionDebriefs: ['SessionID','LeadName','WhatWorked','WhatConfused','WhatBroke','FixCurriculum','FixOperations','SubmittedDate'],
        WinsBoard:       ['PostID','VolunteerNames','RecognitionText','Type','PostedBy','Track','PostedDate'],
        Notifications:   ['NotifID','VolunteerName','Type','Content','Read','CreatedDate','RefID'],
        Nominations:     ['NomID','VolunteerName','Director','Note','Status','NominatedDate','CurrentTier','TargetTier'],
        Cycles:          ['CycleNumber','StartDate','EndDate','Status','Notes'],
        ContentCalendar: ['EntryID','Month','Description','Platform','AssignedVol','Status','DueDate','Approved','CreatedDate'],
    };
    if (headers[name]) sh.appendRow(headers[name]);
}

function appendRow(sheetName, values) {
    getSheet(sheetName).appendRow(values);
}

/* Find a row by matching column value; returns [rowIndex, rowData] or null */
function findRow(sheetName, col, value) {
    const sh = getSheet(sheetName);
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][col]).trim() === String(value).trim()) return [i+1, data[i]];
    }
    return null;
}

/* Update a cell in a found row */
function updateCell(sheetName, rowIdx, col, value) {
    getSheet(sheetName).getRange(rowIdx, col+1).setValue(value);
}

/* ── doPost ─────────────────────────────────────────────────── */
function doPost(e) {
    const output = ContentService.createTextOutput;
    try {
        const body = JSON.parse(e.postData.contents);
        const result = route(body);
        return output(JSON.stringify({ok:true, result})).setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
        return output(JSON.stringify({ok:false, error:err.message})).setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
    return ContentService.createTextOutput(JSON.stringify({ok:true,msg:'Curio Crate Apps Script is running.'}))
        .setMimeType(ContentService.MimeType.JSON);
}

/* ── Router ─────────────────────────────────────────────────── */
function route(body) {
    const action = body.action;
    switch(action) {
        case 'create_task':       return createTask(body);
        case 'update_task':       return updateTask(body);
        case 'submit_task':       return submitTask(body);
        case 'confirm_task':      return confirmTask(body);
        case 'create_session':    return createSession(body);
        case 'sign_up_session':   return signUpSession(body);
        case 'submit_debrief':    return submitDebrief(body);
        case 'post_win':          return postWin(body);
        case 'send_notification': return sendNotification(body);
        case 'mark_notif_read':   return markNotifRead(body);
        case 'mark_all_read':     return markAllRead(body);
        case 'create_nomination': return createNomination(body);
        case 'update_nomination': return updateNomination(body);
        case 'confirm_promotion': return confirmPromotion(body);
        case 'add_content_entry': return addContentEntry(body);
        case 'update_session_status': return updateSessionStatus(body);
        case 'create_cycle':      return createCycle(body);
        default: throw new Error('Unknown action: '+action);
    }
}

/* ── TASKS ──────────────────────────────────────────────────── */
function createTask(b) {
    appendRow('Tasks', [
        b.taskId, b.volunteerName, b.taskName, b.description,
        b.tierLevel, b.cycleNumber, b.templateLink, b.doneWhen,
        b.deadline, b.contactPerson, 'Not Started', '', '',
        b.createdDate, '', '', b.hours||0, b.track||'',
    ]);
    // Notify volunteer
    sendNotification({
        notifId: 'n_'+b.taskId, volunteerName: b.volunteerName,
        type: 'task-assigned',
        content: `New task assigned: "${b.taskName}". Due ${b.deadline}. Done when: ${b.doneWhen}`,
        refId: b.taskId,
    });
    return 'Task created';
}

function updateTask(b) {
    const found = findRow('Tasks', 0, b.taskId);
    if (!found) throw new Error('Task not found: '+b.taskId);
    const [rowIdx] = found;
    if (b.status)       updateCell('Tasks', rowIdx, 10, b.status);
    if (b.directorNote) updateCell('Tasks', rowIdx, 12, b.directorNote);
    if (b.reviewedDate) updateCell('Tasks', rowIdx, 15, b.reviewedDate);
    // Notify volunteer of review result
    if (b.status==='Approved'||b.status==='Revision Needed') {
        sendNotification({
            notifId: 'n_rev_'+b.taskId, volunteerName: b.volunteerName,
            type: b.status==='Approved' ? 'task-approved' : 'revision-needed',
            content: b.status==='Approved'
                ? `Your task has been approved!${b.directorNote?' Director note: '+b.directorNote:''}`
                : `Revision requested: ${b.directorNote||'See your task for details.'}`,
            refId: b.taskId,
        });
    }
    return 'Task updated';
}

function submitTask(b) {
    const found = findRow('Tasks', 0, b.taskId);
    if (!found) throw new Error('Task not found');
    const [rowIdx] = found;
    updateCell('Tasks', rowIdx, 10, 'Submitted');
    updateCell('Tasks', rowIdx, 11, b.submissionLink);
    updateCell('Tasks', rowIdx, 14, b.submittedDate);
    return 'Task submitted';
}

function confirmTask(b) {
    const found = findRow('Tasks', 0, b.taskId);
    if (!found) return 'Task not found (no-op)';
    const [rowIdx] = found;
    updateCell('Tasks', rowIdx, 10, 'In Progress');
    updateCell('Tasks', rowIdx, 15, b.confirmedDate);
    return 'Task confirmed';
}

/* ── SESSIONS ───────────────────────────────────────────────── */
function createSession(b) {
    appendRow('Sessions', [
        b.sessionId, b.sessionName, b.partnerOrg, b.date, b.time,
        b.location, b.kit, b.facilitatorSpots, b.observerSpots,
        b.lead, 'Upcoming', '', b.hours||0, b.notes||'',
    ]);
    // Notify session lead if assigned
    if (b.lead) {
        sendNotification({
            notifId: 'n_sl_'+b.sessionId, volunteerName: b.lead,
            type: 'session-signup',
            content: `You are the Lead for "${b.sessionName}" on ${b.date} at ${b.location||'TBD'}. Kit: ${b.kit||'TBD'}.`,
            refId: b.sessionId,
        });
    }
    return 'Session created';
}

function signUpSession(b) {
    const found = findRow('Sessions', 0, b.sessionId);
    if (!found) throw new Error('Session not found');
    const [rowIdx, row] = found;
    const current = (row[11]||'').split(',').map(s=>s.trim()).filter(Boolean);
    if (!current.includes(b.volunteerName)) current.push(b.volunteerName);
    updateCell('Sessions', rowIdx, 11, current.join(', '));
    sendNotification({
        notifId: 'n_su_'+b.sessionId+'_'+Date.now(), volunteerName: b.volunteerName,
        type: 'session-signup',
        content: `You're signed up for "${row[1]}" on ${row[3]} as ${b.type||'Volunteer'}.`,
        refId: b.sessionId,
    });
    return 'Signed up';
}

function updateSessionStatus(b) {
    const found = findRow('Sessions', 0, b.sessionId);
    if (!found) throw new Error('Session not found');
    const [rowIdx] = found;
    updateCell('Sessions', rowIdx, 10, b.status);
    if (b.attendees) updateCell('Sessions', rowIdx, 11, b.attendees);
    return 'Session updated';
}

function submitDebrief(b) {
    appendRow('SessionDebriefs', [
        b.sessionId, b.leadName, b.whatWorked, b.whatConfused,
        b.whatBroke, b.fixCurriculum, b.fixOperations, b.submittedDate,
    ]);
    return 'Debrief submitted';
}

/* ── WINS BOARD ─────────────────────────────────────────────── */
function postWin(b) {
    appendRow('WinsBoard', [
        b.postId, b.volunteerNames, b.recognitionText,
        b.type, b.postedBy, b.track, b.postedDate,
    ]);
    // Notify each named volunteer
    (b.volunteerNames||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(name=>{
        sendNotification({
            notifId: 'n_win_'+b.postId+'_'+name.replace(/\s/g,''), volunteerName: name,
            type: 'recognition',
            content: b.recognitionText,
            refId: b.postId,
        });
    });
    return 'Win posted';
}

/* ── NOTIFICATIONS ──────────────────────────────────────────── */
function sendNotification(b) {
    appendRow('Notifications', [
        b.notifId||('n_'+Date.now()), b.volunteerName, b.type,
        b.content, 'FALSE', b.createdDate||new Date().toISOString(), b.refId||'',
    ]);
    return 'Notification sent';
}

function markNotifRead(b) {
    const found = findRow('Notifications', 0, b.notifId);
    if (!found) return 'Not found';
    updateCell('Notifications', found[0], 4, 'TRUE');
    return 'Marked read';
}

function markAllRead(b) {
    const sh = getSheet('Notifications');
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if ((data[i][1]||'').trim().toLowerCase() === (b.volunteerName||'').trim().toLowerCase()) {
            sh.getRange(i+1, 5).setValue('TRUE');
        }
    }
    return 'All marked read';
}

/* ── NOMINATIONS ────────────────────────────────────────────── */
function createNomination(b) {
    appendRow('Nominations', [
        b.nomId, b.volunteerName, b.director, b.note,
        'Pending', b.nominatedDate, b.currentTier, b.targetTier,
    ]);
    return 'Nomination created';
}

function updateNomination(b) {
    const found = findRow('Nominations', 0, b.nomId);
    if (!found) throw new Error('Nomination not found');
    const [rowIdx] = found;
    updateCell('Nominations', rowIdx, 4, b.status);
    if (b.updatedDate) updateCell('Nominations', rowIdx, 5, b.updatedDate);
    return 'Nomination updated';
}

function confirmPromotion(b) {
    // Update nomination status
    const nomFound = findRow('Nominations', 0, b.nomId);
    if (nomFound) {
        updateCell('Nominations', nomFound[0], 4, 'Confirmed');
        updateCell('Nominations', nomFound[0], 5, b.confirmedDate);
    }
    // Update volunteer tier in Volunteers sheet
    const volFound = findRow('Volunteers', 0, b.volunteerName);
    if (volFound) {
        updateCell('Volunteers', volFound[0], 6, b.newTier);
        updateCell('Volunteers', volFound[0], 11, b.confirmedDate);
    }
    // Post win
    postWin({
        postId: 'win_prom_'+b.nomId, volunteerNames: b.volunteerName,
        recognitionText: `${b.volunteerName} has been promoted to ${CONFIG_TIERS[b.newTier]||'Tier '+b.newTier}! Congratulations — well deserved. — ${b.presidentName}`,
        type: 'rankup', postedBy: b.presidentName, track: '', postedDate: b.confirmedDate,
    });
    // Personal notification
    sendNotification({
        notifId: 'n_prom_'+b.nomId, volunteerName: b.volunteerName,
        type: 'promotion',
        content: `🎉 You've been promoted to ${CONFIG_TIERS[b.newTier]||'Tier '+b.newTier}! Congratulations from ${b.presidentName}.`,
        refId: b.nomId,
    });
    return 'Promotion confirmed';
}

// Tier names for notification text (mirrors JS config)
const CONFIG_TIERS = {1:'Explorer',2:'Builder',3:'Lead',4:'Architect',Exec:'Executive'};

/* ── CONTENT CALENDAR ───────────────────────────────────────── */
function addContentEntry(b) {
    appendRow('ContentCalendar', [
        b.entryId, b.month, b.description, b.platform,
        b.assignedVol, b.status||'Not Started', b.dueDate,
        b.approved||'FALSE', b.createdDate,
    ]);
    // Assign as a task if volunteer is set
    if (b.assignedVol && b.dueDate) {
        createTask({
            taskId: 'ct_'+b.entryId, volunteerName: b.assignedVol,
            taskName: `${b.platform} Post — ${b.month}`,
            description: b.description, tierLevel: '2',
            cycleNumber: '', templateLink: '', doneWhen: 'Post is exported and ready for director approval',
            deadline: b.dueDate, contactPerson: 'DOP',
            hours: 1, track: 'Publicity', createdDate: b.createdDate,
        });
    }
    return 'Content entry added';
}

/* ── CYCLES ─────────────────────────────────────────────────── */
function createCycle(b) {
    // Mark any existing active cycle as completed
    const sh = getSheet('Cycles');
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][3] === 'Active') sh.getRange(i+1, 4).setValue('Completed');
    }
    appendRow('Cycles', [b.cycleNumber, b.startDate, b.endDate, 'Active', b.notes||'']);
    return 'Cycle created';
}

/* ── FORM SUBMIT TRIGGER ────────────────────────────────────── */
// Set up via: Triggers (clock icon) → + Add Trigger
//   Function: onFormSubmit | From spreadsheet | On form submit
function onFormSubmit(e) {
    const nv = e.namedValues || {};
    function pick(/* ...keys */) {
        for (let i = 0; i < arguments.length; i++) {
            const v = (nv[arguments[i]] || [''])[0].trim();
            if (v) return v;
        }
        return '';
    }

    const email   = pick('Email Address','Email','email').toLowerCase();
    if (!email) return; // form doesn't collect email — nothing to do

    const name    = pick('Full Name','Name','Your Name','What is your name?');
    const school  = pick('School','University','What school do you attend?','School/University');
    const discord = pick('Discord','Discord Username','Discord Handle');

    const sh   = getSheet('Volunteers');
    const data = sh.getDataRange().getValues();

    // Skip if already registered (match by email in col E = index 4)
    for (let i = 1; i < data.length; i++) {
        if ((data[i][4] || '').toString().trim().toLowerCase() === email) return;
    }

    // Add new volunteer row with default tier 1 (Explorer)
    sh.appendRow([
        name,      // A: Name
        discord,   // B: Discord
        school,    // C: School
        '',        // D: Avatar
        email,     // E: Email  ← matched by portal sign-in
        '',        // F: Track  (director assigns)
        '1',       // G: Tier
        'FALSE',   // H: Lead
        '0',       // I: CyclesCompleted
        '',        // J: TeamBadges
        '',        // K: OnTimeRate
        '',        // L: LastContact
    ]);
}
