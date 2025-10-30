/* ui.js — minimal UI wiring for the Minair prototype */
(function () {
    const scheduler = window.MinairScheduler;

    function loadTargets() {
        return fetch('data/targets.json').then(r => r.json());
    }

    function formatTime(d) {
        return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    }

    function populateTargetSelect(targets) {
        const sel = document.getElementById('targetSelect');
        sel.innerHTML = '';
        for (const t of targets) {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.textContent = t.name + ` (RA ${t.ra}, Dec ${t.dec})`;
            sel.appendChild(opt);
        }
    }

    function findTargetByName(targets, name) {
        return targets.find(t => t.name === name);
    }

    function drawAltitude(samples, canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!samples || samples.length === 0) return;
        const w = canvas.width, h = canvas.height;
        const times = samples.map(s => s.time.getTime());
        const alts = samples.map(s => s.alt);
        const tMin = Math.min(...times), tMax = Math.max(...times);
        const aMin = Math.min(...alts, -90), aMax = Math.max(...alts, 90);
        // axes
        ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(40, h - 20); ctx.lineTo(w, h - 20); ctx.stroke();
        // plot
        ctx.strokeStyle = '#0077cc'; ctx.beginPath();
        for (let i = 0; i < samples.length; i++) {
            const x = 40 + ((times[i] - tMin) / (tMax - tMin)) * (w - 50);
            const y = (h - 20) - ((alts[i] - aMin) / (aMax - aMin)) * (h - 40);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    async function onCalculate() {
        const lat = parseFloat(document.getElementById('lat').value);
        const lon = parseFloat(document.getElementById('lon').value);
        const dateStr = document.getElementById('date').value;
        const minAlt = parseFloat(document.getElementById('minAlt').value);
        const step = parseInt(document.getElementById('step').value, 10);
        const sel = document.getElementById('targetSelect');
        const targetName = sel.value;
        const targets = await loadTargets();
        const target = findTargetByName(targets, targetName);
        if (!dateStr) { alert('Please pick a date'); return; }
        const date = new Date(dateStr + 'T00:00:00Z');
        const results = scheduler.calculateNight(date, lat, lon, [target], minAlt, step);
        const out = results[0];
        const summary = document.getElementById('summary');
        if (!out.night) { summary.textContent = 'No night (sun never below -18°) on this date at this location.'; return; }
        summary.innerHTML = `Night: ${formatTime(out.night.start)} → ${formatTime(out.night.end)}; Observable minutes: ${out.totalMin}`;
        const canvas = document.getElementById('altPlot');
        drawAltitude(out.samples, canvas);

        const windowsDiv = document.getElementById('windows'); windowsDiv.innerHTML = '';
        if (out.windows.length === 0) windowsDiv.textContent = 'No observable windows for this target.';
        for (const w of out.windows) {
            const el = document.createElement('div'); el.className = 'window-item';
            el.textContent = `${formatTime(w.start)} → ${formatTime(w.end)} (${Math.round((w.end - w.start) / 60000)} min)`;
            windowsDiv.appendChild(el);
        }
    }

    // Init
    document.addEventListener('DOMContentLoaded', async () => {
        const today = new Date();
        document.getElementById('date').value = today.toISOString().slice(0, 10);
        const targets = await loadTargets();
        populateTargetSelect(targets);
        document.getElementById('calcBtn').addEventListener('click', onCalculate);
    });
})();
