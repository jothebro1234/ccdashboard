/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
const S = {
    user:   null,   // { name, email, track, tier, discord, school, avatar, lead, onTimeRate, lastContact }
    role:   null,   // 'volunteer' | 'doc' | 'doo' | 'dop' | 'president' | 'chapter_rep' | etc.
    view:   null,
    subTab: null,
    data:   {},     // { curriculum, events, allVolunteers, volunteers, lbData, lbReady, myStats, myRegistrations, myEventRegistrations, upcomingEvents, directors, chapters }
    lbCat:  'hours',
    lbPrevRanks: {},
    dirRole: null,  // the director role when in volunteer view
    volUser: null,  // volunteer record if a director is also a volunteer
    _dirUser: null, // saved director user when switching views
    chapData: null, // { name, school } fr chapter_rep
};

let _othersExpanded = false;

/* ── Role helpers ─────────────────────────────────────────── */
const EXEC_ROLES=['president','cef','vp','sec','tres','cpo'];
function isExecRole(r){return EXEC_ROLES.includes(r);}
function canPostAssignment(r){return['doc','chapter_rep',...EXEC_ROLES].includes(r);}
function canPostEvent(r){return['doo','chapter_rep',...EXEC_ROLES].includes(r);}
function canGiveHoursAssign(r){return['doc','chapter_rep',...EXEC_ROLES].includes(r);}
function canGiveHoursEvent(r){return['doo','chapter_rep',...EXEC_ROLES].includes(r);}
function canManageTiersRole(r){return['hr',...EXEC_ROLES].includes(r);}
function canRecordAdHoc(r){return['doo','chapter_rep',...EXEC_ROLES].includes(r);}
function roleLabel(r){const m={doc:'DOC',doo:'DOO',dop:'DOP',president:'Pres',cef:'CEF',vp:'VP',sec:'Sec',tres:'Tres',cpo:'CPO',hr:'HR',mr:'MR',chapter_rep:'ChapRep',trial:'Trial'};return m[r]||String(r||'').toUpperCase();}
function getDirTrack(r){if(isExecRole(r)||['hr','mr','trial'].includes(r))return'All';return(CONFIG.DIRECTORS[r]||{}).track||'All';}
function isUpcomingEv(r){return!!(r&&r[6]);}
function getDirRoleForName(name){const n=(name||'').toLowerCase();const d=(S.data.directors||[]).find(r=>(r[1]||'').trim().toLowerCase()===n);if(d)return(d[2]||'').trim().toLowerCase();if((S.data.chapters||[]).some(r=>(r[1]||'').trim().toLowerCase()===n))return'chapter_rep';return null;}

/* ═══════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════ */
function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmt(n) { return typeof n==='number'&&!isNaN(n)?n.toLocaleString():String(n||''); }
function round1(n) { return Math.round((n||0)*10)/10; }
function fmtDate(s) {
    if(!s)return'—';
    const d=new Date(s);
    return isNaN(d)?s:d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function fmtRelative(s) {
    if(!s)return'';
    const d=new Date(s),diff=Date.now()-d.getTime();
    if(isNaN(d))return s;
    const mins=Math.floor(diff/60000),hrs=Math.floor(diff/3600000),days=Math.floor(diff/86400000);
    if(mins<1)return'just now';
    if(mins<60)return`${mins}m ago`;
    if(hrs<24)return`${hrs}h ago`;
    if(days<30)return`${days}d ago`;
    return fmtDate(s);
}
function isChecked(v) { const u=(v||'').trim().toUpperCase();return u==='TRUE'||u==='YES'||u==='1'||u==='X'||u==='✓'||u==='✔'; }
function deriveTrack(colF,colJ) {
    const f=(colF||'').trim();if(f)return f;
    const s=(colJ||'').toLowerCase();
    if(s.includes('curriculum'))return'Curriculum';
    if(s.includes('operation')||s.includes('in-person')||s.includes('session'))return'Operations';
    if(s.includes('media')||s.includes('design')||s.includes('content')||s.includes('publicity'))return'Media/Design';
    return'';
}
function combinedTrackLabel(u) {
    const t=u.track||'';
    const a=u.additionalTrack||'';
    if(a&&a!==t)return`${t} + ${a}`;
    return t;
}
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

/* ─── Card appearance helpers (color / deco / label) ─────────── */
function getCardAccent(color){
    const m={
        '':     {hex:'#3A72BE',glow:'rgba(58,114,190,0.22)',bg:'rgba(58,114,190,0.07)'},
        blue:   {hex:'#3A72BE',glow:'rgba(58,114,190,0.22)',bg:'rgba(58,114,190,0.07)'},
        purple: {hex:'#8059D8',glow:'rgba(128,89,216,0.22)',bg:'rgba(128,89,216,0.07)'},
        teal:   {hex:'#0EA89A',glow:'rgba(14,168,154,0.22)',bg:'rgba(14,168,154,0.07)'},
        green:  {hex:'#18B888',glow:'rgba(24,184,136,0.22)',bg:'rgba(24,184,136,0.07)'},
        gold:   {hex:'#D4960E',glow:'rgba(212,150,14,0.22)',bg:'rgba(212,150,14,0.07)'},
        red:    {hex:'#E05858',glow:'rgba(224,88,88,0.22)',bg:'rgba(224,88,88,0.07)'},
        orange: {hex:'#D87830',glow:'rgba(216,120,48,0.22)',bg:'rgba(216,120,48,0.07)'},
        pink:   {hex:'#D87898',glow:'rgba(216,120,152,0.22)',bg:'rgba(216,120,152,0.07)'},
    };
    return m[color]||m[''];
}
function cardAppearance(r){
    const color=(r[9]||'').trim();
    const deco=(r[10]||'').trim();
    const label=(r[11]||'').trim();
    const isExclusive=deco==='exclusive';
    const ca=getCardAccent(color);
    const hasCustom=!!(color||deco||label);
    // exclusive has its own full background; skip curr-has-color so they don't conflict
    const cls=[(hasCustom&&!isExclusive?'curr-has-color':''),deco?`curr-deco-${deco}`:''].filter(Boolean).join(' ');
    const style=hasCustom&&!isExclusive?`--card-color:${ca.hex};--card-glow:${ca.glow};--card-bg:${ca.bg}`:'';
    const badgeCls=`card-label-badge${isExclusive?' exclusive-badge':''}`;
    const badgeStyle=!isExclusive?`background:${ca.hex}`:'';
    const badge=label?`<span class="${badgeCls}"${badgeStyle?` style="${badgeStyle}"`:''}>${esc(label)}</span>`:'';
    return {cls:cls.trim(),style,badge,hex:ca.hex,hasCustom,isExclusive};
}
function evCardAppearance(r){
    // Events: r[11]=CardColor, r[12]=CardDeco, r[13]=CardLabel
    // cardAppearance reads r[9], r[10], r[11] — remap via proxy array
    const proxy=Array(9).fill('').concat([r[11]||'',r[12]||'',r[13]||'']);
    return cardAppearance(proxy);
}
function colorDecoPickerHTML(colorId,decoId,colorRowId,decoRowId,selColor,selDeco){
    const colors=[
        {val:'',hex:'#3A72BE',name:'Blue'},
        {val:'purple',hex:'#8059D8',name:'Purple'},
        {val:'teal',hex:'#0EA89A',name:'Teal'},
        {val:'green',hex:'#18B888',name:'Green'},
        {val:'gold',hex:'#D4960E',name:'Gold'},
        {val:'red',hex:'#E05858',name:'Red'},
        {val:'orange',hex:'#D87830',name:'Orange'},
        {val:'pink',hex:'#D87898',name:'Pink'},
    ];
    const decos=[
        {val:'',label:'None'},
        {val:'glow',label:'✨ Glow'},
        {val:'shimmer',label:'💫 Shimmer'},
        {val:'gradient',label:'🌈 Gradient'},
        {val:'sparkle',label:'⭐ Sparkle'},
        {val:'exclusive',label:'👑 Exclusive'},
    ];
    const swatches=colors.map(c=>`<button type="button" class="color-swatch${c.val===selColor?' swatch-selected':''}" data-color="${c.val}" style="background:${c.hex}" title="${c.name}"></button>`).join('');
    const decoBtns=decos.map(d=>`<button type="button" class="deco-pick-btn${d.val===selDeco?' deco-selected':''}" data-deco="${d.val}">${d.label}</button>`).join('');
    return `
        <div class="form-group">
            <label class="form-label">Card Color</label>
            <div class="color-swatch-row" id="${colorRowId}">${swatches}</div>
            <input type="hidden" id="${colorId}" value="${esc(selColor)}">
        </div>
        <div class="form-group">
            <label class="form-label">Card Decoration</label>
            <div class="deco-pick-row" id="${decoRowId}">${decoBtns}</div>
            <input type="hidden" id="${decoId}" value="${esc(selDeco)}">
        </div>`;
}
function initColorDecoPickerEvents(colorId,decoId,colorRowId,decoRowId){
    document.querySelectorAll(`#${colorRowId} .color-swatch`).forEach(btn=>{
        btn.onclick=()=>{
            document.querySelectorAll(`#${colorRowId} .color-swatch`).forEach(b=>b.classList.remove('swatch-selected'));
            btn.classList.add('swatch-selected');
            document.getElementById(colorId).value=btn.dataset.color;
        };
    });
    document.querySelectorAll(`#${decoRowId} .deco-pick-btn`).forEach(btn=>{
        btn.onclick=()=>{
            document.querySelectorAll(`#${decoRowId} .deco-pick-btn`).forEach(b=>b.classList.remove('deco-selected'));
            btn.classList.add('deco-selected');
            document.getElementById(decoId).value=btn.dataset.deco;
        };
    });
}
function labelPresetsHTML(inputId){
    const presets=['Kit Assembly','Teaching Session','Leadership Meeting','Community Event','Orientation','Special Guest'];
    const btns=presets.map(p=>`<button type="button" class="label-preset-btn" data-target="${inputId}" data-val="${esc(p)}">${esc(p)}</button>`).join('');
    return `<div class="label-preset-row">${btns}</div>`;
}
function initLabelPresets(inputId){
    document.querySelectorAll(`.label-preset-btn[data-target="${inputId}"]`).forEach(btn=>{
        btn.onclick=()=>{const el=document.getElementById(btn.dataset.target);if(el)el.value=btn.dataset.val;};
    });
}
function showYMCAUploadModal(){
    const existing=S.user?.ymcaFormURL||'';
    const formUrl=(CONFIG.YMCA_FORM_URL||'').trim();
    const downloadStep=formUrl
        ?`<div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:8px;background:var(--surface-2);border:1.5px solid var(--border)">
            <div style="font-size:22px;flex-shrink:0;margin-top:1px">1️⃣</div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:8px">Download &amp; fill out the YMCA form</div>
                <ul style="margin:0;padding-left:16px;font-size:12.5px;color:var(--textm);line-height:2;list-style:disc">
                    <li>Fill in <strong style="font-size:13.5px;color:#e53e3e">every field boxed in <span style="color:#e53e3e;text-decoration:underline">RED</span></strong></li>
                    <li>Sign the form <span style="color:var(--textm)">(digital signature or hand-sign &amp; scan)</span></li>
                    <li>Save the file as <strong style="color:var(--text);font-family:monospace">firstname_lastname.pdf</strong> <span style="color:var(--textm)">(e.g. <code style="font-size:11px">jane_smith.pdf</code>)</span></li>
                </ul>
            </div>
            <a href="${esc(formUrl)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="flex-shrink:0;margin-top:2px">📄 Open Form</a>
        </div>`
        :`<div style="padding:14px 16px;border-radius:8px;background:var(--surface-2);border:1.5px solid var(--border)">
            <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:8px">1️⃣ &nbsp;Fill out the YMCA form</div>
            <ul style="margin:0;padding-left:16px;font-size:12.5px;color:var(--textm);line-height:2;list-style:disc">
                <li>Get the blank form from your director</li>
                <li>Fill in <strong style="font-size:13.5px;color:#e53e3e">every field boxed in <span style="text-decoration:underline">RED</span></strong></li>
                <li>Sign it, then save as <strong style="color:var(--text);font-family:monospace">firstname_lastname.pdf</strong></li>
            </ul>
        </div>`;
    const html=`
        <div class="modal-header">
            <div class="modal-title">🏕️ YMCA Volunteer Form</div>
            <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
            ${existing?`<div style="margin-bottom:14px;padding:10px 14px;border-radius:8px;background:var(--green-g);border:1.5px solid rgba(52,211,153,.25);font-size:12px;font-weight:700;color:var(--green)">✅ Form already on file — uploading a new one will replace it.</div>`:''}
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
                ${downloadStep}
                <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:8px;background:var(--surface-2);border:1.5px solid var(--border)">
                    <div style="font-size:20px;flex-shrink:0">2️⃣</div>
                    <div style="font-size:13px;font-weight:700;color:var(--text)">Sign it <span style="font-weight:400;color:var(--textm);font-size:12px">(digital signature or sign by hand &amp; scan/photo)</span></div>
                </div>
                <div style="padding:12px 14px;border-radius:8px;background:var(--surface-2);border:1.5px solid var(--border)">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                        <div style="font-size:20px;flex-shrink:0">3️⃣</div>
                        <div style="font-weight:700;font-size:13px;color:var(--text)">Upload your signed form</div>
                    </div>
                    <input type="file" id="ymca-file-input" accept=".pdf,.jpg,.jpeg,.png" class="form-input" style="padding:8px">
                    <div class="form-hint" style="margin-top:6px">Accepted: PDF, JPG, PNG · Max 5 MB · Name your file <strong style="font-family:monospace;color:var(--text)">firstname_lastname.pdf</strong></div>
                </div>
            </div>
            <div class="form-err" id="ymca-err"></div>
            <button class="btn btn-primary" style="width:100%;margin-top:4px" id="ymca-upload-btn">📤 Submit Form</button>
        </div>`;
    const close=openModal(html);
    document.getElementById('ymca-upload-btn').addEventListener('click',async()=>{
        const file=document.getElementById('ymca-file-input').files[0];
        const errEl=document.getElementById('ymca-err');
        if(!file){errEl.textContent='Please select a file.';return;}
        if(file.size>5*1024*1024){errEl.textContent='File too large. Max 5 MB.';return;}
        errEl.textContent='';
        const btn=document.getElementById('ymca-upload-btn');
        btn.disabled=true;btn.textContent='Uploading…';
        try{await doUploadYMCAForm(file,close);}
        catch(e){errEl.textContent=e.message;btn.disabled=false;btn.textContent='📤 Upload Form';}
    });
}
async function doUploadYMCAForm(file,closeFn){
    const fileData=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=e=>res(e.target.result.split(',')[1]);
        r.onerror=()=>rej(new Error('Could not read file'));
        r.readAsDataURL(file);
    });
    const url=await postAction('upload_ymca_form',{volunteerName:S.user.name,fileData,fileName:file.name,mimeType:file.type});
    if(url){S.user.ymcaFormURL=url;if(S.data)S.data.ymcaFormURL=url;saveSession();}
    toast('YMCA form uploaded! You can now register for YMCA events.','success');
    if(closeFn)closeFn();
    if(S.view==='activities')viewActivities();
    else if(S.view==='progress'||S.view==='dashboard')navigate(S.view);
}
/* Returns today as YYYY-MM-DD in the *local* timezone — avoids UTC midnight parse issues */
function localToday() {
    const n=new Date();
    return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
}
/* Normalize any date value to YYYY-MM-DD string for safe string comparison */
function toDateStr(d) {
    if(!d)return'';
    const s=String(d).trim();
    if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
    const p=new Date(s);
    if(isNaN(p))return'';
    return p.getFullYear()+'-'+String(p.getMonth()+1).padStart(2,'0')+'-'+String(p.getDate()).padStart(2,'0');
}
function formatCountdown(startDate) {
    if(!startDate)return'';
    const sd=toDateStr(startDate);
    const st=toTimeStr(startDate);
    if(!sd||sd<localToday())return'Registration locked';
    const closeStr=st?`${sd}T${st}:00`:`${sd}T23:59:59`;
    const diff=new Date(closeStr)-new Date();
    if(diff<=0)return'Closes today';
    const d=Math.floor(diff/86400000);
    const h=Math.floor((diff%86400000)/3600000);
    const m=Math.floor((diff%3600000)/60000);
    const s=Math.floor((diff%60000)/1000);
    if(d>0)return`${d}d ${h}h left`;
    if(h>0)return`${h}h ${m}m left`;
    if(m>0)return`${m}m ${s}s left`;
    return`${s}s left`;
}
/* Lock date is the LAST DAY registration is open; locked from the next day onwards */
function isLocked(startDate) {
    if(!startDate)return false;
    const sd=toDateStr(startDate);
    return sd!==''&&sd<localToday();
}
/* Closed if lock date has passed OR due date has passed */
function isClosed(startDate,dueDate) {
    const today=localToday();
    const sd=toDateStr(startDate);
    const dd=toDateStr(dueDate);
    if(sd&&sd<today)return true;
    if(dd&&dd<today)return true;
    return false;
}
/* Completed = past due date */
function isCompleted(dueDate) {
    if(!dueDate)return false;
    const dd=toDateStr(dueDate);
    return dd!==''&&dd<localToday();
}
function localYesterday() {
    const n=new Date();n.setDate(n.getDate()-1);
    return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
}
/* Extract HH:MM from a datetime string like "2025-06-15T14:00" or "2025-06-15 14:00" */
function toTimeStr(s) {
    if(!s)return'';
    const m=String(s).match(/[T ](\d{2}:\d{2})/);
    return m?m[1]:'';
}
/* Format a stored date/datetime value to human-readable, including time if present */
function fmtDateTimeStr(s) {
    if(!s)return'—';
    const ds=toDateStr(s);
    const ts=toTimeStr(s);
    if(!ds)return String(s)||'—';
    const d=new Date(ds+'T12:00:00');
    const dateFmt=isNaN(d)?ds:d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    if(!ts)return dateFmt;
    const[h,min]=ts.split(':').map(Number);
    const ampm=h>=12?'PM':'AM';
    const hr12=h%12||12;
    return`${dateFmt} at ${hr12}:${String(min).padStart(2,'0')} ${ampm}`;
}
/* Convert stored date/datetime to datetime-local input format */
function toDateTimeLocal(s) {
    if(!s)return'';
    const ds=toDateStr(s);
    if(!ds)return'';
    const ts=toTimeStr(s);
    return ts?`${ds}T${ts}`:`${ds}T00:00`;
}
/* Create and show a modal overlay; returns a close() function */
function openModal(html) {
    const overlay=document.createElement('div');
    overlay.className='modal-overlay';
    overlay.innerHTML=`<div class="modal-box" role="dialog">${html}</div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('modal-in'));
    const close=()=>{
        overlay.classList.remove('modal-in');
        setTimeout(()=>{if(overlay.parentNode)overlay.remove();},220);
    };
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    overlay.querySelectorAll('.modal-close').forEach(b=>b.addEventListener('click',close));
    return close;
}

/* Live countdown timer — ticks every second, updates all .curr-countdown elements */
let _countdownTimer=null;
function startCountdownTimers() {
    if(_countdownTimer)clearInterval(_countdownTimer);
    _countdownTimer=setInterval(()=>{
        document.querySelectorAll('.curr-countdown[data-lockdate]').forEach(el=>{
            el.textContent=formatCountdown(el.dataset.lockdate);
        });
    },1000);
}

/* Real-time polling — re-fetches data and re-renders current view every 30s */
let _pollTimer=null;
function startPolling() {
    if(_pollTimer)clearInterval(_pollTimer);
    _pollTimer=setInterval(async()=>{
        try {
            if(S.role==='volunteer'&&S.user?.name){
                await loadVolunteerData(S.user.name);
                if(S.view==='activities'||S.view==='curriculum'){
                    const tab=document.querySelector('#act-tabs .panel-tab.active')?.dataset.tab||'available';
                    renderActivitiesList(tab);
                    startCountdownTimers();
                } else if(S.view==='dashboard'){
                    viewDashboard();
                }
            } else if(S.role&&S.role!=='volunteer'){
                const track=getDirTrack(S.role);
                await loadDirectorData(track);
                // Also refresh volunteer data for chapter_rep or directors in vol view
                if(S.role==='chapter_rep'&&S.user?.name)await loadVolunteerData(S.user.name).catch(()=>{});
                if(S.view==='director'){
                    const tab=document.querySelector('#dir-tabs .panel-tab.active')?.dataset.tab||'roster';
                    if(tab==='roster')renderDirPanel(tab);
                } else if(S.view==='activities'||S.view==='curriculum'){
                    const tab=document.querySelector('#act-tabs .panel-tab.active')?.dataset.tab||'available';
                    renderActivitiesList(tab);
                    startCountdownTimers();
                } else if(S.view==='dashboard'){
                    viewDashboard();
                }
            }
        } catch(_){}
    },30000);
}

function parseCSV(raw) {
    const rows=[];let i=0;
    while(i<raw.length){
        const row=[];
        while(i<raw.length&&raw[i]==='\r')i++;
        if(i>=raw.length)break;
        while(i<raw.length&&raw[i]!=='\n'){
            let f='';
            if(raw[i]==='"'){i++;while(i<raw.length){if(raw[i]==='"'&&raw[i+1]==='"'){f+='"';i+=2;}else if(raw[i]==='"'){i++;break;}else f+=raw[i++];}}
            else{while(i<raw.length&&raw[i]!==','&&raw[i]!=='\n'&&raw[i]!=='\r')f+=raw[i++];}
            row.push(f.trim());
            if(raw[i]===',')i++;
        }
        if(i<raw.length)i++;
        if(row.some(f=>f))rows.push(row);
    }
    return rows;
}

/* ═══════════════════════════════════════════════════════════════
   DATA LAYER
   ═══════════════════════════════════════════════════════════════ */
async function fetchSheet(name) {
    const res=await fetch(`/api/sheet?name=${encodeURIComponent(name)}`);
    if(!res.ok)throw new Error(`Sheet "${name}": HTTP ${res.status}`);
    return parseCSV(await res.text());
}

async function postAction(action,payload) {
    const body=JSON.stringify({action,...payload});
    const res=await fetch('/api/write',{method:'POST',body,headers:{'Content-Type':'text/plain'}});
    let data;
    try{data=await res.json();}catch(_){return;} // non-JSON response is fine
    if(data&&data.ok===false)throw new Error(data.error||'Server returned an error');
    return data?.result;
}

async function loadVolunteerData(name) {
    const [currRows,evRows,volRows,chapRows,dirRows]=await Promise.all([
        fetchSheet(CONFIG.CURRICULUM_SHEET_NAME).catch(()=>[]),
        fetchSheet(CONFIG.EVENTS_SHEET_NAME).catch(()=>[]),
        fetchSheet(CONFIG.SHEET_NAME).catch(()=>[]),
        fetchSheet(CONFIG.CHAPTERS_SHEET||'Chapters').catch(()=>[]),
        fetchSheet(CONFIG.DIRECTORS_SHEET||'Directors').catch(()=>[]),
    ]);
    S.data.curriculum=currRows.slice(1).filter(r=>r[0]);
    const allEvRows=evRows.slice(1).filter(r=>r[0]);
    S.data.events=allEvRows;
    S.data.upcomingEvents=allEvRows.filter(isUpcomingEv);
    S.data.chapters=chapRows.slice(1).filter(r=>r[0]);
    S.data.directors=dirRows.slice(1).filter(r=>r[0]);
    S.data.allVolunteers=volRows.slice(1).filter(r=>r[0]).map(r=>({
        name:(r[0]||'').trim(),discord:(r[1]||'').trim(),school:(r[2]||'').trim(),
        additionalTrack:deriveTrack('',r[18]||''),
    }));
    const lower=name.toLowerCase();
    let totalHours=0,curricCount=0,eventsCount=0;
    S.data.events.forEach(r=>{
        const atts=(r[3]||'').split(',').map(n=>n.trim().toLowerCase());
        if(atts.includes(lower)){totalHours+=parseFloat(r[2])||0;eventsCount++;}
    });
    S.data.curriculum.forEach(r=>{
        const contribs=(r[3]||'').split(',').map(n=>n.trim().toLowerCase());
        if(contribs.includes(lower)){totalHours+=parseFloat(r[2])||0;curricCount++;}
    });
    S.data.myStats={totalHours:round1(totalHours),curricCount,eventsCount};

    // Build org-wide hours map for ranking
    const allHoursMap={};
    volRows.slice(1).forEach(r=>{const n=(r[0]||'').trim();if(n)allHoursMap[n.toLowerCase()]={name:n,school:(r[2]||'').trim(),hours:0};});
    allEvRows.forEach(r=>{const hrs=parseFloat(r[2])||0;(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(n=>{const k=n.toLowerCase();if(allHoursMap[k])allHoursMap[k].hours+=hrs;});});
    S.data.curriculum.forEach(r=>{const hrs=parseFloat(r[2])||0;(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(n=>{const k=n.toLowerCase();if(allHoursMap[k])allHoursMap[k].hours+=hrs;});});
    const sortedByHours=Object.values(allHoursMap).sort((a,b)=>b.hours-a.hours);
    const mySchool=(volRows.slice(1).find(r=>(r[0]||'').trim().toLowerCase()===lower)||[])[2]||'';
    const orgIdx=sortedByHours.findIndex(v=>v.name.toLowerCase()===lower);
    const chapVols=sortedByHours.filter(v=>v.school&&v.school===mySchool);
    const chapIdx=chapVols.findIndex(v=>v.name.toLowerCase()===lower);
    S.data.orgRank=orgIdx>=0?orgIdx+1:null;
    S.data.orgTotal=sortedByHours.length;
    S.data.chapRank=(mySchool&&chapIdx>=0)?chapIdx+1:null;
    S.data.chapTotal=chapVols.length;

    // Load hours goal and YMCA form URL — find YMCAFormURL column by header name
    const volHeaders=(volRows[0]||[]).map(h=>(h||'').trim());
    const ymcaColIdx=volHeaders.indexOf('YMCAFormURL');
    const myVolRow=volRows.slice(1).find(r=>(r[0]||'').trim().toLowerCase()===lower);
    S.data.hoursGoal=myVolRow?(parseFloat(myVolRow[13])||null):null;
    const ymcaUrl=myVolRow&&ymcaColIdx>=0?(myVolRow[ymcaColIdx]||'').trim():'';
    // Prefer sheet value when present; keep existing in-memory value if sheet returns empty
    // (gviz CSV caches for ~2 min, so a fresh upload may not appear immediately)
    const resolvedYmca=ymcaUrl||(S.data.ymcaFormURL||S.user?.ymcaFormURL||'');
    S.data.ymcaFormURL=resolvedYmca;
    if(S.user)S.user.ymcaFormURL=resolvedYmca; // always sync, even if empty

    S.data.myRegistrations=S.data.curriculum.filter(r=>{
        const reg=(r[7]||'').split(',').map(n=>n.trim().toLowerCase());
        const cred=(r[3]||'').split(',').map(n=>n.trim().toLowerCase());
        return reg.includes(lower)&&!cred.includes(lower);
    });
    // upcoming event registrations (registered but not yet credited)
    S.data.myEventRegistrations=S.data.upcomingEvents.filter(r=>{
        const reg=(r[7]||'').split(',').map(n=>n.trim().toLowerCase());
        const cred=(r[3]||'').split(',').map(n=>n.trim().toLowerCase());
        return reg.includes(lower)&&!cred.includes(lower);
    });
}

async function loadDirectorData(track) {
    const [volRows,currRows,evRows,chapRows,dirRows]=await Promise.all([
        fetchSheet(CONFIG.SHEET_NAME),
        fetchSheet(CONFIG.CURRICULUM_SHEET_NAME).catch(()=>[]),
        fetchSheet(CONFIG.EVENTS_SHEET_NAME).catch(()=>[]),
        fetchSheet(CONFIG.CHAPTERS_SHEET||'Chapters').catch(()=>[]),
        fetchSheet(CONFIG.DIRECTORS_SHEET||'Directors').catch(()=>[]),
    ]);
    const currData=currRows.slice(1).filter(r=>r[0]);
    const evData=evRows.slice(1).filter(r=>r[0]);
    S.data.chapters=chapRows.slice(1).filter(r=>r[0]);
    S.data.directors=dirRows.slice(1).filter(r=>r[0]);
    const all=volRows.slice(1).map(r=>({
        name:(r[0]||'').trim(),discord:(r[1]||'').trim(),school:(r[2]||'').trim(),
        avatar:(r[3]||'').trim(),email:(r[4]||'').trim(),track:deriveTrack(r[5],r[9]),
        tier:(r[6]||'').trim()||'1',lead:(r[7]||'').trim(),
        onTimeRate:parseFloat(r[10])||null,lastContact:(r[11]||'').trim(),
        hours:0,curricCount:0,eventsCount:0,
        additionalTrack:deriveTrack('',r[18]||''),
    })).filter(v=>v.name);
    const vm={};
    all.forEach(v=>{vm[v.name.toLowerCase()]=v;});
    currData.forEach(r=>{
        const hrs=parseFloat(r[2])||0;
        (r[3]||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(n=>{
            const k=n.toLowerCase();if(vm[k]){vm[k].hours+=hrs;vm[k].curricCount+=1;}
        });
    });
    evData.forEach(r=>{
        const hrs=parseFloat(r[2])||0;
        (r[3]||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(n=>{
            const k=n.toLowerCase();if(vm[k]){vm[k].hours+=hrs;vm[k].eventsCount+=1;}
        });
    });
    S.data.allVolunteers=all;
    S.data.volunteers=track==='All'?all:all.filter(v=>v.track===track);
    S.data.curriculum=currData;
    S.data.events=evData;
    S.data.upcomingEvents=evData.filter(isUpcomingEv);
}

async function loadLbData() {
    if(S.data.lbReady)return;
    const [volRows,evRows,currRows,exRows]=await Promise.all([
        fetchSheet(CONFIG.SHEET_NAME),
        fetchSheet(CONFIG.EVENTS_SHEET_NAME),
        fetchSheet(CONFIG.CURRICULUM_SHEET_NAME),
        fetchSheet(CONFIG.EXCEPTIONS_SHEET_NAME).catch(()=>[]),
    ]);
    const exceptions=new Set(exRows.slice(1).map(r=>(r[0]||'').trim().toLowerCase()).filter(Boolean));
    const vm={};
    const mkV=name=>({name,discord:'',school:'',avatar:'',hours:0,events:0,curriculum:0,assemblyHours:0,sessionHours:0,curriculumHours:0,eventList:[],curriculumList:[]});
    volRows.slice(1).forEach(r=>{
        const name=(r[0]||'').trim();if(!name)return;
        const key=name.toLowerCase();
        vm[key]={...mkV(name),discord:(r[1]||'').trim(),school:(r[2]||'').trim(),avatar:(r[3]||'').trim()};
    });
    evRows.slice(1).forEach(r=>{
        const evName=(r[0]||'').trim(),date=(r[1]||'').trim(),hrs=parseFloat(r[2])||0;
        const isAsm=isChecked(r[4]);
        (r[3]||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(att=>{
            const k=att.toLowerCase();if(!vm[k])vm[k]=mkV(att);
            vm[k].hours+=hrs;vm[k].events+=1;
            if(isAsm)vm[k].assemblyHours+=hrs;else vm[k].sessionHours+=hrs;
            vm[k].eventList.push({name:evName,date,hours:hrs,assembly:isAsm});
        });
    });
    currRows.slice(1).forEach(r=>{
        const cName=(r[0]||'').trim(),date=(r[1]||'').trim(),hrs=parseFloat(r[2])||0;
        (r[3]||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(c=>{
            const k=c.toLowerCase();if(!vm[k])vm[k]=mkV(c);
            vm[k].curriculum+=1;vm[k].hours+=hrs;vm[k].curriculumHours+=hrs;
            vm[k].curriculumList.push({name:cName,date,hours:hrs});
        });
    });
    S.data.lbData=Object.values(vm).filter(v=>!exceptions.has(v.name.toLowerCase()));
    S.data.lbReady=true;
}

/* ═══════════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY='cc_portal_session';

function saveSession() {
    try {
        localStorage.setItem(SESSION_KEY,JSON.stringify({
            role:S.role,dirRole:S.dirRole,user:S.user,
            volUser:S.volUser||null,chapData:S.chapData||null,
        }));
    } catch(_) {}
}

async function restoreSession(sess) {
    S.role=sess.role;
    S.dirRole=sess.dirRole||null;
    S.user=sess.user;
    S.volUser=sess.volUser||null;
    S.chapData=sess.chapData||null;
    S._dirUser=sess.dirRole?sess.user:null;
    if(S.role==='volunteer'){
        await loadVolunteerData(S.user.name);
        launchPortal();
    } else {
        // Re-verify the director/rep is still listed in the sheet before restoring the session.
        // If removed from the sheet, downgrade to volunteer (if applicable) or show not-registered.
        const email=(S.user?.email||'').trim().toLowerCase();
        if(email){
            try{
                const [dirRows,chapRows]=await Promise.all([
                    fetchSheet(CONFIG.DIRECTORS_SHEET||'Directors').catch(()=>[]),
                    fetchSheet(CONFIG.CHAPTERS_SHEET||'Chapters').catch(()=>[]),
                ]);
                const stillDir=dirRows.slice(1).some(r=>(r[0]||'').trim().toLowerCase()===email);
                const stillChap=chapRows.slice(1).some(r=>(r[0]||'').trim().toLowerCase()===email);
                if(!stillDir&&!stillChap){
                    try{localStorage.removeItem(SESSION_KEY);}catch(_){}
                    if(S.volUser){
                        S.user=S.volUser;S.role='volunteer';S.dirRole=null;S.volUser=null;
                        await loadVolunteerData(S.user.name);
                        launchPortal();
                    } else {
                        hideLoading();
                        showNotRegistered(email,'');
                    }
                    return;
                }
            }catch(_){
                // Network error — fail open so users aren't locked out during outages
            }
        }
        await launchDirectorPortal(S.role);
    }
}

function logout() {
    try{localStorage.removeItem(SESSION_KEY);}catch(_){}
    if(_pollTimer){clearInterval(_pollTimer);_pollTimer=null;}
    // Reset state
    S.role=null;S.dirRole=null;S.user=null;S.volUser=null;
    S._dirUser=null;S.chapData=null;S.view=null;S.subTab=null;
    S.data={};S.lbCat='hours';S.lbPrevRanks={};
    document.getElementById('portal-shell').style.display='none';
    document.getElementById('auth-gate').style.display='';
    showLanding();
}

async function initAuth() {
    const saved=localStorage.getItem(SESSION_KEY);
    if(saved){
        try{
            const sess=JSON.parse(saved);
            if(sess&&sess.role&&sess.user){
                showLoading();
                await restoreSession(sess);
                return;
            }
        }catch(_){
            localStorage.removeItem(SESSION_KEY);
        }
    }
    showLanding();
}

function initGoogleSignIn() {
    if(typeof google==='undefined'){setTimeout(initGoogleSignIn,200);return;}
    google.accounts.id.initialize({
        client_id:CONFIG.GOOGLE_CLIENT_ID,
        callback:handleGoogleSignIn,
    });
    const wrap=document.getElementById('g-btn-wrap');
    if(wrap){
        google.accounts.id.renderButton(wrap,{
            theme:'filled_blue',size:'large',width:300,
            text:'signin_with',shape:'pill',
        });
    }
    // prompt() triggers One Tap (FedCM) which fails in some browser configs;
    // the rendered button above works independently and is sufficient.
}

async function handleGoogleSignIn(credentialResponse) {
    showLoading();
    try {
        const parts=(credentialResponse.credential||'').split('.');
        if(parts.length<2)throw new Error('Invalid credential from Google.');
        const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
        const email=(payload.email||'').trim().toLowerCase();
        if(!email)throw new Error('No email returned from Google sign-in.');

        // Fetch all three sheets in parallel
        const [volRows,dirRows,chapRows]=await Promise.all([
            fetchSheet(CONFIG.SHEET_NAME).catch(()=>[]),
            fetchSheet(CONFIG.DIRECTORS_SHEET||'Directors').catch(()=>[]),
            fetchSheet(CONFIG.CHAPTERS_SHEET||'Chapters').catch(()=>[]),
        ]);
        const emailCol=CONFIG.EMAIL_COL??4;
        const volHeaders=(volRows[0]||[]).map(h=>(h||'').trim());
        const ymcaColIdx=volHeaders.indexOf('YMCAFormURL');
        const volRow=volRows.slice(1).find(r=>(r[emailCol]||'').trim().toLowerCase()===email);
        const dirRow=dirRows.slice(1).find(r=>(r[0]||'').trim().toLowerCase()===email);
        const chapRow=chapRows.slice(1).find(r=>(r[0]||'').trim().toLowerCase()===email);

        // Build volunteer user object if they're in the volunteer sheet
        let volUser=null;
        if(volRow){
            volUser={
                name:(volRow[0]||'').trim(),email,
                discord:(volRow[1]||'').trim(),school:(volRow[2]||'').trim(),
                avatar:payload.picture||(volRow[3]||'').trim(),
                track:deriveTrack(volRow[5],volRow[9]),
                additionalTrack:deriveTrack('',volRow[18]||''),
                tier:(volRow[6]||'').trim()||'1',
                lead:(volRow[7]||'').trim(),
                onTimeRate:parseFloat(volRow[10])||null,
                lastContact:(volRow[11]||'').trim(),
                ymcaFormURL:ymcaColIdx>=0?(volRow[ymcaColIdx]||'').trim():'',
            };
        }

        // Priority 1: Directors sheet
        if(dirRow){
            const role=((dirRow[2]||'').trim().toLowerCase())||'doc';
            const dirName=(dirRow[1]||'').trim();
            S.role=role;
            S.dirRole=role;
            S.user={name:dirName,email,role,track:getDirTrack(role),avatar:payload.picture||''};
            S._dirUser=S.user;
            S.volUser=volUser;
            await launchDirectorPortal(role);
            return;
        }

        // Priority 2: Chapters sheet
        if(chapRow){
            const chapName=(chapRow[1]||'').trim();
            const chapSchool=(chapRow[2]||'').trim();
            S.role='chapter_rep';
            S.dirRole='chapter_rep';
            S.chapData={name:chapName,school:chapSchool};
            S.user={name:chapName,email,role:'chapter_rep',track:'All',avatar:payload.picture||''};
            S._dirUser=S.user;
            S.volUser=volUser;
            await launchDirectorPortal('chapter_rep');
            return;
        }

        // Priority 3: Volunteers sheet
        if(!volUser){hideLoading();showNotRegistered(email,payload.picture);return;}
        S.user=volUser;
        S.role='volunteer';
        S.dirRole=null;
        S.volUser=null;
        await loadVolunteerData(S.user.name);
        launchPortal();
    } catch(e){
        hideLoading();showAuthError(e.message);
    }
}

function showLanding() {
    document.getElementById('auth-title').textContent='Volunteer Portal';
    document.getElementById('auth-body').innerHTML=`
        <div class="auth-body">
            <p class="auth-desc">Sign in with the Google account you used to fill out the volunteer form.</p>
            <div id="g-btn-wrap" style="display:flex;justify-content:center;margin:6px 0 2px"></div>
            <div class="auth-err" id="auth-err-msg"></div>
            <p class="auth-desc" style="font-size:12px">
                New volunteer? <a href="${esc(CONFIG.JOIN_URL)}" target="_blank" class="auth-link">Fill out the sign-up form first →</a>
            </p>
        </div>`;
    initGoogleSignIn();
}


function showNotRegistered(email,picture) {
    document.getElementById('auth-title').textContent='Not Registered Yet';
    document.getElementById('auth-body').innerHTML=`
        <div class="auth-body">
            ${picture?`<img src="${esc(picture)}" style="width:52px;height:52px;border-radius:50%;margin:0 auto;display:block">`:''}
            <p class="auth-desc" style="color:var(--text2)">Signed in as <strong>${esc(email)}</strong></p>
            <p class="auth-desc">No volunteer record found. Fill out the sign-up form — once you're added to the roster, sign in here with the same Google account.</p>
            <a href="${esc(CONFIG.JOIN_URL)}" target="_blank" class="auth-btn" style="display:block;text-decoration:none;text-align:center">📋 Fill Out Sign-Up Form</a>
            <button class="auth-btn" onclick="showLanding()" style="background:var(--glass);border:1px solid var(--border-hi)">← Use a Different Account</button>
        </div>`;
}


function showAuthError(msg) {
    document.getElementById('auth-body').innerHTML=`
        <div class="auth-body">
            <p class="auth-desc" style="color:var(--red)">Error: ${esc(msg)}</p>
            <button class="auth-btn" onclick="location.reload()">Retry</button>
        </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   PORTAL LAUNCH
   ═══════════════════════════════════════════════════════════════ */
function _setupPortalExtras(){
    const btn=document.getElementById('sb-first-time');
    if(btn)btn.onclick=()=>startTutorial(true);
    const fab=document.getElementById('insta-fab');
    if(fab)fab.href=(typeof CONFIG!=='undefined'&&CONFIG.INSTAGRAM_URL)||'https://www.instagram.com/ckf.curiocrate/';
    setTimeout(()=>startTutorial(),600);
}

function launchPortal() {
    saveSession();
    document.getElementById('auth-gate').style.display='none';
    document.getElementById('portal-shell').style.display='flex';
    hideLoading();
    renderSidebar();
    renderUserInfo();
    navigate('dashboard');
    setupMobileToggle();
    startPolling();
    _setupPortalExtras();
}

async function launchDirectorPortal(role) {
    showLoading();
    try {
        const track=getDirTrack(role);
        const loads=[loadDirectorData(track)];
        // For chapter_rep or directors who are also volunteers, load personal vol data too
        const volName=S.volUser?.name||(role==='chapter_rep'?S.chapData?.name:null);
        if(volName)loads.push(loadVolunteerData(volName));
        await Promise.all(loads);
        saveSession();
        document.getElementById('auth-gate').style.display='none';
        document.getElementById('portal-shell').style.display='flex';
        hideLoading();
        renderSidebar();
        renderUserInfo();
        navigate('director');
        setupMobileToggle();
        startPolling();
        _setupPortalExtras();
    } catch(e){
        hideLoading();showAuthError(e.message);
    }
}

function showCinematic() {
    const u=S.user||{};
    const trackCfg=u.track?(CONFIG.TRACKS[u.track]||{}):{};
    const color=trackCfg.color||'#38bdf8';
    const glow=trackCfg.glow||'rgba(56,189,248,0.3)';
    const ov=document.createElement('div');
    ov.className='cin-overlay';
    ov.innerHTML=`
        <div class="cin-bg"></div>
        <div class="cin-bg-overlay"></div>
        <div class="cin-content">
            <img src="../cclogo.png" class="cin-logo-img" alt="CC"
                 style="filter:drop-shadow(0 0 36px ${glow})"
                 onerror="this.outerHTML='<div class=cin-logo style=color:${color};filter:drop-shadow(0 0 30px ${glow})>CC</div>'">
            <div class="cin-welcome">WELCOME BACK</div>
            <div class="cin-name" style="color:${color};text-shadow:0 0 40px ${glow}">${esc(u.name||'')}</div>
            <div class="cin-track">${esc(trackCfg.icon||'')} ${esc(u.track||'Curio Crate')}</div>
            <div class="cin-bar-wrap"><div class="cin-bar" style="background:${color}"></div></div>
        </div>`;
    document.body.appendChild(ov);
    setTimeout(()=>{
        ov.classList.add('cin-out');
        setTimeout(()=>ov.remove(),500);
    },2800);
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
// Lightweight context helpers — swap user/role without reloading data
function _setVolContext() {
    if(!S.volUser||S.role==='volunteer') return;
    S._dirUser=S._dirUser||S.user;
    S.user=S.volUser; S.role='volunteer';
    renderUserInfo();
}
function _setDirContext() {
    if(!S._dirUser||S.role!=='volunteer') return;
    S.user=S._dirUser; S.role=S.dirRole;
    renderUserInfo();
}

function renderSidebar() {
    const nav=document.getElementById('sb-nav');
    const role=S.role;
    // Directors who also have a volunteer record get a unified sidebar
    const isUnified=!!(S.dirRole&&S.volUser);
    let mainItems=[], othersItems=[];

    if(role==='volunteer'||isUnified){
        const school=((isUnified?S.volUser:S.user)?.school||'').toLowerCase().trim();
        const hasChapter=school&&(S.data.chapters||[]).some(r=>(r[2]||'').trim().toLowerCase()===school);
        mainItems=[
            {id:'dashboard', icon:'🏠',label:'Dashboard'},
            {id:'activities',icon:'📚',label:'Volunteer Opportunities'},
            {id:'calendar',  icon:'📅',label:'Calendar'},
        ];
        if(isUnified) mainItems.push({id:'director',icon:'⚙️',label:'Director Panel'});
        othersItems=[
            ...(hasChapter?[{id:'chapter',icon:'🏫',label:'My Chapter'}]:[]),
            {id:'leaderboard',icon:'🥇',label:'Leaderboard'},
        ];
    } else if(role==='chapter_rep'){
        mainItems=[
            {id:'dashboard', icon:'🏠',label:'Dashboard'},
            {id:'activities',icon:'📚',label:'Volunteer Opportunities'},
            {id:'director',  icon:'⚙️',label:'Chapter Panel'},
            {id:'calendar',  icon:'📅',label:'Calendar'},
        ];
        othersItems=[
            {id:'chapter',    icon:'🏫',label:'My Chapter'},
            {id:'leaderboard',icon:'🥇',label:'Leaderboard'},
        ];
    } else {
        // Pure director (no volunteer record)
        mainItems=[
            {id:'director',  icon:'⚙️',label:'Director Panel'},
            {id:'calendar',  icon:'📅',label:'Calendar'},
        ];
        othersItems=[{id:'leaderboard',icon:'🥇',label:'Leaderboard'}];
    }

    const activeView=S.view||'director';
    const newAct=(role==='volunteer'||role==='chapter_rep'||isUnified)?getNewActivitiesCount():0;
    if(othersItems.some(it=>it.id===activeView)) _othersExpanded=true;

    const mainHTML=mainItems.map(it=>{
        const badge=it.id==='activities'&&newAct>0?`<span class="sb-notif-badge">${newAct}</span>`:'';
        return`<button class="sb-item${activeView===it.id?' active':''}" data-view="${it.id}">
            <span class="sb-icon">${it.icon}</span>
            <span>${it.label}</span>
            ${badge}
        </button>`;
    }).join('');

    const othersHTML=othersItems.length?`
        <button class="sb-item sb-others-toggle" id="sb-others-toggle">
            <span class="sb-icon">•••</span>
            <span>Others</span>
            <span style="margin-left:auto;font-size:10px;opacity:.6">${_othersExpanded?'▲':'▼'}</span>
        </button>
        <div id="sb-others-group" style="${_othersExpanded?'':'display:none'}">
            ${othersItems.map(it=>`<button class="sb-item sb-sub-item${activeView===it.id?' active':''}" data-view="${it.id}">
                <span class="sb-icon">${it.icon}</span>
                <span>${it.label}</span>
            </button>`).join('')}
        </div>`:'';

    nav.innerHTML=mainHTML+othersHTML;

    nav.querySelectorAll('.sb-item[data-view]').forEach(btn=>{
        btn.onclick=()=>{
            const v=btn.dataset.view;
            if(isUnified){
                if(v==='director') _setDirContext();
                else _setVolContext();
            }
            navigate(v);
            closeMobileSidebar();
        };
    });
    document.getElementById('sb-others-toggle')?.addEventListener('click',()=>{
        _othersExpanded=!_othersExpanded;
        const g=document.getElementById('sb-others-group');
        const t=document.getElementById('sb-others-toggle');
        if(g)g.style.display=_othersExpanded?'':'none';
        if(t)t.querySelector('span:last-child').textContent=_othersExpanded?'▲':'▼';
    });

    const brand=document.getElementById('sb-brand');
    if(brand) brand.onclick=null;
}

function activateSidebarItem(view) {
    document.querySelectorAll('.sb-item').forEach(el=>{
        el.classList.toggle('active',el.dataset.view===view);
    });
    // brand is no longer a nav button — no active highlight needed
}

const PALETTE=['#38bdf8','#a78bfa','#22d3ee','#f472b6','#fb923c','#34d399','#fbbf24','#818cf8'];
function avHTML(name,avatar,size) {
    const svg=initSVG(name,size);
    if(avatar&&/^https?:\/\//.test(avatar)){
        return `${svg}<img src="${esc(avatar)}" alt="${esc(name)}" loading="lazy" onerror="this.style.display='none'">`;
    }
    return svg;
}
function initSVG(name,size) {
    const color=PALETTE[(name||'').charCodeAt(0)%PALETTE.length];
    const inits=(name||'?').trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
    const fs=Math.round(size*.38);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${size/2}" fill="${color}1a"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="${color}" font-family="Nunito,sans-serif" font-weight="800" font-size="${fs}">${inits}</text>
    </svg>`;
}

function renderUserInfo() {
    const el=document.getElementById('sb-user');
    const u=S.user||{};
    const track=u.track?(CONFIG.TRACKS[u.track]||{}):{};
    const isDir=!!(S.dirRole);
    el.innerHTML=`
        <div class="sb-av">${avHTML(u.name||'?',u.avatar,34)}</div>
        <div style="min-width:0;flex:1;${isDir?'cursor:pointer':''}" ${isDir?`onclick="_setDirContext();navigate('overview')"`:''}  title="${isDir?'View director overview':''}">
            <div class="sb-name">${esc(u.name||'Director')}</div>
            <div class="sb-meta">${u.track?`${track.icon||''} ${combinedTrackLabel(u)}`:(CONFIG.DIRECTORS[S.role]||CONFIG.DIRECTORS[S.dirRole]||{}).title||''}</div>
        </div>
        <button class="sb-logout-btn" title="Sign out" onclick="logout()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
        </button>`;
}

/* ═══════════════════════════════════════════════════════════════
   ROUTER
   ═══════════════════════════════════════════════════════════════ */
function navigate(view,sub) {
    S.view=view;S.subTab=sub||null;
    activateSidebarItem(view);
    const root=document.getElementById('view-root');
    root.innerHTML='';
    switch(view){
        case 'dashboard':   viewDashboard();break;
        case 'activities':  viewActivities();break;
        case 'curriculum':  viewActivities();break; // alias for backward compat
        case 'progress':    viewMyProgress();break;
        case 'leaderboard': viewLeaderboard();break;
        case 'director':    viewDirectorPanel(sub||'post-event');break;
        case 'overview':    viewDirectorOverview();break;
        case 'chapter':     viewMyChapter();break;
        case 'calendar':    viewCalendar();break;
        default:viewDashboard();
    }
    window.scrollTo(0,0);
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════ */
function trackPill(track) {
    if(!track)return'';
    const cfg=CONFIG.TRACKS[track]||{};
    const cls=cfg.cls||track.toLowerCase().replace(/[^a-z0-9]/g,'-');
    return `<span class="pill pill-${cls}">${cfg.icon||''} ${esc(track)}</span>`;
}
function tierBadge(tier) {
    const t=CONFIG.TIERS[tier]||CONFIG.TIERS[1];
    const cls=tier==='Exec'?'exec':tier;
    return `<span class="tier-badge tier-${cls}">${t.icon} ${t.name}</span>`;
}

function mascotEmpty(title, sub='', btn='') {
    return `<div class="empty-state">
        <img src="../mascot1.png" class="empty-mascot" alt="Curie">
        <div class="empty-title">${title}</div>
        ${sub?`<p class="muted text-small">${sub}</p>`:''}
        ${btn}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   HOURS GOAL
   ═══════════════════════════════════════════════════════════════ */
const HOUR_AWARD_LIST=[
    {hrs:20, icon:'🏅', label:'Eligible for Hours Award'},
    {hrs:50, icon:'🎖', label:'Committed Volunteer Award'},
    {hrs:100,icon:'🥇', label:'Gold Hours Award'},
    {hrs:150,icon:'💎', label:'Platinum Hours Award'},
];

function showHoursGoalModal() {
    const current=S.data.myStats?.totalHours||0;
    const existing=S.data.hoursGoal||50;
    const html=`
    <div class="modal-header">
        <div class="modal-title">🎯 Set Your Hours Goal</div>
        <button class="modal-close">✕</button>
    </div>
    <div class="modal-body">
        <p style="color:var(--text2);font-size:14px;margin:0 0 20px">You have <strong>${current} hrs</strong> so far. Pick a goal and we'll show your progress on the dashboard.</p>
        <div class="goal-slider-wrap">
            <div class="goal-val-display" id="goal-val-display">${existing} hrs</div>
            <input type="range" class="goal-slider" id="goal-slider" min="1" max="300" step="1" value="${existing}">
            <div class="goal-slider-labels"><span>1 hr</span><span>150 hrs</span><span>300 hrs</span></div>
        </div>
        <div class="goal-awards-grid" id="goal-awards-grid">
            ${HOUR_AWARD_LIST.map(a=>`<div class="goal-award-item ${current>=a.hrs?'goal-award-earned':''}" data-hrs="${a.hrs}">
                <div class="goal-award-icon">${a.icon}</div>
                <div class="goal-award-label">${a.label}</div>
                <div class="goal-award-hrs">${a.hrs} hrs</div>
            </div>`).join('')}
        </div>
        <div id="goal-milestone-hint" class="goal-milestone-hint"></div>
        <div style="display:flex;gap:10px;margin-top:20px">
            <button class="btn btn-primary" style="flex:1" id="goal-save-btn">Save Goal</button>
            ${S.data.hoursGoal?`<button class="btn btn-ghost" id="goal-clear-btn">Clear</button>`:''}
        </div>
        <div class="form-err" id="goal-err"></div>
    </div>`;
    const close=openModal(html);
    const slider=document.getElementById('goal-slider');
    const display=document.getElementById('goal-val-display');
    const updateUI=(val)=>{
        display.textContent=val+' hrs';
        const next=HOUR_AWARD_LIST.find(a=>a.hrs>current);
        const hint=document.getElementById('goal-milestone-hint');
        if(hint){
            const selected=HOUR_AWARD_LIST.slice().reverse().find(a=>a.hrs<=val);
            if(val>=150){hint.textContent='💎 This goal earns you the Platinum Hours Award!';}
            else if(val>=100){hint.textContent='🥇 This goal earns you the Gold Hours Award!';}
            else if(val>=50){hint.textContent='🎖 This goal earns you the Committed Volunteer Award!';}
            else if(val>=20){hint.textContent='🏅 This goal earns you the Eligible for Hours Award!';}
            else{hint.textContent='Set a goal of 20+ hrs to be eligible for the hours award.';}
        }
        // Highlight which award this goal reaches
        document.querySelectorAll('.goal-award-item').forEach(el=>{
            const t=parseInt(el.dataset.hrs);
            el.classList.toggle('goal-award-selected', t<=val);
        });
    };
    slider.addEventListener('input',()=>updateUI(parseInt(slider.value)));
    updateUI(existing);
    document.getElementById('goal-save-btn').addEventListener('click',async()=>{
        const val=parseInt(slider.value);
        await saveHoursGoal(val,close);
    });
    document.getElementById('goal-clear-btn')?.addEventListener('click',async()=>{
        await saveHoursGoal(null,close);
    });
}

async function saveHoursGoal(goal,closeFn) {
    const btn=document.getElementById('goal-save-btn');
    const err=document.getElementById('goal-err');
    if(btn)btn.disabled=true;
    try {
        await postAction('set_hours_goal',{volunteerName:S.user.name,goal:goal===null?'':goal});
        S.data.hoursGoal=goal;
        toast(goal?`Goal set to ${goal} hrs!`:'Goal cleared','success');
        if(closeFn)closeFn();
        viewDashboard();
    } catch(e) {
        if(err)err.textContent=e.message;
        if(btn){btn.disabled=false;}
    }
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function viewDashboard() {
    if(S.role!=='volunteer'&&S.role!=='chapter_rep'){viewDirectorOverview();return;}
    const root=document.getElementById('view-root');
    const u=S.user||{};
    const track=u.track?(CONFIG.TRACKS[u.track]||{}):{};
    const stats=S.data.myStats||{totalHours:0,curricCount:0,eventsCount:0};
    const HOUR_AWARDS=[
        {hrs:20, icon:'🏅', label:'Eligible for Hours Award'},
        {hrs:50, icon:'🎖', label:'Committed Volunteer Award'},
        {hrs:100,icon:'🥇', label:'Gold Hours Award'},
        {hrs:150,icon:'💎', label:'Platinum Hours Award'},
    ];
    const hoursGoal=S.data.hoursGoal||null;
    const goalPct=hoursGoal?Math.min(100,Math.round((stats.totalHours/hoursGoal)*100)):0;
    const nextAward=HOUR_AWARDS.find(a=>a.hrs>stats.totalHours);
    const nextAwardText=nextAward?`${nextAward.icon} ${Math.round(nextAward.hrs-stats.totalHours)} more hrs to ${nextAward.label}`:'🏆 All milestone awards earned!';
    const currRegs=S.data.myRegistrations||[];
    const evRegs=S.data.myEventRegistrations||[];
    const totalRegCount=currRegs.length+evRegs.length;

    const evRegCards=evRegs.map(r=>{
        const closeDate=r[8]||'';
        const evDate=r[1]||'';
        const closed=closeDate&&toDateStr(closeDate)<localToday();
        const done=isCompleted(evDate);
        const maxVols=parseInt(r[6])||0;
        const filled=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean).length;
        const countdown=formatCountdown(closeDate);
        const deap=evCardAppearance(r);
        const dStyle=deap.style?`${deap.style};cursor:pointer`:'cursor:pointer';
        return `<div class="curr-card ev-card dash-assign-card dash-reg-card${deap.cls?' '+deap.cls:''}" data-assign-name="${esc(r[0]||'')}" data-type="event" style="${dStyle}">
            <div class="dash-reg-indicator"><span class="dash-reg-badge">✋ Registered</span></div>
            <div style="display:flex;align-items:flex-start;gap:12px">
                <div style="flex:1;min-width:0">
                    ${deap.badge?`<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px"><div class="curr-title" style="margin-bottom:0">${esc(r[0]||'Event')}</div>${deap.badge}</div>`:`<div class="curr-title">${esc(r[0]||'Event')}</div>`}
                    <div class="curr-meta" style="margin-top:6px"><span class="curr-meta-date">📅 ${fmtDateTimeStr(evDate)}</span><span class="curr-meta-sep">·</span><span class="curr-meta-hours">⏱ ${esc(String(r[2]||0))}h credit</span></div>
                    ${!closed&&closeDate?`<div class="curr-signup-close" style="margin-top:5px">🔔 Registration closes ${fmtDateTimeStr(closeDate)}</div>`:''}
                    ${done?`<div class="curr-waiting">⏳ Waiting for hours</div>`:`<div style="font-size:11px;color:var(--textm);margin-top:5px">${filled}/${maxVols||'?'} slots</div>`}
                </div>
                <div style="flex-shrink:0">${done?'<span class="curr-done-badge">✅ Done</span>':closed?'<span class="curr-lock-badge">🔒 Closed</span>':`<span class="curr-countdown" data-lockdate="${esc(closeDate)}">${esc(countdown)}</span>`}</div>
            </div>
        </div>`;
    }).join('');

    const currRegCards=currRegs.map(r=>{
        const locked=isClosed(r[5],r[1]);
        const done=isCompleted(r[1]);
        const maxVols=parseInt(r[6])||0;
        const filled=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean).length;
        const startDate=r[5]||'';
        const countdown=formatCountdown(startDate);
        const dap=cardAppearance(r);
        const dStyle=dap.style?`${dap.style};cursor:pointer`:'cursor:pointer';
        return `<div class="curr-card dash-assign-card dash-reg-card ${dap.cls}" data-assign-name="${esc(r[0]||'')}" data-type="curr" style="${dStyle}">
            <div class="dash-reg-indicator"><span class="dash-reg-badge">✋ Registered</span></div>
            <div style="display:flex;align-items:flex-start;gap:12px">
                <div style="flex:1;min-width:0">
                    ${dap.badge?`<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px"><div class="curr-title" style="margin-bottom:0">${esc(r[0]||'Assignment')}</div>${dap.badge}</div>`:`<div class="curr-title">${esc(r[0]||'Assignment')}</div>`}
                    <div class="curr-meta" style="margin-top:6px"><span class="curr-meta-date">📅 ${fmtDateTimeStr(r[1])}</span><span class="curr-meta-sep">·</span><span class="curr-meta-hours">⏱ ${esc(String(r[2]||0))}h credit</span></div>
                    ${!locked&&startDate?`<div class="curr-signup-close" style="margin-top:5px">🔔 Closes ${fmtDateTimeStr(startDate)}</div>`:''}
                    ${done?`<div class="curr-waiting">⏳ Waiting for director to confirm hours</div>`:`<div style="font-size:11px;color:var(--textm);margin-top:5px">${filled}/${maxVols||'?'} slots filled</div>`}
                </div>
                <div style="flex-shrink:0">${done?'<span class="curr-done-badge">✅ Done</span>':locked?'<span class="curr-lock-badge">🔒 Locked</span>':`<span class="curr-countdown" data-lockdate="${esc(startDate)}">${esc(countdown)}</span>`}</div>
            </div>
        </div>`;
    }).join('');

    // Build director entries from the live sheet, not from hardcoded config names
    const _seenDirRoles=new Set();
    const _allDirEntries=[];
    [u.track,u.additionalTrack].filter(t=>t&&CONFIG.TRACKS[t]).forEach(t=>{
        const role=(CONFIG.TRACKS[t]||{}).role;
        if(role&&!_seenDirRoles.has(role)){
            _seenDirRoles.add(role);
            const roleMeta=CONFIG.DIRECTORS[role]||{title:roleLabel(role),track:getDirTrack(role)};
            const names=(S.data.directors||[])
                .filter(r=>(r[2]||'').trim().toLowerCase()===role && (r[3]||'').trim().toLowerCase()!=='trial')
                .map(r=>(r[1]||'').trim()).filter(Boolean);
            if(names.length)_allDirEntries.push({roleMeta,trackCfg:CONFIG.TRACKS[t]||{},names});
        }
    });
    const trackColor=(track.color)||'var(--blue)';
    const trackColorG=(track.glow)||'rgba(56,189,248,.12)';

    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">Welcome back, ${esc((u.name||'').split(' ')[0])} 👋</div>
                <div class="view-subtitle"></div>
            </div>
            <div class="view-actions">
                <button class="btn btn-ghost btn-sm" onclick="refreshDashboard()" title="Refresh data">🔄 Refresh</button>
            </div>
        </div>
        <div class="card-grid card-grid-3 mb-12">
            <div class="stat-card stat-hours-card" onclick="showHoursGoalModal()" title="Click to set an hours goal">
                <div class="stat-icon" style="background:var(--blue-g)">⏱</div>
                ${hoursGoal?`<div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:baseline;gap:5px">
                        <div class="stat-val">${stats.totalHours}</div>
                        <div class="stat-val-of">/ ${hoursGoal} hrs</div>
                    </div>
                    <div class="stat-lbl">Total Hours</div>
                    <div class="hours-goal-track"><div class="hours-goal-fill" style="width:${goalPct}%"></div></div>
                    <div class="hours-goal-milestone">${nextAwardText}</div>
                </div>`:`<div>
                    <div class="stat-val">${stats.totalHours}</div>
                    <div class="stat-lbl">Total Hours · <span class="hours-goal-hint">Set goal →</span></div>
                </div>`}
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--teal-g)">📚</div>
                <div><div class="stat-val" style="color:var(--teal)">${stats.curricCount}</div><div class="stat-lbl">Curriculum</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--violet-g)">🎓</div>
                <div><div class="stat-val" style="color:var(--violet)">${stats.eventsCount}</div><div class="stat-lbl">Events</div></div>
            </div>
        </div>
        ${(S.data.orgRank||S.data.chapRank)?`<div class="hours-rank-row mb-20">
            ${S.data.orgRank?`<span class="hours-rank-badge">🏆 #${S.data.orgRank} of ${S.data.orgTotal} in the organization</span>`:''}
            ${(S.data.chapRank&&S.data.chapTotal>1)?`<span class="hours-rank-badge hours-rank-chap">📍 #${S.data.chapRank} of ${S.data.chapTotal} in your chapter</span>`:''}
        </div>`:'<div class="mb-20"></div>'}
        <div class="dash-reg-section">
            <div class="dash-reg-section-header">
                <div class="section-title" style="margin-bottom:0">YOUR ACTIVE REGISTRATIONS</div>
                ${totalRegCount>0?`<span class="dash-reg-total-pill">✋ ${totalRegCount} registered</span>`:''}
            </div>
            ${totalRegCount>0?`
            <div class="dash-reg-cols">
                <div class="dash-reg-col">
                    <div class="dash-reg-col-label">🎓 Events <span class="dash-reg-count-pill">${evRegs.length}</span></div>
                    ${evRegs.length?evRegCards:`<div class="dash-reg-col-empty">No event registrations yet</div>`}
                </div>
                <div class="dash-reg-col">
                    <div class="dash-reg-col-label">📚 Curriculum <span class="dash-reg-count-pill">${currRegs.length}</span></div>
                    ${currRegs.length?currRegCards:`<div class="dash-reg-col-empty">No curriculum registrations yet</div>`}
                </div>
            </div>
            <button class="btn btn-ghost btn-sm btn-full mt-8" onclick="navigate('activities')">View all activities →</button>
            `:mascotEmpty('No registrations yet','Sign up for an assignment or event to get started!','<button class="btn btn-ghost btn-sm mt-8" onclick="navigate(\'activities\')">Browse Activities →</button>')}
        </div>
        <div class="dash-directors-section">
            <div class="section-title">YOUR DIRECTORS</div>
            ${(()=>{
                if(!_allDirEntries.length)return'<div class="card dash-directors-card"><div class="muted text-small">No director assigned.</div></div>';
                const volDiscord={};
                (S.data.allVolunteers||[]).forEach(v=>{if(v.name)volDiscord[v.name.toLowerCase()]=v.discord||'';});
                const cards=_allDirEntries.flatMap(({roleMeta,trackCfg:tc,names})=>{
                    const tColor=tc.color||trackColor;
                    const tGlow=tc.glow||trackColorG;
                    return names.map(n=>{
                        const discord=volDiscord[n.toLowerCase()]||'';
                        return`<div class="card dash-directors-card">
                            <div class="dash-dir-row">
                                <div class="dash-dir-icon" style="background:${tGlow};color:${tColor}">${tc.icon||'👤'}</div>
                                <div>
                                    <div class="dash-dir-title">${esc(roleMeta.title)}</div>
                                    <div class="dash-dir-name">${esc(n)}</div>
                                    ${discord?`<div class="dash-dir-discord">Discord: @${esc(discord)}</div>`:''}
                                </div>
                            </div>
                        </div>`;
                    });
                }).filter(Boolean).join('');
                return`<div class="dash-dir-grid">${cards}</div>`;
            })()}
        </div>`;
    // Clicking a registration card opens the detail modal
    root.querySelectorAll('.dash-assign-card').forEach(card=>{
        card.addEventListener('click',()=>{
            const name=card.dataset.assignName;
            const type=card.dataset.type;
            if(type==='event'){
                const r=(S.data.upcomingEvents||[]).find(row=>(row[0]||'').trim()===name.trim());
                if(r)showEventDetail(r);
            } else {
                const r=(S.data.curriculum||[]).find(row=>(row[0]||'').trim()===name.trim());
                if(r)showAssignmentDetail(r);
            }
        });
    });
    startCountdownTimers();
}

function viewDirectorOverview() {
    const root=document.getElementById('view-root');
    const roleInfo=CONFIG.DIRECTORS[S.role]||{title:roleLabel(S.role),track:getDirTrack(S.role)};
    const assignments=S.data.curriculum||[];
    const events=S.data.events||[];
    const upcomingEvents=S.data.upcomingEvents||[];
    const vols=S.data.volunteers||[];
    const openAssignments=assignments.filter(r=>!isLocked(r[5]));
    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">Overview 🏠</div>
                <div class="view-subtitle">${esc(roleInfo.title)} · ${esc(roleInfo.track||'All Tracks')}</div>
            </div>
            <div class="view-actions"></div>
        </div>
        <div class="card-grid card-grid-3 mb-20">
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--blue-g)">👥</div>
                <div><div class="stat-val">${vols.length}</div><div class="stat-lbl">Volunteers</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--teal-g)">📚</div>
                <div><div class="stat-val" style="color:var(--teal)">${assignments.length}</div><div class="stat-lbl">Assignments</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--violet-g)">🎓</div>
                <div><div class="stat-val" style="color:var(--violet)">${events.length}</div><div class="stat-lbl">Events Recorded</div></div>
            </div>
        </div>
        <div class="dash-grid">
            <div>
                <div class="section-title">OPEN ASSIGNMENTS (${openAssignments.length})</div>
                ${openAssignments.slice(0,4).map(r=>{
                    const filled=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean).length;
                    const maxVols=parseInt(r[6])||0;
                    const oa=cardAppearance(r);
                    return `<div class="curr-card ${oa.cls}"${oa.style?` style="${oa.style}"`:''}>${oa.badge?`<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px"><div class="curr-title" style="margin-bottom:0">${esc(r[0]||'')}</div>${oa.badge}</div>`:`<div class="curr-title">${esc(r[0]||'')}</div>`}<div class="curr-meta">Due ${fmtDate(r[1])} · ${filled}/${maxVols} slots · ${esc(formatCountdown(r[5]))}</div></div>`;
                }).join('')||'<div class="muted text-small">No open assignments.</div>'}
            </div>
            <div>
                <div class="section-title">QUICK ACTIONS</div>
                <div class="card">
                    <button class="btn btn-primary btn-full mb-8" onclick="navigate('director')">Open Director Panel →</button>
                    <button class="btn btn-ghost btn-full" onclick="navigate('leaderboard')">View Leaderboard →</button>
                </div>
            </div>
        </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: CURRICULUM ASSIGNMENTS
   ═══════════════════════════════════════════════════════════════ */
function viewCurriculum() {
    const root=document.getElementById('view-root');
    const assignments=S.data.curriculum||[];
    const u=S.user||{};

    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">Available Assignments 📚</div>
                <div class="view-subtitle">${assignments.length} total · ${assignments.filter(r=>!isClosed(r[5],r[1])&&!isCompleted(r[1])).length} open now</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="curr-refresh-btn">↺ Refresh</button>
        </div>
        <div class="panel-tabs" id="curr-tabs">
            <button class="panel-tab active" data-tab="available">Available</button>
            <button class="panel-tab" data-tab="mine">Mine</button>
            <button class="panel-tab" data-tab="all">All (${assignments.length})</button>
        </div>
        <div id="curr-list"></div>`;

    document.getElementById('curr-refresh-btn').onclick=async()=>{
        const btn=document.getElementById('curr-refresh-btn');
        btn.disabled=true;btn.innerHTML='<span class="spinner"></span>';
        await loadVolunteerData(u.name||'').catch(()=>{});
        viewCurriculum();
    };
    root.querySelectorAll('#curr-tabs .panel-tab').forEach(tab=>{
        tab.onclick=()=>{
            root.querySelectorAll('#curr-tabs .panel-tab').forEach(t=>t.classList.remove('active'));
            tab.classList.add('active');
            renderCurrList(tab.dataset.tab);
        };
    });
    renderCurrList('available');
}

function renderCurrList(filter) {
    const listEl=document.getElementById('curr-list');
    if(!listEl)return;
    const assignments=[...(S.data.curriculum||[])].reverse(); // newest first
    const lower=(S.user?.name||'').toLowerCase();
    let filtered=assignments;
    // "available" = everything not yet completed (open + locked), locked appear dimmed
    if(filter==='available')filtered=assignments.filter(r=>!isCompleted(r[1]));
    else if(filter==='mine')filtered=assignments.filter(r=>{
        const reg=(r[7]||'').split(',').map(n=>n.trim().toLowerCase());
        const cred=(r[3]||'').split(',').map(n=>n.trim().toLowerCase());
        return reg.includes(lower)||cred.includes(lower);
    });
    // "all" = everything, simple row layout
    if(filter==='all'){
        listEl.innerHTML=filtered.length
            ?filtered.map(r=>currSimpleRowHTML(r)).join('')
            :mascotEmpty('No assignments yet','Check back soon — new assignments will appear here.');
        // simple rows have no interactive buttons so no attachCurrEvents needed
        listEl.querySelectorAll('.curr-simple-row').forEach(row=>{
            row.addEventListener('click',()=>{
                const name=row.dataset.name;
                const r=assignments.find(x=>(x[0]||'').trim()===name.trim());
                if(r)showAssignmentDetail(r);
            });
        });
        return;
    }
    if(!filtered.length){
        listEl.innerHTML=mascotEmpty('No assignments here','Nothing in this category yet.');
        return;
    }
    listEl.innerHTML=filtered.map(r=>currCardHTML(r,lower)).join('');
    attachCurrEvents();
    startCountdownTimers();
}

function currSimpleRowHTML(r) {
    const name=r[0]||'Untitled';
    const hours=r[2]||'0';
    const credited=(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const regList=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const done=isCompleted(r[1]);
    const locked=isClosed(r[5],r[1]);
    const count=credited.length||regList.length;
    let badge='';
    if(done)badge='<span class="curr-done-badge" style="font-size:10px;padding:2px 8px">Done</span>';
    else if(locked)badge='<span class="curr-lock-badge" style="font-size:10px;padding:2px 8px">Locked</span>';
    else badge='<span class="curr-open-badge" style="font-size:10px;padding:2px 8px">Open</span>';
    const ap=cardAppearance(r);
    return `<div class="curr-simple-row ${done?'done':''}" data-name="${esc(name)}" style="cursor:pointer">
        <span class="curr-simple-icon">${done?'✅':locked?'🔒':'📋'}</span>
        <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="curr-simple-name">${esc(name)}</span>${ap.badge}</div>
            <div class="curr-simple-meta">Due ${fmtDateTimeStr(r[1])} · ${esc(hours)}h · ${count} volunteer${count!==1?'s':''}</div>
        </div>
        <span class="curr-simple-badge">${badge}</span>
    </div>`;
}

function currCardHTML(r,lowerName) {
    const name=r[0]||'Untitled';
    const hours=r[2]||'0';
    const credited=(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const startDate=r[5]||'';
    const maxVols=parseInt(r[6])||0;
    const regList=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const locked=isClosed(startDate,r[1]);
    const done=isCompleted(r[1]);
    const isCredited=credited.some(n=>n.toLowerCase()===lowerName);
    const isRegistered=regList.some(n=>n.toLowerCase()===lowerName);
    const isFull=maxVols>0&&regList.length>=maxVols;
    const countdown=formatCountdown(startDate);

    // Status + lock badges
    let statusBadge='';
    if(isCredited)statusBadge='<span class="curr-credit-badge">✅ Hours given</span>';
    else if(isRegistered)statusBadge='<span class="curr-reg-badge">✋ Registered</span>';
    const lockBadge=done
        ?'<span class="curr-done-badge">✅ Completed</span>'
        :locked?'<span class="curr-lock-badge">🔒 Locked</span>'
        :`<span class="curr-countdown" data-lockdate="${esc(startDate)}">${esc(countdown)}</span>`;

    const signupCloseHTML=!done&&!locked&&startDate
        ?`<div class="curr-signup-close">🔔 Signups close <strong>${fmtDateTimeStr(startDate)}</strong></div>`:'';

    // Slot grid: filled names + empty open slots
    const slotsCount=maxVols>0?maxVols:regList.length;
    const slotItems=[];
    for(let i=0;i<slotsCount;i++){
        const vol=regList[i];
        if(vol){
            const inits=vol.trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
            const isYou=vol.toLowerCase()===lowerName;
            slotItems.push(`<div class="vol-slot ${isYou?'slot-you':'slot-filled'}"><div class="vol-slot-av">${inits}</div><span class="vol-slot-name">${esc(vol)}</span></div>`);
        } else {
            slotItems.push(`<div class="vol-slot slot-empty"><div class="vol-slot-av"></div><span class="vol-slot-name">Open</span></div>`);
        }
    }

    // Hours-confirmed section
    let creditedHTML='';
    if(credited.length){
        const cslots=credited.map(n=>{
            const inits=n.trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
            return `<div class="vol-slot slot-credited"><div class="vol-slot-av">${inits}</div><span class="vol-slot-name">${esc(n)}</span></div>`;
        }).join('');
        creditedHTML=`<div class="curr-subsection"><div class="curr-subsection-lbl">Hours confirmed</div><div class="slot-grid">${cslots}</div></div>`;
    }

    // Action buttons (no Details button — click card to open detail)
    let actionHTML='';
    if(!isCredited){
        if(!locked&&!isRegistered&&!isFull){
            actionHTML=`<button class="btn btn-primary btn-sm curr-reg-btn" data-name="${esc(name)}" data-vol="${esc(S.user?.name||'')}">✋ Register</button>`;
        } else if(!locked&&isRegistered){
            actionHTML=`<button class="btn btn-ghost btn-sm curr-unreg-btn" data-name="${esc(name)}" data-vol="${esc(S.user?.name||'')}">✕ Unregister</button>`;
        } else if(locked&&!isRegistered){
            actionHTML='<span class="muted text-small">Registration closed</span>';
        } else if(isFull&&!isRegistered){
            actionHTML='<span class="muted text-small">Slots full</span>';
        }
    }

    const cardCls=done?'curr-completed':locked&&!isCredited?'curr-locked':'';
    const ap=cardAppearance(r);
    const styleAttr=ap.style?` style="${ap.style}"`:'';
    const exSparkles=ap.isExclusive
        ?`<span class="ex-sparkle" style="top:8px;right:10px;--ex-sz:12px;--ex-color:#d4960e;--ex-dur:1.8s;--ex-delay:0s;--ex-scale:1.5">✦</span>`+
          `<span class="ex-sparkle" style="top:24px;left:22px;--ex-sz:7px;--ex-color:#8059d8;--ex-dur:2.3s;--ex-delay:.4s;--ex-scale:1.7">✦</span>`+
          `<span class="ex-sparkle" style="bottom:10px;right:16px;--ex-sz:10px;--ex-color:#0ea89a;--ex-dur:2.1s;--ex-delay:.9s;--ex-scale:1.5">✦</span>`+
          `<span class="ex-sparkle" style="bottom:18px;left:50px;--ex-sz:6px;--ex-color:#e05858;--ex-dur:2.6s;--ex-delay:1.3s;--ex-scale:1.9">✧</span>`+
          `<span class="ex-sparkle" style="top:48%;right:28px;--ex-sz:8px;--ex-color:#18b888;--ex-dur:2.0s;--ex-delay:.7s;--ex-scale:1.6">✦</span>`
        :'';
    return `<div class="curr-card ${cardCls} ${isCredited?'curr-credited':''} curr-clickable ${ap.cls}" data-name="${esc(name)}"${styleAttr}>
        ${exSparkles}<div style="display:flex;align-items:flex-start;gap:12px">
            <div style="flex:1;min-width:0">
                ${ap.badge?`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px"><div class="curr-title" style="margin-bottom:0">${esc(name)}</div>${ap.badge}</div>`:`<div class="curr-title">${esc(name)}</div>`}
                <div class="curr-meta" style="margin-top:6px"><span class="curr-meta-date">📅 ${fmtDateTimeStr(r[1])}</span><span class="curr-meta-sep">·</span><span class="curr-meta-hours">⏱ ${esc(hours)}h credit</span></div>
                ${statusBadge?`<div style="margin-top:7px">${statusBadge}</div>`:''}
                ${signupCloseHTML}
            </div>
            <div style="flex-shrink:0">${lockBadge}</div>
        </div>
        ${slotItems.length?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.055)"><div class="slot-grid">${slotItems.join('')}</div></div>`:''}
        ${creditedHTML}
        ${actionHTML?`<div class="curr-actions" style="margin-top:12px">${actionHTML}</div>`:''}
    </div>`;
}

function attachCurrEvents() {
    // Clicking the card body (not a button) opens the detail modal
    document.querySelectorAll('.curr-card.curr-clickable').forEach(card=>{
        card.addEventListener('click',e=>{
            if(e.target.closest('.btn'))return;
            const name=card.dataset.name;
            const r=(S.data.curriculum||[]).find(row=>(row[0]||'').trim()===name.trim());
            if(r)showAssignmentDetail(r);
        });
    });
    document.querySelectorAll('.curr-reg-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const assignmentName=btn.dataset.name,volunteerName=btn.dataset.vol;
            btn.disabled=true;btn.textContent='Registering…';
            try {
                await postAction('register_curriculum',{assignmentName,volunteerName});
                toast('Registered! You\'re in.','success');
                await loadVolunteerData(volunteerName).catch(()=>{});
                renderCurrList(document.querySelector('#curr-tabs .panel-tab.active')?.dataset.tab||'all');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✋ Register';}
        };
    });
    document.querySelectorAll('.curr-unreg-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const assignmentName=btn.dataset.name,volunteerName=btn.dataset.vol;
            btn.disabled=true;btn.textContent='Removing…';
            try {
                await postAction('unregister_curriculum',{assignmentName,volunteerName});
                toast('Unregistered.','success');
                await loadVolunteerData(volunteerName).catch(()=>{});
                renderCurrList(document.querySelector('#curr-tabs .panel-tab.active')?.dataset.tab||'all');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✕ Unregister';}
        };
    });
}

function showAssignmentDetail(r) {
    const name=r[0]||'Untitled';
    const hours=r[2]||'0';
    const credited=(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const slidesLink=r[4]||'';
    const startDate=r[5]||'';
    const maxVols=parseInt(r[6])||0;
    const regList=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const instructions=r[8]||'';
    const done=isCompleted(r[1]);
    const locked=isClosed(startDate,r[1]);
    const lockDateStr=startDate?fmtDateTimeStr(startDate):'';
    const dueDateStr=fmtDateTimeStr(r[1]);

    let stateBadge='';
    if(done)stateBadge='<span class="curr-done-badge">✅ Completed</span>';
    else if(locked)stateBadge='<span class="curr-lock-badge">🔒 Registration closed</span>';

    const cardLabel=(r[11]||'').trim();
    const ap=cardAppearance(r);
    const html=`
        <div class="modal-header">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div class="modal-title">${esc(name)}</div>${ap.badge}</div>
            <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
            <div class="modal-chips">
                <span class="modal-chip">📅 Due ${dueDateStr}</span>
                <span class="modal-chip">⏱ ${esc(hours)}h credit</span>
                <span class="modal-chip">👥 ${regList.length}/${maxVols||'?'} slots</span>
                ${stateBadge}
            </div>
            ${!done&&!locked&&lockDateStr?`<div class="modal-signup-close">🔔 Signups for this lesson will close on <strong>${lockDateStr}</strong></div>`:''}
            ${instructions?`<div class="modal-section">
                <div class="modal-section-title">INSTRUCTIONS</div>
                <div class="modal-instructions">${esc(instructions).replace(/\n/g,'<br>')}</div>
            </div>`:''}
            <div class="modal-section">
                <div class="modal-section-title">SLIDES</div>
                ${slidesLink
                    ?`<a href="${esc(slidesLink)}" target="_blank" rel="noopener" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none">📄 Open Slides ↗</a>`
                    :'<span class="muted text-small">No slides link yet.</span>'}
            </div>
            ${regList.length?`<div class="modal-section">
                <div class="modal-section-title">REGISTERED (${regList.length})</div>
                <div class="vol-chips">${regList.map(n=>`<span class="vol-chip">${esc(n)}</span>`).join('')}</div>
            </div>`:''}
            ${credited.length?`<div class="modal-section">
                <div class="modal-section-title">HOURS GIVEN TO</div>
                <div class="vol-chips">${credited.map(n=>`<span class="vol-chip chip-credited">${esc(n)}</span>`).join('')}</div>
            </div>`:''}
        </div>`;
    openModal(html);
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: MY PROGRESS
   ═══════════════════════════════════════════════════════════════ */
function viewMyProgress() {
    const root=document.getElementById('view-root');
    // chapter_rep and directors use volUser for personal stats if available
    const u=(S.role==='chapter_rep'||S.dirRole)?( S.volUser||S.user||{} ):(S.user||{});
    const stats=S.data.myStats||{totalHours:0,curricCount:0,eventsCount:0};

    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">My Progress 📈</div>
                <div class="view-subtitle">${u.track||'Curio Crate'} track</div>
            </div>
        </div>
        <div class="card-grid card-grid-3 mb-20">
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--blue-g)">⏱</div>
                <div><div class="stat-val">${stats.totalHours}</div><div class="stat-lbl">Total Hours</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--teal-g)">📚</div>
                <div><div class="stat-val" style="color:var(--teal)">${stats.curricCount}</div><div class="stat-lbl">Curriculum Built</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--violet-g)">🎓</div>
                <div><div class="stat-val" style="color:var(--violet)">${stats.eventsCount}</div><div class="stat-lbl">Events Attended</div></div>
            </div>
        </div>
        <div class="section-title">REQUIRED FORMS</div>
        <div class="ymca-form-row">
            <div style="font-size:18px">🏕️</div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;color:var(--text);font-size:13px">YMCA Volunteer Form</div>
                <div style="font-size:11px;color:var(--textm);margin-top:2px">Required to register for YMCA-tagged events · upload once, unlocks all</div>
            </div>
            ${S.data.ymcaFormURL||S.user?.ymcaFormURL
                ?`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="font-size:11px;font-weight:700;color:var(--green);background:var(--green-g);border:1px solid rgba(52,211,153,.3);border-radius:100px;padding:3px 10px">✅ On file</span>
                    <a href="${esc(S.data.ymcaFormURL||S.user?.ymcaFormURL||'')}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">View</a>
                    <button class="btn btn-ghost btn-sm" id="ymca-reupload-btn">Re-upload</button>
                </div>`
                :`<button class="btn btn-primary btn-sm" id="ymca-upload-progress-btn">📤 Upload Form</button>`
            }
        </div>`;
    // Attach Required Forms events
    document.getElementById('ymca-upload-progress-btn')?.addEventListener('click',showYMCAUploadModal);
    document.getElementById('ymca-reupload-btn')?.addEventListener('click',showYMCAUploadModal);
}

function buildTierCriteria(tier,completed,current,stats) {
    const c=(stats&&stats.curricCount)||0;
    const e=(stats&&stats.eventsCount)||0;
    const h=(stats&&stats.totalHours)||0;
    if(tier===1)return[
        {label:'Complete at least 1 curriculum assignment',met:completed||c>=1},
        {label:'Attend at least 1 in-person event',met:completed||e>=1},
    ];
    if(tier===2)return[
        {label:'Complete 3+ curriculum assignments (you: '+c+')',met:completed||c>=3},
        {label:'Attend 2+ in-person events (you: '+e+')',met:completed||e>=2},
        {label:'Earn 5+ total volunteer hours (you: '+h+')',met:completed||h>=5},
        {label:'Director nomination',met:completed},
    ];
    if(tier===3)return[
        {label:'Complete 8+ curriculum assignments (you: '+c+')',met:completed||c>=8},
        {label:'Attend 5+ in-person events (you: '+e+')',met:completed||e>=5},
        {label:'Earn 15+ total volunteer hours (you: '+h+')',met:completed||h>=15},
        {label:'Demonstrated leadership in your track',met:completed},
        {label:'Director nomination + conversation with '+CONFIG.PRESIDENT_NAME,met:completed},
    ];
    if(tier===4)return[
        {label:'Complete 15+ curriculum assignments (you: '+c+')',met:completed||c>=15},
        {label:'Attend 10+ in-person events (you: '+e+')',met:completed||e>=10},
        {label:'Earn 30+ total volunteer hours (you: '+h+')',met:completed||h>=30},
        {label:'Led team projects or sessions independently',met:completed},
        {label:'Director nomination + conversation with '+CONFIG.PRESIDENT_NAME,met:completed},
    ];
    if(tier==='Exec')return[
        {label:'Exceptional multi-year service to Curio Crate',met:completed},
        {label:'Invitation-only — offered directly by the President',met:completed},
    ];
    return[];
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: LEADERBOARD
   ═══════════════════════════════════════════════════════════════ */
async function viewLeaderboard() {
    const root=document.getElementById('view-root');
    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">Leaderboard 🥇</div>
                <div class="view-subtitle">Live hours, events &amp; curriculum rankings</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="navigate('leaderboard')">↺ Refresh</button>
        </div>
        <div class="lb-tabs" id="lb-tabs">
            <button class="lb-tab active" data-cat="hours">⏱ Hours</button>
            <button class="lb-tab" data-cat="events">🎯 Events</button>
            <button class="lb-tab" data-cat="curriculum">📚 Curriculum</button>
        </div>
        <div id="lb-podium" class="lb-podium"></div>
        <div class="lb-list">
            <div class="lb-search-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="color:var(--textm)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input class="lb-search" id="lb-search" placeholder="Search a volunteer…">
            </div>
            <div id="lb-rows"><div style="padding:40px;text-align:center;color:var(--textm)"><div class="pl-ring" style="margin:0 auto 10px"></div>Loading…</div></div>
        </div>`;
    root.querySelectorAll('.lb-tab').forEach(tab=>{
        tab.onclick=()=>{
            root.querySelectorAll('.lb-tab').forEach(t=>t.classList.remove('active'));
            tab.classList.add('active');
            S.lbCat=tab.dataset.cat;
            renderLbPodium();renderLbList();
        };
    });
    document.getElementById('lb-search').oninput=renderLbList;
    try{
        await loadLbData();
        renderLbPodium();renderLbList();
    }catch(e){
        document.getElementById('lb-rows').innerHTML=`<div style="padding:40px;text-align:center;color:var(--red)">Failed to load: ${esc(e.message)}</div>`;
    }
}

function lbSorted() {
    return[...(S.data.lbData||[])].sort((a,b)=>{
        if(S.lbCat==='hours')return b.hours-a.hours;
        if(S.lbCat==='events')return b.events-a.events;
        if(S.lbCat==='curriculum')return b.curriculum-a.curriculum;
        return 0;
    });
}
function lbStatVal(v) {
    if(S.lbCat==='hours')return round1(v.hours);
    if(S.lbCat==='events')return v.events;
    if(S.lbCat==='curriculum')return v.curriculum;
}
function lbStatLbl() { return{hours:'hrs',events:'events',curriculum:'built'}[S.lbCat]||''; }

function renderLbPodium() {
    const s=lbSorted(),pod=document.getElementById('lb-podium');
    if(!pod||s.length<1)return;
    const slots=[s[1],s[0],s[2]],ranks=[2,1,3];
    pod.innerHTML=slots.map((v,i)=>{
        if(!v)return'<div></div>';
        const rank=ranks[i],val=lbStatVal(v);
        return `<div class="pod-card p${rank}">
            <div class="pod-rank">#${rank}</div>
            <div class="pod-av">${avHTML(v.name,v.avatar,rank===1?68:56)}</div>
            <div class="pod-name">${esc(v.name)}</div>
            ${v.discord&&CONFIG.SHOW_DISCORD?`<div class="pod-disc">@${esc(v.discord)}</div>`:''}
            <div class="pod-stat">${fmt(val)}</div>
            <div class="pod-stat-lbl">${lbStatLbl()}</div>
        </div>`;
    }).join('');
}

function renderLbList() {
    const q=(document.getElementById('lb-search')?.value||'').toLowerCase().trim();
    const s=lbSorted();
    const rows=document.getElementById('lb-rows');
    if(!rows)return;
    const filtered=q?s.filter(v=>v.name.toLowerCase().includes(q)):s;
    const rest=filtered.slice(3);
    if(!rest.length){rows.innerHTML=`<div style="padding:32px;text-align:center;color:var(--textm)">${q?'No results':'Everyone is on the podium!'}</div>`;return;}
    rows.innerHTML=rest.map(v=>{
        const rank=filtered.indexOf(v)+1,val=lbStatVal(v);
        return `<div class="lb-row">
            <div class="lb-row-rank">${rank}</div>
            <div class="lb-row-av">${avHTML(v.name,v.avatar,36)}</div>
            <div class="lb-row-info">
                <div class="lb-row-name">${esc(v.name)}</div>
                ${v.discord?`<div class="lb-row-sub">@${esc(v.discord)}</div>`:''}
            </div>
            <div class="lb-row-stat">
                <div class="lb-row-val">${fmt(val)}</div>
                <div class="lb-row-lbl">${lbStatLbl()}</div>
            </div>
        </div>`;
    }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: DIRECTOR PANEL
   ═══════════════════════════════════════════════════════════════ */
function viewDirectorPanel(activeTab) {
    const root=document.getElementById('view-root');
    const r=S.role;
    const roleInfo=CONFIG.DIRECTORS[r]||{title:roleLabel(r),track:getDirTrack(r)};

    const tabs=[
        ...(canPostEvent(r)?      [{id:'post-event',       label:'📅 Post Event'}]:[]),
        ...(canPostAssignment(r)? [{id:'post-assignment',  label:'📋 Post Assignment'}]:[]),
        ...(canGiveHoursAssign(r)?[{id:'give-hours',       label:'✅ Give Hours'}]:[]),
        ...(canGiveHoursEvent(r)? [{id:'give-event-hours', label:'🎓 Give Event Hours'}]:[]),
        {id:'roster', label:'👥 Roster'},
    ];

    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">${esc(roleInfo.title)}</div>
                <div class="view-subtitle">${esc(roleInfo.track||'All Tracks')} · Director View</div>
            </div>
            <div class="view-actions">
                <button class="btn btn-ghost btn-sm" id="dir-refresh-btn">↺ Refresh</button>
            </div>
        </div>
        <div class="panel-tabs" id="dir-tabs">
            ${tabs.map(t=>`<button class="panel-tab${t.id===activeTab?' active':''}" data-tab="${t.id}">${t.label}</button>`).join('')}
        </div>
        <div id="dir-panel-body"></div>`;

    document.getElementById('dir-refresh-btn').onclick=async()=>{
        const btn=document.getElementById('dir-refresh-btn');
        btn.disabled=true;btn.innerHTML='<span class="spinner"></span>';
        await loadDirectorData(getDirTrack(r)).catch(()=>{});
        viewDirectorPanel(activeTab);
    };
    root.querySelectorAll('#dir-tabs .panel-tab').forEach(tab=>{
        tab.onclick=()=>{S.subTab=tab.dataset.tab;viewDirectorPanel(tab.dataset.tab);};
    });
    renderDirPanel(activeTab);
}

function renderDirPanel(tab) {
    const body=document.getElementById('dir-panel-body');
    if(!body)return;
    switch(tab){
        case 'roster':          body.innerHTML=dirRosterHTML();          attachRosterEvents();         break;
        case 'post-assignment': body.innerHTML=dirPostAssignHTML();      attachPostAssignEvents();     break;
        case 'give-hours':      body.innerHTML=dirGiveHoursHTML();       attachGiveHoursEvents();      break;
        case 'post-event':      body.innerHTML=dirPostEventHTML();       attachPostEventEvents();      break;
        case 'give-event-hours':body.innerHTML=dirGiveEventHoursHTML();  attachGiveEventHoursEvents(); break;
        default:                body.innerHTML=dirPostEventHTML();       attachPostEventEvents();
    }
}

/* ─── ROSTER ─────────────────────────────────────────────────── */
function dirRosterHTML() {
    const vols=S.data.volunteers||[];
    return `
        <div class="mb-12" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <input class="form-input" id="roster-search" placeholder="Search volunteer…" style="max-width:260px;padding:9px 12px;font-size:13px">
            <span class="muted text-small">${vols.length} volunteer${vols.length!==1?'s':''}</span>
        </div>
        <div class="table-wrap">
        <table class="data-table">
            <thead><tr>
                <th>Volunteer</th><th>Track</th>
                <th class="col-r">Hours</th><th class="col-r">Curriculum</th><th class="col-r">Events</th><th>Email</th>
            </tr></thead>
            <tbody id="roster-tbody">
                ${vols.map(v=>`<tr data-name="${esc(v.name.toLowerCase())}">
                    <td><div class="td-name">${esc(v.name)}</div>${v.discord?`<div class="td-sub">@${esc(v.discord)}</div>`:''}</td>
                    <td>${trackPill(v.track)}</td>
                    <td class="col-r"><span class="td-num">${round1(v.hours)}</span></td>
                    <td class="col-r"><span class="td-num">${v.curricCount}</span></td>
                    <td class="col-r"><span class="td-num">${v.eventsCount}</span></td>
                    <td><span class="muted text-small">${esc(v.email)}</span></td>
                </tr>`).join('')}
            </tbody>
        </table>
        </div>`;
}

function attachRosterEvents() {
    const search=document.getElementById('roster-search');
    const filter=()=>{
        const q=(search?.value||'').toLowerCase();
        document.querySelectorAll('#roster-tbody tr').forEach(tr=>{
            tr.style.display=!q||(tr.dataset.name||'').includes(q)?'':'none';
        });
    };
    search?.addEventListener('input',filter);
}

/* ─── POST ASSIGNMENT (DOC) ─────────────────────────────────── */
function dirPostAssignHTML() {
    const existing=S.data.curriculum||[];
    const existingCards=existing.slice().reverse().map(r=>{
        const filled=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean).length;
        const maxVols=parseInt(r[6])||0;
        const done=isCompleted(r[1]);
        const locked=isClosed(r[5],r[1]);
        const statusBadge=done
            ?'<span class="curr-done-badge">✅ Completed</span>'
            :locked?'<span class="curr-lock-badge">🔒 Locked</span>'
            :`<span class="curr-open-badge">Open · ${esc(formatCountdown(r[5]))}</span>`;
        const da=cardAppearance(r);
        return `<div class="curr-card ${da.cls}"${da.style?` style="${da.style}"`:''}">
            <div class="curr-header">
                <div style="flex:1;min-width:0">
                    ${da.badge?`<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px"><div class="curr-title" style="margin-bottom:0">${esc(r[0]||'')}</div>${da.badge}</div>`:`<div class="curr-title">${esc(r[0]||'')}</div>`}
                    <div class="curr-meta">Due ${fmtDateTimeStr(r[1])} · ${esc(r[2]||'0')}h · ${filled}/${maxVols} slots</div>
                </div>
                <div style="flex-shrink:0">${statusBadge}</div>
            </div>
            <div class="curr-actions mt-10" style="flex-wrap:wrap;gap:7px">
                <button class="btn btn-ghost btn-sm dir-edit-btn" data-name="${esc(r[0]||'')}">✏️ Edit</button>
                ${!locked?`<button class="btn btn-ghost btn-sm dir-startnow-btn" data-name="${esc(r[0]||'')}">▶ Start Now</button>`:''}
                ${!done?`<button class="btn btn-ghost btn-sm dir-finishearly-btn" data-name="${esc(r[0]||'')}">✓ Finish Early</button>`:''}
            </div>
        </div>`;
    }).join('')||'<div class="muted text-small">No assignments posted yet.</div>';

    return `
        <div style="display:grid;grid-template-columns:1fr 1.1fr;gap:20px;align-items:start">
            <div class="card">
                <div class="card-title">POST CURRICULUM ASSIGNMENT</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Assignment Name *</label>
                        <input class="form-input" id="pa-name" placeholder="e.g. Week 3 — Circuits Lesson">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Slides Link</label>
                        <input class="form-input" id="pa-slides" placeholder="https://docs.google.com/presentation/…">
                    </div>
                    <div class="form-grid form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Due Date &amp; Time *</label>
                            <input class="form-input" type="datetime-local" id="pa-due">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Registration Lock Date &amp; Time *</label>
                            <input class="form-input" type="datetime-local" id="pa-start">
                            <div class="form-hint">After this, no new sign-ups</div>
                        </div>
                    </div>
                    <div class="form-grid form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Hours Credit *</label>
                            <input class="form-input" type="number" id="pa-hours" placeholder="2" min="0" step="0.5">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Max Volunteers *</label>
                            <input class="form-input" type="number" id="pa-max" placeholder="3" min="1">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Instructions *</label>
                        <textarea class="form-textarea" id="pa-instructions" style="min-height:90px" placeholder="Describe what volunteers need to do, any requirements, etc."></textarea>
                    </div>
                    ${colorDecoPickerHTML('pa-color','pa-deco','pa-color-row','pa-deco-row','','')}
                    <div class="form-group">
                        <label class="form-label">Custom Label <span style="font-size:11px;color:var(--textm);font-weight:600">(badge shown on card — optional)</span></label>
                        <input class="form-input" id="pa-label" placeholder="e.g. Urgent, Bonus, Week 3, Special">
                    </div>
                    <div class="form-err" id="pa-err"></div>
                    <button class="btn btn-primary" id="pa-submit-btn">📋 Post Assignment</button>
                </div>
            </div>
            <div>
                <div class="section-title">EXISTING ASSIGNMENTS (${existing.length})</div>
                ${existingCards}
            </div>
        </div>`;
}

function attachPostAssignEvents() {
    initColorDecoPickerEvents('pa-color','pa-deco','pa-color-row','pa-deco-row');
    document.getElementById('pa-submit-btn').onclick=async()=>{
        const name=document.getElementById('pa-name').value.trim();
        const slides=document.getElementById('pa-slides').value.trim();
        const due=document.getElementById('pa-due').value;
        const start=document.getElementById('pa-start').value;
        const hours=document.getElementById('pa-hours').value;
        const max=document.getElementById('pa-max').value;
        const instructions=document.getElementById('pa-instructions').value;
        const cardColor=document.getElementById('pa-color').value;
        const cardDeco=document.getElementById('pa-deco').value;
        const cardLabel=document.getElementById('pa-label').value.trim();
        const err=document.getElementById('pa-err');
        if(!name||!due||!start||!hours||!max||!instructions){err.textContent='All fields including instructions are required.';return;}
        err.textContent='';
        const btn=document.getElementById('pa-submit-btn');
        btn.disabled=true;btn.textContent='Posting…';
        try {
            await postAction('create_curriculum',{
                assignmentName:name,dueDate:due,hours,contributors:'',
                slidesLink:slides,startDate:start,maxVolunteers:max,
                registeredVolunteers:'',instructions,cardColor,cardDeco,cardLabel,
            });
            toast(`"${name}" posted!`,'success');
            ['pa-name','pa-slides','pa-due','pa-start','pa-hours','pa-max','pa-instructions'].forEach(id=>{document.getElementById(id).value='';});
            const track=getDirTrack(S.role);
            await loadDirectorData(track).catch(()=>{});
            viewDirectorPanel('post-assignment');
        } catch(e){err.textContent=e.message;}
        btn.disabled=false;btn.textContent='📋 Post Assignment';
    };

    document.querySelectorAll('.dir-edit-btn').forEach(btn=>{
        btn.onclick=()=>{
            const name=btn.dataset.name;
            const r=(S.data.curriculum||[]).find(row=>(row[0]||'').trim()===name.trim());
            if(r)showEditAssignment(r);
        };
    });

    document.querySelectorAll('.dir-startnow-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const name=btn.dataset.name;
            if(!confirm(`Start "${name}" now?\n\nThis will close registration immediately.`))return;
            btn.disabled=true;btn.textContent='Starting…';
            try {
                await postAction('edit_curriculum',{assignmentName:name,fields:{startDate:localYesterday()}});
                toast(`Registration closed — "${name}" has started.`,'success');
                const track=getDirTrack(S.role);
                await loadDirectorData(track).catch(()=>{});
                viewDirectorPanel('post-assignment');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='▶ Start Now';}
        };
    });

    document.querySelectorAll('.dir-finishearly-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const name=btn.dataset.name;
            if(!confirm(`Mark "${name}" as finished early?\n\nThis sets the due date to yesterday and marks the assignment as completed.`))return;
            btn.disabled=true;btn.textContent='Finishing…';
            try {
                await postAction('edit_curriculum',{assignmentName:name,fields:{startDate:localYesterday(),dueDate:localYesterday()}});
                toast(`"${name}" marked as completed.`,'success');
                const track=getDirTrack(S.role);
                await loadDirectorData(track).catch(()=>{});
                viewDirectorPanel('post-assignment');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✓ Finish Early';}
        };
    });
}

function showEditAssignment(r) {
    const name=r[0]||'';
    const selColor=(r[9]||'').trim();
    const selDeco=(r[10]||'').trim();
    const selLabel=(r[11]||'').trim();
    const html=`
        <div class="modal-header">
            <div class="modal-title">Edit Assignment</div>
            <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
            <div class="form-group mb-12">
                <div class="form-label" style="margin-bottom:4px">Assignment</div>
                <div style="font-weight:600;color:var(--text2)">${esc(name)}</div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">Slides Link</label>
                    <input class="form-input" id="ed-slides" value="${esc(r[4]||'')}" placeholder="https://…">
                </div>
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label">Due Date &amp; Time</label>
                        <input class="form-input" type="datetime-local" id="ed-due" value="${esc(toDateTimeLocal(r[1]))}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Registration Lock Date &amp; Time</label>
                        <input class="form-input" type="datetime-local" id="ed-start" value="${esc(toDateTimeLocal(r[5]))}">
                    </div>
                </div>
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label">Hours Credit</label>
                        <input class="form-input" type="number" id="ed-hours" value="${esc(r[2]||'')}" min="0" step="0.5">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Max Volunteers</label>
                        <input class="form-input" type="number" id="ed-max" value="${esc(r[6]||'')}" min="1">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Instructions</label>
                    <textarea class="form-textarea" id="ed-instructions" style="min-height:100px">${esc(r[8]||'')}</textarea>
                </div>
                ${colorDecoPickerHTML('ed-color','ed-deco','ed-color-row','ed-deco-row',selColor,selDeco)}
                <div class="form-group">
                    <label class="form-label">Custom Label <span style="font-size:11px;color:var(--textm);font-weight:600">(badge on card — optional)</span></label>
                    <input class="form-input" id="ed-label" value="${esc(selLabel)}" placeholder="e.g. Urgent, Bonus, Week 3, Special">
                </div>
                <div class="form-err" id="ed-err"></div>
                <button class="btn btn-primary" id="ed-submit-btn">Save Changes</button>
            </div>
        </div>`;
    const close=openModal(html);
    initColorDecoPickerEvents('ed-color','ed-deco','ed-color-row','ed-deco-row');
    document.getElementById('ed-submit-btn').addEventListener('click',async()=>{
        const slides=document.getElementById('ed-slides').value.trim();
        const due=document.getElementById('ed-due').value;
        const start=document.getElementById('ed-start').value;
        const hours=document.getElementById('ed-hours').value;
        const max=document.getElementById('ed-max').value;
        const instructions=document.getElementById('ed-instructions').value;
        const cardColor=document.getElementById('ed-color').value;
        const cardDeco=document.getElementById('ed-deco').value;
        const cardLabel=document.getElementById('ed-label').value.trim();
        const err=document.getElementById('ed-err');
        if(!due){err.textContent='Due date is required.';return;}
        err.textContent='';
        const btn=document.getElementById('ed-submit-btn');
        btn.disabled=true;btn.textContent='Saving…';
        try {
            await postAction('edit_curriculum',{assignmentName:name,fields:{slidesLink:slides,dueDate:due,startDate:start,hours,maxVolunteers:max,instructions,cardColor,cardDeco,cardLabel}});
            toast(`"${name}" updated!`,'success');
            close();
            const track=getDirTrack(S.role);
            await loadDirectorData(track).catch(()=>{});
            viewDirectorPanel('post-assignment');
        } catch(e){err.textContent=e.message;btn.disabled=false;btn.textContent='Save Changes';}
    });
}

/* ─── GIVE HOURS (DOC) ──────────────────────────────────────── */
function dirGiveHoursHTML() {
    const assignments=[...(S.data.curriculum||[])].reverse(); // newest first
    if(!assignments.length)return mascotEmpty('No assignments yet','Post assignments first, then give hours after volunteers complete the work.');
    const allVols=S.data.allVolunteers||[];
    const discordMap={};
    allVols.forEach(v=>{discordMap[v.name.toLowerCase()]=v.discord;});

    const cards=assignments.map(r=>{
        const name=r[0]||'';
        const regList=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean);
        const credited=(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean);
        const alreadyGiven=credited.length>0;
        const locked=isLocked(r[5]);
        const volChips=regList.map(n=>{
            const disc=discordMap[n.toLowerCase()]||'';
            const dirR=getDirRoleForName(n);
            const roleBadge=dirR?`<span class="slot-role-badge">${roleLabel(dirR)}</span>`:'';
            return `<span class="give-hrs-chip" data-vol="${esc(n)}">
                ${esc(n)}${disc?' · @'+esc(disc):''}${roleBadge}
                <button class="remove-vol-btn" title="Mark as no-show">✕</button>
            </span>`;
        }).join('');
        const creditedChips=credited.map(n=>`<span class="vol-chip chip-credited">${esc(n)}</span>`).join('');
        return `<div class="curr-card ${locked?'curr-locked':'curr-open'}">
            <div class="curr-header">
                <div style="flex:1;min-width:0">
                    <div class="curr-title">${esc(name)}</div>
                    <div class="curr-meta">Due ${fmtDate(r[1])} · ${esc(r[2]||'0')}h credit · ${regList.length} registered</div>
                </div>
                <div style="flex-shrink:0">
                    ${locked?'<span class="curr-lock-badge">🔒 Locked</span>':'<span class="curr-open-badge">Open</span>'}
                </div>
            </div>
            ${regList.length?`<div class="vol-chip-row mt-10" data-assign="${esc(name)}"><div class="muted text-small mb-4" style="width:100%">Will receive hours (click ✕ to exclude no-shows):</div>${volChips}</div>`:'<div class="muted text-small mt-8">No volunteers registered.</div>'}
            ${alreadyGiven?`<div class="vol-chips mt-8"><div class="muted text-small mb-4">Already given to:</div>${creditedChips}</div>`:''}
            ${regList.length?`<button class="btn ${alreadyGiven?'btn-ghost':'btn-primary'} btn-sm mt-12 give-hrs-btn" data-name="${esc(name)}">${alreadyGiven?'↻ Re-give Hours':'✅ Give Hours'}</button>`:''}
        </div>`;
    }).join('');

    return `<div class="card mb-16" style="border-color:rgba(251,191,36,.2)">
        <div class="muted text-small" style="line-height:1.7"><strong style="color:var(--gold)">How Give Hours works:</strong> Click ✕ next to any volunteer to mark them as a no-show — they stay registered but won't receive credit. Then click "Give Hours" to credit the remaining volunteers.</div>
    </div>${cards}`;
}

function attachGiveHoursEvents() {
    // Toggle no-show exclusion
    document.querySelectorAll('.give-hrs-chip .remove-vol-btn').forEach(rmBtn=>{
        rmBtn.addEventListener('click',e=>{
            e.stopPropagation();
            const chip=rmBtn.closest('.give-hrs-chip');
            chip.classList.toggle('vol-excluded');
        });
    });
    document.querySelectorAll('.give-hrs-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const assignmentName=btn.dataset.name;
            // Collect non-excluded volunteers from this assignment's chip row
            const chipRow=document.querySelector(`.vol-chip-row[data-assign="${CSS.escape(assignmentName)}"]`);
            const finalAttendees=chipRow
                ?[...chipRow.querySelectorAll('.give-hrs-chip:not(.vol-excluded)')].map(c=>(c.dataset.vol||'').trim()).filter(Boolean)
                :[];
            const attendeesStr=finalAttendees.join(', ');
            if(!confirm(`Give hours to ${finalAttendees.length} volunteer(s) for "${assignmentName}"?\n\nThis will update the leaderboard.`))return;
            btn.disabled=true;btn.textContent='Giving hours…';
            try {
                await postAction('give_hours',{assignmentName,attendees:attendeesStr,givenBy:S.user?.name||'Director',givenDate:new Date().toISOString()});
                toast('Hours given! Leaderboard updates shortly.','success');
                await loadDirectorData(getDirTrack(S.role)).catch(()=>{});
                viewDirectorPanel('give-hours');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✅ Give Hours';}
        };
    });
}

/* ─── RECORD EVENT (DOO) ────────────────────────────────────── */
function dirRecordEventHTML() {
    const events=(S.data.events||[]).slice().reverse().slice(0,10);
    return `
        <div style="display:grid;grid-template-columns:1fr 1.1fr;gap:20px;align-items:start">
            <div class="card">
                <div class="card-title">RECORD IN-PERSON EVENT</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Event Name *</label>
                        <input class="form-input" id="re-name" placeholder="e.g. Westwood Elementary — Circuits">
                    </div>
                    <div class="form-grid form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Date *</label>
                            <input class="form-input" type="date" id="re-date">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hours Credit *</label>
                            <input class="form-input" type="number" id="re-hours" placeholder="2" min="0" step="0.5">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Attendees * <span class="muted" style="font-weight:400">(comma-separated, exact names)</span></label>
                        <textarea class="form-textarea" id="re-attendees" style="min-height:80px" placeholder="Jane Smith, John Doe, …"></textarea>
                        <div class="form-hint">Names must exactly match the Volunteers sheet</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
                            <input type="checkbox" id="re-assembly" style="width:16px;height:16px;accent-color:var(--blue)">
                            Mark as Assembly event
                        </label>
                    </div>
                    <div class="form-err" id="re-err"></div>
                    <button class="btn btn-primary" id="re-submit-btn">🎓 Record Event</button>
                </div>
            </div>
            <div>
                <div class="section-title">RECENT EVENTS</div>
                ${events.map(r=>`<div class="curr-card">
                    <div class="curr-title">${esc(r[0]||'')}</div>
                    <div class="curr-meta">${fmtDate(r[1])} · ${esc(r[2]||'0')}h ${isChecked(r[4])?'· Assembly':''}</div>
                    ${r[3]?`<div class="muted text-small mt-4">${esc(r[3])}</div>`:''}
                </div>`).join('')||'<div class="muted text-small">No events recorded yet.</div>'}
            </div>
        </div>`;
}

function attachRecordEventEvents() {
    document.getElementById('re-submit-btn')?.addEventListener('click',async()=>{
        const name=document.getElementById('re-name').value.trim();
        const date=document.getElementById('re-date').value;
        const hours=document.getElementById('re-hours').value;
        const attendees=document.getElementById('re-attendees').value.trim();
        const assembly=document.getElementById('re-assembly').checked;
        const err=document.getElementById('re-err');
        if(!name||!date||!hours||!attendees){err.textContent='All required fields must be filled.';return;}
        err.textContent='';
        const btn=document.getElementById('re-submit-btn');
        btn.disabled=true;btn.textContent='Recording…';
        try {
            await postAction('record_event',{
                eventName:name,date,hours,attendees,
                isAssembly:assembly?'TRUE':'FALSE',
                recordedBy:S.user?.name||'Director',recordedDate:new Date().toISOString(),
            });
            toast(`"${name}" recorded!`,'success');
            document.getElementById('re-name').value='';
            document.getElementById('re-date').value='';
            document.getElementById('re-hours').value='';
            document.getElementById('re-attendees').value='';
            document.getElementById('re-assembly').checked=false;
            S.data.lbReady=false; // force lb refresh
            const track=getDirTrack(S.role);
            await loadDirectorData(track).catch(()=>{});
            viewDirectorPanel('record-event');
        } catch(e){err.textContent=e.message;btn.disabled=false;btn.textContent='🎓 Record Event';}
        btn.disabled=false;btn.textContent='🎓 Record Event';
    });
}

/* ─── MANAGE TIERS (PRESIDENT) ──────────────────────────────── */
function dirManageTiersHTML() {
    const vols=S.data.allVolunteers||[];
    return `
        <div class="card mb-16" style="border-color:rgba(251,191,36,.2)">
            <div class="muted text-small" style="line-height:1.7"><strong style="color:var(--gold)">Manage Tiers:</strong> After the promotion conversation, select the volunteer's new tier and click Update. This writes directly to their Volunteers sheet record (column G).</div>
        </div>
        <div class="mb-12">
            <input class="form-input" id="mt-search" placeholder="Search volunteer…" style="max-width:280px;padding:9px 12px;font-size:13px">
        </div>
        <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>Volunteer</th><th>Track</th><th>Current Tier</th><th>Update To</th><th></th></tr></thead>
            <tbody id="mt-tbody">
                ${vols.map(v=>`<tr data-name="${esc(v.name.toLowerCase())}">
                    <td><div class="td-name">${esc(v.name)}</div>${v.discord?`<div class="td-sub">@${esc(v.discord)}</div>`:''}</td>
                    <td>${trackPill(v.track)}</td>
                    <td>${tierBadge(v.tier)}</td>
                    <td><select class="form-select mt-tier-sel" data-vol="${esc(v.name)}" style="padding:6px 10px;font-size:12px;max-width:140px">
                        ${Object.entries(CONFIG.TIERS).map(([k,t])=>`<option value="${k}"${String(v.tier)===String(k)?' selected':''}>${t.name}</option>`).join('')}
                    </select></td>
                    <td><button class="btn btn-ghost btn-sm mt-update-btn" data-vol="${esc(v.name)}">Update</button></td>
                </tr>`).join('')}
            </tbody>
        </table>
        </div>`;
}

function attachManageTiersEvents() {
    const search=document.getElementById('mt-search');
    search?.addEventListener('input',()=>{
        const q=(search.value||'').toLowerCase();
        document.querySelectorAll('#mt-tbody tr').forEach(tr=>{
            tr.style.display=!q||tr.dataset.name.includes(q)?'':'none';
        });
    });
    document.querySelectorAll('.mt-update-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const volName=btn.dataset.vol;
            const row=btn.closest('tr');
            const sel=row?.querySelector('.mt-tier-sel');
            const newTier=sel?.value||'1';
            btn.disabled=true;btn.textContent='Updating…';
            try {
                await postAction('update_tier',{volunteerName:volName,newTier,updatedBy:S.user?.name||'President',updatedDate:new Date().toISOString()});
                toast(`${volName} → ${CONFIG.TIERS[newTier]?.name||newTier}!`,'success');
                await loadDirectorData('All').catch(()=>{});
                viewDirectorPanel('manage-tiers');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='Update';}
        };
    });
}

/* ═══════════════════════════════════════════════════════════════
   TOAST & LOADING
   ═══════════════════════════════════════════════════════════════ */
function toast(msg,type='success') {
    const wrap=document.getElementById('toast-wrap');
    const el=document.createElement('div');
    el.className=`toast ${type}`;
    el.innerHTML=`<span>${type==='success'?'✓':'⚠'}</span>${esc(msg)}`;
    wrap.appendChild(el);
    setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),300);},3500);
}
let _loadStart=0, _initialHidden=false, _hideTimer=null;
function showLoading() {
    if(_hideTimer){clearTimeout(_hideTimer);_hideTimer=null;}
    const el=document.getElementById('portal-loading');
    if(!el)return;
    el.classList.remove('pl-init','hidden');
    void el.offsetWidth; // force reflow so CSS animations restart from 0
    if(!_initialHidden) _loadStart=Date.now();
}
function hideLoading() {
    const el=document.getElementById('portal-loading');
    if(!el||el.classList.contains('pl-init'))return; // already fully hidden
    const doHide=()=>{
        el.classList.add('hidden');
        _hideTimer=setTimeout(()=>{el.classList.add('pl-init');_hideTimer=null;},900);
    };
    if(!_initialHidden){
        // First login: short minimum so animations feel snappy
        const elapsed=Date.now()-_loadStart;
        const delay=Math.max(0,1200-elapsed);
        _initialHidden=true;
        _hideTimer=setTimeout(doHide,delay);
    } else {
        doHide();
    }
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
function setupMobileToggle() {
    const btn=document.getElementById('mob-toggle');
    const shell=document.getElementById('portal-shell');
    if(!btn||!shell)return;
    btn.onclick=()=>shell.classList.toggle('sidebar-open');
    document.getElementById('portal-main')?.addEventListener('click',e=>{
        if(e.target.closest('.sidebar'))return;
        shell.classList.remove('sidebar-open');
    });
}
function closeMobileSidebar() {
    document.getElementById('portal-shell')?.classList.remove('sidebar-open');
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: ACTIVITIES (combined curriculum + upcoming events)
   ═══════════════════════════════════════════════════════════════ */
function viewActivities() {
    markActivitiesSeen();
    const root=document.getElementById('view-root');
    const assignments=S.data.curriculum||[];
    const upcomingEvs=S.data.upcomingEvents||[];
    const total=assignments.length+upcomingEvs.length;
    const openAssign=assignments.filter(r=>!isClosed(r[5],r[1])&&!isCompleted(r[1])).length;
    const openEvs=upcomingEvs.filter(r=>{
        const cd=toDateStr(r[8]);
        return !cd||cd>=localToday();
    }).length;

    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">Volunteer Opportunities 📚</div>
                <div class="view-subtitle">${total} total · ${openAssign+openEvs} open now</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="act-refresh-btn">↺ Refresh</button>
        </div>
        <div class="panel-tabs" id="act-tabs">
            <button class="panel-tab active" data-tab="available">Available</button>
            <button class="panel-tab" data-tab="mine">My Past Volunteering</button>
            <button class="panel-tab" data-tab="all">All (${total})</button>
        </div>
        <div class="act-split">
            <div id="act-col-events"></div>
            <div id="act-col-curriculum"></div>
        </div>`;

    document.getElementById('act-refresh-btn').onclick=async()=>{
        const btn=document.getElementById('act-refresh-btn');
        btn.disabled=true;btn.innerHTML='<span class="spinner"></span>';
        await loadVolunteerData(S.user?.name||'').catch(()=>{});
        viewActivities();
    };
    root.querySelectorAll('#act-tabs .panel-tab').forEach(tab=>{
        tab.onclick=()=>{
            root.querySelectorAll('#act-tabs .panel-tab').forEach(t=>t.classList.remove('active'));
            tab.classList.add('active');
            renderActivitiesList(tab.dataset.tab);
        };
    });
    renderActivitiesList('available');
}

function renderActivitiesList(filter) {
    const evCol=document.getElementById('act-col-events');
    const currCol=document.getElementById('act-col-curriculum');
    if(!evCol||!currCol)return;

    const assignments=[...(S.data.curriculum||[])].reverse();
    const upcomingEvs=[...(S.data.upcomingEvents||[])].reverse();
    const lower=(S.user?.name||'').toLowerCase();

    let filteredAssign=assignments;
    let filteredEvs=upcomingEvs;

    if(filter==='available'){
        filteredAssign=assignments.filter(r=>!isCompleted(r[1]));
        filteredEvs=upcomingEvs.filter(r=>{
            const cd=toDateStr(r[8]);
            return !isCompleted(r[1])&&(!cd||cd>=localToday());
        });
    } else if(filter==='mine'){
        filteredAssign=assignments.filter(r=>{
            const reg=(r[7]||'').split(',').map(n=>n.trim().toLowerCase());
            const cred=(r[3]||'').split(',').map(n=>n.trim().toLowerCase());
            return reg.includes(lower)||cred.includes(lower);
        });
        filteredEvs=upcomingEvs.filter(r=>{
            const reg=(r[7]||'').split(',').map(n=>n.trim().toLowerCase());
            const cred=(r[3]||'').split(',').map(n=>n.trim().toLowerCase());
            return reg.includes(lower)||cred.includes(lower);
        });
    }

    // Events column (left)
    const evHeader=`<div class="act-col-header">📅 Upcoming Events<span class="act-col-count">${filteredEvs.length}</span></div>`;
    if(filteredEvs.length){
        const cards=filter==='all'
            ?filteredEvs.map(r=>evSimpleRowHTML(r)).join('')
            :filteredEvs.map(r=>evCardHTML(r,lower)).join('');
        evCol.innerHTML=evHeader+cards;
    } else {
        evCol.innerHTML=evHeader+`<div class="muted text-small" style="padding:10px 0">No events to show.</div>`;
    }

    // Curriculum column (right)
    const currHeader=`<div class="act-col-header">📚 Curriculum Opportunities<span class="act-col-count">${filteredAssign.length}</span></div>`;
    if(filteredAssign.length){
        const cards=filter==='all'
            ?filteredAssign.map(r=>currSimpleRowHTML(r)).join('')
            :filteredAssign.map(r=>currCardHTML(r,lower)).join('');
        currCol.innerHTML=currHeader+cards;
    } else {
        currCol.innerHTML=currHeader+`<div class="muted text-small" style="padding:10px 0">No assignments to show.</div>`;
    }

    // Wire up simple-row clicks (All tab)
    if(filter==='all'){
        document.querySelectorAll('.curr-simple-row').forEach(row=>{
            row.addEventListener('click',()=>{
                const name=row.dataset.name;
                if(row.dataset.type==='event'){
                    const r=upcomingEvs.find(x=>(x[0]||'').trim()===name.trim());
                    if(r)showEventDetail(r);
                } else {
                    const r=assignments.find(x=>(x[0]||'').trim()===name.trim());
                    if(r)showAssignmentDetail(r);
                }
            });
        });
        return;
    }

    attachActivitiesEvents();
    startCountdownTimers();
}

function evCardHTML(r,lowerName) {
    const name=r[0]||'Untitled';
    const evDate=r[1]||'';
    const hours=r[2]||'0';
    const credited=(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const isAssembly=isChecked(r[4]);
    const isLeadership=isChecked(r[5]);
    const maxVols=parseInt(r[6])||0;
    const regList=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const closeDate=r[8]||'';
    const instructions=r[9]||'';
    const chapterLabel=r[10]||'';
    const eap=evCardAppearance(r);
    const closed=closeDate&&toDateStr(closeDate)<localToday();
    const done=isCompleted(evDate);
    const isCredited=credited.some(n=>n.toLowerCase()===lowerName);
    const isRegistered=regList.some(n=>n.toLowerCase()===lowerName);
    const isFull=maxVols>0&&regList.length>=maxVols;
    const countdown=formatCountdown(closeDate);

    let statusBadge='';
    if(isCredited)statusBadge='<span class="curr-credit-badge">✅ Hours given</span>';
    else if(isRegistered)statusBadge='<span class="curr-reg-badge">✋ Registered</span>';

    const lockBadge=done
        ?'<span class="curr-done-badge">✅ Completed</span>'
        :closed?'<span class="curr-lock-badge">🔒 Closed</span>'
        :`<span class="curr-countdown" data-lockdate="${esc(closeDate)}">${esc(countdown)}</span>`;

    const signupCloseHTML=!done&&!closed&&closeDate
        ?`<div class="curr-signup-close">🔔 Registration closes <strong>${fmtDateTimeStr(closeDate)}</strong></div>`:'';

    const requiresYMCA=isChecked(r[14]);
    const hasYMCAForm=!!(S.user?.ymcaFormURL);

    const tags=[];
    if(isAssembly)tags.push('<span class="ev-tag ev-tag-assembly">Assembly</span>');
    if(isLeadership)tags.push('<span class="ev-tag ev-tag-leadership">Leadership</span>');
    if(requiresYMCA)tags.push('<span class="ev-tag ev-tag-ymca">🏕️ YMCA</span>');
    const tagsHTML=tags.length?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${tags.join('')}</div>`:'';

    const chapterBadge=chapterLabel?`<span class="chapter-label-badge">🏫 ${esc(chapterLabel)}</span>`:'';

    // Slot grid
    const slotsCount=maxVols>0?maxVols:regList.length;
    const slotItems=[];
    for(let i=0;i<slotsCount;i++){
        const vol=regList[i];
        if(vol){
            const inits=vol.trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
            const isYou=vol.toLowerCase()===lowerName;
            const dirR=getDirRoleForName(vol);
            const roleBadge=dirR?`<span class="slot-role-badge">${roleLabel(dirR)}</span>`:'';
            slotItems.push(`<div class="vol-slot ${isYou?'slot-you':'slot-filled'}"><div class="vol-slot-av">${inits}</div><span class="vol-slot-name">${esc(vol)}</span>${roleBadge}</div>`);
        } else {
            slotItems.push(`<div class="vol-slot slot-empty"><div class="vol-slot-av"></div><span class="vol-slot-name">Open</span></div>`);
        }
    }

    let creditedHTML='';
    if(credited.length){
        const cslots=credited.map(n=>{
            const inits=n.trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
            return `<div class="vol-slot slot-credited"><div class="vol-slot-av">${inits}</div><span class="vol-slot-name">${esc(n)}</span></div>`;
        }).join('');
        creditedHTML=`<div class="curr-subsection"><div class="curr-subsection-lbl">Hours confirmed</div><div class="slot-grid">${cslots}</div></div>`;
    }

    let actionHTML='';
    if(!isCredited){
        const ymcaBlocked=requiresYMCA&&!hasYMCAForm&&!isRegistered;
        if(!closed&&ymcaBlocked){
            actionHTML=`<button class="btn btn-sm ev-ymca-btn" style="background:rgba(212,150,14,.88);border:1.5px solid rgba(180,120,0,.9);color:#fff;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.18)" data-name="${esc(name)}">🏕️ Upload YMCA Form to Register</button>`;
        } else if(!closed&&!isRegistered&&!isFull){
            actionHTML=`<button class="btn btn-primary btn-sm ev-reg-btn" data-name="${esc(name)}" data-vol="${esc(S.user?.name||'')}">✋ Register</button>`;
        } else if(!closed&&isRegistered){
            actionHTML=`<button class="btn btn-ghost btn-sm ev-unreg-btn" data-name="${esc(name)}" data-vol="${esc(S.user?.name||'')}">✕ Unregister</button>`;
        } else if(closed&&!isRegistered){
            actionHTML='<span class="muted text-small">Registration closed</span>';
        } else if(isFull&&!isRegistered){
            actionHTML='<span class="muted text-small">Slots full</span>';
        }
    }

    const cardCls=done?'curr-completed':closed&&!isCredited?'curr-locked':'';
    const cardStyle=eap.style||(isCredited?'':'');
    return `<div class="curr-card ev-card ${cardCls} ${isCredited?'curr-credited':''} curr-clickable${eap.cls?' '+eap.cls:''}" data-name="${esc(name)}" data-type="event"${cardStyle?` style="${cardStyle}"`:''}>`+`
        <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <div class="curr-title">${esc(name)}</div>
                    ${chapterBadge}${eap.badge}
                </div>
                <div class="curr-meta" style="margin-top:6px"><span class="curr-meta-date">📅 ${fmtDateTimeStr(evDate)}</span><span class="curr-meta-sep">·</span><span class="curr-meta-hours">⏱ ${esc(hours)}h credit</span></div>
                ${tagsHTML}
                ${statusBadge?`<div style="margin-top:7px">${statusBadge}</div>`:''}
                ${signupCloseHTML}
            </div>
            <div style="flex-shrink:0">${lockBadge}</div>
        </div>
        ${slotItems.length?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.055)"><div class="slot-grid">${slotItems.join('')}</div></div>`:''}
        ${creditedHTML}
        ${actionHTML?`<div class="curr-actions" style="margin-top:12px">${actionHTML}</div>`:''}
    </div>`;
}

function evSimpleRowHTML(r) {
    const name=r[0]||'Untitled';
    const evDate=r[1]||'';
    const hours=r[2]||'0';
    const credited=(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const regList=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const closeDate=r[8]||'';
    const chapterLabel=r[10]||'';
    const done=isCompleted(evDate);
    const closed=closeDate&&toDateStr(closeDate)<localToday();
    const count=credited.length||regList.length;
    let badge='';
    if(done)badge='<span class="curr-done-badge" style="font-size:10px;padding:2px 8px">Done</span>';
    else if(closed)badge='<span class="curr-lock-badge" style="font-size:10px;padding:2px 8px">Closed</span>';
    else badge='<span class="curr-open-badge" style="font-size:10px;padding:2px 8px">Open</span>';
    return `<div class="curr-simple-row ${done?'done':''}" data-name="${esc(name)}" data-type="event" style="cursor:pointer">
        <span class="curr-simple-icon">${done?'✅':closed?'🔒':'📅'}</span>
        <div style="flex:1;min-width:0">
            <div class="curr-simple-name">${esc(name)}${chapterLabel?` <span style="font-size:10px;color:var(--purple)">🏫 ${esc(chapterLabel)}</span>`:''}</div>
            <div class="curr-simple-meta">${fmtDateTimeStr(evDate)} · ${esc(hours)}h · ${count} volunteer${count!==1?'s':''}</div>
        </div>
        <span class="curr-simple-badge">${badge}</span>
    </div>`;
}

function showEventDetail(r) {
    const name=r[0]||'Untitled';
    const evDate=r[1]||'';
    const hours=r[2]||'0';
    const credited=(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const isAssembly=isChecked(r[4]);
    const isLeadership=isChecked(r[5]);
    const maxVols=parseInt(r[6])||0;
    const regList=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const closeDate=r[8]||'';
    const instructions=r[9]||'';
    const chapterLabel=r[10]||'';
    const requiresYMCA=isChecked(r[14]);
    const hasYMCAForm=!!(S.user?.ymcaFormURL);
    const done=isCompleted(evDate);
    const closed=closeDate&&toDateStr(closeDate)<localToday();

    let stateBadge='';
    if(done)stateBadge='<span class="curr-done-badge">✅ Completed</span>';
    else if(closed)stateBadge='<span class="curr-lock-badge">🔒 Registration closed</span>';

    const tags=[];
    if(isAssembly)tags.push('<span class="ev-tag ev-tag-assembly">Assembly</span>');
    if(isLeadership)tags.push('<span class="ev-tag ev-tag-leadership">Leadership</span>');
    if(requiresYMCA)tags.push('<span class="ev-tag ev-tag-ymca">🏕️ YMCA</span>');

    const ymcaBannerHTML=requiresYMCA?(hasYMCAForm
        ?`<div style="margin:14px 0;padding:10px 14px;border-radius:8px;background:var(--green-g);border:1.5px solid rgba(52,211,153,.25);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:0;font-size:12px;color:var(--green);font-weight:700">✅ YMCA form on file</div>
            <button class="btn btn-ghost btn-sm" id="detail-ymca-btn">Replace Form</button>
        </div>`
        :`<div style="margin:14px 0;padding:12px 14px;border-radius:8px;background:rgba(212,150,14,.10);border:1.5px solid rgba(212,150,14,.30);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:0;font-size:12px;color:#b87000;font-weight:700">🏕️ This event requires a signed YMCA volunteer form to register.</div>
            <button class="btn btn-sm" style="background:rgba(212,150,14,.15);border:1.5px solid rgba(212,150,14,.40);color:#b87000;flex-shrink:0" id="detail-ymca-btn">Upload Form</button>
        </div>`)
        :'';

    const html=`
        <div class="modal-header">
            <div class="modal-title">${esc(name)}</div>
            <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
            <div class="modal-chips">
                <span class="modal-chip">📅 ${fmtDateTimeStr(evDate)}</span>
                <span class="modal-chip">⏱ ${esc(hours)}h credit</span>
                <span class="modal-chip">👥 ${regList.length}/${maxVols||'?'} slots</span>
                ${chapterLabel?`<span class="chapter-label-badge">🏫 ${esc(chapterLabel)}</span>`:''}
                ${tags.join('')}
                ${stateBadge}
            </div>
            ${ymcaBannerHTML}
            ${!done&&!closed&&closeDate?`<div class="modal-signup-close">🔔 Registration closes <strong>${fmtDateTimeStr(closeDate)}</strong></div>`:''}
            ${instructions?`<div class="modal-section">
                <div class="modal-section-title">INSTRUCTIONS</div>
                <div class="modal-instructions">${esc(instructions).replace(/\n/g,'<br>')}</div>
            </div>`:''}
            ${regList.length?`<div class="modal-section">
                <div class="modal-section-title">REGISTERED (${regList.length})</div>
                <div class="vol-chips">${regList.map(n=>`<span class="vol-chip">${esc(n)}</span>`).join('')}</div>
            </div>`:''}
            ${credited.length?`<div class="modal-section">
                <div class="modal-section-title">HOURS GIVEN TO</div>
                <div class="vol-chips">${credited.map(n=>`<span class="vol-chip chip-credited">${esc(n)}</span>`).join('')}</div>
            </div>`:''}
        </div>`;
    const close=openModal(html);
    document.getElementById('detail-ymca-btn')?.addEventListener('click',()=>{close();showYMCAUploadModal();});
}

function attachActivitiesEvents() {
    // Curriculum card clicks
    document.querySelectorAll('.curr-card.curr-clickable:not([data-type="event"])').forEach(card=>{
        card.addEventListener('click',e=>{
            if(e.target.closest('.btn'))return;
            const name=card.dataset.name;
            const r=(S.data.curriculum||[]).find(row=>(row[0]||'').trim()===name.trim());
            if(r)showAssignmentDetail(r);
        });
    });
    // Event card clicks
    document.querySelectorAll('.curr-card.curr-clickable[data-type="event"]').forEach(card=>{
        card.addEventListener('click',e=>{
            if(e.target.closest('.btn'))return;
            const name=card.dataset.name;
            const r=(S.data.upcomingEvents||[]).find(row=>(row[0]||'').trim()===name.trim());
            if(r)showEventDetail(r);
        });
    });
    // Curriculum register/unregister
    document.querySelectorAll('.curr-reg-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const assignmentName=btn.dataset.name,volunteerName=btn.dataset.vol;
            btn.disabled=true;btn.textContent='Registering…';
            try {
                await postAction('register_curriculum',{assignmentName,volunteerName});
                toast('Registered! You\'re in.','success');
                await loadVolunteerData(volunteerName).catch(()=>{});
                renderActivitiesList(document.querySelector('#act-tabs .panel-tab.active')?.dataset.tab||'available');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✋ Register';}
        };
    });
    document.querySelectorAll('.curr-unreg-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const assignmentName=btn.dataset.name,volunteerName=btn.dataset.vol;
            btn.disabled=true;btn.textContent='Removing…';
            try {
                await postAction('unregister_curriculum',{assignmentName,volunteerName});
                toast('Unregistered.','success');
                await loadVolunteerData(volunteerName).catch(()=>{});
                renderActivitiesList(document.querySelector('#act-tabs .panel-tab.active')?.dataset.tab||'available');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✕ Unregister';}
        };
    });
    // YMCA gate button — prompts upload
    document.querySelectorAll('.ev-ymca-btn').forEach(btn=>{
        btn.onclick=e=>{e.stopPropagation();showYMCAUploadModal();};
    });
    // Event register/unregister
    document.querySelectorAll('.ev-reg-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const eventName=btn.dataset.name,volunteerName=btn.dataset.vol;
            btn.disabled=true;btn.textContent='Registering…';
            try {
                await postAction('register_event',{eventName,volunteerName});
                toast('Registered for event!','success');
                await loadVolunteerData(volunteerName).catch(()=>{});
                renderActivitiesList(document.querySelector('#act-tabs .panel-tab.active')?.dataset.tab||'available');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✋ Register';}
        };
    });
    document.querySelectorAll('.ev-unreg-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const eventName=btn.dataset.name,volunteerName=btn.dataset.vol;
            btn.disabled=true;btn.textContent='Removing…';
            try {
                await postAction('unregister_event',{eventName,volunteerName});
                toast('Unregistered from event.','success');
                await loadVolunteerData(volunteerName).catch(()=>{});
                renderActivitiesList(document.querySelector('#act-tabs .panel-tab.active')?.dataset.tab||'available');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✕ Unregister';}
        };
    });
}

/* ═══════════════════════════════════════════════════════════════
   DIRECTOR: POST EVENT
   ═══════════════════════════════════════════════════════════════ */
function dirPostEventHTML() {
    const existing=(S.data.upcomingEvents||[]).slice().reverse();
    const isChapRep=S.role==='chapter_rep';
    const chapSchool=S.chapData?.school||'';

    const existingCards=existing.map(r=>{
        const filled=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean).length;
        const maxVols=parseInt(r[6])||0;
        const closeDate=r[8]||'';
        const done=isCompleted(r[1]);
        const closed=closeDate&&toDateStr(closeDate)<localToday();
        const statusBadge=done
            ?'<span class="curr-done-badge">✅ Completed</span>'
            :closed?'<span class="curr-lock-badge">🔒 Closed</span>'
            :`<span class="curr-open-badge">Open · ${esc(formatCountdown(closeDate))}</span>`;
        const chap=r[10]?`<span class="chapter-label-badge" style="font-size:10px">🏫 ${esc(r[10])}</span>`:'';
        const eap=evCardAppearance(r);
        return `<div class="curr-card ev-card${eap.cls?' '+eap.cls:''}"${eap.style?` style="${eap.style}"`:''}>`+`
            <div class="curr-header">
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        <div class="curr-title">${esc(r[0]||'')}</div>${chap}${eap.badge}
                    </div>
                    <div class="curr-meta">${fmtDateTimeStr(r[1])} · ${esc(r[2]||'0')}h · ${filled}/${maxVols} slots</div>
                </div>
                <div style="flex-shrink:0">${statusBadge}</div>
            </div>
            <div class="curr-actions mt-10" style="flex-wrap:wrap;gap:7px">
                <button class="btn btn-ghost btn-sm ev-edit-btn" data-name="${esc(r[0]||'')}">✏️ Edit</button>
                ${!closed?`<button class="btn btn-ghost btn-sm ev-startnow-btn" data-name="${esc(r[0]||'')}">▶ Start Now</button>`:''}
                ${!done?`<button class="btn btn-ghost btn-sm ev-finishearly-btn" data-name="${esc(r[0]||'')}">✓ Finish Early</button>`:''}
            </div>
        </div>`;
    }).join('')||'<div class="muted text-small">No upcoming events posted yet.</div>';

    return `
        <div style="display:grid;grid-template-columns:1fr 1.1fr;gap:20px;align-items:start">
            <div class="card">
                <div class="card-title">POST UPCOMING EVENT</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Event Name *</label>
                        <input class="form-input" id="pe-name" placeholder="e.g. Westwood Elementary — Spring Session">
                    </div>
                    <div class="form-grid form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Event Date &amp; Time *</label>
                            <input class="form-input" type="datetime-local" id="pe-date">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Signup Close Date &amp; Time *</label>
                            <input class="form-input" type="datetime-local" id="pe-close">
                            <div class="form-hint">After this, no new sign-ups</div>
                        </div>
                    </div>
                    <div class="form-grid form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Hours Credit *</label>
                            <input class="form-input" type="number" id="pe-hours" placeholder="2" min="0" step="0.5">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Max Volunteers *</label>
                            <input class="form-input" type="number" id="pe-max" placeholder="5" min="1">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:4px">
                            <input type="checkbox" id="pe-assembly" style="width:16px;height:16px;accent-color:var(--blue)">
                            Mark as Assembly event
                        </label>
                        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
                            <input type="checkbox" id="pe-leadership" style="width:16px;height:16px;accent-color:var(--blue)">
                            Mark as Leadership event
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Instructions</label>
                        <textarea class="form-textarea" id="pe-instructions" style="min-height:80px" placeholder="What volunteers need to know, what to bring, etc."></textarea>
                    </div>
                    ${colorDecoPickerHTML('pe-color','pe-deco','pe-color-row','pe-deco-row','','')}
                    <div class="form-group">
                        <label class="form-label">Card Label <span style="font-weight:400;color:var(--textm)">(optional badge on card)</span></label>
                        <input class="form-input" id="pe-label" placeholder="e.g. Priority · New" maxlength="30">
                        ${labelPresetsHTML('pe-label')}
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
                            <input type="checkbox" id="pe-ymca" style="width:16px;height:16px;accent-color:var(--gold)">
                            🏕️ Requires YMCA Form <span style="font-size:11px;font-weight:400;color:var(--textm)">(volunteers must upload signed YMCA form to register)</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Chapter Label ${isChapRep?'(auto-filled)':''}</label>
                        ${buildChapComboHTML('pe-chapter',chapSchool)}
                        <div class="form-hint">Leave blank for org-wide. Only chapters in the Chapters sheet appear.</div>
                    </div>
                    <div class="form-err" id="pe-err"></div>
                    <button class="btn btn-primary" id="pe-submit-btn">📅 Post Event</button>
                </div>
            </div>
            <div>
                <div class="section-title">EXISTING UPCOMING EVENTS (${existing.length})</div>
                ${existingCards}
            </div>
        </div>`;
}

function attachPostEventEvents() {
    initChapCombo('pe-chapter', S.chapData?.school||'', S.role==='chapter_rep');
    initColorDecoPickerEvents('pe-color','pe-deco','pe-color-row','pe-deco-row');
    initLabelPresets('pe-label');
    document.getElementById('pe-submit-btn')?.addEventListener('click',async()=>{
        const name=document.getElementById('pe-name').value.trim();
        const eventDate=document.getElementById('pe-date').value;
        const signupCloseDate=document.getElementById('pe-close').value;
        const hours=document.getElementById('pe-hours').value;
        const maxVolunteers=document.getElementById('pe-max').value;
        const isAssembly=document.getElementById('pe-assembly').checked?'TRUE':'FALSE';
        const isLeadership=document.getElementById('pe-leadership').checked?'TRUE':'FALSE';
        const instructions=document.getElementById('pe-instructions').value;
        const chapterLabel=document.getElementById('pe-chapter').value.trim();
        const cardColor=document.getElementById('pe-color').value;
        const cardDeco=document.getElementById('pe-deco').value;
        const cardLabel=document.getElementById('pe-label').value.trim();
        const requiresYMCA=document.getElementById('pe-ymca').checked?'TRUE':'FALSE';
        const err=document.getElementById('pe-err');
        if(!name||!eventDate||!signupCloseDate||!hours||!maxVolunteers){err.textContent='All required fields must be filled.';return;}
        err.textContent='';
        const btn=document.getElementById('pe-submit-btn');
        btn.disabled=true;btn.textContent='Posting…';
        try {
            await postAction('create_event',{eventName:name,eventDate,signupCloseDate,hours,maxVolunteers,isAssembly,isLeadership,instructions,chapterLabel,cardColor,cardDeco,cardLabel,requiresYMCA,registeredList:''});
            toast(`"${name}" posted!`,'success');
            ['pe-name','pe-date','pe-close','pe-hours','pe-max','pe-instructions','pe-label'].forEach(id=>{document.getElementById(id).value='';});
            document.getElementById('pe-assembly').checked=false;
            document.getElementById('pe-leadership').checked=false;
            document.getElementById('pe-ymca').checked=false;
            // Restore chapter label for chapter_rep
            if(S.role==='chapter_rep')document.getElementById('pe-chapter').value=S.chapData?.school||'';
            await loadDirectorData(getDirTrack(S.role)).catch(()=>{});
            viewDirectorPanel('post-event');
        } catch(e){err.textContent=e.message;}
        btn.disabled=false;btn.textContent='📅 Post Event';
    });

    document.querySelectorAll('.ev-edit-btn').forEach(btn=>{
        btn.onclick=()=>{
            const name=btn.dataset.name;
            const r=(S.data.upcomingEvents||[]).find(row=>(row[0]||'').trim()===name.trim());
            if(r)showEditEvent(r);
        };
    });

    document.querySelectorAll('.ev-startnow-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const name=btn.dataset.name;
            if(!confirm(`Start "${name}" now?\n\nThis will close registration immediately.`))return;
            btn.disabled=true;btn.textContent='Starting…';
            try {
                await postAction('edit_event',{eventName:name,fields:{signupCloseDate:localYesterday()}});
                toast(`Registration closed — "${name}" has started.`,'success');
                await loadDirectorData(getDirTrack(S.role)).catch(()=>{});
                viewDirectorPanel('post-event');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='▶ Start Now';}
        };
    });

    document.querySelectorAll('.ev-finishearly-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const name=btn.dataset.name;
            if(!confirm(`Mark "${name}" as finished early?\n\nThis sets the event date and signup close to yesterday.`))return;
            btn.disabled=true;btn.textContent='Finishing…';
            try {
                await postAction('edit_event',{eventName:name,fields:{eventDate:localYesterday(),signupCloseDate:localYesterday()}});
                toast(`"${name}" marked as completed.`,'success');
                await loadDirectorData(getDirTrack(S.role)).catch(()=>{});
                viewDirectorPanel('post-event');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✓ Finish Early';}
        };
    });
}

function showEditEvent(r) {
    const name=r[0]||'';
    const html=`
        <div class="modal-header">
            <div class="modal-title">Edit Event</div>
            <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
            <div class="form-group mb-12">
                <div class="form-label" style="margin-bottom:4px">Event</div>
                <div style="font-weight:600;color:var(--text2)">${esc(name)}</div>
            </div>
            <div class="form-grid">
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label">Event Date &amp; Time</label>
                        <input class="form-input" type="datetime-local" id="ee-date" value="${esc(toDateTimeLocal(r[1]))}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Signup Close Date &amp; Time</label>
                        <input class="form-input" type="datetime-local" id="ee-close" value="${esc(toDateTimeLocal(r[8]))}">
                    </div>
                </div>
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label">Hours Credit</label>
                        <input class="form-input" type="number" id="ee-hours" value="${esc(r[2]||'')}" min="0" step="0.5">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Max Volunteers</label>
                        <input class="form-input" type="number" id="ee-max" value="${esc(r[6]||'')}" min="1">
                    </div>
                </div>
                ${colorDecoPickerHTML('ee-color','ee-deco','ee-color-row','ee-deco-row',r[11]||'',r[12]||'')}
                <div class="form-group">
                    <label class="form-label">Card Label <span style="font-weight:400;color:var(--textm)">(optional badge)</span></label>
                    <input class="form-input" id="ee-label" value="${esc(r[13]||'')}" placeholder="e.g. Priority · New" maxlength="30">
                    ${labelPresetsHTML('ee-label')}
                </div>
                <div class="form-group">
                    <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
                        <input type="checkbox" id="ee-ymca" style="width:16px;height:16px;accent-color:var(--gold)"${isChecked(r[14])?' checked':''}>
                        🏕️ Requires YMCA Form
                    </label>
                </div>
                <div class="form-group">
                    <label class="form-label">Chapter Label</label>
                    ${buildChapComboHTML('ee-chapter',r[10]||'')}
                </div>
                <div class="form-group">
                    <label class="form-label">Instructions</label>
                    <textarea class="form-textarea" id="ee-instructions" style="min-height:80px">${esc(r[9]||'')}</textarea>
                </div>
                <div class="form-err" id="ee-err"></div>
                <button class="btn btn-primary" id="ee-submit-btn">Save Changes</button>
            </div>
        </div>`;
    const close=openModal(html);
    initChapCombo('ee-chapter', r[10]||'', false);
    initColorDecoPickerEvents('ee-color','ee-deco','ee-color-row','ee-deco-row');
    initLabelPresets('ee-label');
    document.getElementById('ee-submit-btn').addEventListener('click',async()=>{
        const eventDate=document.getElementById('ee-date').value;
        const signupCloseDate=document.getElementById('ee-close').value;
        const hours=document.getElementById('ee-hours').value;
        const maxVolunteers=document.getElementById('ee-max').value;
        const chapterLabel=document.getElementById('ee-chapter').value.trim();
        const instructions=document.getElementById('ee-instructions').value;
        const cardColor=document.getElementById('ee-color').value;
        const cardDeco=document.getElementById('ee-deco').value;
        const cardLabel=document.getElementById('ee-label').value.trim();
        const requiresYMCA=document.getElementById('ee-ymca').checked?'TRUE':'FALSE';
        const err=document.getElementById('ee-err');
        if(!eventDate){err.textContent='Event date is required.';return;}
        err.textContent='';
        const btn=document.getElementById('ee-submit-btn');
        btn.disabled=true;btn.textContent='Saving…';
        try {
            await postAction('edit_event',{eventName:name,fields:{eventDate,signupCloseDate,hours,maxVolunteers,chapterLabel,instructions,cardColor,cardDeco,cardLabel,requiresYMCA}});
            toast(`"${name}" updated!`,'success');
            close();
            await loadDirectorData(getDirTrack(S.role)).catch(()=>{});
            viewDirectorPanel('post-event');
        } catch(e){err.textContent=e.message;btn.disabled=false;btn.textContent='Save Changes';}
    });
}

/* ═══════════════════════════════════════════════════════════════
   DIRECTOR: GIVE EVENT HOURS
   ═══════════════════════════════════════════════════════════════ */
function dirGiveEventHoursHTML() {
    const events=(S.data.upcomingEvents||[]).slice().reverse();
    if(!events.length)return mascotEmpty('No upcoming events yet','Post upcoming events first, then give hours after they happen.');
    const allVols=S.data.allVolunteers||[];
    const discordMap={};
    allVols.forEach(v=>{discordMap[v.name.toLowerCase()]=v.discord;});

    const cards=events.map(r=>{
        const name=r[0]||'';
        const closeDate=r[8]||'';
        const evDate=r[1]||'';
        const regList=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean);
        const credited=(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean);
        const alreadyGiven=credited.length>0;
        const done=isCompleted(evDate);
        const closed=closeDate&&toDateStr(closeDate)<localToday();
        // Only show events that are done or registration closed
        if(!done&&!closed)return'';
        const volChips=regList.map(n=>{
            const disc=discordMap[n.toLowerCase()]||'';
            const dirR=getDirRoleForName(n);
            const roleBadge=dirR?`<span class="slot-role-badge">${roleLabel(dirR)}</span>`:'';
            return `<span class="give-hrs-chip" data-vol="${esc(n)}">
                ${esc(n)}${disc?' · @'+esc(disc):''}${roleBadge}
                <button class="remove-vol-btn" title="Mark as no-show">✕</button>
            </span>`;
        }).join('');
        const creditedChips=credited.map(n=>`<span class="vol-chip chip-credited">${esc(n)}</span>`).join('');
        return `<div class="curr-card ev-card">
            <div class="curr-header">
                <div style="flex:1;min-width:0">
                    <div class="curr-title">${esc(name)}</div>
                    <div class="curr-meta">${fmtDateTimeStr(evDate)} · ${esc(r[2]||'0')}h credit · ${regList.length} registered</div>
                </div>
                <div style="flex-shrink:0">
                    ${done?'<span class="curr-done-badge">✅ Completed</span>':'<span class="curr-lock-badge">🔒 Closed</span>'}
                </div>
            </div>
            ${regList.length?`<div class="vol-chip-row mt-10" data-event="${esc(name)}"><div class="muted text-small mb-4" style="width:100%">Will receive hours (click ✕ to exclude no-shows):</div>${volChips}</div>`:'<div class="muted text-small mt-8">No volunteers registered.</div>'}
            ${alreadyGiven?`<div class="vol-chips mt-8"><div class="muted text-small mb-4">Already given to:</div>${creditedChips}</div>`:''}
            ${regList.length?`<button class="btn ${alreadyGiven?'btn-ghost':'btn-primary'} btn-sm mt-12 give-ev-hrs-btn" data-name="${esc(name)}">${alreadyGiven?'↻ Re-give Event Hours':'🎓 Give Event Hours'}</button>`:''}
        </div>`;
    }).filter(Boolean).join('');

    return `<div class="card mb-16" style="border-color:rgba(251,191,36,.2)">
        <div class="muted text-small" style="line-height:1.7"><strong style="color:var(--gold)">How Give Event Hours works:</strong> Click ✕ to mark no-shows. Then click "Give Event Hours" to credit attending volunteers. Only events that have passed or are closed for registration are shown.</div>
    </div>${cards||mascotEmpty('No completed events yet','Events appear here after the event date passes or registration closes.')}`;
}

function attachGiveEventHoursEvents() {
    document.querySelectorAll('.give-hrs-chip .remove-vol-btn').forEach(rmBtn=>{
        rmBtn.addEventListener('click',e=>{
            e.stopPropagation();
            rmBtn.closest('.give-hrs-chip').classList.toggle('vol-excluded');
        });
    });
    document.querySelectorAll('.give-ev-hrs-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const eventName=btn.dataset.name;
            const chipRow=document.querySelector(`.vol-chip-row[data-event="${CSS.escape(eventName)}"]`);
            const finalAttendees=chipRow
                ?[...chipRow.querySelectorAll('.give-hrs-chip:not(.vol-excluded)')].map(c=>(c.dataset.vol||'').trim()).filter(Boolean)
                :[];
            const attendeesStr=finalAttendees.join(', ');
            if(!confirm(`Give hours to ${finalAttendees.length} volunteer(s) for "${eventName}"?`))return;
            btn.disabled=true;btn.textContent='Giving hours…';
            try {
                await postAction('give_event_hours',{eventName,attendees:attendeesStr,givenBy:S.user?.name||'Director',givenDate:new Date().toISOString()});
                toast('Event hours given!','success');
                S.data.lbReady=false;
                await loadDirectorData(getDirTrack(S.role)).catch(()=>{});
                viewDirectorPanel('give-event-hours');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='🎓 Give Event Hours';}
        };
    });
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: MY CHAPTER
   ═══════════════════════════════════════════════════════════════ */
function viewMyChapter() {
    const root=document.getElementById('view-root');
    // For chapter_rep, use chapData.school; for volunteers, use user.school
    const rawSchool=S.role==='chapter_rep'?(S.chapData?.school||''):(S.user?.school||'');
    const userSchool=rawSchool.trim().toLowerCase();
    const chapters=S.data.chapters||[];
    // Find chapter rep for user's school
    const chapEntry=chapters.find(r=>(r[2]||'').trim().toLowerCase()===userSchool);
    if(!userSchool||!chapEntry){
        root.innerHTML=`
            <div class="view-header">
                <div>
                    <div class="view-title">My Chapter 🏫</div>
                    <div class="view-subtitle">Chapter information for your school</div>
                </div>
            </div>
            <div class="card">
                ${mascotEmpty('No Chapter Set Up Yet',`No chapter rep has been assigned for ${esc(S.user?.school||'your school')} yet. Contact your DOO or President to get one assigned.`)}
            </div>`;
        return;
    }

    const chapRepName=(chapEntry[1]||'').trim();
    const chapSchool=(chapEntry[2]||'').trim();

    // Chapter-local upcoming events
    const chapEvents=(S.data.upcomingEvents||[]).filter(r=>(r[10]||'').trim().toLowerCase()===userSchool);

    // Chapter members (volunteers with same school)
    const chapMembers=(S.data.allVolunteers||[]).filter(v=>(v.school||'').trim().toLowerCase()===userSchool);

    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">My Chapter 🏫</div>
                <div class="view-subtitle">${esc(chapSchool)} chapter</div>
            </div>
        </div>
        <div class="card chapter-rep-card mb-20">
            <div class="sb-av" style="width:48px;height:48px;flex-shrink:0">${avHTML(chapRepName,'',48)}</div>
            <div>
                <div style="font-size:10px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:.08em">Chapter Representative</div>
                <div style="font-weight:700;font-size:16px;margin-top:2px">${esc(chapRepName)}</div>
                <div style="font-size:12px;color:var(--textm);margin-top:2px">${esc(chapSchool)}</div>
            </div>
        </div>
        <div class="section-title">CHAPTER EVENTS (${chapEvents.length})</div>
        ${chapEvents.length
            ?chapEvents.map(r=>{
                const closed=(r[8]&&toDateStr(r[8])<localToday());
                return `<div class="curr-card ev-card">
                    <div class="curr-title">${esc(r[0]||'')}</div>
                    <div class="curr-meta">${fmtDateTimeStr(r[1])} · ${esc(r[2]||'0')}h ${closed?'· Closed':''}</div>
                    ${r[9]?`<div class="muted text-small mt-4" style="font-size:12px">${esc(r[9]).slice(0,100)}</div>`:''}
                </div>`;
            }).join('')
            :'<div class="card"><div class="muted text-small">No chapter-specific events yet.</div></div>'}
        <div class="section-title mt-20">CHAPTER MEMBERS (${chapMembers.length})</div>
        <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>Volunteer</th><th>Track</th></tr></thead>
            <tbody>
                ${chapMembers.map(v=>`<tr>
                    <td><div class="td-name">${esc(v.name)}</div>${v.discord?`<div class="td-sub">@${esc(v.discord)}</div>`:''}</td>
                    <td>${trackPill(v.track||'')}</td>
                </tr>`).join('')||'<tr><td colspan="2" class="muted text-small" style="text-align:center;padding:20px">No members found.</td></tr>'}
            </tbody>
        </table>
        </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW TOGGLE: DIRECTOR <-> VOLUNTEER
   ═══════════════════════════════════════════════════════════════ */
async function switchToVolunteerView() {
    if(!S.volUser){toast('No volunteer record linked to this director account.','error');return;}
    // Save director user
    S._dirUser=S.user;
    // Switch to volunteer
    S.user=S.volUser;
    S.role='volunteer';
    showLoading();
    try {
        await loadVolunteerData(S.user.name);
        hideLoading();
        renderSidebar();
        renderUserInfo();
        navigate('dashboard');
    } catch(e){hideLoading();toast(e.message,'error');}
}

async function switchToDirectorView() {
    if(!S._dirUser){return;}
    S.user=S._dirUser;
    S.role=S.dirRole;
    showLoading();
    try {
        await loadDirectorData(getDirTrack(S.role));
        hideLoading();
        renderSidebar();
        renderUserInfo();
        navigate('dashboard');
    } catch(e){hideLoading();toast(e.message,'error');}
}

/* ═══════════════════════════════════════════════════════════════
   CHAPTER COMBO (searchable dropdown)
   ═══════════════════════════════════════════════════════════════ */
function buildChapComboHTML(prefix, currentVal) {
    const label=currentVal||'None (org-wide)';
    return `<div class="chap-combo" id="${prefix}-wrap">
        <div class="form-input chap-combo-trigger" id="${prefix}-trigger" tabindex="0">
            <span id="${prefix}-display">${esc(label)}</span>
            <span class="chap-combo-caret">▾</span>
        </div>
        <div class="chap-combo-panel" id="${prefix}-panel" style="display:none">
            <input class="chap-combo-search" id="${prefix}-search" placeholder="Search chapters…" autocomplete="off">
            <div class="chap-combo-opts" id="${prefix}-opts"></div>
        </div>
        <input type="hidden" id="${prefix}" value="${esc(currentVal||'')}">
    </div>`;
}

function initChapCombo(prefix, currentVal, isDisabled) {
    const trigger=document.getElementById(`${prefix}-trigger`);
    const panel  =document.getElementById(`${prefix}-panel`);
    const display=document.getElementById(`${prefix}-display`);
    const search =document.getElementById(`${prefix}-search`);
    const optsEl =document.getElementById(`${prefix}-opts`);
    const hidden =document.getElementById(prefix);
    if(!trigger||!panel||!optsEl||!hidden)return;
    if(isDisabled){trigger.style.opacity='0.65';trigger.style.cursor='default';trigger.style.pointerEvents='none';return;}

    const chapters=S.data.chapters||[];
    const schools=[...new Set(chapters.map(r=>(r[2]||'').trim()).filter(Boolean))].sort();
    const options=[{val:'',label:'None (org-wide)'},...schools.map(s=>({val:s,label:s}))];

    function renderOpts(q){
        const lower=(q||'').toLowerCase();
        const filtered=lower?options.filter(o=>o.label.toLowerCase().includes(lower)):options;
        optsEl.innerHTML=filtered.length
            ?filtered.map(o=>`<div class="chap-combo-opt${o.val===hidden.value?' selected':''}" data-val="${esc(o.val)}">${esc(o.label)}</div>`).join('')
            :'<div class="chap-combo-opt chap-combo-none">No chapters found</div>';
        optsEl.querySelectorAll('.chap-combo-opt:not(.chap-combo-none)').forEach(opt=>{
            opt.addEventListener('click',()=>{
                hidden.value=opt.dataset.val;
                display.textContent=opt.dataset.val||'None (org-wide)';
                closePanel();
            });
        });
    }

    let _outside=null;
    function openPanel(){
        panel.style.display='block';
        search.value='';
        renderOpts('');
        setTimeout(()=>search.focus(),10);
        trigger.classList.add('open');
        if(_outside)document.removeEventListener('click',_outside);
        _outside=e=>{if(!document.getElementById(`${prefix}-wrap`)?.contains(e.target))closePanel();};
        setTimeout(()=>document.addEventListener('click',_outside),0);
    }
    function closePanel(){
        panel.style.display='none';
        trigger.classList.remove('open');
        if(_outside){document.removeEventListener('click',_outside);_outside=null;}
    }

    trigger.addEventListener('click',e=>{e.stopPropagation();panel.style.display==='none'?openPanel():closePanel();});
    trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPanel();}if(e.key==='Escape')closePanel();});
    search.addEventListener('input',()=>renderOpts(search.value));
    search.addEventListener('click',e=>e.stopPropagation());
}

/* ═══════════════════════════════════════════════════════════════
   ACTIVITY NOTIFICATION HELPERS
   ═══════════════════════════════════════════════════════════════ */
function _actSeenKey(){return'cc_seen_act_'+((S.user||{}).email||S.role||'anon');}
function getNewActivitiesCount(){
    const curr=(S.data.curriculum||[]).length+(S.data.upcomingEvents||[]).length;
    const seen=parseInt(localStorage.getItem(_actSeenKey())||'0',10);
    return Math.max(0,curr-seen);
}
function markActivitiesSeen(){
    const curr=(S.data.curriculum||[]).length+(S.data.upcomingEvents||[]).length;
    localStorage.setItem(_actSeenKey(),String(curr));
    document.querySelectorAll('.sb-item[data-view="activities"] .sb-notif-badge').forEach(b=>b.remove());
}

/* ═══════════════════════════════════════════════════════════════
   REFRESH DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
async function refreshDashboard(){
    showLoading();
    try{
        if(S.role==='volunteer'){
            await loadVolunteerData(S.user.name);
        } else {
            await loadDirectorData(getDirTrack(S.role));
        }
        hideLoading();
        renderSidebar();
        navigate('dashboard');
        toast('Dashboard refreshed');
    }catch(e){hideLoading();toast(e.message,'error');}
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: CALENDAR
   ═══════════════════════════════════════════════════════════════ */
async function viewCalendar(){
    const root=document.getElementById('view-root');
    root.innerHTML=`<div class="view-header"><div><div class="view-title">📅 Calendar</div></div></div><div class="cal-loading">Loading calendar…</div>`;
    let rows=[];
    try{rows=await fetchSheet(CONFIG.CALENDAR_SHEET||'Calendar');}
    catch(e){root.innerHTML+='<div class="card"><p class="muted">Could not load calendar: '+esc(e.message)+'</p></div>';return;}

    // Parse rows: row 0 is header, rest are [Date, Notes]
    const entries=[];
    rows.slice(1).forEach(r=>{
        const raw=(r[0]||'').trim();if(!raw)return;
        // Accept YYYY-MM-DD or M/D/YYYY or MM/DD/YYYY
        let d=null;
        if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){d=new Date(raw+'T00:00:00');}
        else{const p=new Date(raw);if(!isNaN(p))d=p;}
        if(!d||isNaN(d))return;
        entries.push({date:d,notes:(r[1]||'').trim()});
    });

    if(!entries.length){
        root.innerHTML=root.innerHTML.replace('<div class="cal-loading">Loading calendar…</div>','');
        root.innerHTML+=`<div class="card"><p class="muted text-center">No calendar entries yet. Add rows to the <strong>Calendar</strong> sheet: Date (YYYY-MM-DD) in column A, Notes in column B.</p></div>`;
        return;
    }

    // Group by year-month
    const months={};
    entries.forEach(e=>{
        const key=e.date.getFullYear()+'-'+String(e.date.getMonth()+1).padStart(2,'0');
        if(!months[key])months[key]={year:e.date.getFullYear(),month:e.date.getMonth(),days:{}};
        months[key].days[e.date.getDate()]=(months[key].days[e.date.getDate()]||[]);
        months[key].days[e.date.getDate()].push(e.notes);
    });

    const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today=new Date();

    let html=`<div class="view-header"><div><div class="view-title">📅 Calendar</div><div class="view-subtitle">Curio Crate schedule</div></div></div>`;

    Object.keys(months).sort().forEach(key=>{
        const {year,month,days}=months[key];
        const firstDay=new Date(year,month,1).getDay(); // 0=Sun
        const totalDays=new Date(year,month+1,0).getDate();

        let cells=[];
        // leading empty cells
        for(let i=0;i<firstDay;i++)cells.push('');
        for(let d=1;d<=totalDays;d++){
            const noteList=(days[d]||[]).filter(Boolean);
            const isToday=today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===d;
            cells.push({d,notes:noteList,today:isToday});
        }
        // pad to full weeks
        while(cells.length%7!==0)cells.push('');

        const rows2=[];
        for(let i=0;i<cells.length;i+=7)rows2.push(cells.slice(i,i+7));

        html+=`<div class="cal-month-block">
            <div class="cal-month-title">${MONTH_NAMES[month]} ${year}</div>
            <div class="cal-grid">
                ${DAY_NAMES.map(d=>`<div class="cal-day-header">${d}</div>`).join('')}
                ${rows2.map(row=>row.map(cell=>{
                    if(cell==='')return'<div class="cal-cell cal-cell-empty"></div>';
                    const {d,notes,today:isToday}=cell;
                    const noteHtml=notes.map(n=>`<div class="cal-note">${esc(n)}</div>`).join('');
                    return`<div class="cal-cell${isToday?' cal-today':''}${notes.length?' cal-has-notes':''}">
                        <div class="cal-date-num">${d}</div>
                        ${noteHtml}
                    </div>`;
                }).join('')).join('')}
            </div>
        </div>`;
    });

    root.innerHTML=html;
}

/* ═══════════════════════════════════════════════════════════════
   TUTORIAL / ONBOARDING WALKTHROUGH
   ═══════════════════════════════════════════════════════════════ */
const TUTO_KEY='cc_tutorial_v1';
let _tutoStep=0;

const TUTORIAL_STEPS=[
    {
        target:null,
        title:'👋 Welcome to Curio Crate!',
        body:'This is the <strong>Volunteer Portal</strong> — your hub for tracking hours, signing up for assignments, and climbing the leaderboard.<br><br>Let me walk you through the key features. Takes about a minute!',
    },
    {
        target:'#sb-nav',
        title:'📍 Sidebar Navigation',
        body:'The <strong>sidebar</strong> on the left is how you get around. Click any item to switch sections.',
    },
    {
        target:'.sb-item[data-view="dashboard"]',
        title:'🏠 Dashboard',
        body:'Your <strong>Dashboard</strong> shows a quick summary: total hours, assignments completed, events attended, and your current volunteer tier.',
    },
    {
        target:'.sb-item[data-view="activities"]',
        title:'📚 Activities',
        body:'Browse <strong>Activities</strong> to find open curriculum assignments and upcoming events. Click a card to sign up, view instructions, or check your status.',
    },
    {
        target:'.sb-item[data-view="leaderboard"]',
        title:'🥇 Leaderboard',
        body:'The <strong>Leaderboard</strong> ranks all volunteers by total hours. Track your placement and see who\'s leading the pack!',
    },
    {
        target:'#sb-user',
        title:'👤 Your Profile',
        body:'Your <strong>name and volunteer track</strong> appear here. Use the "Change your preferences" link below to update your track at any time.',
    },
    {
        target:null,
        title:'🎉 You\'re all set!',
        body:'That covers the essentials! You can replay this tour anytime by clicking <strong>"✨ First Time?"</strong> at the bottom of the sidebar.<br><br>Happy volunteering! 🌟',
    },
];

function startTutorial(force){
    if(!force&&localStorage.getItem(TUTO_KEY))return;
    _tutoStep=0;
    _renderTutoStep();
}

function _clearTuto(){
    document.getElementById('tuto-bd')?.remove();
    document.getElementById('tuto-card')?.remove();
    document.querySelectorAll('.tuto-highlight').forEach(el=>el.classList.remove('tuto-highlight'));
    // Restore sidebar z-index if we boosted it
    document.querySelector('.sidebar[data-tuto-z]')?.removeAttribute('data-tuto-z');
    document.querySelector('.sidebar')?.style.removeProperty('z-index');
}

function _renderTutoStep(){
    _clearTuto();

    const step=TUTORIAL_STEPS[_tutoStep];
    const total=TUTORIAL_STEPS.length;
    const isFirst=_tutoStep===0;
    const isLast=_tutoStep===total-1;

    const dots=Array.from({length:total},(_,i)=>`<span class="tuto-dot${i===_tutoStep?' active':''}"></span>`).join('');

    // Backdrop — separate element at z-index 8900
    const bd=document.createElement('div');
    bd.id='tuto-bd';
    bd.className='tuto-backdrop';
    document.body.appendChild(bd);

    // Card — separate element at z-index 9400 (above any stacking context we boost)
    const card=document.createElement('div');
    card.id='tuto-card';
    card.className='tuto-card tuto-card-center';
    card.tabIndex=-1;
    card.innerHTML=`
<div class="tuto-step-lbl">Step ${_tutoStep+1} of ${total}</div>
<div class="tuto-title">${step.title}</div>
<div class="tuto-body">${step.body}</div>
<div class="tuto-dots">${dots}</div>
<div class="tuto-actions">
    <button class="tuto-skip" type="button">Skip tour</button>
    <div class="tuto-nav">
        ${!isFirst?'<button class="tuto-prev" type="button">← Back</button>':'<span></span>'}
        <button class="tuto-next" type="button">${isLast?'Finish! 🎉':'Next →'}</button>
    </div>
</div>`;
    document.body.appendChild(card);

    // Highlight target and position card beside it
    if(step.target){
        const targetEl=document.querySelector(step.target);
        if(targetEl){
            targetEl.classList.add('tuto-highlight');
            // Boost the sidebar's stacking context above the backdrop so
            // sidebar items are visually spotlit through the dark overlay
            const sb=targetEl.closest('.sidebar');
            if(sb){sb.setAttribute('data-tuto-z','1');sb.style.zIndex='9200';}
            // Position card to the right of the target
            const rect=targetEl.getBoundingClientRect();
            const ch=card.offsetHeight||200;
            let top=rect.top+rect.height/2-ch/2;
            top=Math.max(16,Math.min(top,window.innerHeight-ch-16));
            const left=rect.right+14;
            const maxW=Math.min(292,window.innerWidth-left-16);
            card.className='tuto-card tuto-has-arrow';
            card.style.cssText=`top:${top}px;left:${left}px;max-width:${maxW}px`;
        }
    }

    // Wire events
    bd.onclick=_endTutorial;
    card.querySelector('.tuto-skip').onclick=_endTutorial;
    card.querySelector('.tuto-next').onclick=()=>isLast?_endTutorial():(_tutoStep++,_renderTutoStep());
    card.querySelector('.tuto-prev')?.addEventListener('click',()=>{_tutoStep--;_renderTutoStep();});
    card.onkeydown=e=>{
        if(e.key==='Escape')_endTutorial();
        if(e.key==='ArrowRight'&&!isLast){_tutoStep++;_renderTutoStep();}
        if(e.key==='ArrowLeft'&&!isFirst){_tutoStep--;_renderTutoStep();}
    };
    card.focus();
}

function _endTutorial(){
    _clearTuto();
    localStorage.setItem(TUTO_KEY,'1');
}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
    initAuth().catch(e=>showAuthError(e.message));
});
