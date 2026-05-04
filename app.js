// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let allData         = [];
let previousRanks   = {};
let currentCategory = 'hours';
let timerInterval   = null;
let timerVal        = CONFIG.REFRESH_INTERVAL;

// ═══════════════════════════════════════════════════════════════
// STARFIELD BACKGROUND
// ═══════════════════════════════════════════════════════════════
function initStarfield() {
    const canvas = document.getElementById('stars');
    const ctx    = canvas.getContext('2d');
    let stars    = [];

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        stars = Array.from({ length: 160 }, () => ({
            x:  Math.random() * canvas.width,
            y:  Math.random() * canvas.height,
            r:  0.3 + Math.random() * 1.2,
            op: Math.random() * 0.7 + 0.1,
            d:  (Math.random() - 0.5) * 0.015,
        }));
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const s of stars) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${s.op.toFixed(2)})`;
            ctx.fill();
            s.op += s.d;
            if (s.op > 0.8 || s.op < 0.05) s.d *= -1;
        }
        requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
}

// ═══════════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════════
async function fetchData() {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const rows = parseCSV(text);
        if (rows.length < 2) throw new Error('Sheet appears empty');

        const data = rows.slice(1)
            .map(r => ({
                name:    (r[0] || '').trim(),
                discord: (r[1] || '').trim(),
                hours:   parseFloat(r[2]) || 0,
                events:  parseInt(r[3])   || 0,
                avatar:  (r[4] || '').trim(),
            }))
            .filter(v => v.name);

        allData = data;
        render(data);
        hideLoading();
        document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();

    } catch (err) {
        console.error('[Leaderboard] Fetch error:', err);
        if (allData.length === 0) showFetchError(err.message);
    }
}

function parseCSV(raw) {
    const rows = [];
    let i = 0;
    while (i < raw.length) {
        const row = [];
        // skip \r
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
                while (i < raw.length && raw[i] !== ',' && raw[i] !== '\n' && raw[i] !== '\r') {
                    field += raw[i++];
                }
            }
            row.push(field.trim());
            if (raw[i] === ',') i++;
        }
        if (i < raw.length) i++; // skip \n
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
    const hours  = data.reduce((s, v) => s + v.hours,  0);
    const events = data.reduce((s, v) => s + v.events, 0);
    animateNum('stat-volunteers', data.length);
    animateNum('stat-hours',      Math.round(hours));
    animateNum('stat-events',     events);
}

// ── Podium ────────────────────────────────────────────────────
function renderPodium(sorted) {
    const grid = document.getElementById('podium');
    grid.innerHTML = '';

    if (sorted.length === 0) return;

    // Display order: 2nd, 1st, 3rd
    const slots = [sorted[1], sorted[0], sorted[2]];
    const ranks = [2, 1, 3];

    slots.forEach((vol, i) => {
        if (!vol) { grid.appendChild(document.createElement('div')); return; }
        const rank     = ranks[i];
        const statVal  = currentCategory === 'hours' ? vol.hours : vol.events;
        const statLbl  = currentCategory === 'hours' ? 'hours' : 'events';

        const card = document.createElement('div');
        card.className = `podium-card p${rank}`;

        card.innerHTML = `
            <div class="podium-rank">#${rank}</div>
            <div class="podium-avatar">${avatarHTML(vol, 62)}</div>
            <div class="podium-name">${esc(vol.name)}</div>
            ${vol.discord && CONFIG.SHOW_DISCORD ? `<div class="podium-discord">@${esc(vol.discord)}</div>` : ''}
            <div class="podium-stat" data-val="${statVal}">0</div>
            <div class="podium-stat-lbl">${statLbl}</div>
        `;

        grid.appendChild(card);

        const statEl = card.querySelector('.podium-stat');
        setTimeout(() => animateCounter(statEl, statVal), 60 * i);
    });
}

// ── List (rank 4+) ────────────────────────────────────────────
function renderList(sorted) {
    const container = document.getElementById('leaderboard-list');
    const rest      = sorted.slice(3);

    // Capture new ranks before overwriting
    const newRanks = {};
    sorted.forEach((v, i) => { newRanks[v.name] = i + 1; });

    container.innerHTML = '';

    if (rest.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎖️</div>
                Everyone is on the podium!
            </div>`;
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
        item.className   = 'lb-item';
        item.style.animationDelay = `${Math.min(i * 25, 400)}ms`;
        item.dataset.name = vol.name.toLowerCase();

        item.innerHTML = `
            <div class="lb-rank">${rank}</div>
            <div class="lb-avatar">${avatarHTML(vol, 38)}</div>
            <div class="lb-info">
                <div class="lb-name">${esc(vol.name)}</div>
                ${vol.discord && CONFIG.SHOW_DISCORD ? `<div class="lb-discord">@${esc(vol.discord)}</div>` : ''}
            </div>
            ${changeHTML}
            <div class="lb-stat">
                <div class="lb-stat-val">${fmt(statVal)}</div>
                <div class="lb-stat-lbl">${statLbl}</div>
            </div>
        `;
        container.appendChild(item);
    });

    document.getElementById('list-count').textContent = `${rest.length} more`;
    previousRanks = newRanks;
    applySearch();
}

// ═══════════════════════════════════════════════════════════════
// AVATAR GENERATION
// ═══════════════════════════════════════════════════════════════
const PALETTE = ['#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#34d399','#fbbf24','#38bdf8'];

function avatarHTML(vol, size) {
    if (vol.avatar && /^https?:\/\//.test(vol.avatar)) {
        const fallback = initSVG(vol.name, size);
        return `<img src="${esc(vol.avatar)}" alt="${esc(vol.name)}" loading="lazy" onerror="this.outerHTML='${fallback.replace(/'/g, "\\'")}'">`;
    }
    return initSVG(vol.name, size);
}

function initSVG(name, size) {
    const color    = PALETTE[name.charCodeAt(0) % PALETTE.length];
    const initials = name.trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
    const fs       = Math.round(size * 0.36);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${size/2}" fill="${color}22"/>
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
        const p    = Math.min((Date.now() - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(target * ease));
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(target);
    }
    requestAnimationFrame(tick);
}

function animateNum(id, target, duration = 650) {
    const el = document.getElementById(id);
    if (!el) return;
    const from = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
    const start = Date.now();
    function tick() {
        const p    = Math.min((Date.now() - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(from + (target - from) * ease));
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
        if (timerVal <= 0) {
            timerVal = CONFIG.REFRESH_INTERVAL;
            fetchData();
        }
    }, 1000);
}

function tickTimer() {
    const el   = document.getElementById('countdown');
    const ring = document.getElementById('ring-fill');
    if (el)   el.textContent = timerVal;
    if (ring) {
        const pct = (timerVal / CONFIG.REFRESH_INTERVAL) * 100;
        ring.setAttribute('stroke-dasharray', `${pct.toFixed(1)} 100`);
    }
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
    if (items.length > 0) {
        document.getElementById('list-count').textContent = q ? `${count} result${count !== 1 ? 's' : ''}` : `${items.length} more`;
    }
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
            <p style="margin-top:12px">Make sure your Sheet ID is set in <code>config.js</code> and the sheet is shared (Anyone with link can view).</p>
        </div>`;
}

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
function fmt(n) {
    return typeof n === 'number' && !isNaN(n) ? n.toLocaleString() : String(n);
}

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('org-name').textContent = CONFIG.ORG_NAME;
    initStarfield();
    setupTabs();
    setupSearch();
    fetchData();
    startTimer();
});
