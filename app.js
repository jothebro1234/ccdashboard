// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let allData         = [];
let previousRanks   = {};
let currentCategory = 'hours';
let timerInterval   = null;
let timerVal        = CONFIG.REFRESH_INTERVAL;

// ═══════════════════════════════════════════════════════════════
// CINEMATIC INTRO
// ═══════════════════════════════════════════════════════════════
function runIntro() {
    const intro = document.getElementById('intro');
    setTimeout(() => {
        intro.classList.add('reveal');
        setTimeout(() => {
            intro.style.display = 'none';
            animatePageIn();
        }, 1000);
    }, 2900);
}

function animatePageIn() {
    document.querySelectorAll('[data-ani]').forEach((el, i) => {
        setTimeout(() => el.classList.add('in'), i * 110);
    });
}

// ═══════════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════════
async function fetchSheet(name) {
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} (sheet: "${name}")`);
    return parseCSV(await res.text());
}

async function fetchData() {
    try {
        const [volRows, eventRows, currRows, exRows] = await Promise.all([
            fetchSheet(CONFIG.SHEET_NAME),
            fetchSheet(CONFIG.EVENTS_SHEET_NAME),
            fetchSheet(CONFIG.CURRICULUM_SHEET_NAME),
            fetchSheet(CONFIG.EXCEPTIONS_SHEET_NAME).catch(() => []),
        ]);

        const exceptions = new Set(
            exRows.slice(1).map(r => (r[0]||'').trim().toLowerCase()).filter(Boolean)
        );

        if (volRows.length < 1) throw new Error('Volunteers sheet is empty');

        // Volunteers sheet: Name | Discord | School | Avatar
        const volMap = {};
        volRows.slice(1).forEach(r => {
            const name = (r[0] || '').trim();
            if (!name) return;
            volMap[name.toLowerCase()] = {
                name,
                discord:        (r[1] || '').trim(),
                school:         (r[2] || '').trim(),
                avatar:         (r[3] || '').trim(),
                hours:      0,  events:      0,  curriculum:      0,
                eventList: [],  curriculumList: [],
            };
        });

        // Events sheet: Event Name | Date | Hours | Attendees
        eventRows.slice(1).forEach(r => {
            const evName    = (r[0] || '').trim();
            const date      = (r[1] || '').trim();
            const hrs       = parseFloat(r[2]) || 0;
            const attendees = (r[3] || '').split(',').map(n => n.trim()).filter(Boolean);
            attendees.forEach(att => {
                const key = att.toLowerCase();
                if (!volMap[key]) volMap[key] = { name:att, discord:'', school:'', avatar:'', hours:0, events:0, curriculum:0, eventList:[], curriculumList:[] };
                volMap[key].hours  += hrs;
                volMap[key].events += 1;
                volMap[key].eventList.push({ name: evName, date, hours: hrs });
            });
        });

        // Curriculum sheet: Curriculum Name | Date | Hours | Contributors
        currRows.slice(1).forEach(r => {
            const currName = (r[0] || '').trim();
            const date     = (r[1] || '').trim();
            const hrs      = parseFloat(r[2]) || 0;
            const contribs = (r[3] || '').split(',').map(n => n.trim()).filter(Boolean);
            contribs.forEach(contrib => {
                const key = contrib.toLowerCase();
                if (!volMap[key]) volMap[key] = { name:contrib, discord:'', school:'', avatar:'', hours:0, events:0, curriculum:0, eventList:[], curriculumList:[] };
                volMap[key].curriculum += 1;
                volMap[key].hours      += hrs;
                volMap[key].curriculumList.push({ name: currName, date, hours: hrs });
            });
        });

        allData = Object.values(volMap).filter(v => !exceptions.has(v.name.toLowerCase()));
        render(allData);
        hideLoading();
        document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();

    } catch (err) {
        console.error('[Leaderboard]', err);
        if (allData.length === 0) showFetchError(err.message);
    }
}

async function fetchAnnouncement() {
    try {
        const rows = await fetchSheet(CONFIG.ANNOUNCEMENTS_SHEET_NAME);
        const text = rows[0] && rows[0][0] ? rows[0][0].trim() : '';
        if (text) {
            document.getElementById('ann-text').textContent = text;
            const wrap = document.getElementById('ann-wrap');
            wrap.style.display = 'block';
            wrap.classList.add('in');
        }
    } catch (_) { /* optional — fail silently */ }
}

function parseCSV(raw) {
    const rows = [];
    let i = 0;
    while (i < raw.length) {
        const row = [];
        while (i < raw.length && raw[i] === '\r') i++;
        if (i >= raw.length) break;
        while (i < raw.length && raw[i] !== '\n') {
            let field = '';
            if (raw[i] === '"') {
                i++;
                while (i < raw.length) {
                    if (raw[i] === '"' && raw[i+1] === '"') { field += '"'; i += 2; }
                    else if (raw[i] === '"') { i++; break; }
                    else field += raw[i++];
                }
            } else {
                while (i < raw.length && raw[i] !== ',' && raw[i] !== '\n' && raw[i] !== '\r') field += raw[i++];
            }
            row.push(field.trim());
            if (raw[i] === ',') i++;
        }
        if (i < raw.length) i++;
        if (row.some(f => f)) rows.push(row);
    }
    return rows;
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
function render(data) {
    const sorted = sortData(data, currentCategory);
    renderStats(data);
    renderPodium(sorted);
    renderList(sorted);
}

function sortData(data, cat) {
    return [...data].sort((a, b) => {
        if (cat === 'hours')      return b.hours      - a.hours;
        if (cat === 'events')     return b.events     - a.events;
        if (cat === 'curriculum') return b.curriculum - a.curriculum;
        return 0;
    });
}

function getStatVal(vol, cat) {
    if (cat === 'hours')      return vol.hours;
    if (cat === 'events')     return vol.events;
    if (cat === 'curriculum') return vol.curriculum;
    return 0;
}

function getStatLbl(cat, short = false) {
    if (cat === 'hours')      return short ? 'hrs'       : 'hours';
    if (cat === 'events')     return short ? 'events'    : 'events';
    if (cat === 'curriculum') return short ? 'developed' : 'developed';
    return '';
}

function renderStats(data) {
    animateNum('stat-volunteers', data.length);
    animateNum('stat-hours',      Math.round(data.reduce((s, v) => s + v.hours,      0)));
    animateNum('stat-events',     data.reduce((s, v) => s + v.events,     0));
    animateNum('stat-curriculum', data.reduce((s, v) => s + v.curriculum, 0));
}

// ── Podium ─────────────────────────────────────────────────────
function renderPodium(sorted) {
    const grid = document.getElementById('podium');
    grid.innerHTML = '';
    if (!sorted.length) return;

    const slots = [sorted[1], sorted[0], sorted[2]];
    const ranks = [2, 1, 3];

    slots.forEach((vol, i) => {
        if (!vol) { grid.appendChild(document.createElement('div')); return; }
        const rank    = ranks[i];
        const statVal = getStatVal(vol, currentCategory);
        const statLbl = getStatLbl(currentCategory);

        const card = document.createElement('div');
        card.className = `podium-card p${rank}`;
        card.innerHTML = `
            <div class="pod-rank">#${rank}</div>
            <div class="pod-av">${avHTML(vol, rank === 1 ? 80 : 70)}</div>
            <div class="pod-name">${esc(vol.name)}</div>
            ${vol.discord && CONFIG.SHOW_DISCORD ? `<div class="pod-disc">@${esc(vol.discord)}</div>` : ''}
            ${vol.school ? `<div class="pod-school">🏫 ${esc(vol.school)}</div>` : ''}
            <div class="pod-stat" data-v="${statVal}">0</div>
            <div class="pod-stat-lbl">${statLbl}</div>
        `;
        card.addEventListener('click', () => openModal(vol.name));
        grid.appendChild(card);
        setTimeout(() => animateCounter(card.querySelector('.pod-stat'), statVal), 60 * i);
    });
}

// ── List (rank 4+) ──────────────────────────────────────────────
function renderList(sorted) {
    const container = document.getElementById('leaderboard-list');
    const rest = sorted.slice(3);

    const newRanks = {};
    sorted.forEach((v, i) => { newRanks[v.name] = i + 1; });

    container.innerHTML = '';

    if (!rest.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎖️</div>Everyone is on the podium!</div>`;
        document.getElementById('list-count').textContent = '';
        previousRanks = newRanks;
        return;
    }

    rest.forEach((vol, i) => {
        const rank    = i + 4;
        const statVal = getStatVal(vol, currentCategory);
        const statLbl = getStatLbl(currentCategory, true);
        const prev    = previousRanks[vol.name];

        let changeHTML = '';
        if (prev !== undefined) {
            const diff = prev - rank;
            if (diff > 0)      changeHTML = `<span class="lb-change up">▲${diff}</span>`;
            else if (diff < 0) changeHTML = `<span class="lb-change down">▼${Math.abs(diff)}</span>`;
            else               changeHTML = `<span class="lb-change same">—</span>`;
        }

        const item = document.createElement('div');
        item.className = 'lb-item';
        item.style.animationDelay = `${Math.min(i * 22, 350)}ms`;
        item.dataset.name = vol.name.toLowerCase();
        item.innerHTML = `
            <div class="lb-rank">${rank}</div>
            <div class="lb-av">${avHTML(vol, 40)}</div>
            <div class="lb-info">
                <div class="lb-name">${esc(vol.name)}</div>
                ${vol.discord && CONFIG.SHOW_DISCORD ? `<div class="lb-disc">@${esc(vol.discord)}</div>` : ''}
                ${vol.school ? `<div class="lb-school">🏫 ${esc(vol.school)}</div>` : ''}
            </div>
            ${changeHTML}
            <div class="lb-stat">
                <div class="lb-stat-val">${fmt(statVal)}</div>
                <div class="lb-stat-lbl">${statLbl}</div>
            </div>
            <span class="lb-chev">›</span>
        `;
        item.addEventListener('click', () => openModal(vol.name));
        container.appendChild(item);
    });

    document.getElementById('list-count').textContent = `${rest.length} more`;
    previousRanks = newRanks;
    applySearch();
}

// ═══════════════════════════════════════════════════════════════
// VOLUNTEER MODAL
// ═══════════════════════════════════════════════════════════════
function openModal(name) {
    const vol = allData.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (!vol) return;

    document.getElementById('modal-av').innerHTML    = avHTML(vol, 58);
    document.getElementById('modal-name').textContent = vol.name;
    document.getElementById('modal-disc').textContent = vol.discord ? `@${vol.discord}` : '';
    document.getElementById('modal-school').textContent = vol.school ? `🏫 ${vol.school}` : '';
    document.getElementById('modal-hrs').textContent  = fmt(Math.round(vol.hours * 10) / 10);
    document.getElementById('modal-evc').textContent  = vol.events;
    document.getElementById('modal-curr').textContent = vol.curriculum;

    // Events list
    const evList = document.getElementById('modal-ev-list');
    evList.innerHTML = '';
    if (vol.eventList && vol.eventList.length > 0) {
        [...vol.eventList]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach(ev => {
                const item = document.createElement('div');
                item.className = 'm-ev-item';
                item.innerHTML = `
                    <div class="m-ev-dot"></div>
                    <div class="m-ev-info">
                        <div class="m-ev-name">${esc(ev.name)}</div>
                        <div class="m-ev-date">${fmtDate(ev.date)}</div>
                    </div>
                    <div class="m-ev-hrs">${ev.hours % 1 === 0 ? ev.hours : ev.hours.toFixed(1)} hrs</div>
                `;
                evList.appendChild(item);
            });
    } else {
        evList.innerHTML = '<div class="m-empty">No events recorded yet.</div>';
    }

    // Curriculum list
    const currTitle = document.getElementById('modal-curr-title');
    const currList  = document.getElementById('modal-curr-list');
    currList.innerHTML = '';
    if (vol.curriculumList && vol.curriculumList.length > 0) {
        currTitle.style.display = '';
        [...vol.curriculumList]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach(c => {
                const item = document.createElement('div');
                item.className = 'm-ev-item';
                item.innerHTML = `
                    <div class="m-ev-dot" style="background:var(--cyan);box-shadow:0 0 0 3px rgba(34,211,238,0.15)"></div>
                    <div class="m-ev-info">
                        <div class="m-ev-name">${esc(c.name)}</div>
                        <div class="m-ev-date">${fmtDate(c.date)}</div>
                    </div>
                    <div class="m-ev-hrs" style="color:var(--cyan)">${c.hours > 0 ? (c.hours % 1 === 0 ? c.hours : c.hours.toFixed(1)) + ' hrs' : '📚'}</div>
                `;
                currList.appendChild(item);
            });
    } else {
        currTitle.style.display = 'none';
    }

    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
}

function fmtDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

// ═══════════════════════════════════════════════════════════════
// AVATARS
// ═══════════════════════════════════════════════════════════════
const PALETTE = ['#38bdf8','#a78bfa','#22d3ee','#f472b6','#fb923c','#34d399','#fbbf24','#818cf8'];

function avHTML(vol, size) {
    if (vol.avatar && /^https?:\/\//.test(vol.avatar)) {
        const fb = initSVG(vol.name, size).replace(/'/g, "\\'");
        return `<img src="${esc(vol.avatar)}" alt="${esc(vol.name)}" loading="lazy" onerror="this.outerHTML='${fb}'">`;
    }
    return initSVG(vol.name, size);
}

function initSVG(name, size) {
    const color    = PALETTE[name.charCodeAt(0) % PALETTE.length];
    const initials = name.trim().split(/\s+/).map(w => w[0]||'').slice(0,2).join('').toUpperCase();
    const fs       = Math.round(size * 0.37);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${size/2}" fill="${color}1a"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
              fill="${color}" font-family="Space Grotesk,sans-serif"
              font-weight="700" font-size="${fs}">${initials}</text>
    </svg>`;
}

// ═══════════════════════════════════════════════════════════════
// ANIMATIONS
// ═══════════════════════════════════════════════════════════════
function animateCounter(el, target, dur = 1000) {
    const start = Date.now();
    const tick = () => {
        const p = Math.min((Date.now() - start) / dur, 1);
        el.textContent = fmt(Math.round(target * (1 - Math.pow(1-p, 3))));
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(target);
    };
    requestAnimationFrame(tick);
}

function animateNum(id, target, dur = 700) {
    const el = document.getElementById(id);
    if (!el) return;
    const from  = parseInt(el.textContent.replace(/\D/g,'')) || 0;
    const start = Date.now();
    const tick = () => {
        const p = Math.min((Date.now() - start) / dur, 1);
        el.textContent = fmt(Math.round(from + (target - from) * (1 - Math.pow(1-p, 3))));
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(target);
    };
    requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════════
// COUNTDOWN
// ═══════════════════════════════════════════════════════════════
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerVal = CONFIG.REFRESH_INTERVAL;
    tickTimer();
    timerInterval = setInterval(() => {
        timerVal--;
        tickTimer();
        if (timerVal <= 0) { timerVal = CONFIG.REFRESH_INTERVAL; fetchData(); }
    }, 1000);
}

function tickTimer() {
    const el   = document.getElementById('countdown');
    const ring = document.getElementById('ring-fill');
    if (el)   el.textContent = timerVal;
    if (ring) ring.setAttribute('stroke-dasharray', `${((timerVal/CONFIG.REFRESH_INTERVAL)*100).toFixed(1)} 100`);
}

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════
function setupSearch() {
    document.getElementById('search').addEventListener('input', applySearch);
}

function applySearch() {
    const q = document.getElementById('search').value.toLowerCase().trim();
    const items = document.querySelectorAll('.lb-item');
    let count = 0;
    items.forEach(item => {
        const show = !q || item.dataset.name.includes(q);
        item.style.display = show ? '' : 'none';
        if (show) count++;
    });
    if (items.length)
        document.getElementById('list-count').textContent =
            q ? `${count} result${count !== 1 ? 's' : ''}` : `${items.length} more`;
}

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════
function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.cat;
            if (allData.length) render(allData);
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// LOADING / ERROR
// ═══════════════════════════════════════════════════════════════
function hideLoading() {
    const el = document.getElementById('loading');
    if (!el) return;
    el.classList.add('hidden');
    setTimeout(() => el.remove(), 600);
}

function showFetchError(msg) {
    const el = document.getElementById('loading');
    if (!el) return;
    el.innerHTML = `
        <div class="err-card">
            <div class="err-icon">⚠️</div>
            <h3>Could not load data</h3>
            <p>${esc(msg)}</p>
            <p style="margin-top:12px">Check your Sheet ID in <code>config.js</code> and make sure all sheets are shared publicly.</p>
        </div>`;
}

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
function fmt(n) { return typeof n === 'number' && !isNaN(n) ? n.toLocaleString() : String(n); }

function esc(s) {
    return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fab-join').href = CONFIG.JOIN_URL;
    document.getElementById('fab-ig').href   = CONFIG.INSTAGRAM_URL;

    setupTabs();
    setupSearch();

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    runIntro();
    fetchData();
    fetchAnnouncement();
    startTimer();
});
