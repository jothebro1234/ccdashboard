/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
const S = {
    user:   null,   // { name, token, track, tier, discord, school, avatar, lead, cycles, onTimeRate, lastContact }
    role:   null,   // 'volunteer' | 'doc' | 'doo' | 'dop' | 'president'
    view:   null,
    subTab: null,
    data:   {},     // { tasks, sessions, wins, notifs, nominations, cycles, volunteers, events, curriculum, content }
    lbCat:  'hours',
    lbPrevRanks: {},
    notifCount: 0,
};

/* ═══════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════ */
function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmt(n) { return typeof n==='number' && !isNaN(n) ? n.toLocaleString() : String(n||''); }
function round1(n) { return Math.round((n||0)*10)/10; }
function fmtDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function fmtRelative(s) {
    if (!s) return '';
    const d = new Date(s), diff = Date.now()-d.getTime();
    if (isNaN(d)) return s;
    const mins=Math.floor(diff/60000), hrs=Math.floor(diff/3600000), days=Math.floor(diff/86400000);
    if (mins<1) return 'just now';
    if (mins<60) return `${mins}m ago`;
    if (hrs<24)  return `${hrs}h ago`;
    if (days<30) return `${days}d ago`;
    return fmtDate(s);
}
function isOverdue(deadline) { return deadline && new Date(deadline) < new Date(); }
function isChecked(v) { const u=(v||'').trim().toUpperCase(); return u==='TRUE'||u==='YES'||u==='1'||u==='X'||u==='✓'||u==='✔'; }
/* Derive track from col F; fall back to col J (specialty form response) */
function deriveTrack(colF, colJ) {
    const f = (colF||'').trim();
    if (f) return f;
    const s = (colJ||'').toLowerCase();
    if (s.includes('curriculum'))                                                          return 'Curriculum';
    if (s.includes('operation') || s.includes('in-person') || s.includes('session'))      return 'Operations';
    if (s.includes('media') || s.includes('design') || s.includes('content') || s.includes('publicity')) return 'Media/Design';
    return '';
}
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function parseCSV(raw) {
    const rows=[]; let i=0;
    while (i<raw.length) {
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
    if(!res.ok) throw new Error(`Sheet "${name}": HTTP ${res.status}`);
    return parseCSV(await res.text());
}

async function postAction(action, payload) {
    if (!CONFIG.APPS_SCRIPT_URL) {
        toast('Write operations require Apps Script URL in config.js','error');
        throw new Error('APPS_SCRIPT_URL not configured');
    }
    const body = JSON.stringify({action, ...payload});
    await fetch(CONFIG.APPS_SCRIPT_URL, {
        method:'POST', body,
        headers:{'Content-Type':'text/plain'}, // avoids CORS preflight
    });
}

/* Load all data needed for a volunteer's portal */
async function loadVolunteerData(name) {
    const [taskRows, winRows, notifRows, cycleRows, sessionRows] = await Promise.all([
        fetchSheet(CONFIG.TASKS_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.WINS_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.NOTIFS_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.CYCLES_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.SESSIONS_SHEET).catch(()=>[]),
    ]);
    const lowerName = name.toLowerCase();
    S.data.tasks     = taskRows.slice(1).filter(r=>(r[1]||'').trim().toLowerCase()===lowerName);
    S.data.wins      = winRows.slice(1).filter(r=>r[0]); // all wins for Wins Board
    S.data.notifs    = notifRows.slice(1).filter(r=>(r[1]||'').trim().toLowerCase()===lowerName);
    S.data.cycles    = cycleRows.slice(1).filter(r=>r[0]);
    S.data.sessions  = sessionRows.slice(1).filter(r=>r[0]);
    S.data.allWins   = winRows.slice(1).filter(r=>r[0]);
    S.notifCount     = S.data.notifs.filter(r=>!isChecked(r[4])).length;
    updateNotifBadge();
}

/* Load all data for a director's panel */
async function loadDirectorData(track) {
    const [volRows, taskRows, sessionRows, winRows, notifRows, nomRows, cycleRows, calRows] = await Promise.all([
        fetchSheet(CONFIG.SHEET_NAME),
        fetchSheet(CONFIG.TASKS_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.SESSIONS_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.WINS_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.NOTIFS_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.NOMINATIONS_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.CYCLES_SHEET).catch(()=>[]),
        fetchSheet(CONFIG.CONTENT_CAL_SHEET).catch(()=>[]),
    ]);
    const all = volRows.slice(1).map(r=>({
        name:(r[0]||'').trim(), discord:(r[1]||'').trim(), school:(r[2]||'').trim(),
        avatar:(r[3]||'').trim(), email:(r[4]||'').trim(), track:deriveTrack(r[5],r[9]),
        tier:(r[6]||'').trim()||'1', lead:(r[7]||'').trim(), cycles:parseInt(r[8])||0,
        onTimeRate:parseFloat(r[10])||null, lastContact:(r[11]||'').trim(),
    })).filter(v=>v.name);
    S.data.volunteers = track==='All' ? all : all.filter(v=>v.track===track);
    S.data.allVolunteers = all;
    S.data.allTasks   = taskRows.slice(1).filter(r=>r[0]);
    S.data.sessions   = sessionRows.slice(1).filter(r=>r[0]);
    S.data.allWins    = winRows.slice(1).filter(r=>r[0]);
    S.data.allNotifs  = notifRows.slice(1).filter(r=>r[0]);
    S.data.nominations= nomRows.slice(1).filter(r=>r[0]);
    S.data.cycles     = cycleRows.slice(1).filter(r=>r[0]);
    S.data.content    = calRows.slice(1).filter(r=>r[0]);
}

/* Load leaderboard data (events + curriculum + volunteer list) */
async function loadLbData() {
    if (S.data.lbReady) return;
    const [volRows, evRows, currRows, exRows] = await Promise.all([
        fetchSheet(CONFIG.SHEET_NAME),
        fetchSheet(CONFIG.EVENTS_SHEET_NAME),
        fetchSheet(CONFIG.CURRICULUM_SHEET_NAME),
        fetchSheet(CONFIG.EXCEPTIONS_SHEET_NAME).catch(()=>[]),
    ]);
    const exceptions = new Set(exRows.slice(1).map(r=>(r[0]||'').trim().toLowerCase()).filter(Boolean));
    const vm={};
    const mkV=name=>({name,discord:'',school:'',avatar:'',hours:0,events:0,curriculum:0,assemblyHours:0,sessionHours:0,curriculumHours:0,eventList:[],curriculumList:[]});
    volRows.slice(1).forEach(r=>{
        const name=(r[0]||'').trim(); if(!name)return;
        const key=name.toLowerCase();
        vm[key]={...mkV(name),discord:(r[1]||'').trim(),school:(r[2]||'').trim(),avatar:(r[3]||'').trim()};
    });
    evRows.slice(1).forEach(r=>{
        const evName=(r[0]||'').trim(), date=(r[1]||'').trim(), hrs=parseFloat(r[2])||0;
        const isAsm=isChecked(r[4]);
        (r[3]||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(att=>{
            const k=att.toLowerCase(); if(!vm[k])vm[k]=mkV(att);
            vm[k].hours+=hrs; vm[k].events+=1;
            if(isAsm)vm[k].assemblyHours+=hrs; else vm[k].sessionHours+=hrs;
            vm[k].eventList.push({name:evName,date,hours:hrs,assembly:isAsm});
        });
    });
    currRows.slice(1).forEach(r=>{
        const cName=(r[0]||'').trim(), date=(r[1]||'').trim(), hrs=parseFloat(r[2])||0;
        (r[3]||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(c=>{
            const k=c.toLowerCase(); if(!vm[k])vm[k]=mkV(c);
            vm[k].curriculum+=1; vm[k].hours+=hrs; vm[k].curriculumHours+=hrs;
            vm[k].curriculumList.push({name:cName,date,hours:hrs});
        });
    });
    S.data.lbData = Object.values(vm).filter(v=>!exceptions.has(v.name.toLowerCase()));
    S.data.lbReady = true;
}

/* ═══════════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════════ */
function parseURLParams() {
    const p = new URLSearchParams(window.location.search);
    return { role: p.get('role') };
}

async function initAuth() {
    const { role } = parseURLParams();
    if (role) {
        showRoleAuth(role);
    } else {
        showLanding();
    }
}

/* ── Google Sign-In ────────────────────────────────────────────── */
function initGoogleSignIn() {
    if (typeof google === 'undefined') { setTimeout(initGoogleSignIn, 200); return; }
    google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
        auto_select: true,
        cancel_on_tap_outside: false,
    });
    const wrap = document.getElementById('g-btn-wrap');
    if (wrap) {
        google.accounts.id.renderButton(wrap, {
            theme: 'filled_blue', size: 'large', width: 300,
            text: 'signin_with', shape: 'pill',
        });
    }
    google.accounts.id.prompt();
}

async function handleGoogleSignIn(credentialResponse) {
    showLoading();
    try {
        const parts = (credentialResponse.credential||'').split('.');
        if (parts.length < 2) throw new Error('Invalid credential from Google.');
        const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
        const email = (payload.email||'').trim().toLowerCase();
        if (!email) throw new Error('No email returned from Google sign-in.');

        const rows = await fetchSheet(CONFIG.SHEET_NAME);
        const emailCol = CONFIG.EMAIL_COL ?? 4;
        const row = rows.slice(1).find(r=>(r[emailCol]||'').trim().toLowerCase()===email);

        if (!row) { hideLoading(); showNotRegistered(email, payload.picture); return; }

        S.user = {
            name:       (row[0]||'').trim(),
            email,
            discord:    (row[1]||'').trim(),
            school:     (row[2]||'').trim(),
            avatar:     payload.picture || (row[3]||'').trim(),
            track:      deriveTrack(row[5], row[9]),
            tier:       (row[6]||'').trim()||'1',
            lead:       (row[7]||'').trim(),
            cycles:     parseInt(row[8])||0,
            onTimeRate: parseFloat(row[10])||null,
            lastContact:(row[11]||'').trim(),
        };
        S.role = 'volunteer';
        await loadVolunteerData(S.user.name);
        launchPortal();
    } catch(e) {
        hideLoading();
        showAuthError(e.message);
    }
}

function showLanding() {
    document.getElementById('auth-title').textContent = 'Volunteer Portal';
    document.getElementById('auth-body').innerHTML = `
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
        btn.onclick = () => showRoleAuth(btn.dataset.role);
    });
}

function showNotRegistered(email, picture) {
    document.getElementById('auth-title').textContent = 'Not Registered Yet';
    document.getElementById('auth-body').innerHTML = `
        <div class="auth-body">
            ${picture ? `<img src="${esc(picture)}" style="width:52px;height:52px;border-radius:50%;margin:0 auto;display:block">` : ''}
            <p class="auth-desc" style="color:var(--text2)">Signed in as <strong>${esc(email)}</strong></p>
            <p class="auth-desc">No volunteer record found. Fill out the sign-up form — once you're added to the roster, sign in here with the same Google account.</p>
            <a href="${esc(CONFIG.JOIN_URL)}" target="_blank" class="auth-btn" style="display:block;text-decoration:none;text-align:center">📋 Fill Out Sign-Up Form</a>
            <button class="auth-btn" onclick="showLanding()" style="background:var(--glass);border:1px solid var(--border-hi)">← Use a Different Account</button>
        </div>`;
}

function showRoleAuth(role) {
    const labels = {doc:'Director of Curriculum',doo:'Director of Operations',dop:'Director of Publicity',president:'President'};
    const icons  = {doc:'📚',doo:'🎓',dop:'📣',president:'👑'};
    document.getElementById('auth-title').textContent = `${icons[role]||''} ${labels[role]||role}`;
    document.getElementById('auth-body').innerHTML = `
        <div class="auth-body">
            <label class="auth-label">Director Code</label>
            <input class="auth-input" id="dir-code-input" type="password" placeholder="Enter access code..." autocomplete="off">
            <button class="auth-btn" id="dir-auth-btn">Unlock Dashboard</button>
            <div class="auth-err" id="auth-err-msg"></div>
            <p class="auth-back" id="auth-back">← Back</p>
        </div>`;
    const input = document.getElementById('dir-code-input');
    const tryCode = () => {
        const code = input.value.trim();
        if (code === CONFIG.DIRECTOR_CODES[role]) {
            S.role = role;
            S.user = { name: (CONFIG.DIRECTORS[role]||{}).name || labels[role], role, track: (CONFIG.DIRECTORS[role]||{}).track||'' };
            launchDirectorPortal(role);
        } else {
            const err = document.getElementById('auth-err-msg');
            err.textContent='Incorrect code.';
            input.value=''; input.focus();
            setTimeout(()=>{ if(err)err.textContent=''; },2500);
        }
    };
    document.getElementById('dir-auth-btn').onclick = tryCode;
    input.addEventListener('keydown', e=>{ if(e.key==='Enter')tryCode(); });
    document.getElementById('auth-back').onclick = showLanding;
    input.focus();
}


function showAuthError(msg) {
    document.getElementById('auth-body').innerHTML = `
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
}

async function launchDirectorPortal(role) {
    showLoading();
    try {
        const track = role==='president' ? 'All' : (CONFIG.DIRECTORS[role]||{}).track||'';
        await loadDirectorData(track);
        document.getElementById('auth-gate').style.display='none';
        document.getElementById('portal-shell').style.display='flex';
        hideLoading();
        renderSidebar();
        renderUserInfo();
        navigate('director');
        setupMobileToggle();
    } catch(e) {
        hideLoading();
        showAuthError(e.message);
    }
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
function renderSidebar() {
    const nav = document.getElementById('sb-nav');
    const isDir = S.role !== 'volunteer';
    const trackCls = S.user?.track ? (CONFIG.TRACKS[S.user.track]||{}).cls||'' : '';

    const volItems = [
        { id:'dashboard',    icon:'🏠', label:'Dashboard'    },
        { id:'tasks',        icon:'📋', label:'My Tasks'     },
        { id:'progress',     icon:'📈', label:'My Progress'  },
        { id:'sessions',     icon:'📅', label:'Sessions'     },
        { id:'wins',         icon:'🏆', label:'Wins Board'   },
        { id:'notifications',icon:'🔔', label:'Notifications' },
        { id:'leaderboard',  icon:'🥇', label:'Leaderboard'  },
    ];
    const dirItems = [
        { id:'dashboard',  icon:'🏠', label:'Overview'       },
        { id:'director',   icon:'⚙️', label:'Director Panel' },
        { id:'wins',       icon:'🏆', label:'Wins Board'     },
        { id:'leaderboard',icon:'🥇', label:'Leaderboard'   },
    ];
    const items = isDir ? dirItems : volItems;

    nav.innerHTML = items.map(it=>`
        <button class="sb-item${S.view===it.id?' active':''}" data-view="${it.id}">
            <span class="sb-icon">${it.icon}</span>
            <span>${it.label}</span>
            ${it.id==='notifications'?`<span class="sb-notif-badge" id="notif-badge" style="${S.notifCount?'':'display:none'">${S.notifCount}</span>`:''}
        </button>`).join('');

    nav.querySelectorAll('.sb-item').forEach(btn=>{
        btn.onclick=()=>{ navigate(btn.dataset.view); closeMobileSidebar(); };
    });
}

function updateNotifBadge() {
    const el = document.getElementById('notif-badge');
    if (!el) return;
    el.textContent = S.notifCount;
    el.style.display = S.notifCount ? '' : 'none';
}

function activateSidebarItem(view) {
    document.querySelectorAll('.sb-item').forEach(el=>{
        el.classList.toggle('active', el.dataset.view===view);
    });
}

const PALETTE = ['#38bdf8','#a78bfa','#22d3ee','#f472b6','#fb923c','#34d399','#fbbf24','#818cf8'];
function avHTML(name, avatar, size) {
    if (avatar && /^https?:\/\//.test(avatar)) {
        const fb = initSVG(name,size).replace(/'/g,"\\'");
        return `<img src="${esc(avatar)}" alt="${esc(name)}" loading="lazy" onerror="this.outerHTML='${fb}'">`;
    }
    return initSVG(name,size);
}
function initSVG(name, size) {
    const color=PALETTE[(name||'').charCodeAt(0)%PALETTE.length];
    const inits=(name||'?').trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
    const fs=Math.round(size*.38);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${size/2}" fill="${color}1a"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="${color}" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="${fs}">${inits}</text>
    </svg>`;
}

function renderUserInfo() {
    const el = document.getElementById('sb-user');
    const u = S.user||{};
    const track = u.track ? (CONFIG.TRACKS[u.track]||{}) : {};
    const tier  = CONFIG.TIERS[u.tier] || CONFIG.TIERS[1];
    el.innerHTML = `
        <div class="sb-av">${avHTML(u.name||'?', u.avatar, 34)}</div>
        <div style="min-width:0">
            <div class="sb-name">${esc(u.name||'Director')}</div>
            <div class="sb-meta">${u.track ? `${track.icon||''} ${u.track}` : (CONFIG.DIRECTORS[S.role]||{}).title||''} ${u.tier&&u.tier!=='Exec'?`· T${u.tier}`:(u.tier==='Exec'?'· Exec':'')}</div>
        </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   ROUTER
   ═══════════════════════════════════════════════════════════════ */
function navigate(view, sub) {
    S.view = view;
    S.subTab = sub || null;
    activateSidebarItem(view);
    const root = document.getElementById('view-root');
    root.innerHTML = '';
    switch(view) {
        case 'dashboard':    viewDashboard(); break;
        case 'tasks':        viewMyTasks(); break;
        case 'progress':     viewMyProgress(); break;
        case 'sessions':     viewSessions(); break;
        case 'wins':         viewWinsBoard(); break;
        case 'notifications':viewNotifications(); break;
        case 'leaderboard':  viewLeaderboard(); break;
        case 'director':     viewDirectorPanel(sub||'roster'); break;
        default: viewDashboard();
    }
    window.scrollTo(0, 0);
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════ */
function trackPill(track) {
    if (!track) return '';
    const cls = track.toLowerCase();
    return `<span class="pill pill-${cls}">${(CONFIG.TRACKS[track]||{}).icon||''} ${esc(track)}</span>`;
}
function tierBadge(tier) {
    const t = CONFIG.TIERS[tier]||CONFIG.TIERS[1];
    const cls = tier==='Exec'?'exec':tier;
    return `<span class="tier-badge tier-${cls}">${t.icon} ${t.name}</span>`;
}
function statusPill(status) {
    const map = {
        'Not Started':'notstarted','In Progress':'inprogress','Submitted':'submitted',
        'Approved':'approved','Revision Needed':'revision','Overdue':'overdue',
        'Upcoming':'upcoming','Completed':'completed','Cancelled':'cancelled',
        'Pending':'pending','Confirmed':'confirmed',
    };
    const cls = map[status]||'notstarted';
    const icons = {Approved:'✓',Overdue:'⚠',Submitted:'→','In Progress':'◉','Not Started':'○','Revision Needed':'↻',Upcoming:'📅',Completed:'✓',Cancelled:'✕',Pending:'⏳',Confirmed:'✓'};
    return `<span class="pill pill-${cls}">${icons[status]||''} ${esc(status)}</span>`;
}
function winTypePill(type) {
    const labels = {task:'Task',session:'Session',rankup:'Rank Up',crosstrack:'Cross-Track',spotlight:'Spotlight'};
    const cls = (type||'').replace('-','');
    return `<span class="pill win-${cls}">${labels[type]||type}</span>`;
}

/* Current active cycle */
function getCurrentCycle() {
    const cycles = (S.data.cycles||[]).filter(r=>r[3]==='Active');
    if (!cycles.length) return null;
    const c = cycles[0];
    return { num:c[0], start:c[1], end:c[2], status:c[3] };
}
function cycleDayInfo(cycle) {
    if (!cycle) return null;
    const start = new Date(cycle.start), end = new Date(cycle.end);
    const now = new Date(), total = CONFIG.CYCLE_DAYS;
    const elapsed = Math.max(0,Math.min(total, Math.ceil((now-start)/86400000)));
    const pct = (elapsed/total)*100;
    let phase='';
    if(elapsed<=1) phase='🚀 Tasks just assigned';
    else if(elapsed<=5) phase='💬 Mid-cycle check-in due';
    else if(elapsed<=10) phase='📤 Submission window';
    else if(elapsed<=11) phase='🔍 Director reviewing';
    else phase='🔄 New cycle starting soon';
    return { elapsed, total, pct: Math.min(pct,100), phase, dueDate: fmtDate(cycle.end) };
}

/* Task helpers */
function taskStatus(r) {
    if (r[10]==='Approved') return 'Approved';
    if (r[10]==='Revision Needed') return 'Revision Needed';
    if (r[10]==='Submitted') return 'Submitted';
    if (r[10]==='Overdue'||isOverdue(r[8])) return 'Overdue';
    if (r[10]==='In Progress') return 'In Progress';
    return r[10]||'Not Started';
}
function taskBorderCls(status) {
    return {Approved:'approved','Revision Needed':'revision',Submitted:'submitted','In Progress':'inprog',Overdue:'overdue'}[status]||'';
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function viewDashboard() {
    const root = document.getElementById('view-root');
    const u = S.user||{};
    const cycle = getCurrentCycle();
    const ci = cycleDayInfo(cycle);
    const activeTasks = (S.data.tasks||[]).filter(r=>{ const st=taskStatus(r); return st!=='Approved'; });
    const overdueCount = activeTasks.filter(r=>taskStatus(r)==='Overdue').length;
    const recentNotifs = (S.data.notifs||[]).filter(r=>!isChecked(r[4])).slice(0,3);
    const recentWins = (S.data.allWins||[]).slice(-5).reverse();
    const track = u.track ? CONFIG.TRACKS[u.track]||{} : {};
    const tier  = CONFIG.TIERS[u.tier]||CONFIG.TIERS[1];

    root.innerHTML = `
        <div class="view-header">
            <div>
                <div class="view-title">Welcome back, ${esc((u.name||'').split(' ')[0])} 👋</div>
                <div class="view-subtitle">${track.icon||''} ${u.track||'Curio Crate'} · ${tierBadge(u.tier)}</div>
            </div>
        </div>

        ${ci ? `
        <div class="cycle-card mb-20">
            <div class="cycle-ring-wrap">
                <svg viewBox="0 0 36 36">
                    <circle class="cycle-track" cx="18" cy="18" r="15.9"/>
                    <circle class="cycle-fill" cx="18" cy="18" r="15.9" stroke-dasharray="${(ci.pct/100*100).toFixed(1)} 100"/>
                </svg>
                <div class="cycle-lbl">
                    <span class="cycle-day">${ci.elapsed}</span>
                    <span class="cycle-of">of ${ci.total}</span>
                </div>
            </div>
            <div class="cycle-info">
                <div class="cycle-name">Cycle #${cycle.num}</div>
                <div class="cycle-meta">Day ${ci.elapsed} of ${ci.total} · Due ${ci.dueDate}</div>
                <div class="cycle-phase">${ci.phase}</div>
            </div>
        </div>` : `
        <div class="card mb-20" style="border-color:rgba(245,158,11,.25)">
            <div class="muted text-small">⏸ No active cycle right now — check back with your director.</div>
        </div>`}

        <div class="card-grid card-grid-4 mb-20">
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--blue-g)">📋</div>
                <div><div class="stat-val">${activeTasks.length}</div><div class="stat-lbl">Active Tasks</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--red-g)">⚠️</div>
                <div><div class="stat-val" style="color:${overdueCount?'var(--red)':'var(--green)'}">${overdueCount}</div><div class="stat-lbl">Overdue</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--teal-g)">🔄</div>
                <div><div class="stat-val" style="color:var(--teal)">${u.cycles||0}</div><div class="stat-lbl">Cycles Done</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--gold-g)">🔔</div>
                <div><div class="stat-val" style="color:var(--gold)">${S.notifCount}</div><div class="stat-lbl">Unread</div></div>
            </div>
        </div>

        <div class="dash-grid">
            <div>
                <div class="section-title">Active Tasks</div>
                ${activeTasks.length ? activeTasks.slice(0,3).map(r=>{
                    const st=taskStatus(r);
                    return `<div class="task-card ${taskBorderCls(st)} mb-12" style="cursor:pointer" onclick="navigate('tasks')">
                        <div class="task-name">${esc(r[2]||'Untitled Task')}</div>
                        <div class="task-meta mt-4">
                            ${statusPill(st)}
                            ${r[8]?`<span class="muted text-small">Due ${fmtDate(r[8])}</span>`:''}
                        </div>
                    </div>`;
                }).join('')+
                (activeTasks.length>3?`<button class="btn btn-ghost btn-sm btn-full mt-8" onclick="navigate('tasks')">View all ${activeTasks.length} tasks →</button>`:'')
                : `<div class="card"><div class="muted text-small">✅ No active tasks — check back at the start of the next cycle.</div></div>`}
            </div>
            <div>
                <div class="section-title">Recent Notifications</div>
                ${recentNotifs.length ? recentNotifs.map(r=>`
                    <div class="notif-item unread mb-4">
                        <div class="notif-body">
                            <div class="notif-type">${esc(r[2]||'')}</div>
                            <div class="notif-content">${esc((r[3]||'').slice(0,80))}${(r[3]||'').length>80?'…':''}</div>
                        </div>
                    </div>`).join('') :
                `<div class="card"><div class="muted text-small">No new notifications.</div></div>`}
                ${recentNotifs.length ? `<button class="btn btn-ghost btn-sm btn-full mt-8" onclick="navigate('notifications')">All notifications →</button>` : ''}
            </div>
        </div>

        ${recentWins.length ? `
        <div class="mt-20">
            <div class="section-title">Recent Recognition</div>
            <div class="wins-feed">
                ${recentWins.slice(0,3).map(winCardHTML).join('')}
            </div>
            <button class="btn btn-ghost btn-sm btn-full mt-12" onclick="navigate('wins')">Full Wins Board →</button>
        </div>` : ''}`;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: MY TASKS
   ═══════════════════════════════════════════════════════════════ */
function viewMyTasks() {
    const root = document.getElementById('view-root');
    const tasks = S.data.tasks||[];
    const active = tasks.filter(r=>{ const st=taskStatus(r); return st!=='Approved'; });
    const done   = tasks.filter(r=>taskStatus(r)==='Approved');

    root.innerHTML = `
        <div class="view-header">
            <div>
                <div class="view-title">My Tasks</div>
                <div class="view-subtitle">${active.length} active · ${done.length} completed</div>
            </div>
        </div>
        <div class="panel-tabs" id="task-tabs">
            <button class="panel-tab active" data-tab="active">Active (${active.length})</button>
            <button class="panel-tab" data-tab="history">History (${done.length})</button>
        </div>
        <div id="task-panel-active">${active.length ? active.map(r=>taskCardHTML(r,true)).join('') :
            `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No active tasks</div><p class="muted text-small">Your next task will appear here at the start of the next cycle.</p></div>`
        }</div>
        <div id="task-panel-history" style="display:none">${done.length ? done.map(r=>taskCardHTML(r,false)).join('') :
            `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">No completed tasks yet</div></div>`
        }</div>`;

    root.querySelectorAll('.panel-tab').forEach(tab=>{
        tab.onclick=()=>{
            root.querySelectorAll('.panel-tab').forEach(t=>t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('task-panel-active').style.display=tab.dataset.tab==='active'?'':'none';
            document.getElementById('task-panel-history').style.display=tab.dataset.tab==='history'?'':'none';
        };
    });

    root.querySelectorAll('.task-confirm-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const id=btn.dataset.id, name=S.user.name;
            btn.disabled=true; btn.textContent='Confirming…';
            try {
                await postAction('confirm_task',{taskId:id,volunteerName:name,confirmedDate:new Date().toISOString()});
                toast('Task confirmed!','success'); navigate('tasks');
            } catch(e){ btn.disabled=false; btn.textContent='✓ Confirm Task'; }
        };
    });

    root.querySelectorAll('.task-submit-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const id=btn.dataset.id, linkEl=document.getElementById(`submit-link-${id}`);
            const link=(linkEl&&linkEl.value.trim())||'';
            if(!link){toast('Paste your submission link first','error');return;}
            btn.disabled=true; btn.textContent='Submitting…';
            try {
                await postAction('submit_task',{taskId:id,volunteerName:S.user.name,submissionLink:link,submittedDate:new Date().toISOString(),status:'Submitted'});
                toast('Submitted! Your director will review soon.','success'); navigate('tasks');
            } catch(e){ btn.disabled=false; btn.textContent='Submit'; }
        };
    });
}

function taskCardHTML(r, interactive) {
    const status = taskStatus(r);
    const id = r[0]||genId();
    const hasRevision = status==='Revision Needed' && r[12];
    return `<div class="task-card ${taskBorderCls(status)}">
        <div class="task-top">
            <div class="task-info">
                <div class="task-name">${esc(r[2]||'Untitled Task')}</div>
                <div class="task-meta">
                    ${statusPill(status)}
                    ${r[8]?`<span class="muted text-small">Due ${fmtDate(r[8])}</span>`:''}
                    ${r[5]?`<span class="muted text-small">Cycle #${esc(r[5])}</span>`:''}
                    ${r[17]?trackPill(r[17]):''}
                </div>
            </div>
        </div>
        ${r[3]?`<div class="task-desc">${esc(r[3])}</div>`:''}
        ${r[7]?`<div class="task-donewhen"><strong>Done when:</strong> ${esc(r[7])}</div>`:''}
        ${hasRevision?`<div class="task-director-note"><strong>Director Feedback</strong><p>${esc(r[12])}</p></div>`:''}
        ${r[12]&&status==='Approved'?`<div class="task-donewhen" style="background:var(--green-g);border-color:rgba(52,211,153,.25)"><strong style="color:var(--green)">Director note:</strong> ${esc(r[12])}</div>`:''}
        <div class="task-links">
            ${r[6]?`<a href="${esc(r[6])}" target="_blank" class="task-link">📄 Template ↗</a>`:''}
            ${r[11]?`<a href="${esc(r[11])}" target="_blank" class="task-link">📎 My Submission ↗</a>`:''}
            ${r[9]?`<span class="muted text-small">Contact: ${esc(r[9])}</span>`:''}
        </div>
        ${interactive && status!=='Approved' && status!=='Submitted' ? `
        <div class="task-actions">
            <button class="btn btn-ghost btn-sm task-confirm-btn" data-id="${esc(id)}">✓ Confirm Task</button>
            <div class="task-submit-row">
                <input class="form-input" id="submit-link-${esc(id)}" placeholder="Paste Google Doc / Drive link…" style="font-size:13px;padding:8px 12px">
                <button class="btn btn-primary btn-sm task-submit-btn" data-id="${esc(id)}">Submit</button>
            </div>
        </div>` : ''}
        ${status==='Submitted'?`<div class="muted text-small mt-4">⏳ Awaiting director review…</div>`:''}
        ${status==='Approved'?`<div class="muted text-small mt-4" style="color:var(--green)">✅ Approved ${r[15]?fmtDate(r[15]):''}</div>`:''}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: MY PROGRESS
   ═══════════════════════════════════════════════════════════════ */
function viewMyProgress() {
    const root = document.getElementById('view-root');
    const u = S.user||{};
    const cycles = parseInt(u.cycles)||0;
    const onTime = u.onTimeRate!==null ? Math.round(u.onTimeRate*100) : null;
    const currentTier = parseInt(u.tier)||1;
    const tasks = S.data.tasks||[];
    const approvedCount = tasks.filter(r=>taskStatus(r)==='Approved').length;

    const tierOrder = [1,2,3,4,'Exec'];
    const tierNames = {1:'Explorer',2:'Builder',3:'Lead',4:'Architect',Exec:'Executive'};

    const tierHTML = tierOrder.map(tier=>{
        const t = CONFIG.TIERS[tier]||CONFIG.TIERS[1];
        const numTier = tier==='Exec'?999:parseInt(tier);
        const numCurrent = currentTier==='Exec'?999:parseInt(currentTier);
        const isCompleted = numCurrent>numTier;
        const isCurrent   = String(tier)===String(currentTier);
        const isLocked    = numCurrent<numTier;

        const tierCyclesNeeded = t.cycles||0;
        const progress = Math.min(100, cycles>=tierCyclesNeeded ? 100 : (cycles/Math.max(tierCyclesNeeded,1))*100);

        const criteria = buildTierCriteria(tier, cycles, onTime, isCompleted, isCurrent);
        const metCount = criteria.filter(c=>c.met).length;

        return `<div class="tier-step ${isCompleted?'completed':isCurrent?'current':isLocked?'locked':''}">
            <div class="tier-step-header">
                <div class="tier-step-icon">${t.icon}</div>
                <div>
                    <div class="tier-step-name">${tierBadge(tier)}</div>
                    <div class="tier-step-lbl">${tier==='Exec'?'Offered by the President':'Tier '+tier}</div>
                </div>
                <div class="tier-step-status">
                    ${isCompleted?statusPill('Approved'):isCurrent?statusPill('In Progress'):''}
                </div>
            </div>
            ${!isLocked||isCurrent ? `
            <div class="criteria-list">
                ${criteria.map(c=>`
                <div class="criteria-item ${c.met?'met':''}">
                    <div class="criteria-check">${c.met?'✓':''}</div>
                    <span>${c.label}</span>
                </div>`).join('')}
            </div>
            ${!isCompleted ? `
            <div class="progress-bar-wrap">
                <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${(metCount/Math.max(criteria.length,1)*100).toFixed(0)}%"></div></div>
                <div class="progress-bar-lbl">${metCount}/${criteria.length} criteria met</div>
            </div>` : ''}` : `<div class="muted text-small">Complete Tier ${numTier-1} to unlock requirements.</div>`}
        </div>`;
    }).join('');

    root.innerHTML = `
        <div class="view-header">
            <div>
                <div class="view-title">My Progress</div>
                <div class="view-subtitle">${u.cycles||0} cycles completed · ${u.track||'—'} track</div>
            </div>
        </div>
        <div class="card mb-20" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <div style="flex:1;min-width:160px">
                <div class="section-title">CURRENT TIER</div>
                <div style="font-size:28px;margin-bottom:4px">${(CONFIG.TIERS[currentTier]||CONFIG.TIERS[1]).icon}</div>
                ${tierBadge(currentTier)}
                <div class="muted text-small mt-8">Cycles completed: <strong style="color:var(--text)">${cycles}</strong></div>
                ${onTime!==null?`<div class="muted text-small mt-4">On-time rate: <strong style="color:${onTime>=80?'var(--green)':'var(--orange)'}">${onTime}%</strong></div>`:''}
            </div>
            <div style="flex:2;min-width:200px">
                <div class="muted text-small mb-4">Promotions require director nomination + a conversation with ${esc(CONFIG.PRESIDENT_NAME)}. The system tracks your progress; your director initiates the process.</div>
            </div>
        </div>
        <div class="section-title">TIER JOURNEY</div>
        <div class="progress-journey">${tierHTML}</div>`;
}

function buildTierCriteria(tier, cycles, onTime, completed, current) {
    const base = [];
    if (tier===1) {
        base.push({label:'Attend orientation and confirm first task',met:completed||current});
    } else if (tier===2) {
        base.push({label:'2 completed cycles',met:cycles>=2});
        base.push({label:'Quality check by director',met:completed});
        base.push({label:'Director nomination',met:completed});
    } else if (tier===3) {
        base.push({label:'5 total cycles completed',met:cycles>=5});
        base.push({label:'80%+ on-time submission rate',met:(onTime===null?false:onTime>=80)});
        base.push({label:'Director nomination',met:completed});
        base.push({label:'Conversation with '+CONFIG.PRESIDENT_NAME,met:completed});
    } else if (tier===4) {
        base.push({label:'10 total cycles completed',met:cycles>=10});
        base.push({label:'Led a team through multiple cycles',met:completed});
        base.push({label:'Director nomination',met:completed});
        base.push({label:'Conversation with '+CONFIG.PRESIDENT_NAME,met:completed});
    } else if (tier==='Exec') {
        base.push({label:'Sustained reliability across all tiers (2–4 years)',met:completed});
        base.push({label:'Offered directly by President — never applied for',met:completed});
    }
    return base;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: SESSIONS
   ═══════════════════════════════════════════════════════════════ */
function viewSessions() {
    const root = document.getElementById('view-root');
    const sessions = S.data.sessions||[];
    const upcoming = sessions.filter(r=>r[10]==='Upcoming');
    const past     = sessions.filter(r=>r[10]==='Completed');
    const myName   = (S.user?.name||'').toLowerCase();
    const mine     = sessions.filter(r=>(r[11]||'').toLowerCase().includes(myName));

    root.innerHTML = `
        <div class="view-header">
            <div>
                <div class="view-title">Sessions</div>
                <div class="view-subtitle">${upcoming.length} upcoming · ${mine.length} mine</div>
            </div>
        </div>
        <div class="panel-tabs" id="sess-tabs">
            <button class="panel-tab active" data-tab="upcoming">Upcoming (${upcoming.length})</button>
            <button class="panel-tab" data-tab="mine">My Sessions (${mine.length})</button>
            <button class="panel-tab" data-tab="past">Past (${past.length})</button>
        </div>
        <div id="sp-upcoming">${upcoming.length?upcoming.map(r=>sessionCardHTML(r,myName,true)).join(''):`<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">No upcoming sessions</div><p class="muted text-small">Check back when the DOO schedules the next session.</p></div>`}</div>
        <div id="sp-mine"     style="display:none">${mine.length?mine.map(r=>sessionCardHTML(r,myName,false)).join(''):`<div class="empty-state"><div class="empty-icon">🎓</div><div class="empty-title">No sessions yet</div></div>`}</div>
        <div id="sp-past"     style="display:none">${past.length?past.map(r=>sessionCardHTML(r,myName,false)).join(''):`<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-title">No past sessions</div></div>`}</div>`;

    root.querySelectorAll('#sess-tabs .panel-tab').forEach(tab=>{
        tab.onclick=()=>{
            root.querySelectorAll('#sess-tabs .panel-tab').forEach(t=>t.classList.remove('active'));
            tab.classList.add('active');
            ['upcoming','mine','past'].forEach(p=>{ document.getElementById('sp-'+p).style.display=tab.dataset.tab===p?'':'none'; });
        };
    });

    root.querySelectorAll('.sess-signup-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const id=btn.dataset.id, type=btn.dataset.type;
            btn.disabled=true; btn.textContent='Signing up…';
            try {
                await postAction('sign_up_session',{sessionId:id,volunteerName:S.user.name,type,date:new Date().toISOString()});
                toast(`Signed up as ${type}!`,'success'); navigate('sessions');
            } catch(e){ btn.disabled=false; btn.textContent='Sign Up'; }
        };
    });
}

function sessionCardHTML(r, myName, showSignup) {
    const id=r[0], attended=(r[11]||'').toLowerCase().includes(myName), isLead=(r[9]||'').toLowerCase()===myName;
    const facSpots=parseInt(r[7])||0, obsSpots=parseInt(r[8])||0;
    const attendees=(r[11]||'').split(',').map(n=>n.trim()).filter(Boolean);
    return `<div class="session-card">
        <div class="session-top">
            <div class="session-info">
                <div class="session-name">${esc(r[1]||'Session')}</div>
                <div class="session-detail">
                    ${r[2]?`<span class="session-detail-item">🏫 ${esc(r[2])}</span>`:''}
                    ${r[3]?`<span class="session-detail-item">📅 ${fmtDate(r[3])}${r[4]?' at '+esc(r[4]):''}</span>`:''}
                    ${r[5]?`<span class="session-detail-item">📍 ${esc(r[5])}</span>`:''}
                    ${r[6]?`<span class="session-detail-item">🧪 Kit: ${esc(r[6])}</span>`:''}
                    ${r[9]?`<span class="session-detail-item">⭐ Lead: ${esc(r[9])}</span>`:''}
                </div>
                <div class="session-spots">
                    Facilitator spots: <strong>${facSpots}</strong> · Observer spots: <strong>${obsSpots}</strong>
                    ${r[12]?` · <strong>${r[12]}h</strong> credited`:''}
                </div>
                ${attendees.length?`<div class="session-attendees">Attendees: ${attendees.map(a=>esc(a)).join(', ')}</div>`:''}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
                ${statusPill(r[10]||'Upcoming')}
                ${isLead?`<span class="pill pill-approved">⭐ Lead</span>`:''}
                ${attended&&!isLead?`<span class="pill pill-completed">✓ Attending</span>`:''}
            </div>
        </div>
        ${showSignup&&!attended?`<div class="task-actions">
            <button class="btn btn-primary btn-sm sess-signup-btn" data-id="${esc(id)}" data-type="Facilitator">Sign Up: Facilitator</button>
            <button class="btn btn-ghost btn-sm sess-signup-btn" data-id="${esc(id)}" data-type="Observer">Sign Up: Observer</button>
        </div>`:''}
        ${r[13]?`<div class="muted text-small mt-4">${esc(r[13])}</div>`:''}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: WINS BOARD
   ═══════════════════════════════════════════════════════════════ */
function viewWinsBoard() {
    const root = document.getElementById('view-root');
    const allWins = (S.data.allWins||[]).slice().reverse();
    const tracks = ['All','Curriculum','Operations','Publicity'];

    root.innerHTML = `
        <div class="view-header">
            <div>
                <div class="view-title">Wins Board 🏆</div>
                <div class="view-subtitle">Recognition across all tracks</div>
            </div>
        </div>
        <div class="panel-tabs" id="wins-tabs" style="margin-bottom:16px">
            ${tracks.map((t,i)=>`<button class="panel-tab${i===0?' active':''}" data-track="${t}">${t==='All'?'🌐':''} ${t}</button>`).join('')}
        </div>
        <div class="wins-feed" id="wins-feed">
            ${allWins.length ? allWins.map(winCardHTML).join('') : `<div class="empty-state"><div class="empty-icon">🌟</div><div class="empty-title">No wins yet</div><p class="muted text-small">Recognition posts from directors will appear here.</p></div>`}
        </div>`;

    root.querySelectorAll('#wins-tabs .panel-tab').forEach(tab=>{
        tab.onclick=()=>{
            root.querySelectorAll('#wins-tabs .panel-tab').forEach(t=>t.classList.remove('active'));
            tab.classList.add('active');
            const filter=tab.dataset.track;
            const feed=document.getElementById('wins-feed');
            const filtered=filter==='All'?allWins:allWins.filter(r=>r[5]===filter);
            feed.innerHTML = filtered.length ? filtered.map(winCardHTML).join('') :
                `<div class="empty-state"><div class="empty-icon">🌟</div><div class="empty-title">No wins for ${filter} yet</div></div>`;
        };
    });
}

function winCardHTML(r) {
    const type=(r[3]||'task').replace('-','');
    const track=r[5]||'';
    const trackCfg=CONFIG.TRACKS[track]||{};
    const border = trackCfg.color ? `border-left:3px solid ${trackCfg.color}` : '';
    return `<div class="win-card" style="${border}">
        <div class="win-top">
            <div class="win-names">${esc(r[1]||'Team')}</div>
            ${winTypePill(r[3]||'task')}
            ${track?trackPill(track):''}
            <div class="win-time">${fmtRelative(r[6])}</div>
        </div>
        <div class="win-text">${esc(r[2]||'')}</div>
        <div class="win-footer">
            <span class="win-posted-by">Posted by ${esc(r[4]||'Director')}</span>
        </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════ */
function viewNotifications() {
    const root = document.getElementById('view-root');
    const notifs = (S.data.notifs||[]).slice().reverse();
    const unread = notifs.filter(r=>!isChecked(r[4]));

    root.innerHTML = `
        <div class="view-header">
            <div>
                <div class="view-title">Notifications</div>
                <div class="view-subtitle">${unread.length} unread</div>
            </div>
            ${unread.length?`<button class="btn btn-ghost btn-sm" id="mark-all-btn">Mark all read</button>`:''}
        </div>
        <div class="notif-list" id="notif-list">
            ${notifs.length ? notifs.map(r=>`
            <div class="notif-item ${!isChecked(r[4])?'unread':''}" data-id="${esc(r[0])}">
                <div class="notif-body">
                    <div class="notif-type">${notifTypeLabel(r[2])}</div>
                    <div class="notif-content">${esc(r[3]||'')}</div>
                    <div class="notif-time">${fmtRelative(r[5])}</div>
                </div>
            </div>`).join('') :
            `<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-title">No notifications</div></div>`}
        </div>`;

    root.querySelectorAll('.notif-item').forEach(el=>{
        el.onclick=async()=>{
            if (!el.classList.contains('unread')) return;
            el.classList.remove('unread');
            S.notifCount = Math.max(0,S.notifCount-1);
            updateNotifBadge();
            const id=el.dataset.id;
            try { await postAction('mark_notif_read',{notifId:id,volunteerName:S.user.name}); } catch(_){}
        };
    });

    const markAll = document.getElementById('mark-all-btn');
    if (markAll) markAll.onclick=async()=>{
        root.querySelectorAll('.notif-item.unread').forEach(el=>el.classList.remove('unread'));
        S.notifCount=0; updateNotifBadge();
        try { await postAction('mark_all_read',{volunteerName:S.user.name}); } catch(_){}
        toast('All notifications marked as read','success');
    };
}

function notifTypeLabel(type) {
    const labels = {
        'task-assigned':'📋 Task Assigned','midpoint-checkin':'💬 Midpoint Check-In',
        'task-approved':'✅ Task Approved','revision-needed':'↻ Revision Requested',
        'recognition':'🌟 Recognition Posted','promotion':'🎉 Promoted!',
        'session-signup':'📅 Session Confirmed','announcement':'📢 Announcement',
    };
    return labels[type]||type||'Notification';
}

/* ═══════════════════════════════════════════════════════════════
   VIEW: LEADERBOARD (embedded)
   ═══════════════════════════════════════════════════════════════ */
async function viewLeaderboard() {
    const root = document.getElementById('view-root');
    root.innerHTML = `
        <div class="view-header">
            <div>
                <div class="view-title">Leaderboard 🥇</div>
                <div class="view-subtitle">Live hours, events & curriculum rankings</div>
            </div>
            <a href="../main/" target="_blank" class="btn btn-ghost btn-sm">Full Page ↗</a>
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
            renderLbPodium(); renderLbList();
        };
    });
    document.getElementById('lb-search').oninput=renderLbList;

    try {
        await loadLbData();
        renderLbPodium(); renderLbList();
    } catch(e) {
        document.getElementById('lb-rows').innerHTML=`<div style="padding:40px;text-align:center;color:var(--red)">Failed to load: ${esc(e.message)}</div>`;
    }
}

function lbSorted() {
    return [...(S.data.lbData||[])].sort((a,b)=>{
        if(S.lbCat==='hours')      return b.hours-a.hours;
        if(S.lbCat==='events')     return b.events-a.events;
        if(S.lbCat==='curriculum') return b.curriculum-a.curriculum;
        return 0;
    });
}

function lbStatVal(v) {
    if(S.lbCat==='hours')      return round1(v.hours);
    if(S.lbCat==='events')     return v.events;
    if(S.lbCat==='curriculum') return v.curriculum;
}
function lbStatLbl() { return {hours:'hrs',events:'events',curriculum:'built'}[S.lbCat]||''; }

function renderLbPodium() {
    const s=lbSorted(), pod=document.getElementById('lb-podium');
    if(!pod||s.length<1)return;
    const slots=[s[1],s[0],s[2]], ranks=[2,1,3];
    pod.innerHTML=slots.map((v,i)=>{
        if(!v) return '<div></div>';
        const rank=ranks[i], val=lbStatVal(v);
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
    if(!rows) return;
    const filtered=q?s.filter(v=>v.name.toLowerCase().includes(q)):s;
    const rest=filtered.slice(3);
    if(!rest.length){rows.innerHTML=`<div style="padding:32px;text-align:center;color:var(--textm)">${q?'No results':'Everyone is on the podium!'}</div>`;return;}
    rows.innerHTML=rest.map((v,i)=>{
        const rank=filtered.indexOf(v)+1, val=lbStatVal(v);
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
    const root = document.getElementById('view-root');
    const isPresident = S.role==='president';
    const isDOO = S.role==='doo';
    const isDOP = S.role==='dop';
    const roleInfo = CONFIG.DIRECTORS[S.role]||{title:'Director',track:''};

    const tabs = [
        {id:'roster',   label:'👥 Roster'},
        {id:'assign',   label:'📋 Assign Task'},
        {id:'wins-post',label:'🌟 Post Win'},
        {id:'nominations',label:'⭐ Nominations'},
        ...(isDOO?[{id:'sessions',label:'📅 Sessions'}]:[]),
        ...(isDOP?[{id:'calendar',label:'📆 Calendar'}]:[]),
        ...(isPresident?[{id:'promotions',label:'👑 Promotions'}]:[]),
    ];

    root.innerHTML = `
        <div class="view-header">
            <div>
                <div class="view-title">${isPresident?'👑 President Dashboard':`${roleInfo.title}`}</div>
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
        hideLoading(); viewDirectorPanel(activeTab);
    };

    root.querySelectorAll('#dir-tabs .panel-tab').forEach(tab=>{
        tab.onclick=()=>{ S.subTab=tab.dataset.tab; viewDirectorPanel(tab.dataset.tab); };
    });

    renderDirPanel(activeTab);
}

function renderDirPanel(tab) {
    const body=document.getElementById('dir-panel-body');
    if(!body)return;
    switch(tab){
        case 'roster':      body.innerHTML=dirRosterHTML(); attachRosterEvents(); break;
        case 'assign':      body.innerHTML=dirAssignHTML();  attachAssignEvents(); break;
        case 'wins-post':   body.innerHTML=dirWinsPostHTML(); attachWinsPostEvents(); break;
        case 'nominations': body.innerHTML=dirNominationsHTML(); attachNomEvents(); break;
        case 'sessions':    body.innerHTML=dirSessionsHTML(); attachSessionEvents(); break;
        case 'calendar':    body.innerHTML=dirCalendarHTML(); attachCalEvents(); break;
        case 'promotions':  body.innerHTML=dirPromotionsHTML(); attachPromEvents(); break;
    }
}

/* ROSTER */
function dirRosterHTML() {
    const vols = S.data.volunteers||[];
    const allTasks = S.data.allTasks||[];
    const now = new Date();

    const rows = vols.map(v=>{
        const vtasks = allTasks.filter(r=>(r[1]||'').trim().toLowerCase()===v.name.toLowerCase());
        const active = vtasks.find(r=>{ const st=taskStatus(r); return st!=='Approved'; });
        const lastContact = v.lastContact ? new Date(v.lastContact) : null;
        const daysSilent  = lastContact ? Math.floor((now-lastContact)/86400000) : null;
        const isAlert = active && daysSilent!==null && daysSilent>=7;

        return {v, active, daysSilent, isAlert};
    });

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
        <table class="data-table" id="roster-table">
            <thead><tr>
                <th>Volunteer</th><th>Track</th><th>Tier</th><th>Current Task</th>
                <th>Status</th><th class="col-r">Cycles</th><th class="col-r">On-Time</th><th>Last Contact</th>
            </tr></thead>
            <tbody id="roster-tbody">
                ${rows.map(({v,active,daysSilent,isAlert})=>`
                <tr class="${isAlert?'row-alert':''} clickable-row" data-name="${esc(v.name.toLowerCase())}" data-tier="${esc(String(v.tier))}">
                    <td><div class="td-name">${esc(v.name)}</div>${v.discord?`<div class="td-sub">@${esc(v.discord)}</div>`:''}</td>
                    <td>${trackPill(v.track)}</td>
                    <td>${tierBadge(v.tier)}</td>
                    <td>${active?`<span style="font-size:13px">${esc(active[2]||'')}</span>`:`<span class="muted">—</span>`}</td>
                    <td>${active?statusPill(taskStatus(active)):`<span class="muted">—</span>`}</td>
                    <td class="col-r"><span class="td-num">${v.cycles}</span></td>
                    <td class="col-r">${v.onTimeRate!==null?`<span class="td-num" style="color:${v.onTimeRate>=.8?'var(--green)':'var(--orange)'}">${Math.round(v.onTimeRate*100)}%</span>`:`<span class="muted">—</span>`}</td>
                    <td>${daysSilent!==null?`<span class="${isAlert?'td-alert':''}">${daysSilent}d ago${isAlert?' ⚠️':''}</span>`:`<span class="muted">—</span>`}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        </div>`;
}

function attachRosterEvents() {
    const search=document.getElementById('roster-search');
    const tierSel=document.getElementById('roster-tier');
    function filterRoster() {
        const q=(search?.value||'').toLowerCase(), tier=tierSel?.value||'';
        document.querySelectorAll('#roster-tbody tr').forEach(tr=>{
            const name=(tr.dataset.name||'');
            const tierMatch = !tier || (tr.dataset.tier===tier);
            tr.style.display=(!q||name.includes(q))&&tierMatch?'':'none';
        });
    }
    search?.addEventListener('input',filterRoster);
    tierSel?.addEventListener('change',filterRoster);
}

/* ASSIGN TASK */
function dirAssignHTML() {
    const vols=(S.data.volunteers||[]).map(v=>v.name);
    const cycle=getCurrentCycle();
    return `
        <div class="card" style="max-width:640px">
            <div class="card-title">ASSIGN A TASK</div>
            <div class="form-grid">
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label">Volunteer *</label>
                        <select class="form-select" id="at-vol">
                            <option value="">Select volunteer…</option>
                            ${vols.map(n=>`<option>${esc(n)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tier Level</label>
                        <select class="form-select" id="at-tier">
                            ${Object.entries(CONFIG.TIERS).map(([k,t])=>`<option value="${k}">${t.name} (T${k})</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Task Name *</label>
                    <input class="form-input" id="at-name" placeholder="e.g. Design Week 3 Instagram Post">
                </div>
                <div class="form-group">
                    <label class="form-label">Description *</label>
                    <textarea class="form-textarea" id="at-desc" placeholder="What should the volunteer do? Be specific."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Done-When Statement *</label>
                    <input class="form-input" id="at-donewhen" placeholder="e.g. The post is exported at 1080×1080 and shared in Slack">
                </div>
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label">Deadline *</label>
                        <input class="form-input" type="date" id="at-deadline">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Hours Credit</label>
                        <input class="form-input" type="number" id="at-hours" placeholder="0" min="0" step="0.5">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Template Link</label>
                    <input class="form-input" id="at-template" placeholder="https://docs.google.com/…">
                </div>
                <div class="form-group">
                    <label class="form-label">Contact Person</label>
                    <input class="form-input" id="at-contact" placeholder="Your name or Discord handle" value="${esc(S.user?.name||'')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Cycle #</label>
                    <input class="form-input" type="number" id="at-cycle" placeholder="Cycle number" value="${cycle?cycle.num:''}">
                </div>
                <div class="form-err" id="at-err"></div>
                <button class="btn btn-primary" id="at-submit-btn">📋 Assign Task</button>
            </div>
        </div>`;
}

function attachAssignEvents() {
    document.getElementById('at-submit-btn').onclick=async()=>{
        const vol=document.getElementById('at-vol').value;
        const name=document.getElementById('at-name').value.trim();
        const desc=document.getElementById('at-desc').value.trim();
        const done=document.getElementById('at-donewhen').value.trim();
        const dl=document.getElementById('at-deadline').value;
        const err=document.getElementById('at-err');
        if(!vol||!name||!desc||!done||!dl){ err.textContent='Fill in all required fields.'; return; }
        err.textContent='';
        const btn=document.getElementById('at-submit-btn');
        btn.disabled=true; btn.textContent='Assigning…';
        try {
            const track = S.role==='president'?'':(CONFIG.DIRECTORS[S.role]||{}).track||'';
            await postAction('create_task',{
                taskId:genId(), volunteerName:vol,
                taskName:name, description:desc,
                tierLevel:document.getElementById('at-tier').value,
                cycleNumber:document.getElementById('at-cycle').value,
                templateLink:document.getElementById('at-template').value.trim(),
                doneWhen:done, deadline:dl,
                contactPerson:document.getElementById('at-contact').value.trim(),
                hours:document.getElementById('at-hours').value||'0',
                status:'Not Started', track, createdDate:new Date().toISOString(),
                directorName:S.user?.name||'',
            });
            toast(`Task assigned to ${vol}!`,'success');
            document.getElementById('at-vol').value='';
            document.getElementById('at-name').value='';
            document.getElementById('at-desc').value='';
            document.getElementById('at-donewhen').value='';
            document.getElementById('at-deadline').value='';
        } catch(e){ err.textContent=e.message; }
        btn.disabled=false; btn.textContent='📋 Assign Task';
    };
}

/* POST WIN */
function dirWinsPostHTML() {
    const vols=(S.data.volunteers||[]).map(v=>v.name);
    return `
        <div class="card" style="max-width:580px">
            <div class="card-title">POST RECOGNITION TO WINS BOARD</div>
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">Volunteer Name(s) *</label>
                    <input class="form-input" id="wn-names" placeholder="Name(s), comma-separated">
                    <div class="form-hint">Use "Team" for group recognition</div>
                </div>
                <div class="form-group">
                    <label class="form-label">Recognition Text *</label>
                    <textarea class="form-textarea" id="wn-text" placeholder="What did they do? What impact did it have? Be specific — this is what others will read."></textarea>
                </div>
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label">Type</label>
                        <select class="form-select" id="wn-type">
                            <option value="task">Task Completion</option>
                            <option value="session">Session Attendance</option>
                            <option value="rankup">Rank Up</option>
                            <option value="cross-track">Cross-Track</option>
                            <option value="spotlight">Monthly Spotlight</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Track</label>
                        <select class="form-select" id="wn-track">
                            <option value="">— Select Track —</option>
                            ${Object.keys(CONFIG.TRACKS).map(t=>`<option>${t}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-err" id="wn-err"></div>
                <button class="btn btn-primary" id="wn-submit-btn">🌟 Post to Wins Board</button>
            </div>
        </div>

        <div class="mt-20">
            <div class="section-title">RECENT WINS</div>
            <div class="wins-feed">
                ${(S.data.allWins||[]).slice(-5).reverse().map(winCardHTML).join('')||`<div class="muted text-small">No wins posted yet.</div>`}
            </div>
        </div>`;
}

function attachWinsPostEvents() {
    document.getElementById('wn-submit-btn').onclick=async()=>{
        const names=document.getElementById('wn-names').value.trim();
        const text=document.getElementById('wn-text').value.trim();
        const type=document.getElementById('wn-type').value;
        const track=document.getElementById('wn-track').value;
        const err=document.getElementById('wn-err');
        if(!names||!text){ err.textContent='Name and recognition text are required.'; return; }
        err.textContent='';
        const btn=document.getElementById('wn-submit-btn');
        btn.disabled=true; btn.textContent='Posting…';
        try {
            await postAction('post_win',{
                postId:genId(), volunteerNames:names, recognitionText:text,
                type, postedBy:S.user?.name||'Director',
                track, postedDate:new Date().toISOString(),
            });
            toast('Recognition posted to Wins Board!','success');
            document.getElementById('wn-names').value='';
            document.getElementById('wn-text').value='';
        } catch(e){ err.textContent=e.message; }
        btn.disabled=false; btn.textContent='🌟 Post to Wins Board';
    };
}

/* NOMINATIONS */
function dirNominationsHTML() {
    const vols=(S.data.volunteers||[]);
    const noms=(S.data.nominations||[]).filter(r=>r[2]===(CONFIG.DIRECTORS[S.role]||{}).title||(S.role==='president'));
    return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;flex-wrap:wrap" class="dir-nom-grid">
            <div class="card">
                <div class="card-title">SUBMIT NOMINATION</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Volunteer *</label>
                        <select class="form-select" id="nm-vol">
                            <option value="">Select volunteer…</option>
                            ${vols.map(v=>`<option>${esc(v.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Current Tier</label>
                        <select class="form-select" id="nm-tier">
                            ${Object.entries(CONFIG.TIERS).filter(([k])=>k!=='Exec').map(([k,t])=>`<option value="${k}">${t.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Note for ${esc(CONFIG.PRESIDENT_NAME)} *</label>
                        <textarea class="form-textarea" id="nm-note" placeholder="Why is this volunteer ready? What have you seen from them?"></textarea>
                    </div>
                    <div class="form-err" id="nm-err"></div>
                    <button class="btn btn-primary" id="nm-submit-btn">⭐ Submit Nomination</button>
                </div>
            </div>
            <div>
                <div class="section-title">PENDING NOMINATIONS</div>
                ${noms.filter(r=>r[4]==='Pending').length ?
                    noms.filter(r=>r[4]==='Pending').map(r=>`
                    <div class="nomination-card">
                        <div class="nom-info">
                            <div class="nom-name">${esc(r[1]||'')}</div>
                            <div class="nom-meta">Tier ${esc(r[6]||'')} → Tier ${esc(r[7]||'')} · Nominated ${fmtDate(r[5])}</div>
                            ${r[3]?`<div class="nom-note">"${esc(r[3])}"</div>`:''}
                        </div>
                        ${statusPill(r[4]||'Pending')}
                    </div>`).join('') :
                    `<div class="muted text-small">No pending nominations.</div>`}
            </div>
        </div>`;
}

function attachNomEvents() {
    document.getElementById('nm-submit-btn')?.addEventListener('click',async()=>{
        const vol=document.getElementById('nm-vol').value;
        const note=document.getElementById('nm-note').value.trim();
        const tier=document.getElementById('nm-tier').value;
        const err=document.getElementById('nm-err');
        if(!vol||!note){ err.textContent='All fields required.'; return; }
        err.textContent='';
        const btn=document.getElementById('nm-submit-btn');
        btn.disabled=true; btn.textContent='Submitting…';
        try {
            const targetTier={1:2,2:3,3:4,4:'Exec'}[parseInt(tier)]||tier;
            await postAction('create_nomination',{
                nomId:genId(), volunteerName:vol,
                director:(CONFIG.DIRECTORS[S.role]||{}).title||'Director',
                note, status:'Pending', nominatedDate:new Date().toISOString(),
                currentTier:tier, targetTier,
            });
            toast(`Nomination submitted for ${vol}!`,'success');
            document.getElementById('nm-vol').value='';
            document.getElementById('nm-note').value='';
        } catch(e){ err.textContent=e.message; }
        btn.disabled=false; btn.textContent='⭐ Submit Nomination';
    });
}

/* DOO: SESSIONS */
function dirSessionsHTML() {
    const sessions=S.data.sessions||[];
    return `
        <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:20px;align-items:start">
            <div class="card">
                <div class="card-title">CREATE SESSION</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Session Name *</label>
                        <input class="form-input" id="cs-name" placeholder="e.g. Westwood Elementary — Circuits">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Partner Organization *</label>
                        <input class="form-input" id="cs-org" placeholder="School or org name">
                    </div>
                    <div class="form-grid form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Date *</label>
                            <input class="form-input" type="date" id="cs-date">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Time</label>
                            <input class="form-input" type="time" id="cs-time">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Location</label>
                        <input class="form-input" id="cs-loc" placeholder="Address or room">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Kit Used</label>
                        <input class="form-input" id="cs-kit" placeholder="e.g. Circuits Kit v2">
                    </div>
                    <div class="form-grid form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Facilitator Spots</label>
                            <input class="form-input" type="number" id="cs-fac" placeholder="4" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Observer Spots</label>
                            <input class="form-input" type="number" id="cs-obs" placeholder="2" min="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Session Lead</label>
                        <select class="form-select" id="cs-lead">
                            <option value="">Select lead…</option>
                            ${(S.data.volunteers||[]).filter(v=>parseInt(v.tier)>=3).map(v=>`<option>${esc(v.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Hours Credit</label>
                        <input class="form-input" type="number" id="cs-hrs" placeholder="2" min="0" step="0.5">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notes / Briefing</label>
                        <textarea class="form-textarea" id="cs-notes" style="min-height:70px" placeholder="Student age group, special instructions…"></textarea>
                    </div>
                    <div class="form-err" id="cs-err"></div>
                    <button class="btn btn-primary" id="cs-submit-btn">📅 Create Session</button>
                </div>
            </div>
            <div>
                <div class="section-title">ALL SESSIONS</div>
                ${sessions.length?sessions.map(r=>`
                <div class="session-card">
                    <div class="session-name">${esc(r[1]||'')}</div>
                    <div class="session-detail" style="margin-top:6px">
                        ${r[2]?`<span class="session-detail-item">🏫 ${esc(r[2])}</span>`:''}
                        ${r[3]?`<span class="session-detail-item">📅 ${fmtDate(r[3])}</span>`:''}
                        ${r[9]?`<span class="session-detail-item">⭐ ${esc(r[9])}</span>`:''}
                    </div>
                    <div class="task-meta mt-4">${statusPill(r[10]||'Upcoming')}</div>
                    ${r[11]?`<div class="session-attendees mt-4">Attendees: ${esc(r[11])}</div>`:''}
                </div>`).join('') : `<div class="muted text-small">No sessions created yet.</div>`}
            </div>
        </div>`;
}

function attachSessionEvents() {
    document.getElementById('cs-submit-btn')?.addEventListener('click',async()=>{
        const name=document.getElementById('cs-name').value.trim();
        const org=document.getElementById('cs-org').value.trim();
        const date=document.getElementById('cs-date').value;
        const err=document.getElementById('cs-err');
        if(!name||!org||!date){ err.textContent='Name, org, and date are required.'; return; }
        err.textContent='';
        const btn=document.getElementById('cs-submit-btn');
        btn.disabled=true; btn.textContent='Creating…';
        try {
            await postAction('create_session',{
                sessionId:genId(), sessionName:name, partnerOrg:org, date,
                time:document.getElementById('cs-time').value,
                location:document.getElementById('cs-loc').value.trim(),
                kit:document.getElementById('cs-kit').value.trim(),
                facilitatorSpots:document.getElementById('cs-fac').value||'0',
                observerSpots:document.getElementById('cs-obs').value||'0',
                lead:document.getElementById('cs-lead').value,
                hours:document.getElementById('cs-hrs').value||'0',
                notes:document.getElementById('cs-notes').value.trim(),
                status:'Upcoming', attendees:'', createdDate:new Date().toISOString(),
            });
            toast(`Session "${name}" created!`,'success');
            document.getElementById('cs-name').value='';
            document.getElementById('cs-org').value='';
            document.getElementById('cs-date').value='';
        } catch(e){ err.textContent=e.message; }
        btn.disabled=false; btn.textContent='📅 Create Session';
    });
}

/* DOP: CONTENT CALENDAR */
function dirCalendarHTML() {
    const entries=S.data.content||[];
    const vols=(S.data.volunteers||[]).map(v=>v.name);
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now=new Date(), thisMonth=months[now.getMonth()]+' '+now.getFullYear();
    const monthEntries=entries.filter(r=>r[1]===thisMonth||!r[1]);

    return `
        <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:20px;align-items:start">
            <div class="card">
                <div class="card-title">ADD CALENDAR ENTRY</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Month</label>
                        <input class="form-input" id="cc-month" value="${esc(thisMonth)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Post Description *</label>
                        <textarea class="form-textarea" style="min-height:70px" id="cc-desc" placeholder="What is this post about?"></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Platform</label>
                        <select class="form-select" id="cc-platform">
                            <option>Instagram</option><option>TikTok</option><option>LinkedIn</option><option>Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Assigned Volunteer</label>
                        <select class="form-select" id="cc-vol">
                            <option value="">Unassigned</option>
                            ${vols.map(n=>`<option>${esc(n)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Due Date</label>
                        <input class="form-input" type="date" id="cc-due">
                    </div>
                    <div class="form-err" id="cc-err"></div>
                    <button class="btn btn-primary" id="cc-submit-btn">📆 Add Entry</button>
                </div>
            </div>
            <div>
                <div class="section-title">CONTENT CALENDAR — ${esc(thisMonth)}</div>
                ${monthEntries.length ? `
                <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>Description</th><th>Platform</th><th>Assigned To</th><th>Due</th><th>Status</th></tr></thead>
                    <tbody>
                    ${monthEntries.map(r=>`<tr>
                        <td style="max-width:200px;font-size:13px">${esc(r[2]||'')}</td>
                        <td>${esc(r[3]||'')}</td>
                        <td>${r[4]?esc(r[4]):'<span class="muted">—</span>'}</td>
                        <td>${fmtDate(r[6])}</td>
                        <td>${statusPill(r[5]||'Not Started')}</td>
                    </tr>`).join('')}
                    </tbody>
                </table>
                </div>` : `<div class="muted text-small">No entries for this month yet.</div>`}
            </div>
        </div>`;
}

function attachCalEvents() {
    document.getElementById('cc-submit-btn')?.addEventListener('click',async()=>{
        const desc=document.getElementById('cc-desc').value.trim();
        const err=document.getElementById('cc-err');
        if(!desc){ err.textContent='Description required.'; return; }
        err.textContent='';
        const btn=document.getElementById('cc-submit-btn');
        btn.disabled=true; btn.textContent='Adding…';
        try {
            await postAction('add_content_entry',{
                entryId:genId(),
                month:document.getElementById('cc-month').value.trim(),
                description:desc,
                platform:document.getElementById('cc-platform').value,
                assignedVol:document.getElementById('cc-vol').value,
                status:'Not Started',
                dueDate:document.getElementById('cc-due').value,
                approved:'FALSE', createdDate:new Date().toISOString(),
            });
            toast('Entry added to calendar!','success');
            document.getElementById('cc-desc').value='';
        } catch(e){ err.textContent=e.message; }
        btn.disabled=false; btn.textContent='📆 Add Entry';
    });
}

/* PRESIDENT: PROMOTIONS */
function dirPromotionsHTML() {
    const noms=(S.data.nominations||[]);
    const pending=noms.filter(r=>r[4]==='Pending');
    const recent=noms.filter(r=>r[4]!=='Pending').slice(-5).reverse();
    return `
        <div class="section-title">PENDING NOMINATIONS (${pending.length})</div>
        ${pending.length ? pending.map(r=>`
        <div class="nomination-card">
            <div class="nom-info">
                <div class="nom-name">${esc(r[1]||'')} ${tierBadge(r[6])} → ${tierBadge(r[7])}</div>
                <div class="nom-meta">Nominated by ${esc(r[2]||'')} · ${fmtDate(r[5])}</div>
                ${r[3]?`<div class="nom-note">"${esc(r[3])}"</div>`:''}
            </div>
            <div class="nom-actions">
                <button class="btn btn-success btn-sm prom-confirm-btn" data-id="${esc(r[0])}" data-vol="${esc(r[1])}" data-tier="${esc(r[7])}">✓ Confirm</button>
                <button class="btn btn-danger btn-sm prom-decline-btn" data-id="${esc(r[0])}">✕ Decline</button>
            </div>
        </div>`).join('') : `<div class="muted text-small mb-20">No pending nominations.</div>`}

        ${recent.length?`<div class="section-title mt-20">RECENT DECISIONS</div>
        ${recent.map(r=>`<div class="nomination-card">
            <div class="nom-info">
                <div class="nom-name">${esc(r[1]||'')} ${tierBadge(r[7])}</div>
                <div class="nom-meta">${esc(r[2]||'')} · ${fmtDate(r[5])}</div>
            </div>
            ${statusPill(r[4]||'Pending')}
        </div>`).join('')}`:''}`;
}

function attachPromEvents() {
    document.querySelectorAll('.prom-confirm-btn').forEach(btn=>{
        btn.onclick=async()=>{
            const id=btn.dataset.id, vol=btn.dataset.vol, tier=btn.dataset.tier;
            btn.disabled=true; btn.textContent='Confirming…';
            try {
                await postAction('confirm_promotion',{
                    nomId:id, volunteerName:vol, newTier:tier,
                    confirmedDate:new Date().toISOString(), presidentName:CONFIG.PRESIDENT_NAME,
                });
                toast(`${vol} promoted!`,'success');
                await loadDirectorData('All');
                viewDirectorPanel('promotions');
            } catch(e){ toast(e.message,'error'); btn.disabled=false; btn.textContent='✓ Confirm'; }
        };
    });
    document.querySelectorAll('.prom-decline-btn').forEach(btn=>{
        btn.onclick=async()=>{
            btn.disabled=true; btn.textContent='Declining…';
            try {
                await postAction('update_nomination',{nomId:btn.dataset.id,status:'Declined',updatedDate:new Date().toISOString()});
                toast('Nomination declined.','success');
                await loadDirectorData('All');
                viewDirectorPanel('promotions');
            } catch(e){ toast(e.message,'error'); btn.disabled=false; btn.textContent='✕ Decline'; }
        };
    });
}

/* ═══════════════════════════════════════════════════════════════
   TOAST & LOADING
   ═══════════════════════════════════════════════════════════════ */
function toast(msg, type='success') {
    const wrap=document.getElementById('toast-wrap');
    const el=document.createElement('div');
    el.className=`toast ${type}`;
    el.innerHTML=`<span>${type==='success'?'✓':'⚠'}</span>${esc(msg)}`;
    wrap.appendChild(el);
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),300); },3500);
}

function showLoading() {
    const el=document.getElementById('portal-loading');
    if(el){ el.classList.remove('hidden'); }
}
function hideLoading() {
    const el=document.getElementById('portal-loading');
    if(el){ el.classList.add('hidden'); }
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
document.addEventListener('DOMContentLoaded', () => {
    initAuth().catch(e=>showAuthError(e.message));
});
