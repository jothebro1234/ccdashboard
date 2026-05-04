// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let allData         = [];
let previousRanks   = {};
let currentCategory = 'hours';
let timerInterval   = null;
let timerVal        = CONFIG.REFRESH_INTERVAL;

// ═══════════════════════════════════════════════════════════════
// DATA FETCHING — two sheets in parallel
// ═══════════════════════════════════════════════════════════════
async function fetchSheet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching sheet "${sheetName}"`);
    return parseCSV(await res.text());
}

async function fetchData() {
    try {
        const [volRows, eventRows] = await Promise.all([
            fetchSheet(CONFIG.SHEET_NAME),
            fetchSheet(CONFIG.EVENTS_SHEET_NAME),
        ]);

        if (volRows.length < 1) throw new Error('Volunteers sheet appears empty');

        // Build volunteer map from Volunteers sheet (Name | Discord | Avatar)
        const volMap = {};
        volRows.slice(1).forEach(r => {
            const name = (r[0] || '').trim();
            if (!name) return;
            volMap[name.toLowerCase()] = {
                name,
                discord:   (r[1] || '').trim(),
                avatar:    (r[2] || '').trim(),
                hours:     0,
                events:    0,
                eventList: [],
            };
        });

        // Process events sheet (Event Name | Date | Hours | Attendees)
        eventRows.slice(1).forEach(r => {
            const eventName = (r[0] || '').trim();
            const date      = (r[1] || '').trim();
            const hrs       = parseFloat(r[2]) || 0;
            const attendees = (r[3] || '').split(',').map(n => n.trim()).filter(Boolean);

            attendees.forEach(attendee => {
                const key = attendee.toLowerCase();
                if (!volMap[key]) {
                    // Auto-create entry if volunteer appears in events but not Volunteers sheet
                    volMap[key] = { name: attendee, discord: '', avatar: '', hours: 0, events: 0, eventList: [] };
                }
                volMap[key].hours += hrs;
                volMap[key].events += 1;
                volMap[key].eventList.push({ name: eventName, date, hours: hrs });
            });
        });

        allData = Object.values(volMap);
        render(allData);
        hideLoading();
        document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();

    } catch (err) {
        console.error('[Leaderboard]', err);
        if (allData.length === 0) showFetchError(err.message);
    }
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
                    else if (raw[i] === '"')                 { i++; break; }
                    else                                      { field += raw[i++]; }
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
    return [...data].sort((a, b) => cat === 'hours' ? b.hours - a.hours : b.events - a.events);
}

// ── Stats ─────────────────────────────────────────────────────
function renderStats(data) {
    animateNum('stat-volunteers', data.length);
    animateNum('stat-hours',      Math.round(data.reduce((s, v) => s + v.hours,  0)));
    animateNum('stat-events',     data.reduce((s, v) => s + v.events, 0));
}

// ── Podium ────────────────────────────────────────────────────
function renderPodium(sorted) {
    const grid = document.getElementById('podium');
    grid.innerHTML = '';
    if (sorted.length === 0) return;

    // Display order: 2nd | 1st | 3rd
    const slots = [sorted[1], sorted[0], sorted[2]];
    const ranks = [2, 1, 3];

    slots.forEach((vol, i) => {
        if (!vol) { grid.appendChild(document.createElement('div')); return; }
        const rank    = ranks[i];
        const statVal = currentCategory === 'hours' ? vol.hours : vol.events;
        const statLbl = currentCategory === 'hours' ? 'hours' : 'events';

        const card = document.createElement('div');
        card.className = `podium-card p${rank}`;
        card.setAttribute('title', `Click to view ${vol.name}'s profile`);
        card.innerHTML = `
            <div class="podium-rank">#${rank}</div>
            <div class="podium-avatar">${avatarHTML(vol, 64)}</div>
            <div class="podium-name">${esc(vol.name)}</div>
            ${vol.discord && CONFIG.SHOW_DISCORD ? `<div class="podium-discord">@${esc(vol.discord)}</div>` : ''}
            <div class="podium-stat" data-val="${statVal}">0</div>
            <div class="podium-stat-lbl">${statLbl}</div>
        `;
        card.addEventListener('click', () => openModal(vol.name));
        grid.appendChild(card);

        const statEl = card.querySelector('.podium-stat');
        setTimeout(() => animateCounter(statEl, statVal), 60 * i);
    });
}

// ── List (rank 4+) ────────────────────────────────────────────
function renderList(sorted) {
    const container = document.getElementById('leaderboard-list');
    const rest      = sorted.slice(3);

    const newRanks = {};
    sorted.forEach((v, i) => { newRanks[v.name] = i + 1; });

    container.innerHTML = '';

    if (rest.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎖️</div>Everyone is on the podium!</div>`;
        document.getElementById('list-count').textContent = '';
        previousRanks = newRanks;
        return;
    }

    rest.forEach((vol, i) => {
        const rank    = i + 4;
        const statVal = currentCategory === 'hours' ? vol.hours : vol.events;
        const statLbl = currentCategory === 'hours' ? 'hrs' : 'events';
        const prev    = previousRanks[vol.name];

        let changeHTML = '';
        if (prev !== undefined) {
            const diff = prev - rank;
            if      (diff > 0) changeHTML = `<span class="lb-change up">▲${diff}</span>`;
            else if (diff < 0) changeHTML = `<span class="lb-change down">▼${Math.abs(diff)}</span>`;
            else               changeHTML = `<span class="lb-change same">—</span>`;
        }

        const item = document.createElement('div');
        item.className = 'lb-item';
        item.style.animationDelay = `${Math.min(i * 22, 350)}ms`;
        item.dataset.name = vol.name.toLowerCase();
        item.innerHTML = `
            <div class="lb-rank">${rank}</div>
            <div class="lb-avatar">${avatarHTML(vol, 40)}</div>
            <div class="lb-info">
                <div class="lb-name">${esc(vol.name)}</div>
                ${vol.discord && CONFIG.SHOW_DISCORD ? `<div class="lb-discord">@${esc(vol.discord)}</div>` : ''}
            </div>
            ${changeHTML}
            <div class="lb-stat">
                <div class="lb-stat-val">${fmt(statVal)}</div>
                <div class="lb-stat-lbl">${statLbl}</div>
            </div>
            <span class="lb-chevron">›</span>
        `;
        item.addEventListener('click', () => openModal(vol.name));
        container.appendChild(item);
    });

    document.getElementById('list-count').textContent = `${rest.length} more`;
    previousRanks = newRanks;
    applySearch();
}

// ═══════════════════════════════════════════════════════════════
// VOLUNTEER PROFILE MODAL
// ═══════════════════════════════════════════════════════════════
function openModal(name) {
    const vol = allData.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (!vol) return;

    document.getElementById('modal-avatar').innerHTML = avatarHTML(vol, 60);
    document.getElementById('modal-name').textContent    = vol.name;
    document.getElementById('modal-discord').textContent = vol.discord ? `@${vol.discord}` : '';
    document.getElementById('modal-hours').textContent    = fmt(Math.round(vol.hours * 10) / 10);
    document.getElementById('modal-ev-count').textContent = vol.events;

    const list = document.getElementById('modal-event-list');
    list.innerHTML = '';

    if (vol.eventList && vol.eventList.length > 0) {
        const sorted = [...vol.eventList].sort((a, b) => new Date(b.date) - new Date(a.date));
        sorted.forEach(ev => {
            const item = document.createElement('div');
            item.className = 'modal-event-item';
            item.innerHTML = `
                <div class="mei-dot"></div>
                <div class="mei-info">
                    <div class="mei-name">${esc(ev.name)}</div>
                    <div class="mei-date">${formatDate(ev.date)}</div>
                </div>
                <div class="mei-hours">${ev.hours % 1 === 0 ? ev.hours : ev.hours.toFixed(1)} hrs</div>
            `;
            list.appendChild(item);
        });
    } else {
        list.innerHTML = '<div class="modal-empty">No events recorded yet.</div>';
    }

    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
}

function formatDate(str) {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════
// AVATAR GENERATION
// ═══════════════════════════════════════════════════════════════
const PALETTE = ['#0ea5e9','#c084fc','#0284c7','#f472b6','#fb923c','#34d399','#f59e0b','#38bdf8'];

function avatarHTML(vol, size) {
    if (vol.avatar && /^https?:\/\//.test(vol.avatar)) {
        const fb = initSVG(vol.name, size).replace(/'/g, "\\'");
        return `<img src="${esc(vol.avatar)}" alt="${esc(vol.name)}" loading="lazy" onerror="this.outerHTML='${fb}'">`;
    }
    return initSVG(vol.name, size);
}

function initSVG(name, size) {
    const color    = PALETTE[name.charCodeAt(0) % PALETTE.length];
    const initials = name.trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
    const fs       = Math.round(size * 0.36);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${size/2}" fill="${color}18"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
              fill="${color}" font-family="Space Grotesk,sans-serif"
              font-weight="700" font-size="${fs}">${initials}</text>
    </svg>`;
}

// ═══════════════════════════════════════════════════════════════
// ANIMATIONS
// ═══════════════════════════════════════════════════════════════
function animateCounter(el, target, duration = 900) {
    const start = Date.now();
    function tick() {
        const p = Math.min((Date.now() - start) / duration, 1);
        el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(target);
    }
    requestAnimationFrame(tick);
}

function animateNum(id, target, duration = 650) {
    const el = document.getElementById(id);
    if (!el) return;
    const from  = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
    const start = Date.now();
    function tick() {
        const p = Math.min((Date.now() - start) / duration, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(from + (target - from) * e));
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(target);
    }
    requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════════
// COUNTDOWN TIMER
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
    if (ring) ring.setAttribute('stroke-dasharray', `${((timerVal / CONFIG.REFRESH_INTERVAL) * 100).toFixed(1)} 100`);
}

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════
function setupSearch() {
    document.getElementById('search').addEventListener('input', applySearch);
}

function applySearch() {
    const q     = document.getElementById('search').value.toLowerCase().trim();
    const items = document.querySelectorAll('.lb-item');
    let   count = 0;
    items.forEach(item => {
        const show = !q || item.dataset.name.includes(q);
        item.style.display = show ? '' : 'none';
        if (show) count++;
    });
    if (items.length > 0)
        document.getElementById('list-count').textContent = q ? `${count} result${count !== 1 ? 's' : ''}` : `${items.length} more`;
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
        <div class="error-card">
            <div class="error-icon">⚠️</div>
            <h3>Could not load data</h3>
            <p>${esc(msg)}</p>
            <p style="margin-top:12px">Make sure your Sheet ID is correct in <code>config.js</code> and both sheets are shared publicly (Anyone with link → Viewer).</p>
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
    document.getElementById('org-name').textContent = CONFIG.ORG_NAME;
    setupTabs();
    setupSearch();
    fetchData();
    startTimer();

    // Modal close handlers
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
});
