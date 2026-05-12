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
    if(!sd||sd<localToday())return'Registration locked';
    const diff=new Date(sd+'T23:59:59')-new Date();
    if(diff<=0)return'Closes today';
    const d=Math.floor(diff/86400000);
    const h=Math.floor((diff%86400000)/3600000);
    if(d>0)return`${d}d ${h}h left`;
    return`${h}h left`;
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
    hideLoading();
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
    showCinematic();
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
    ov.innerHTML=`<div class="cin-content">
        <div class="cin-logo" style="color:${color};filter:drop-shadow(0 0 30px ${glow})">CC</div>
        <div class="cin-welcome">WELCOME BACK</div>
        <div class="cin-name" style="color:${color};text-shadow:0 0 40px ${glow}">${esc(u.name||'')}</div>
        <div class="cin-track">${esc(trackCfg.icon||'')} ${esc(u.track||'Curio Crate')}</div>
        <div class="cin-bar-wrap"><div class="cin-bar" style="background:${color}"></div></div>
    </div>`;
    document.body.appendChild(ov);
    setTimeout(()=>{
        ov.classList.add('cin-out');
        setTimeout(()=>ov.remove(),500);
    },2300);
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
function renderSidebar() {
    const nav=document.getElementById('sb-nav');
    const isDir=S.role!=='volunteer';
    const volItems=[
        {id:'dashboard',  icon:'🏠',label:'Dashboard'},
        {id:'curriculum', icon:'📚',label:'Assignments'},
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
        const locked=isLocked(r[5]);
        const maxVols=parseInt(r[6])||0;
        const filled=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean).length;
        const pct=maxVols?Math.min(100,(filled/maxVols)*100):0;
        return `<div class="curr-card" onclick="navigate('curriculum')" style="cursor:pointer">
            <div class="curr-header">
                <div style="flex:1;min-width:0">
                    <div class="curr-title">${esc(r[0]||'Assignment')}</div>
                    <div class="curr-meta">Due ${fmtDate(r[1])} · ${esc(String(r[2]||0))}h credit</div>
                </div>
                ${locked?'<span class="curr-lock-badge">🔒 Locked</span>':'<span class="curr-countdown">'+esc(formatCountdown(r[5]))+'</span>'}
            </div>
            <div class="slot-bar-wrap mt-8">
                <div class="slot-bar-track"><div class="slot-bar-fill" style="width:${pct}%"></div></div>
                <div class="slot-info">${filled}/${maxVols||'?'} slots</div>
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
        <div class="dash-grid">
            <div>
                <div class="section-title">YOUR ACTIVE REGISTRATIONS</div>
                ${regs.length
                    ? regCards+'<button class="btn btn-ghost btn-sm btn-full mt-8" onclick="navigate(\'curriculum\')">View all assignments →</button>'
                    : '<div class="card"><div class="muted text-small">No active registrations yet.</div><button class="btn btn-ghost btn-sm mt-8" onclick="navigate(\'curriculum\')">Browse Assignments →</button></div>'}
            </div>
            <div>
                <div class="section-title">TIER STATUS</div>
                <div class="card">
                    <div style="font-size:36px;margin-bottom:8px">${(CONFIG.TIERS[u.tier]||CONFIG.TIERS[1]).icon}</div>
                    ${tierBadge(u.tier)}
                    <div class="muted text-small mt-12" style="line-height:1.65">Tier promotions are decided by your director. Keep contributing to build your track record.</div>
                    <button class="btn btn-ghost btn-sm btn-full mt-12" onclick="navigate('progress')">View Tier Journey →</button>
                </div>
            </div>
        </div>`;
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
                <div class="view-title">Assignments 📚</div>
                <div class="view-subtitle">${assignments.length} total assignments</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="curr-refresh-btn">↺ Refresh</button>
        </div>
        <div class="panel-tabs" id="curr-tabs">
            <button class="panel-tab active" data-tab="open">Open</button>
            <button class="panel-tab" data-tab="mine">Mine</button>
            <button class="panel-tab" data-tab="locked">Locked</button>
            <button class="panel-tab" data-tab="all">All (${assignments.length})</button>
        </div>
        <div id="curr-list"></div>`;

    document.getElementById('curr-refresh-btn').onclick=async()=>{
        showLoading();
        await loadVolunteerData(u.name||'').catch(()=>{});
        hideLoading();viewCurriculum();
    };
    root.querySelectorAll('#curr-tabs .panel-tab').forEach(tab=>{
        tab.onclick=()=>{
            root.querySelectorAll('#curr-tabs .panel-tab').forEach(t=>t.classList.remove('active'));
            tab.classList.add('active');
            renderCurrList(tab.dataset.tab);
        };
    });
    renderCurrList('open');
}

function renderCurrList(filter) {
    const listEl=document.getElementById('curr-list');
    if(!listEl)return;
    const assignments=S.data.curriculum||[];
    const lower=(S.user?.name||'').toLowerCase();
    let filtered=assignments;
    if(filter==='open')filtered=assignments.filter(r=>!isClosed(r[5],r[1])&&!isCompleted(r[1]));
    else if(filter==='locked')filtered=assignments.filter(r=>isClosed(r[5],r[1])&&!isCompleted(r[1]));
    else if(filter==='mine')filtered=assignments.filter(r=>{
        const reg=(r[7]||'').split(',').map(n=>n.trim().toLowerCase());
        const cred=(r[3]||'').split(',').map(n=>n.trim().toLowerCase());
        return reg.includes(lower)||cred.includes(lower);
    });
    if(!filtered.length){
        listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No assignments here</div></div>`;
        return;
    }
    listEl.innerHTML=filtered.map(r=>currCardHTML(r,lower)).join('');
    attachCurrEvents();
}

function currCardHTML(r,lowerName) {
    const name=r[0]||'Untitled';
    const hours=r[2]||'0';
    const credited=(r[3]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const slidesLink=r[4]||'';
    const startDate=r[5]||'';
    const maxVols=parseInt(r[6])||0;
    const regList=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean);
    const filled=regList.length;
    const locked=isClosed(startDate,r[1]); // locked by start date OR past due date
    const done=isCompleted(r[1]);
    const isCredited=credited.some(n=>n.toLowerCase()===lowerName);
    const isRegistered=regList.some(n=>n.toLowerCase()===lowerName);
    const isFull=maxVols>0&&filled>=maxVols;
    const countdown=formatCountdown(startDate);
    const pct=maxVols?Math.min(100,(filled/maxVols)*100):0;

    const discordMap={};
    (S.data.allVolunteers||[]).forEach(v=>{discordMap[v.name.toLowerCase()]=v.discord;});

    const volChips=regList.map(n=>{
        const disc=discordMap[n.toLowerCase()]||'';
        return `<span class="vol-chip">${esc(n)}${disc?' · @'+esc(disc):''}</span>`;
    }).join('');
    const creditedChips=credited.map(n=>`<span class="vol-chip chip-credited">${esc(n)}</span>`).join('');

    let statusBadge='';
    if(isCredited)statusBadge='<span class="curr-credit-badge">✅ Hours credited</span>';
    else if(isRegistered)statusBadge='<span class="curr-reg-badge">✋ You\'re in</span>';

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
    const lockBadge=done
        ?'<span class="curr-done-badge">✅ Completed</span>'
        :locked?'<span class="curr-lock-badge">🔒 Locked</span>'
        :`<span class="curr-countdown">${esc(countdown)}</span>`;
    return `<div class="curr-card ${cardCls} ${isCredited?'curr-credited':''}">
        <div class="curr-header">
            <div style="flex:1;min-width:0">
                <div class="curr-title">${esc(name)}</div>
                <div class="curr-meta">
                    Due ${fmtDate(r[1])} · ${esc(hours)}h credit
                    ${slidesLink?` · <a href="${esc(slidesLink)}" target="_blank" class="task-link" style="font-size:11px;padding:2px 7px">📄 Slides ↗</a>`:''}
                </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
                ${statusBadge}
                ${lockBadge}
            </div>
        </div>
        <div class="slot-bar-wrap mt-12">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
                <span class="muted text-small">${filled} / ${maxVols||'?'} volunteers registered</span>
                ${isFull&&!isRegistered?'<span class="curr-full-badge">FULL</span>':''}
            </div>
            <div class="slot-bar-track"><div class="slot-bar-fill" style="width:${pct}%"></div></div>
        </div>
        ${regList.length?`<div class="vol-chips mt-10"><div class="muted text-small mb-4">Registered:</div>${volChips}</div>`:''}
        ${credited.length?`<div class="vol-chips mt-6"><div class="muted text-small mb-4">Hours given to:</div>${creditedChips}</div>`:''}
        <div class="curr-actions mt-12">${actionHTML}</div>
    </div>`;
}

function attachCurrEvents() {
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

/* ═══════════════════════════════════════════════════════════════
   VIEW: MY PROGRESS
   ═══════════════════════════════════════════════════════════════ */
function viewMyProgress() {
    const root=document.getElementById('view-root');
    const u=S.user||{};
    const stats=S.data.myStats||{totalHours:0,curricCount:0,eventsCount:0};
    const currentTier=u.tier||'1';
    const tierOrder=[1,2,3,4,'Exec'];

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
        const criteria=buildTierCriteria(tier,isCompleted,isCurrent);
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
        <div class="card mb-20" style="border-color:rgba(56,189,248,.15)">
            <div class="muted text-small" style="line-height:1.7"><strong style="color:var(--text2)">How tiers work:</strong> Tiers are not automatic — your director nominates you based on the quality and consistency of your contributions. Once nominated, you'll have a conversation with ${esc(CONFIG.PRESIDENT_NAME)} before a promotion is confirmed. Focus on great work; your director handles the rest.</div>
        </div>
        <div class="section-title">TIER JOURNEY</div>
        <div class="progress-journey">${tierHTML}</div>`;
}

function buildTierCriteria(tier,completed,current) {
    if(tier===1)return[
        {label:'Completed the volunteer sign-up form',met:completed||current},
        {label:'Attended first session or orientation',met:completed},
    ];
    if(tier===2)return[
        {label:'Meaningful contribution to curriculum or events',met:completed},
        {label:'Consistent communication with your team',met:completed},
        {label:'Director nomination',met:completed},
    ];
    if(tier===3)return[
        {label:'Demonstrated leadership within your track',met:completed},
        {label:'Multiple quality curriculum or event contributions',met:completed},
        {label:'Director nomination',met:completed},
        {label:'Conversation with '+CONFIG.PRESIDENT_NAME,met:completed},
    ];
    if(tier===4)return[
        {label:'Led team projects or sessions independently',met:completed},
        {label:'Long-term sustained track record',met:completed},
        {label:'Director nomination',met:completed},
        {label:'Conversation with '+CONFIG.PRESIDENT_NAME,met:completed},
    ];
    if(tier==='Exec')return[
        {label:'Exceptional multi-year service to Curio Crate',met:completed},
        {label:'Offered directly by President — never applied for',met:completed},
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
        showLoading();
        const track=isPresident?'All':(roleInfo.track||'');
        await loadDirectorData(track).catch(()=>{});
        hideLoading();viewDirectorPanel(activeTab);
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
                        <label class="form-label">Slides Link *</label>
                        <input class="form-input" id="pa-slides" placeholder="https://docs.google.com/presentation/…">
                    </div>
                    <div class="form-grid form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Due Date *</label>
                            <input class="form-input" type="date" id="pa-due">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Registration Lock Date *</label>
                            <input class="form-input" type="date" id="pa-start">
                            <div class="form-hint">After this date, no new registrations</div>
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
                    <div class="form-err" id="pa-err"></div>
                    <button class="btn btn-primary" id="pa-submit-btn">📋 Post Assignment</button>
                </div>
            </div>
            <div>
                <div class="section-title">EXISTING ASSIGNMENTS (${existing.length})</div>
                ${existing.slice().reverse().slice(0,8).map(r=>{
                    const filled=(r[7]||'').split(',').map(n=>n.trim()).filter(Boolean).length;
                    const maxVols=parseInt(r[6])||0;
                    return `<div class="curr-card">
                        <div class="curr-title">${esc(r[0]||'')}</div>
                        <div class="curr-meta">Due ${fmtDate(r[1])} · ${esc(r[2]||'0')}h · ${filled}/${maxVols} slots</div>
                        <div class="curr-meta mt-4">${isLocked(r[5])?'<span class="curr-lock-badge">🔒 Locked</span>':'<span class="curr-open-badge">Open: '+esc(formatCountdown(r[5]))+'</span>'}</div>
                    </div>`;
                }).join('')||'<div class="muted text-small">No assignments posted yet.</div>'}
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
        const err=document.getElementById('pa-err');
        if(!name||!slides||!due||!start||!hours||!max){err.textContent='All fields are required.';return;}
        err.textContent='';
        const btn=document.getElementById('pa-submit-btn');
        btn.disabled=true;btn.textContent='Posting…';
        try {
            await postAction('create_curriculum',{
                assignmentName:name,dueDate:due,hours,contributors:'',
                slidesLink:slides,startDate:start,maxVolunteers:max,
                registeredVolunteers:'',postedBy:S.user?.name||'Director',
                postedDate:new Date().toISOString(),
            });
            toast(`"${name}" posted!`,'success');
            ['pa-name','pa-slides','pa-due','pa-start','pa-hours','pa-max'].forEach(id=>{document.getElementById(id).value='';});
            const track=S.role==='president'?'All':(CONFIG.DIRECTORS[S.role]||{}).track||'';
            await loadDirectorData(track).catch(()=>{});
            viewDirectorPanel('post-assignment');
        } catch(e){err.textContent=e.message;}
        btn.disabled=false;btn.textContent='📋 Post Assignment';
    };
}

/* ─── GIVE HOURS (DOC) ──────────────────────────────────────── */
function dirGiveHoursHTML() {
    const assignments=S.data.curriculum||[];
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
function showLoading() { const el=document.getElementById('portal-loading');if(el)el.classList.remove('hidden'); }
function hideLoading() { const el=document.getElementById('portal-loading');if(el)el.classList.add('hidden'); }

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
