/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
const S = {
    user:   null,   // { name, email, track, tier, discord, school, avatar, lead, onTimeRate, lastContact }
    role:   null,   // 'volunteer' | 'doc' | 'doo' | 'dop' | 'president'
    view:   null,
    subTab: null,
    data:   {},     // { curriculum, events, allVolunteers, volunteers, lbData, lbReady, myStats, myRegistrations }
    lbCat:  'hours',
    lbPrevRanks: {},
};

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
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
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
                if(S.view==='curriculum'){
                    const tab=document.querySelector('#curr-tabs .panel-tab.active')?.dataset.tab||'open';
                    renderCurrList(tab);
                    startCountdownTimers();
                } else if(S.view==='dashboard'){
                    viewDashboard();
                }
            } else if(S.role&&S.role!=='volunteer'){
                const track=S.role==='president'?'All':(CONFIG.DIRECTORS[S.role]||{}).track||'';
                await loadDirectorData(track);
                if(S.view==='director'){
                    const tab=document.querySelector('#dir-tabs .panel-tab.active')?.dataset.tab||'roster';
                    // Only re-render read-only tabs; form tabs would reset user input
                    if(tab==='roster')renderDirPanel(tab);
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
    const url=`https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok)throw new Error(`Sheet "${name}": HTTP ${res.status}`);
    return parseCSV(await res.text());
}

async function postAction(action,payload) {
    if(!CONFIG.APPS_SCRIPT_URL){
        toast('Write operations require Apps Script URL in config.js','error');
        throw new Error('APPS_SCRIPT_URL not configured');
    }
    const body=JSON.stringify({action,...payload});
    const res=await fetch(CONFIG.APPS_SCRIPT_URL,{method:'POST',body,headers:{'Content-Type':'text/plain'}});
    let data;
    try{data=await res.json();}catch(_){return;} // non-JSON response is fine
    if(data&&data.ok===false)throw new Error(data.error||'Server returned an error');
}

async function loadVolunteerData(name) {
    const [currRows,evRows,volRows]=await Promise.all([
        fetchSheet(CONFIG.CURRICULUM_SHEET_NAME).catch(()=>[]),
        fetchSheet(CONFIG.EVENTS_SHEET_NAME).catch(()=>[]),
        fetchSheet(CONFIG.SHEET_NAME).catch(()=>[]),
    ]);
    S.data.curriculum=currRows.slice(1).filter(r=>r[0]);
    S.data.events=evRows.slice(1).filter(r=>r[0]);
    S.data.allVolunteers=volRows.slice(1).filter(r=>r[0]).map(r=>({
        name:(r[0]||'').trim(),discord:(r[1]||'').trim(),
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
    S.data.myRegistrations=S.data.curriculum.filter(r=>{
        const reg=(r[7]||'').split(',').map(n=>n.trim().toLowerCase());
        const cred=(r[3]||'').split(',').map(n=>n.trim().toLowerCase());
        return reg.includes(lower)&&!cred.includes(lower);
    });
}

async function loadDirectorData(track) {
    const [volRows,currRows,evRows]=await Promise.all([
        fetchSheet(CONFIG.SHEET_NAME),
        fetchSheet(CONFIG.CURRICULUM_SHEET_NAME).catch(()=>[]),
        fetchSheet(CONFIG.EVENTS_SHEET_NAME).catch(()=>[]),
    ]);
    const currData=currRows.slice(1).filter(r=>r[0]);
    const evData=evRows.slice(1).filter(r=>r[0]);
    const all=volRows.slice(1).map(r=>({
        name:(r[0]||'').trim(),discord:(r[1]||'').trim(),school:(r[2]||'').trim(),
        avatar:(r[3]||'').trim(),email:(r[4]||'').trim(),track:deriveTrack(r[5],r[9]),
        tier:(r[6]||'').trim()||'1',lead:(r[7]||'').trim(),
        onTimeRate:parseFloat(r[10])||null,lastContact:(r[11]||'').trim(),
        hours:0,curricCount:0,eventsCount:0,
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
function parseURLParams() {
    const p=new URLSearchParams(window.location.search);
    return{role:p.get('role')};
}

async function initAuth() {
    const{role}=parseURLParams();
    if(role){showRoleAuth(role);}else{showLanding();}
}

function initGoogleSignIn() {
    if(typeof google==='undefined'){setTimeout(initGoogleSignIn,200);return;}
    google.accounts.id.initialize({
        client_id:CONFIG.GOOGLE_CLIENT_ID,
        callback:handleGoogleSignIn,
        auto_select:true,
        cancel_on_tap_outside:false,
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
        const rows=await fetchSheet(CONFIG.SHEET_NAME);
        const emailCol=CONFIG.EMAIL_COL??4;
        const row=rows.slice(1).find(r=>(r[emailCol]||'').trim().toLowerCase()===email);
        if(!row){hideLoading();showNotRegistered(email,payload.picture);return;}
        S.user={
            name:(row[0]||'').trim(),email,
            discord:(row[1]||'').trim(),school:(row[2]||'').trim(),
            avatar:payload.picture||(row[3]||'').trim(),
            track:deriveTrack(row[5],row[9]),
            tier:(row[6]||'').trim()||'1',
            lead:(row[7]||'').trim(),
            onTimeRate:parseFloat(row[10])||null,
            lastContact:(row[11]||'').trim(),
        };
        S.role='volunteer';
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
            <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);width:100%;margin-top:4px">
            <p class="auth-desc" style="font-size:11px;margin-bottom:-4px">Director or President? Sign in here:</p>
            <div class="auth-role-row">
                <button class="auth-role-btn" data-role="doc">📚 DOC</button>
                <button class="auth-role-btn" data-role="doo">🎓 DOO</button>
                <button class="auth-role-btn" data-role="dop">📣 DOP</button>
                <button class="auth-role-btn" data-role="president">👑 Pres</button>
            </div>
        </div>`;
    initGoogleSignIn();
    document.querySelectorAll('.auth-role-btn').forEach(btn=>{
        btn.onclick=()=>showRoleAuth(btn.dataset.role);
    });
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

function showRoleAuth(role) {
    const labels={doc:'Director of Curriculum',doo:'Director of Operations',dop:'Director of Publicity',president:'President'};
    const icons={doc:'📚',doo:'🎓',dop:'📣',president:'👑'};
    document.getElementById('auth-title').textContent=`${icons[role]||''} ${labels[role]||role}`;
    document.getElementById('auth-body').innerHTML=`
        <div class="auth-body">
            <label class="auth-label">Director Code</label>
            <input class="auth-input" id="dir-code-input" type="password" placeholder="Enter access code…" autocomplete="off">
            <button class="auth-btn" id="dir-auth-btn">Unlock Dashboard</button>
            <div class="auth-err" id="auth-err-msg"></div>
            <p class="auth-back" id="auth-back">← Back</p>
        </div>`;
    const input=document.getElementById('dir-code-input');
    const tryCode=()=>{
        const code=input.value.trim();
        if(code===CONFIG.DIRECTOR_CODES[role]){
            S.role=role;
            S.user={name:(CONFIG.DIRECTORS[role]||{}).name||labels[role],role,track:(CONFIG.DIRECTORS[role]||{}).track||''};
            launchDirectorPortal(role);
        } else {
            const err=document.getElementById('auth-err-msg');
            err.textContent='Incorrect code.';
            input.value='';input.focus();
            setTimeout(()=>{if(err)err.textContent='';},2500);
        }
    };
    document.getElementById('dir-auth-btn').onclick=tryCode;
    input.addEventListener('keydown',e=>{if(e.key==='Enter')tryCode();});
    document.getElementById('auth-back').onclick=showLanding;
    input.focus();
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
function launchPortal() {
    document.getElementById('auth-gate').style.display='none';
    document.getElementById('portal-shell').style.display='flex';
    hideLoading();
    renderSidebar();
    renderUserInfo();
    navigate('dashboard');
    setupMobileToggle();
    startPolling();
}

async function launchDirectorPortal(role) {
    showLoading();
    try {
        const track=role==='president'?'All':(CONFIG.DIRECTORS[role]||{}).track||'';
        await loadDirectorData(track);
        document.getElementById('auth-gate').style.display='none';
        document.getElementById('portal-shell').style.display='flex';
        hideLoading();
        renderSidebar();
        renderUserInfo();
        navigate('director');
        setupMobileToggle();
        startPolling();
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
function renderSidebar() {
    const nav=document.getElementById('sb-nav');
    const isDir=S.role!=='volunteer';
    const volItems=[
        {id:'dashboard',  icon:'🏠',label:'Dashboard'},
        {id:'curriculum', icon:'📚',label:'Assignments'}, // sub-tab defaults to "Available"
        {id:'progress',   icon:'📈',label:'My Progress'},
        {id:'leaderboard',icon:'🥇',label:'Leaderboard'},
    ];
    const dirItems=[
        {id:'dashboard',  icon:'🏠',label:'Overview'},
        {id:'director',   icon:'⚙️',label:'Director Panel'},
        {id:'leaderboard',icon:'🥇',label:'Leaderboard'},
    ];
    const items=isDir?dirItems:volItems;
    nav.innerHTML=items.map(it=>`<button class="sb-item${S.view===it.id?' active':''}" data-view="${it.id}">
        <span class="sb-icon">${it.icon}</span>
        <span>${it.label}</span>
    </button>`).join('');
    nav.querySelectorAll('.sb-item').forEach(btn=>{
        btn.onclick=()=>{navigate(btn.dataset.view);closeMobileSidebar();};
    });
}

function activateSidebarItem(view) {
    document.querySelectorAll('.sb-item').forEach(el=>{
        el.classList.toggle('active',el.dataset.view===view);
    });
}

const PALETTE=['#38bdf8','#a78bfa','#22d3ee','#f472b6','#fb923c','#34d399','#fbbf24','#818cf8'];
function avHTML(name,avatar,size) {
    if(avatar&&/^https?:\/\//.test(avatar)){
        const fb=initSVG(name,size).replace(/'/g,"\\'");
        return `<img src="${esc(avatar)}" alt="${esc(name)}" loading="lazy" onerror="this.outerHTML='${fb}'">`;
    }
    return initSVG(name,size);
}
function initSVG(name,size) {
    const color=PALETTE[(name||'').charCodeAt(0)%PALETTE.length];
    const inits=(name||'?').trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
    const fs=Math.round(size*.38);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${size/2}" fill="${color}1a"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="${color}" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="${fs}">${inits}</text>
    </svg>`;
}

function renderUserInfo() {
    const el=document.getElementById('sb-user');
    const u=S.user||{};
    const track=u.track?(CONFIG.TRACKS[u.track]||{}):{};
    el.innerHTML=`
        <div class="sb-av">${avHTML(u.name||'?',u.avatar,34)}</div>
        <div style="min-width:0">
            <div class="sb-name">${esc(u.name||'Director')}</div>
            <div class="sb-meta">${u.track?`${track.icon||''} ${u.track}`:(CONFIG.DIRECTORS[S.role]||{}).title||''} ${u.tier&&u.tier!=='Exec'?`· T${u.tier}`:(u.tier==='Exec'?'· Exec':'')}</div>
        </div>`;
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
        case 'curriculum':  viewCurriculum();break;
        case 'progress':    viewMyProgress();break;
        case 'leaderboard': viewLeaderboard();break;
        case 'director':    viewDirectorPanel(sub||'roster');break;
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

/* ═══════════════════════════════════════════════════════════════
   VIEW: DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function viewDashboard() {
    if(S.role!=='volunteer'){viewDirectorOverview();return;}
    const root=document.getElementById('view-root');
    const u=S.user||{};
    const track=u.track?(CONFIG.TRACKS[u.track]||{}):{};
    const stats=S.data.myStats||{totalHours:0,curricCount:0,eventsCount:0};
    const regs=S.data.myRegistrations||[];

    const regCards=regs.slice(0,3).map(r=>{
        const locked=isClosed(r[5],r[1]);
        const done=isCompleted(r[1]);
        const maxVols=parseInt(r[6])||0;
        const filled=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean).length;
        const startDate=r[5]||'';
        const countdown=formatCountdown(startDate);
        return `<div class="curr-card dash-assign-card" data-assign-name="${esc(r[0]||'')}" style="cursor:pointer">
            <div style="display:flex;align-items:flex-start;gap:12px">
                <div style="flex:1;min-width:0">
                    <div class="curr-title">${esc(r[0]||'Assignment')}</div>
                    <div class="curr-meta" style="margin-top:4px">📅 Due ${fmtDateTimeStr(r[1])} · ⏱ ${esc(String(r[2]||0))}h credit</div>
                    ${!locked&&startDate?`<div class="curr-signup-close" style="margin-top:5px">🔔 Closes ${fmtDateTimeStr(startDate)}</div>`:''}
                    ${done?`<div class="curr-waiting">⏳ Waiting for director to confirm hours</div>`:`<div style="font-size:11px;color:var(--textm);margin-top:5px">${filled}/${maxVols||'?'} slots filled</div>`}
                </div>
                <div style="flex-shrink:0">${done?'<span class="curr-done-badge">✅ Done</span>':locked?'<span class="curr-lock-badge">🔒 Locked</span>':`<span class="curr-countdown" data-lockdate="${esc(startDate)}">${esc(countdown)}</span>`}</div>
            </div>
        </div>`;
    }).join('');

    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">Welcome back, ${esc((u.name||'').split(' ')[0])} 👋</div>
                <div class="view-subtitle">${track.icon||''} ${u.track||'Curio Crate'} · ${tierBadge(u.tier)}</div>
            </div>
        </div>
        <div class="card-grid card-grid-4 mb-20">
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--blue-g)">⏱</div>
                <div><div class="stat-val">${stats.totalHours}</div><div class="stat-lbl">Total Hours</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--teal-g)">📚</div>
                <div><div class="stat-val" style="color:var(--teal)">${stats.curricCount}</div><div class="stat-lbl">Curriculum</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--violet-g)">🎓</div>
                <div><div class="stat-val" style="color:var(--violet)">${stats.eventsCount}</div><div class="stat-lbl">Events</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--gold-g)">✋</div>
                <div><div class="stat-val" style="color:var(--gold)">${regs.length}</div><div class="stat-lbl">Registered</div></div>
            </div>
        </div>
        <div>
            <div class="section-title">YOUR ACTIVE REGISTRATIONS</div>
            ${regs.length
                ? regCards+'<button class="btn btn-ghost btn-sm btn-full mt-8" onclick="navigate(\'curriculum\')">View all assignments →</button>'
                : '<div class="card"><div class="muted text-small">No active registrations yet.</div><button class="btn btn-ghost btn-sm mt-8" onclick="navigate(\'curriculum\')">Browse Assignments →</button></div>'}
        </div>`;
    // Clicking a registration card opens the detail modal
    root.querySelectorAll('.dash-assign-card').forEach(card=>{
        card.addEventListener('click',()=>{
            const name=card.dataset.assignName;
            const r=(S.data.curriculum||[]).find(row=>(row[0]||'').trim()===name.trim());
            if(r)showAssignmentDetail(r);
        });
    });
    startCountdownTimers();
}

function viewDirectorOverview() {
    const root=document.getElementById('view-root');
    const roleInfo=CONFIG.DIRECTORS[S.role]||{title:'Director',track:''};
    const assignments=S.data.curriculum||[];
    const events=S.data.events||[];
    const vols=S.data.volunteers||[];
    const openAssignments=assignments.filter(r=>!isLocked(r[5]));
    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">Overview 🏠</div>
                <div class="view-subtitle">${roleInfo.title} · ${roleInfo.track||'All Tracks'}</div>
            </div>
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
                    return `<div class="curr-card">
                        <div class="curr-title">${esc(r[0]||'')}</div>
                        <div class="curr-meta">Due ${fmtDate(r[1])} · ${filled}/${maxVols} slots · ${esc(formatCountdown(r[5]))}</div>
                    </div>`;
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
            :`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No assignments yet</div></div>`;
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
        listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No assignments here</div></div>`;
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
    return `<div class="curr-simple-row ${done?'done':''}" data-name="${esc(name)}" style="cursor:pointer">
        <span class="curr-simple-icon">${done?'✅':locked?'🔒':'📋'}</span>
        <div style="flex:1;min-width:0">
            <div class="curr-simple-name">${esc(name)}</div>
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
    return `<div class="curr-card ${cardCls} ${isCredited?'curr-credited':''} curr-clickable" data-name="${esc(name)}">
        <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="flex:1;min-width:0">
                <div class="curr-title">${esc(name)}</div>
                <div class="curr-meta" style="margin-top:5px">📅 Due ${fmtDateTimeStr(r[1])} · ⏱ ${esc(hours)}h credit</div>
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

    const html=`
        <div class="modal-header">
            <div class="modal-title">${esc(name)}</div>
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
    const u=S.user||{};
    const stats=S.data.myStats||{totalHours:0,curricCount:0,eventsCount:0};
    const currentTier=u.tier||'1';
    const tierOrder=[1,2,3,4];

    const tierHTML=tierOrder.map(tier=>{
        const t=CONFIG.TIERS[tier]||CONFIG.TIERS[1];
        const numTier=tier==='Exec'?999:parseInt(tier);
        const numCurrent=currentTier==='Exec'?999:parseInt(currentTier);
        const isCompleted=numCurrent>numTier;
        const isCurrent=String(tier)===String(currentTier);
        const isLocked_=numCurrent<numTier;
        let stateClass=isCompleted?'completed':isCurrent?'current':isLocked_?'locked':'';
        let statusHTML='';
        if(isCompleted)statusHTML='<span style="font-size:11px;font-weight:700;color:var(--green);background:var(--green-g);border:1px solid rgba(52,211,153,.3);border-radius:100px;padding:3px 10px">✓ Achieved</span>';
        else if(isCurrent)statusHTML='<span style="font-size:11px;font-weight:700;color:var(--blue);background:var(--blue-g);border:1px solid rgba(56,189,248,.3);border-radius:100px;padding:3px 10px">● Current</span>';
        const criteria=buildTierCriteria(tier,isCompleted,isCurrent,stats);
        const metCount=criteria.filter(c=>c.met).length;
        const criteriaHTML=!isLocked_?`<div class="criteria-list mt-12">`+
            criteria.map(c=>`<div class="criteria-item ${c.met?'met':''}"><div class="criteria-check">${c.met?'✓':''}</div><span>${c.label}</span></div>`).join('')+
            `</div>${!isCompleted?`<div class="progress-bar-wrap mt-12"><div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.round(metCount/Math.max(criteria.length,1)*100)}%"></div></div><div class="progress-bar-lbl">${metCount}/${criteria.length} criteria</div></div>`:''}`:
            `<div class="muted text-small mt-8">Achieve the previous tier first.</div>`;
        return `<div class="tier-step ${stateClass}">
            <div class="tier-step-header">
                <div class="tier-step-icon">${t.icon}</div>
                <div style="flex:1">
                    <div class="tier-step-name">${tierBadge(tier)}</div>
                    <div class="tier-step-lbl">${tier==='Exec'?'Invitation only':'Tier '+tier}</div>
                </div>
                ${statusHTML}
            </div>
            ${criteriaHTML}
        </div>`;
    }).join('');

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
        <div class="section-title">TIER JOURNEY</div>
        <div class="progress-journey">${tierHTML}</div>`;
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
    const isPresident=S.role==='president';
    const isDOO=S.role==='doo';
    const isDOC=S.role==='doc';
    const roleInfo=CONFIG.DIRECTORS[S.role]||{title:'Director',track:''};

    const tabs=[
        {id:'roster',          label:'👥 Roster'},
        ...(isDOC||isPresident?[{id:'post-assignment',label:'📋 Post Assignment'}]:[]),
        ...(isDOC||isPresident?[{id:'give-hours',     label:'✅ Give Hours'}]:[]),
        ...(isDOO||isPresident?[{id:'record-event',   label:'🎓 Record Event'}]:[]),
        ...(isPresident?       [{id:'manage-tiers',   label:'👑 Manage Tiers'}]:[]),
    ];

    root.innerHTML=`
        <div class="view-header">
            <div>
                <div class="view-title">${isPresident?'👑 President Dashboard':roleInfo.title}</div>
                <div class="view-subtitle">${roleInfo.track||'All Tracks'} · Director View</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="dir-refresh-btn">↺ Refresh</button>
        </div>
        <div class="panel-tabs" id="dir-tabs">
            ${tabs.map(t=>`<button class="panel-tab${t.id===activeTab?' active':''}" data-tab="${t.id}">${t.label}</button>`).join('')}
        </div>
        <div id="dir-panel-body"></div>`;

    document.getElementById('dir-refresh-btn').onclick=async()=>{
        const btn=document.getElementById('dir-refresh-btn');
        btn.disabled=true;btn.innerHTML='<span class="spinner"></span>';
        const track=isPresident?'All':(roleInfo.track||'');
        await loadDirectorData(track).catch(()=>{});
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
        case 'roster':          body.innerHTML=dirRosterHTML();       attachRosterEvents();      break;
        case 'post-assignment': body.innerHTML=dirPostAssignHTML();   attachPostAssignEvents();  break;
        case 'give-hours':      body.innerHTML=dirGiveHoursHTML();    attachGiveHoursEvents();   break;
        case 'record-event':    body.innerHTML=dirRecordEventHTML();  attachRecordEventEvents(); break;
        case 'manage-tiers':    body.innerHTML=dirManageTiersHTML();  attachManageTiersEvents(); break;
        default:                body.innerHTML=dirRosterHTML();       attachRosterEvents();
    }
}

/* ─── ROSTER ─────────────────────────────────────────────────── */
function dirRosterHTML() {
    const vols=S.data.volunteers||[];
    return `
        <div class="mb-12" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <input class="form-input" id="roster-search" placeholder="Search volunteer…" style="max-width:260px;padding:9px 12px;font-size:13px">
            <select class="form-select" id="roster-tier" style="max-width:160px;padding:9px 12px;font-size:13px">
                <option value="">All Tiers</option>
                ${Object.entries(CONFIG.TIERS).map(([k,t])=>`<option value="${k}">${t.name}</option>`).join('')}
            </select>
            <span class="muted text-small">${vols.length} volunteer${vols.length!==1?'s':''}</span>
        </div>
        <div class="table-wrap">
        <table class="data-table">
            <thead><tr>
                <th>Volunteer</th><th>Track</th><th>Tier</th>
                <th class="col-r">Hours</th><th class="col-r">Curriculum</th><th class="col-r">Events</th><th>Email</th>
            </tr></thead>
            <tbody id="roster-tbody">
                ${vols.map(v=>`<tr data-name="${esc(v.name.toLowerCase())}" data-tier="${esc(String(v.tier))}">
                    <td><div class="td-name">${esc(v.name)}</div>${v.discord?`<div class="td-sub">@${esc(v.discord)}</div>`:''}</td>
                    <td>${trackPill(v.track)}</td>
                    <td>${tierBadge(v.tier)}</td>
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
    const tierSel=document.getElementById('roster-tier');
    const filter=()=>{
        const q=(search?.value||'').toLowerCase(),tier=tierSel?.value||'';
        document.querySelectorAll('#roster-tbody tr').forEach(tr=>{
            const name=(tr.dataset.name||'');
            const tierMatch=!tier||(tr.dataset.tier===tier);
            tr.style.display=(!q||name.includes(q))&&tierMatch?'':'none';
        });
    };
    search?.addEventListener('input',filter);
    tierSel?.addEventListener('change',filter);
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
        return `<div class="curr-card">
            <div class="curr-header">
                <div style="flex:1;min-width:0">
                    <div class="curr-title">${esc(r[0]||'')}</div>
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
    document.getElementById('pa-submit-btn').onclick=async()=>{
        const name=document.getElementById('pa-name').value.trim();
        const slides=document.getElementById('pa-slides').value.trim();
        const due=document.getElementById('pa-due').value;
        const start=document.getElementById('pa-start').value;
        const hours=document.getElementById('pa-hours').value;
        const max=document.getElementById('pa-max').value;
        const instructions=document.getElementById('pa-instructions').value;
        const err=document.getElementById('pa-err');
        if(!name||!due||!start||!hours||!max||!instructions){err.textContent='All fields including instructions are required.';return;}
        err.textContent='';
        const btn=document.getElementById('pa-submit-btn');
        btn.disabled=true;btn.textContent='Posting…';
        try {
            await postAction('create_curriculum',{
                assignmentName:name,dueDate:due,hours,contributors:'',
                slidesLink:slides,startDate:start,maxVolunteers:max,
                registeredVolunteers:'',instructions,
            });
            toast(`"${name}" posted!`,'success');
            ['pa-name','pa-slides','pa-due','pa-start','pa-hours','pa-max','pa-instructions'].forEach(id=>{document.getElementById(id).value='';});
            const track=S.role==='president'?'All':(CONFIG.DIRECTORS[S.role]||{}).track||'';
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
                const track=S.role==='president'?'All':(CONFIG.DIRECTORS[S.role]||{}).track||'';
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
                const track=S.role==='president'?'All':(CONFIG.DIRECTORS[S.role]||{}).track||'';
                await loadDirectorData(track).catch(()=>{});
                viewDirectorPanel('post-assignment');
            } catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='✓ Finish Early';}
        };
    });
}

function showEditAssignment(r) {
    const name=r[0]||'';
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
                <div class="form-err" id="ed-err"></div>
                <button class="btn btn-primary" id="ed-submit-btn">Save Changes</button>
            </div>
        </div>`;
    const close=openModal(html);
    document.getElementById('ed-submit-btn').addEventListener('click',async()=>{
        const slides=document.getElementById('ed-slides').value.trim();
        const due=document.getElementById('ed-due').value;
        const start=document.getElementById('ed-start').value;
        const hours=document.getElementById('ed-hours').value;
        const max=document.getElementById('ed-max').value;
        const instructions=document.getElementById('ed-instructions').value;
        const err=document.getElementById('ed-err');
        if(!due){err.textContent='Due date is required.';return;}
        err.textContent='';
        const btn=document.getElementById('ed-submit-btn');
        btn.disabled=true;btn.textContent='Saving…';
        try {
            await postAction('edit_curriculum',{assignmentName:name,fields:{slidesLink:slides,dueDate:due,startDate:start,hours,maxVolunteers:max,instructions}});
            toast(`"${name}" updated!`,'success');
            close();
            const track=S.role==='president'?'All':(CONFIG.DIRECTORS[S.role]||{}).track||'';
            await loadDirectorData(track).catch(()=>{});
            viewDirectorPanel('post-assignment');
        } catch(e){err.textContent=e.message;btn.disabled=false;btn.textContent='Save Changes';}
    });
}

/* ─── GIVE HOURS (DOC) ──────────────────────────────────────── */
function dirGiveHoursHTML() {
    const assignments=[...(S.data.curriculum||[])].reverse(); // newest first
    if(!assignments.length)return`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No assignments yet</div><p class="muted text-small">Post assignments first, then give hours after volunteers complete the work.</p></div>`;
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
            return `<span class="vol-chip">${esc(n)}${disc?' · @'+esc(disc):''}</span>`;
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
            ${regList.length?`<div class="vol-chips mt-10"><div class="muted text-small mb-4">Will receive hours:</div>${volChips}</div>`:'<div class="muted text-small mt-8">No volunteers registered.</div>'}
            ${alreadyGiven?`<div class="vol-chips mt-8"><div class="muted text-small mb-4">Already given to:</div>${creditedChips}</div>`:''}
            ${regList.length?`<button class="btn ${alreadyGiven?'btn-ghost':'btn-primary'} btn-sm mt-12 give-hrs-btn" data-name="${esc(name)}">${alreadyGiven?'↻ Re-give Hours':'✅ Give Hours'}</button>`:''}
        </div>`;
    }).join('');

    return `<div class="card mb-16" style="border-color:rgba(251,191,36,.2)">
        <div class="muted text-small" style="line-height:1.7"><strong style="color:var(--gold)">How Give Hours works:</strong> After verifying the slides are complete, click "Give Hours" to credit all registered volunteers. This copies the registered list to the contributors column, which updates the leaderboard.</div>
    </div>${cards}`;
}

function attachGiveHoursEvents() {
    document.querySelectorAll('.give-hrs-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const assignmentName=btn.dataset.name;
            if(!confirm(`Give hours to all registered volunteers for "${assignmentName}"?\n\nThis will update the leaderboard.`))return;
            btn.disabled=true;btn.textContent='Giving hours…';
            try {
                await postAction('give_hours',{assignmentName,givenBy:S.user?.name||'Director',givenDate:new Date().toISOString()});
                toast('Hours given! Leaderboard updates shortly.','success');
                const track=S.role==='president'?'All':(CONFIG.DIRECTORS[S.role]||{}).track||'';
                await loadDirectorData(track).catch(()=>{});
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
            const track=S.role==='president'?'All':(CONFIG.DIRECTORS[S.role]||{}).track||'';
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
        // First login: guarantee at least 5.5s so all animations fully play
        const elapsed=Date.now()-_loadStart;
        const delay=Math.max(0,5500-elapsed);
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
   INIT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
    initAuth().catch(e=>showAuthError(e.message));
});
