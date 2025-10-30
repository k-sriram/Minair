/* scheduler.js — sampling and window detection for Minair */
(function (global) {
    const astro = global.MinairAstronomy;

    function sampleNightTimes(date, lat, lon, stepMinutes = 5) {
        // Returns array of Date objects across the 24h UTC day that contains 'date'
        // We'll sample from 00:00 UTC to 24:00 UTC of that date.
        const samples = [];
        const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
        for (let m = 0; m < 24 * 60; m += stepMinutes) {
            samples.push(new Date(base.getTime() + m * 60000));
        }
        return samples;
    }

    function findNightInterval(date, lat, lon, stepMinutes = 5) {
        // Determine night window by checking when sun altitude < -18 deg (astronomical twilight)
        const times = sampleNightTimes(date, lat, lon, stepMinutes);
        const isNight = times.map(t => astro.sunAltitude(t, lat, lon) < -18);
        // find contiguous ranges where isNight=true
        const intervals = [];
        let start = null;
        for (let i = 0; i < isNight.length; i++) {
            if (isNight[i] && start === null) start = times[i];
            if (!isNight[i] && start !== null) { intervals.push({ start, end: times[i] }); start = null; }
        }
        if (start !== null) intervals.push({ start, end: times[times.length - 1] });
        // choose the longest interval overlapping local night (simple heuristic)
        if (intervals.length === 0) return null;
        let longest = intervals[0];
        for (const iv of intervals) {
            if (iv.end - iv.start > longest.end - longest.start) longest = iv;
        }
        return longest;
    }

    function computeAltitudeCurve(target, date, lat, lon, stepMinutes = 5) {
        // target: {name, raHours, decDeg}
        const night = findNightInterval(date, lat, lon, stepMinutes);
        const samples = [];
        if (!night) return { samples: [], night };
        for (let t = night.start.getTime(); t <= night.end.getTime(); t += stepMinutes * 60000) {
            const d = new Date(t);
            const altAz = astro.raDecToAltAz(target.raHours, target.decDeg, d, lat, lon);
            samples.push({ time: d, alt: altAz.alt, az: altAz.az });
        }
        return { samples, night };
    }

    function detectWindowsFromCurve(curve, minAltDeg) {
        const windows = [];
        let startIdx = null;
        for (let i = 0; i < curve.length; i++) {
            const ok = curve[i].alt >= minAltDeg;
            if (ok && startIdx === null) startIdx = i;
            if (!ok && startIdx !== null) {
                windows.push({ start: curve[startIdx].time, end: curve[i - 1].time });
                startIdx = null;
            }
        }
        if (startIdx !== null) windows.push({ start: curve[startIdx].time, end: curve[curve.length - 1].time });
        return windows;
    }

    function calculateNight(date, lat, lon, targets, minAltDeg = 30, stepMinutes = 5) {
        // For each target compute curve and windows
        const results = [];
        for (const t of targets) {
            const { samples, night } = computeAltitudeCurve(t, date, lat, lon, stepMinutes);
            const windows = samples.length ? detectWindowsFromCurve(samples, minAltDeg) : [];
            // simple metric: total observable minutes
            let totalMin = 0;
            for (const w of windows) totalMin += Math.round((w.end - w.start) / 60000);
            results.push({ target: t, night, samples, windows, totalMin });
        }
        // sort by totalMin desc
        results.sort((a, b) => b.totalMin - a.totalMin);
        return results;
    }

    global.MinairScheduler = {
        calculateNight,
        computeAltitudeCurve,
        findNightInterval
    };
})(window);
