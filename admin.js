let adminData = [];
let sortedData = [];

// ── CSV & fetch ──────────────────────────────────────────────────
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

async function fetchSheet(name) {
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} (sheet: "${name}")`);
    return parseCSV(await res.text());
}

function isChecked(val) {
    const v = (val || '').trim().toUpperCase();
    return v === 'TRUE' || v === 'YES' || v === '1' || v === 'X' || v === '✓' || v === '✔' || v === '☑';
}

function mkVol(name) {
    return {
        name, discord: '', school: '',
        hours: 0, events: 0, curriculum: 0,
        curriculumHours: 0, assemblyHours: 0, sessionHours: 0,
        teams: [],
    };
}

// ── Data loading ─────────────────────────────────────────────────
function parseTeams(raw) {
    const t = (raw || '').toLowerCase();
    const teams = [];
    if (t.includes('curriculum team'))                              teams.push('Curriculum');
    if (t.includes('kit assembly') || t.includes('kitmaking'))     teams.push('Kitmaking');
    if (t.includes('in-person session') || t.includes('in person session')) teams.push('In-Person');
    if (t.includes('content creation') || t.includes('media team')) teams.push('Media');
    return teams;
}

async function loadAdminData() {
    const [volRows, eventRows, currRows] = await Promise.all([
        fetchSheet(CONFIG.SHEET_NAME),
        fetchSheet(CONFIG.EVENTS_SHEET_NAME),
        fetchSheet(CONFIG.CURRICULUM_SHEET_NAME),
    ]);

    const volMap = {};
    volRows.slice(1).forEach(r => {
        const name = (r[0] || '').trim();
        if (!name) return;
        volMap[name.toLowerCase()] = {
            ...mkVol(name),
            discord: (r[1]||'').trim(),
            school:  (r[2]||'').trim(),
            teams:   parseTeams(r[9]),  // col J = team selection from form
        };
    });

    eventRows.slice(1).forEach(r => {
        const hrs        = parseFloat(r[2]) || 0;
        const attendees  = (r[3]||'').split(',').map(n => n.trim()).filter(Boolean);
        const isAssembly = isChecked(r[4]);
        attendees.forEach(att => {
            const key = att.toLowerCase();
            if (!volMap[key]) volMap[key] = mkVol(att);
            volMap[key].hours  += hrs;
            volMap[key].events += 1;
            if (isAssembly) volMap[key].assemblyHours += hrs;
            else            volMap[key].sessionHours  += hrs;
        });
    });

    currRows.slice(1).forEach(r => {
        const hrs      = parseFloat(r[2]) || 0;
        const contribs = (r[3]||'').split(',').map(n => n.trim()).filter(Boolean);
        contribs.forEach(contrib => {
            const key = contrib.toLowerCase();
            if (!volMap[key]) volMap[key] = mkVol(contrib);
            volMap[key].curriculum      += 1;
            volMap[key].hours           += hrs;
            volMap[key].curriculumHours += hrs;
        });
    });


    adminData = Object.values(volMap).sort((a, b) => b.hours - a.hours);
    sortedData = [...adminData];
    renderSummary(adminData);
    renderTable(sortedData);
    document.getElementById('admin-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
}

// ── Summary cards ─────────────────────────────────────────────────
function renderSummary(data) {
    const totalHrs  = data.reduce((s, v) => s + v.hours, 0);
    const currHrs   = data.reduce((s, v) => s + v.curriculumHours, 0);
    const asmHrs    = data.reduce((s, v) => s + v.assemblyHours, 0);
    const sessHrs   = data.reduce((s, v) => s + v.sessionHours, 0);

    document.getElementById('admin-summary').innerHTML = `
        <div class="as-card"><div class="as-val" style="color:var(--purple)">${fmt(round1(totalHrs))}</div><div class="as-lbl">Total Hours</div></div>
        <div class="as-card"><div class="as-val" style="color:var(--blue)">${fmt(round1(currHrs))}</div><div class="as-lbl">📚 Curriculum Hours</div></div>
        <div class="as-card"><div class="as-val" style="color:var(--bronze)">${fmt(round1(asmHrs))}</div><div class="as-lbl">🔧 Kit Assembly Hours</div></div>
        <div class="as-card"><div class="as-val" style="color:var(--green)">${fmt(round1(sessHrs))}</div><div class="as-lbl">🎓 In-Person Hours</div></div>
    `;
}

// ── Table render ──────────────────────────────────────────────────
function renderTable(data) {
    const tbody = document.getElementById('admin-tbody');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-loading">No results.</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    data.forEach(vol => {
        const TEAM_STYLE = {
            'Curriculum': { cls: 'curriculum', label: '📚 Curriculum' },
            'Kitmaking':  { cls: 'kitmaking',  label: '🔧 Kit Assembly' },
            'In-Person':  { cls: 'inperson',   label: '🎓 In-Person' },
            'Media':      { cls: 'media',       label: '🎨 Media' },
        };
        const badges = (vol.teams || []).map(team => {
            const s = TEAM_STYLE[team] || { cls: 'media', label: team };
            return `<span class="team-badge ${s.cls}">${s.label}</span>`;
        }).join('');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-name">
                <div class="td-name">${esc(vol.name)}</div>
                ${vol.discord ? `<div class="td-disc">@${esc(vol.discord)}</div>` : ''}
            </td>
            <td class="col-school"><span class="td-school">${vol.school ? esc(vol.school) : '<span style="color:var(--textm)">—</span>'}</span></td>
            <td class="col-teams">${badges || '<span style="color:var(--textm);font-size:12px">—</span>'}</td>
            <td class="col-num"><span class="num-val num-curr">${fmt(round1(vol.curriculumHours))}</span></td>
            <td class="col-num"><span class="num-val num-asm">${fmt(round1(vol.assemblyHours))}</span></td>
            <td class="col-num"><span class="num-val num-sess">${fmt(round1(vol.sessionHours))}</span></td>
            <td class="col-num"><span class="num-val num-total">${fmt(round1(vol.hours))}</span></td>
            <td class="col-num"><span class="num-val num-events">${vol.events}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ── Helpers ───────────────────────────────────────────────────────
function round1(n) { return Math.round((n || 0) * 10) / 10; }
function fmt(n) { return typeof n === 'number' && !isNaN(n) ? n.toLocaleString() : String(n); }
function esc(s) {
    return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Auth ──────────────────────────────────────────────────────────
function unlock() {
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('admin-app').style.display = '';

    loadAdminData().catch(err => {
        document.getElementById('admin-tbody').innerHTML =
            `<tr><td colspan="8" class="admin-loading" style="color:var(--red)">${esc(err.message)}</td></tr>`;
    });

    document.getElementById('admin-search').addEventListener('input', e => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = q ? adminData.filter(v => v.name.toLowerCase().includes(q)) : adminData;
        sortedData = applySortOrder(filtered);
        renderTable(sortedData);
    });

    document.getElementById('sort-by').addEventListener('change', () => {
        const q = document.getElementById('admin-search').value.toLowerCase().trim();
        const filtered = q ? adminData.filter(v => v.name.toLowerCase().includes(q)) : adminData;
        sortedData = applySortOrder(filtered);
        renderTable(sortedData);
    });

    document.getElementById('lock-out-btn').addEventListener('click', () => {
        sessionStorage.removeItem('cc_admin_unlocked');
        location.reload();
    });
}

function applySortOrder(data) {
    const key = document.getElementById('sort-by').value;
    return [...data].sort((a, b) => {
        if (key === 'name')       return a.name.localeCompare(b.name);
        if (key === 'total')      return b.hours - a.hours;
        if (key === 'curriculum') return b.curriculumHours - a.curriculumHours;
        if (key === 'assembly')   return b.assemblyHours - a.assemblyHours;
        if (key === 'session')    return b.sessionHours - a.sessionHours;
        if (key === 'events')     return b.events - a.events;
        return 0;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('cc_admin_unlocked') === 'true') {
        unlock();
        return;
    }

    const input = document.getElementById('code-input');
    const errEl = document.getElementById('lock-err');

    function tryCode() {
        if (input.value === CONFIG.ADMIN_CODE) {
            sessionStorage.setItem('cc_admin_unlocked', 'true');
            unlock();
        } else {
            errEl.textContent = 'Incorrect code — try again.';
            input.value = '';
            input.focus();
            setTimeout(() => { errEl.textContent = ''; }, 2500);
        }
    }

    document.getElementById('code-submit').addEventListener('click', tryCode);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryCode(); });
    input.focus();
});
