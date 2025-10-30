/* ui.js — UI controller for Minair astronomical observation planner */
(function () {
    'use strict';

    // Theme Management
    class ThemeManager {
        constructor() {
            this.currentTheme = this.loadTheme();
            this.applyTheme(this.currentTheme);
        }

        loadTheme() {
            const saved = localStorage.getItem('minair-theme');
            return saved || 'light';
        }

        saveTheme(theme) {
            localStorage.setItem('minair-theme', theme);
        }

        applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            this.currentTheme = theme;
            this.saveTheme(theme);

            // Update theme selector
            const themeSelect = document.getElementById('theme-select');
            if (themeSelect) {
                themeSelect.value = theme;
            }
        }

        switchTheme(theme) {
            this.applyTheme(theme);
        }
    }

    // Location Management
    class LocationManager {
        constructor() {
            this.observatories = {
                'greenwich': { name: 'Greenwich, UK', lat: 51.4779, lon: -0.0015 },
                'mauna-kea': { name: 'Mauna Kea, Hawaii', lat: 19.8283, lon: -155.4783 },
                'atacama': { name: 'Atacama Desert, Chile', lat: -24.6272, lon: -70.4042 },
                'palomar': { name: 'Palomar Observatory, CA', lat: 33.3563, lon: -116.8650 }
            };
            this.currentLocation = this.loadLocation();
        }

        loadLocation() {
            const saved = localStorage.getItem('minair-location');
            if (saved) {
                return JSON.parse(saved);
            }
            return { lat: 51.4779, lon: -0.0015, name: 'Greenwich, UK' };
        }

        saveLocation(location) {
            localStorage.setItem('minair-location', JSON.stringify(location));
        }

        setLocation(lat, lon, name = 'Custom Location') {
            this.currentLocation = { lat, lon, name };
            this.saveLocation(this.currentLocation);
        }

        getLocation() {
            return this.currentLocation;
        }

        setObservatory(key) {
            if (this.observatories[key]) {
                const obs = this.observatories[key];
                this.setLocation(obs.lat, obs.lon, obs.name);
                return obs;
            }
            return null;
        }
    }

    // Time Management
    class TimeManager {
        constructor(locationManager) {
            this.locationManager = locationManager;
            this.selectedTimeReference = this.loadTimeReference();
            this.currentTime = new Date();
            this.timezone = this.detectTimezone();
            this.startClock();
        }

        loadTimeReference() {
            const saved = localStorage.getItem('minair-time-reference');
            return saved || 'local';
        }

        saveTimeReference(reference) {
            localStorage.setItem('minair-time-reference', reference);
        }

        detectTimezone() {
            const offset = new Date().getTimezoneOffset();
            const hours = Math.floor(Math.abs(offset) / 60);
            const minutes = Math.abs(offset) % 60;
            const sign = offset <= 0 ? '+' : '-';

            if (minutes === 0) {
                return `UTC${sign}${hours}`;
            } else {
                return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
            }
        }

        initializeTimezoneDropdown() {
            const timezoneSelect = document.getElementById('timezone-select');
            const detectedTimezone = this.detectTimezone();

            // Set the dropdown to the detected timezone
            if (timezoneSelect) {
                timezoneSelect.value = detectedTimezone;
            }
        }

        startClock() {
            this.initializeTimezoneDropdown();
            this.lstAccumulator = 0; // Track fractional LST seconds
            this.updateClocks();

            // Update all clocks every 100ms for smooth display
            setInterval(() => {
                this.currentTime = new Date();
                this.updateClocks();
            }, 100);
        }

        updateClocks() {
            // UTC Time
            const utcTime = this.currentTime.toUTCString().split(' ')[4];
            document.getElementById('utc-time').textContent = utcTime;

            // Local Time (using selected timezone)
            const localTime = this.getTimeForSelectedTimezone();
            document.getElementById('local-time').textContent = localTime;

            // Local Sidereal Time - accumulate at sidereal rate
            // Sidereal rate: 1.00273790935 sidereal seconds per solar second
            this.lstAccumulator += 0.1 * 1.00273790935; // 0.1 seconds at sidereal rate

            if (this.lstAccumulator >= 1.0) {
                this.lstAccumulator -= 1.0;
                // Calculate and update LST
                const location = this.locationManager.getLocation();
                const lstTime = this.calculateLST(this.currentTime, location.lon);
                document.getElementById('lst-time').textContent = this.formatTime(lstTime);
            }

            // Update active clock indicator
            this.updateActiveClockIndicator();
        }

        getTimeForSelectedTimezone() {
            const timezoneSelect = document.getElementById('timezone-select');
            if (!timezoneSelect) return this.currentTime.toLocaleTimeString([], { hour12: false });

            const selectedTimezone = timezoneSelect.value;

            // Parse the timezone offset (e.g., "UTC+5:30" -> +5.5 hours)
            const match = selectedTimezone.match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/);
            if (!match) return this.currentTime.toLocaleTimeString([], { hour12: false });

            const sign = match[1] === '+' ? 1 : -1;
            const hours = parseInt(match[2]);
            const minutes = parseInt(match[3] || '0');
            const offsetMinutes = sign * (hours * 60 + minutes);

            // Calculate time in selected timezone
            const utcTime = this.currentTime.getTime() + (this.currentTime.getTimezoneOffset() * 60000);
            const timezoneTime = new Date(utcTime + (offsetMinutes * 60000));

            return timezoneTime.toLocaleTimeString([], { hour12: false });
        }

        calculateLST(date, longitude) {
            // Simplified LST calculation - use astronomy.js for more accurate version
            const jd = this.dateToJulianDay(date);
            const gmst = this.julianDayToGMST(jd);
            const lst = gmst + (longitude / 15.0);
            return this.normalizeHours(lst);
        }

        dateToJulianDay(date) {
            return (date.getTime() / 86400000) + 2440587.5;
        }

        julianDayToGMST(jd) {
            const t = (jd - 2451545.0) / 36525.0;
            let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - t * t * t / 38710000.0;
            return this.normalizeHours(gmst / 15.0);
        }

        normalizeHours(hours) {
            while (hours < 0) hours += 24;
            while (hours >= 24) hours -= 24;
            return hours;
        }

        formatTime(hours) {
            const h = Math.floor(hours);
            const m = Math.floor((hours - h) * 60);
            const s = Math.floor(((hours - h) * 60 - m) * 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        updateActiveClockIndicator() {
            // Remove active class from all clocks
            document.querySelectorAll('.time-clock').forEach(clock => {
                clock.classList.remove('active');
            });

            // Add active class to selected clock
            const activeClockId = `${this.selectedTimeReference}-clock`;
            const activeClock = document.getElementById(activeClockId);
            if (activeClock) {
                activeClock.classList.add('active');
            }
        }

        setTimeReference(reference) {
            this.selectedTimeReference = reference;
            this.saveTimeReference(reference);
            this.updateActiveClockIndicator();
        }
    }

    // Target Management
    class TargetManager {
        constructor() {
            this.targets = [];
            this.loadDefaultTargets();
            this._lastLookupTime = 0; // for rate-limiting external queries (ms)
        }

        async loadDefaultTargets() {
            try {
                const response = await fetch('data/targets.json');
                const defaultTargets = await response.json();
                this.targets = [...defaultTargets];
                this.updateTargetTable();
                // After populating table, compute current alt/az and rise/set for each target
                this.updateTargetsObservingInfo();
            } catch (error) {
                console.error('Failed to load default targets:', error);
            }
        }

        addTarget(name, ra, dec) {
            const target = {
                name: name.trim(),
                ra: this.parseRA(ra),
                dec: this.parseDec(dec),
                id: Date.now() // Simple ID generation
            };
            this.targets.push(target);
            this.updateTargetTable();
            return target;
        }

        removeTarget(id) {
            this.targets = this.targets.filter(t => t.id !== id);
            this.updateTargetTable();
        }

        parseRA(raStr) {
            return this.parseCoordinate(raStr, 'ha');
        }

        parseDec(decStr) {
            return this.parseCoordinate(decStr, 'deg');
        }

        // Comprehensive coordinate parser that handles multiple formats
        parseCoordinate(coordStr, default_unit) {
            if (typeof coordStr === 'number') return coordStr;

            // Clean up the input string - remove extra spaces and normalize
            let cleaned = coordStr.toString().trim().replace(/\s+/g, ' ');

            // Handle different format patterns
            const patterns = [
                // HMS/DMS with colons: "12:34:56.7" or "12:34:56"
                /^([+-]?)([0-9]{1,3}):([0-9]{1,2}):([0-9]{1,2}(?:\.[0-9]+)?)$/,
                // HM/DM with colons: "12:34" (partial format)
                /^([+-]?)([0-9]{1,3}):([0-9]{1,2})$/,
                // HMS/DMS with spaces: "12 34 56.7" or "12 34 56"
                /^([+-]?)([0-9]{1,3})\s+([0-9]{1,2})\s+([0-9]{1,2}(?:\.[0-9]+)?)$/,
                // HM/DM with spaces: "12 34" (partial format)
                /^([+-]?)([0-9]{1,3})\s+([0-9]{1,2})$/,
                // Compact format: "123456" or "123456.7"
                /^([+-]?)([0-9]{2})([0-9]{2})([0-9]{2}(?:\.[0-9]+)?)$/,
                // Compact partial format: "1234" (HHMM)
                /^([+-]?)([0-9]{2})([0-9]{2})$/,
                // With unit suffixes: "12h34m56s" or "12d34m56s"
                /^([+-]?)([0-9]{1,3})[hd]([0-9]{1,2})m([0-9]{1,2}(?:\.[0-9]+)?)s$/,
                // With unit suffixes (partial): "12h34m" or "12d34m"
                /^([+-]?)([0-9]{1,3})[hd]([0-9]{1,2})m$/,
                // With unit suffixes and spaces: "12h 34m 56s" or "12d 34m 56s"
                /^([+-]?)([0-9]{1,3})[hd]\s*([0-9]{1,2})m\s*([0-9]{1,2}(?:\.[0-9]+)?)s$/,
                // With unit suffixes and spaces (partial): "12h 34m" or "12d 34m"
                /^([+-]?)([0-9]{1,3})[hd]\s*([0-9]{1,2})m$/,
                // Pure decimal: "123.456" or "+123.456" or "-123.456"
                /^([+-]?)([0-9]{1,3}(?:\.[0-9]+))$/
            ];

            // Try each pattern
            for (const pattern of patterns) {
                const match = cleaned.match(pattern);
                if (match) {
                    const sign = match[1] === '-' ? -1 : 1;

                    if (pattern === patterns[10]) { // Pure decimal
                        const decimal = parseFloat(match[2]);
                        // Decimals are always interpreted as degrees
                        if (default_unit === 'ha') {
                            // For hour angles, convert degrees to hours
                            return sign * (decimal / 15);
                        } else { // deg
                            // For degrees, already in degrees
                            return sign * decimal;
                        }
                    } else {
                        // HMS/DMS format (full or partial)
                        const major = parseFloat(match[2]);
                        const minor = parseFloat(match[3] || 0);
                        const seconds = parseFloat(match[4] || 0);

                        let result = Math.abs(major) + minor / 60 + seconds / 3600;

                        // Handle the sign properly for negative degrees where major part is 0
                        if (sign === -1 || (match[1] === '' && major === 0 && (minor > 0 || seconds > 0) && cleaned.startsWith('-'))) {
                            result = -result;
                        }

                        // Check if we need unit conversion based on context and format
                        if (default_unit === 'ha') {
                            // If this looks like it was specified in degrees (d suffix or value > 24), convert to hours
                            if (cleaned.includes('d') || result > 24) {
                                result = result / 15;
                            }
                            // Result should be in hours for hour angles
                            return result;
                        } else { // deg
                            // If this looks like it was specified in hours (h suffix or value <= 24), convert to degrees
                            if (cleaned.includes('h') || (result <= 24 && !cleaned.includes('d'))) {
                                result = result * 15;
                            }
                            // Result should be in degrees
                            return result;
                        }
                    }
                }
            }

            // Fallback: try to parse as a simple number
            const fallback = parseFloat(cleaned);
            if (!isNaN(fallback)) {
                // Decimals are always interpreted as degrees
                if (default_unit === 'ha') {
                    // For hour angles, convert degrees to hours
                    return fallback / 15;
                } else {
                    // For degrees, already in degrees
                    return fallback;
                }
            }

            throw new Error(`Unable to parse coordinate: ${coordStr}`);
        }

        updateTargetTable() {
            const tbody = document.getElementById('target-table-body');
            tbody.innerHTML = '';

            this.targets.forEach(target => {
                const row = this.createTargetRow(target);
                tbody.appendChild(row);
            });
        }

        createTargetRow(target) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="cell-name">${target.name}</td>
                <td class="cell-ra">${this.formatRA(target.ra)}</td>
                <td class="cell-dec">${this.formatDec(target.dec)}</td>
                <td class="cell-alt">--:--:--</td>
                <td class="cell-az">--:--:--</td>
                <td class="cell-rise">--:--</td>
                <td class="cell-set">--:--</td>
                <td class="form-row">
                    <button onclick="minairApp.targetManager.removeTarget(${target.id})">Remove</button>
                </td>
            `;
            return row;
        }

        // Lightweight method to update only current alt/az for real-time tracking
        async updateCurrentAltAz() {
            const tbody = document.getElementById('target-table-body');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const astro = window.MinairAstronomy;
            const app = window.minairApp;
            const loc = app ? app.locationManager.getLocation() : { lat: 51.4779, lon: -0.0015 };
            const now = new Date();

            for (let i = 0; i < this.targets.length; i++) {
                const target = this.targets[i];
                const row = rows[i];
                if (!row) continue;

                // Current alt/az only
                try {
                    const altAz = astro.raDecToAltAz(target.ra, target.dec, now, loc.lat, loc.lon);
                    row.querySelector('.cell-alt').textContent = this.formatAngleDeg(altAz.alt);
                    row.querySelector('.cell-az').textContent = this.formatAngleDegUnsigned(altAz.az);
                } catch (e) {
                    // ignore
                }
            }
        }

        // Method to update rise/set times (less frequent updates)
        async updateRiseSetTimes() {
            const tbody = document.getElementById('target-table-body');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const scheduler = window.MinairScheduler;
            const app = window.minairApp;
            const loc = app ? app.locationManager.getLocation() : { lat: 51.4779, lon: -0.0015 };
            const now = new Date();

            for (let i = 0; i < this.targets.length; i++) {
                const target = this.targets[i];
                const row = rows[i];
                if (!row) continue;

                // Rise/Set times: compute altitude curve with 1-minute sampling and detect crossings at 0°
                try {
                    const t = scheduler.computeAltitudeCurve({ raHours: target.ra, decDeg: target.dec }, now, loc.lat, loc.lon, 1);
                    const samples = t.samples || [];
                    let rise = null, set = null;
                    let inAbove = false, startIdx = null;
                    for (let j = 0; j < samples.length; j++) {
                        const ok = samples[j].alt >= 0;
                        if (ok && !inAbove) { inAbove = true; startIdx = j; rise = samples[j].time; }
                        if (!ok && inAbove) { set = samples[j - 1].time; inAbove = false; }
                    }
                    if (inAbove && !set && samples.length) set = samples[samples.length - 1].time;
                    if (rise) row.querySelector('.cell-rise').textContent = this.formatDateHHMM(rise);
                    if (set) row.querySelector('.cell-set').textContent = this.formatDateHHMM(set);
                } catch (e) {
                    // ignore
                }
            }
        }

        // Compute and update current alt/az and rise/set times for targets
        async updateTargetsObservingInfo() {
            // Update both alt/az and rise/set times
            await this.updateCurrentAltAz();
            await this.updateRiseSetTimes();
        }

        // Rate-limit helper: ensure at least 100ms between external queries
        async _rateLimitQuery() {
            const minInterval = 100; // ms
            const now = Date.now();
            const since = now - (this._lastLookupTime || 0);
            if (since < minInterval) {
                await new Promise(r => setTimeout(r, minInterval - since));
            }
            this._lastLookupTime = Date.now();
        }

        // Lookup coordinates for an object name using CDS/SIMBAD services.
        // Returns { raHours, decDeg }
        async lookupCoordinates(name) {
            if (!name || !name.trim()) throw new Error('Empty name');
            await this._rateLimitQuery();

            // First try CDS Sesame text resolver which often returns a '%J' line with J2000 decimal degrees
            const sesameUrl = `https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oI?${encodeURIComponent(name)}`;
            try {
                const res = await fetch(sesameUrl);
                if (res.ok) {
                    const txt = await res.text();
                    const lines = txt.split(/\r?\n/);
                    for (const line of lines) {
                        // %J RA DEC (degrees)
                        const m = line.match(/^%J\s+([+-]?[0-9\.Ee+-]+)\s+([+-]?[0-9\.Ee+-]+)/);
                        if (m) {
                            const raDeg = parseFloat(m[1]);
                            const decDeg = parseFloat(m[2]);
                            if (!isNaN(raDeg) && !isNaN(decDeg)) {
                                return { raHours: raDeg / 15.0, decDeg };
                            }
                        }
                    }
                }
            } catch (e) {
                // ignore and try SIMBAD VOTABLE next
                console.warn('Sesame lookup failed:', e);
            }

            // Second attempt: SIMBAD VOTABLE output (may be blocked by CORS in browsers)
            const simbadUrl = `https://simbad.u-strasbg.fr/simbad/sim-id?Ident=${encodeURIComponent(name)}&output.format=VOTABLE`;
            try {
                const res2 = await fetch(simbadUrl);
                if (res2.ok) {
                    const xmlText = await res2.text();
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(xmlText, 'application/xml');

                    // Build field name -> index map
                    const fields = Array.from(xml.querySelectorAll('FIELD')).map(f => ({ name: f.getAttribute('name') || '', id: f.getAttribute('ID') || '' }));
                    let raIdx = -1, decIdx = -1;
                    for (let i = 0; i < fields.length; i++) {
                        const nm = (fields[i].name || fields[i].id || '').toLowerCase();
                        if (nm.includes('ra') && raIdx === -1) raIdx = i;
                        if (nm.includes('dec') && decIdx === -1) decIdx = i;
                    }

                    // Fallback: pick first two numeric TDs in first TR
                    const firstTR = xml.querySelector('TR');
                    if (firstTR) {
                        const tds = Array.from(firstTR.querySelectorAll('TD'));
                        if (raIdx >= 0 && decIdx >= 0 && tds.length > Math.max(raIdx, decIdx)) {
                            const raVal = parseFloat(tds[raIdx].textContent);
                            const decVal = parseFloat(tds[decIdx].textContent);
                            if (!isNaN(raVal) && !isNaN(decVal)) return { raHours: raVal / 15.0, decDeg: decVal };
                        }
                        // Try scanning for two numeric columns
                        const numeric = tds.map(td => parseFloat(td.textContent)).filter(n => !isNaN(n));
                        if (numeric.length >= 2) {
                            // Assume first is RA (deg) and second is Dec (deg)
                            return { raHours: numeric[0] / 15.0, decDeg: numeric[1] };
                        }
                    }
                }
            } catch (e) {
                console.warn('SIMBAD VOTABLE lookup failed:', e);
            }

            throw new Error('Unable to resolve object coordinates. Please check the object name and try again.');
        }

        // Format azimuth without sign, 0-360 as dd:mm:ss
        formatAngleDegUnsigned(angle) {
            let a = angle % 360;
            if (a < 0) a += 360;
            let deg = Math.floor(a);
            let minutesFloat = (a - deg) * 60;
            let min = Math.floor(minutesFloat);
            let sec = Math.floor((minutesFloat - min) * 60);

            // Handle seconds overflow due to floating-point precision
            if (sec >= 60) {
                sec -= 60;
                min += 1;
            }
            if (min >= 60) {
                min -= 60;
                deg += 1;
            }

            return `${deg.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }

        formatRA(ra) {
            // ra is in decimal hours. Format: hh:mm:ss.ss (seconds with 2 decimals)
            let hours = Math.floor(ra);
            let minutesFloat = (ra - hours) * 60;
            let minutes = Math.floor(minutesFloat);
            let seconds = (minutesFloat - minutes) * 60;

            // Handle seconds overflow due to floating-point precision
            if (seconds >= 60) {
                seconds -= 60;
                minutes += 1;
            }
            if (minutes >= 60) {
                minutes -= 60;
                hours += 1;
            }

            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
        }

        formatDec(dec) {
            // dec is in decimal degrees. Format: +dd:mm:ss.s (seconds with 1 decimal)
            const sign = dec >= 0 ? '+' : '-';
            const absDec = Math.abs(dec);
            let degrees = Math.floor(absDec);
            let minutesFloat = (absDec - degrees) * 60;
            let minutes = Math.floor(minutesFloat);
            let seconds = (minutesFloat - minutes) * 60;

            // Handle seconds overflow due to floating-point precision
            if (seconds >= 60) {
                seconds -= 60;
                minutes += 1;
            }
            if (minutes >= 60) {
                minutes -= 60;
                degrees += 1;
            }

            return `${sign}${degrees.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
        }

        // Format an angle in decimal degrees to dd:mm:ss (seconds integer)
        formatAngleDeg(angle) {
            const sign = angle >= 0 ? '+' : '-';
            const absA = Math.abs(angle);
            let deg = Math.floor(absA);
            let minutesFloat = (absA - deg) * 60;
            let min = Math.floor(minutesFloat);
            let sec = Math.floor((minutesFloat - min) * 60);

            // Handle seconds overflow due to floating-point precision
            if (sec >= 60) {
                sec -= 60;
                min += 1;
            }
            if (min >= 60) {
                min -= 60;
                deg += 1;
            }

            return `${sign}${deg.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }

        // Format a Date to hh:mm (24-hour) in the selected time reference
        formatDateHHMM(date) {
            if (!date || !(date instanceof Date)) return '--:--';

            const app = window.minairApp;
            if (!app || !app.timeManager) {
                // Fallback to local time
                const h = date.getHours().toString().padStart(2, '0');
                const m = date.getMinutes().toString().padStart(2, '0');
                return `${h}:${m}`;
            }

            const convertedDate = this.convertDateToSelectedTimeReference(date, app.timeManager);
            const h = convertedDate.getHours().toString().padStart(2, '0');
            const m = convertedDate.getMinutes().toString().padStart(2, '0');
            return `${h}:${m}`;
        }

        // Convert a Date to the selected time reference
        convertDateToSelectedTimeReference(date, timeManager) {
            const selectedRef = timeManager.selectedTimeReference;

            if (selectedRef === 'utc') {
                // Convert to UTC
                return new Date(date.getTime());
            } else if (selectedRef === 'lst') {
                // For LST, we'll show the time as if it were local time but calculated as LST
                // This is an approximation since LST doesn't directly map to clock time
                const location = timeManager.locationManager.getLocation();
                const lstHours = timeManager.calculateLST(date, location.lon);
                const lstDate = new Date(date);
                lstDate.setUTCHours(Math.floor(lstHours), Math.floor((lstHours % 1) * 60), 0, 0);
                return lstDate;
            } else { // 'local' or selected timezone
                const timezoneSelect = document.getElementById('timezone-select');
                if (!timezoneSelect) return date;

                const selectedTimezone = timezoneSelect.value;
                const match = selectedTimezone.match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/);
                if (!match) return date;

                const sign = match[1] === '+' ? 1 : -1;
                const hours = parseInt(match[2]);
                const minutes = parseInt(match[3] || '0');
                const offsetMinutes = sign * (hours * 60 + minutes);

                // Calculate time in selected timezone
                const utcTime = date.getTime();
                const timezoneTime = new Date(utcTime + (offsetMinutes * 60000));
                return timezoneTime;
            }
        }
    }

    // Custom Dropdown Manager
    class CustomDropdown {
        constructor(selectElement) {
            this.originalSelect = selectElement;
            this.value = selectElement.value;
            this.options = Array.from(selectElement.options).map(opt => ({
                value: opt.value,
                text: opt.textContent
            }));

            this.createCustomDropdown();
            this.bindEvents();
        }

        createCustomDropdown() {
            // Create custom dropdown structure
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-dropdown';
            if (this.originalSelect.classList.contains('timezone-dropdown')) {
                wrapper.classList.add('timezone-dropdown');
            }

            const toggle = document.createElement('div');
            toggle.className = 'dropdown-toggle';

            const selectedText = document.createElement('span');
            selectedText.className = 'selected-text';
            selectedText.textContent = this.getSelectedText();

            const arrow = document.createElement('div');
            arrow.className = 'dropdown-arrow';

            toggle.appendChild(selectedText);
            toggle.appendChild(arrow);

            const menu = document.createElement('div');
            menu.className = 'dropdown-menu';

            this.options.forEach(option => {
                const item = document.createElement('div');
                item.className = 'dropdown-option';
                item.dataset.value = option.value;
                item.textContent = option.text;
                if (option.value === this.value) {
                    item.classList.add('selected');
                }
                menu.appendChild(item);
            });

            wrapper.appendChild(toggle);
            wrapper.appendChild(menu);

            // Replace original select
            this.originalSelect.style.display = 'none';
            this.originalSelect.parentNode.insertBefore(wrapper, this.originalSelect);

            this.wrapper = wrapper;
            this.toggle = toggle;
            this.menu = menu;
            this.selectedText = selectedText;
        }

        bindEvents() {
            // Toggle dropdown
            this.toggle.addEventListener('click', () => {
                this.toggleDropdown();
            });

            // Handle option selection
            this.menu.addEventListener('click', (e) => {
                if (e.target.classList.contains('dropdown-option')) {
                    this.selectOption(e.target.dataset.value);
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!this.wrapper.contains(e.target)) {
                    this.closeDropdown();
                }
            });

            // Handle keyboard navigation
            this.wrapper.addEventListener('keydown', (e) => {
                this.handleKeyboard(e);
            });
        }

        toggleDropdown() {
            const isOpen = this.menu.classList.contains('open');
            if (isOpen) {
                this.closeDropdown();
            } else {
                this.openDropdown();
            }
        }

        openDropdown() {
            this.toggle.classList.add('open');
            this.menu.classList.add('open');
            this.wrapper.setAttribute('tabindex', '0');
            this.wrapper.focus();
        }

        closeDropdown() {
            this.toggle.classList.remove('open');
            this.menu.classList.remove('open');
            this.wrapper.removeAttribute('tabindex');
        }

        selectOption(value) {
            // Update selected option styling
            this.menu.querySelectorAll('.dropdown-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.value === value) {
                    opt.classList.add('selected');
                }
            });

            // Update display and internal state
            this.value = value;
            this.selectedText.textContent = this.getSelectedText();

            // Update original select and trigger change event
            this.originalSelect.value = value;
            this.originalSelect.dispatchEvent(new Event('change', { bubbles: true }));

            this.closeDropdown();
        }

        getSelectedText() {
            const selectedOption = this.options.find(opt => opt.value === this.value);
            return selectedOption ? selectedOption.text : '';
        }

        handleKeyboard(e) {
            const options = Array.from(this.menu.querySelectorAll('.dropdown-option'));
            const currentIndex = options.findIndex(opt => opt.classList.contains('selected'));

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    const nextIndex = Math.min(currentIndex + 1, options.length - 1);
                    this.selectOption(options[nextIndex].dataset.value);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    const prevIndex = Math.max(currentIndex - 1, 0);
                    this.selectOption(options[prevIndex].dataset.value);
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    this.toggleDropdown();
                    break;
                case 'Escape':
                    this.closeDropdown();
                    break;
            }
        }
    }

    // Main Application Controller
    class MinairApp {
        constructor() {
            this.themeManager = new ThemeManager();
            this.locationManager = new LocationManager();
            this.timeManager = new TimeManager(this.locationManager);
            this.targetManager = new TargetManager();

            this.setupEventListeners();
            this.initializeUI();
        }

        setupEventListeners() {
            // Theme selector
            document.getElementById('theme-select').addEventListener('change', (e) => {
                this.themeManager.switchTheme(e.target.value);
            });

            // Location selector
            document.getElementById('location-select').addEventListener('change', (e) => {
                this.handleLocationChange(e.target.value);
            });

            // Time clock buttons
            document.querySelectorAll('.time-clock').forEach(clock => {
                clock.addEventListener('click', (e) => {
                    const timeRef = e.currentTarget.dataset.timezone;
                    this.timeManager.setTimeReference(timeRef);
                    // Time reference changed - update rise/set display
                    this.targetManager.updateRiseSetTimes();
                });
            });

            // Timezone selector
            document.getElementById('timezone-select').addEventListener('change', () => {
                // Time will update on next clock tick
                // Timezone changed - update rise/set display
                this.targetManager.updateRiseSetTimes();
            });

            // Target management - Add button
            document.getElementById('add-target-btn').addEventListener('click', () => {
                this.addNewTarget();
            });

            // Enter key handling for form inputs
            ['target-name', 'target-ra', 'target-dec'].forEach(id => {
                document.getElementById(id).addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.addNewTarget();
                    }
                });
            });

            // Lookup button for target name -> query SIMBAD/Sesame
            const lookupBtn = document.getElementById('lookup-target-btn');
            if (lookupBtn) {
                lookupBtn.addEventListener('click', async () => {
                    const name = document.getElementById('target-name').value.trim();
                    if (!name) {
                        this.showLookupMessage('Please enter a target name before lookup.', 'error');
                        return;
                    }
                    try {
                        lookupBtn.disabled = true;
                        const origText = lookupBtn.textContent;
                        lookupBtn.textContent = 'Looking...';
                        const coords = await this.targetManager.lookupCoordinates(name);
                        if (coords) {
                            // coords: { raHours, decDeg }
                            document.getElementById('target-ra').value = this.targetManager.formatRA(coords.raHours);
                            document.getElementById('target-dec').value = this.targetManager.formatDec(coords.decDeg);
                            this.showLookupMessage('Coordinates found and filled in.', 'success');
                        } else {
                            this.showLookupMessage('No coordinates found for "' + name + '". Please check the object name.', 'error');
                        }
                    } catch (err) {
                        console.error('Lookup error:', err);
                        this.showLookupMessage('Lookup failed: ' + err.message, 'error');
                    } finally {
                        lookupBtn.disabled = false;
                        lookupBtn.textContent = 'Lookup';
                    }
                });
            }



            // Custom location inputs
            document.getElementById('latitude').addEventListener('change', () => {
                this.updateCustomLocation();
            });

            document.getElementById('longitude').addEventListener('change', () => {
                this.updateCustomLocation();
            });

            // Observation date changes
            document.getElementById('observation-date').addEventListener('change', () => {
                // Date changed - update rise/set times
                this.targetManager.updateRiseSetTimes();
            });

            // Min altitude changes
            document.getElementById('min-altitude').addEventListener('change', () => {
                // Min altitude changed - update rise/set times
                this.targetManager.updateRiseSetTimes();
            });
        }

        initializeUI() {
            // Set today's date
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('observation-date').value = today;

            // Initialize custom dropdowns
            this.initializeCustomDropdowns();

            // Initialize location UI
            this.updateLocationUI();

            // Update alt/az every second for real-time tracking
            setInterval(() => {
                try {
                    this.targetManager.updateCurrentAltAz();
                } catch (e) {
                    // ignore timing errors
                }
            }, 1000);
        }

        initializeCustomDropdowns() {
            // Replace select elements with custom dropdowns
            const selectElements = [
                document.getElementById('theme-select'),
                document.getElementById('location-select'),
                document.getElementById('timezone-select')
            ];

            selectElements.forEach(select => {
                if (select) {
                    new CustomDropdown(select);
                }
            });
        }

        handleLocationChange(value) {
            const customLocation = document.getElementById('custom-location');

            if (value === 'custom') {
                customLocation.style.display = 'flex';
                const location = this.locationManager.getLocation();
                document.getElementById('latitude').value = location.lat;
                document.getElementById('longitude').value = location.lon;
            } else {
                customLocation.style.display = 'none';
                this.locationManager.setObservatory(value);
                // Location changed - update rise/set times
                this.targetManager.updateRiseSetTimes();
            }
        }

        updateCustomLocation() {
            const lat = parseFloat(document.getElementById('latitude').value);
            const lon = parseFloat(document.getElementById('longitude').value);

            if (!isNaN(lat) && !isNaN(lon)) {
                this.locationManager.setLocation(lat, lon, 'Custom Location');
                // Location changed - update rise/set times
                this.targetManager.updateRiseSetTimes();
            }
        }

        updateLocationUI() {
            const location = this.locationManager.getLocation();
            const locationSelect = document.getElementById('location-select');

            // Check if current location matches any observatory
            let matchedObservatory = null;
            for (const [key, obs] of Object.entries(this.locationManager.observatories)) {
                if (Math.abs(obs.lat - location.lat) < 0.001 && Math.abs(obs.lon - location.lon) < 0.001) {
                    matchedObservatory = key;
                    break;
                }
            }

            if (matchedObservatory) {
                locationSelect.value = matchedObservatory;
                document.getElementById('custom-location').style.display = 'none';
            } else {
                locationSelect.value = 'custom';
                document.getElementById('custom-location').style.display = 'flex';
                document.getElementById('latitude').value = location.lat;
                document.getElementById('longitude').value = location.lon;
            }
        }

        clearAddTargetForm() {
            document.getElementById('target-name').value = '';
            document.getElementById('target-ra').value = '';
            document.getElementById('target-dec').value = '';
            this.hideLookupMessage();
            // Focus back to target name for next entry
            document.getElementById('target-name').focus();
        }

        showLookupMessage(message, type = 'info') {
            const messageEl = document.getElementById('lookup-message');
            messageEl.textContent = message;
            messageEl.className = 'lookup-message ' + type;
            messageEl.style.display = 'block';

            // Auto-hide success and info messages after 5 seconds
            if (type === 'success' || type === 'info') {
                setTimeout(() => {
                    this.hideLookupMessage();
                }, 5000);
            }
        }

        hideLookupMessage() {
            const messageEl = document.getElementById('lookup-message');
            messageEl.style.display = 'none';
            messageEl.className = 'lookup-message';
        }

        addNewTarget() {
            const name = document.getElementById('target-name').value.trim();
            const ra = document.getElementById('target-ra').value.trim();
            const dec = document.getElementById('target-dec').value.trim();

            if (!name || !ra || !dec) {
                this.showLookupMessage('Please fill in all target fields.', 'error');
                return;
            }

            try {
                this.targetManager.addTarget(name, ra, dec);
                this.showLookupMessage('Target "' + name + '" added successfully.', 'success');
                this.clearAddTargetForm();
                // Trigger immediate update of observing info for the new target
                setTimeout(() => {
                    this.targetManager.updateTargetsObservingInfo();
                }, 100);
            } catch (error) {
                // Provide more specific error feedback based on the parsing error
                let errorMessage = 'Error adding target: ';
                if (error.message.includes('coordinate')) {
                    errorMessage += 'Invalid coordinate format. ';
                    errorMessage += 'Examples: 12:34:56, 12h34m56s, 12 34 56, 123456, or 185.25 (degrees)';
                } else {
                    errorMessage += error.message;
                }
                this.showLookupMessage(errorMessage, 'error');
                console.error('Target add error:', error);
            }
        }
    }

    // Initialize application when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        window.minairApp = new MinairApp();
    });

})();
