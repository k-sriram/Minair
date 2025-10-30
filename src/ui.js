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
                <td>
                    <button onclick="minairApp.targetManager.removeTarget(${target.id})" style="background: #dc3545; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer;">Remove</button>
                </td>
            `;
            return row;
        }

        // Compute and update current alt/az and rise/set times for targets
        async updateTargetsObservingInfo() {
            const tbody = document.getElementById('target-table-body');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const astro = window.MinairAstronomy;
            const scheduler = window.MinairScheduler;
            // use existing global app instance for location
            const app = window.minairApp;
            const loc = app ? app.locationManager.getLocation() : { lat: 51.4779, lon: -0.0015 };
            const now = new Date();

            for (let i = 0; i < this.targets.length; i++) {
                const target = this.targets[i];
                const row = rows[i];
                if (!row) continue;

                // Current alt/az
                try {
                    const altAz = astro.raDecToAltAz(target.ra, target.dec, now, loc.lat, loc.lon);
                    row.querySelector('.cell-alt').textContent = this.formatAngleDeg(altAz.alt);
                    row.querySelector('.cell-az').textContent = this.formatAngleDegUnsigned(altAz.az);
                } catch (e) {
                    // ignore
                }

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

        // Format azimuth without sign, 0-360 as dd:mm:ss
        formatAngleDegUnsigned(angle) {
            let a = angle % 360;
            if (a < 0) a += 360;
            const deg = Math.floor(a);
            const min = Math.floor((a - deg) * 60);
            const sec = Math.floor(((a - deg) * 60 - min) * 60);
            return `${deg.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }

        formatRA(ra) {
            // ra is in decimal hours. Format: hh:mm:ss.ss (seconds with 2 decimals)
            const hours = Math.floor(ra);
            const minutes = Math.floor((ra - hours) * 60);
            const seconds = ((ra - hours) * 60 - minutes) * 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
        }

        formatDec(dec) {
            // dec is in decimal degrees. Format: +dd:mm:ss.s (seconds with 1 decimal)
            const sign = dec >= 0 ? '+' : '-';
            const absDec = Math.abs(dec);
            const degrees = Math.floor(absDec);
            const minutes = Math.floor((absDec - degrees) * 60);
            const seconds = ((absDec - degrees) * 60 - minutes) * 60;
            return `${sign}${degrees.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
        }

        // Format an angle in decimal degrees to dd:mm:ss (seconds integer)
        formatAngleDeg(angle) {
            const sign = angle >= 0 ? '+' : '-';
            const absA = Math.abs(angle);
            const deg = Math.floor(absA);
            const min = Math.floor((absA - deg) * 60);
            const sec = Math.floor(((absA - deg) * 60 - min) * 60);
            return `${sign}${deg.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }

        // Format a Date to hh:mm (24-hour)
        formatDateHHMM(date) {
            if (!date || !(date instanceof Date)) return '--:--';
            const h = date.getHours().toString().padStart(2, '0');
            const m = date.getMinutes().toString().padStart(2, '0');
            return `${h}:${m}`;
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
                });
            });

            // Timezone selector
            document.getElementById('timezone-select').addEventListener('change', () => {
                // Time will update on next clock tick
            });

            // Target management
            document.getElementById('add-target-btn').addEventListener('click', () => {
                this.showAddTargetForm();
            });

            document.getElementById('save-target-btn').addEventListener('click', () => {
                this.saveNewTarget();
            });

            document.getElementById('cancel-target-btn').addEventListener('click', () => {
                this.hideAddTargetForm();
            });

            // Custom location inputs
            document.getElementById('latitude').addEventListener('change', () => {
                this.updateCustomLocation();
            });

            document.getElementById('longitude').addEventListener('change', () => {
                this.updateCustomLocation();
            });
        }

        initializeUI() {
            // Set today's date
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('observation-date').value = today;

            // Initialize location UI
            this.updateLocationUI();

            // Periodically refresh observing info (alt/az, rise/set)
            setInterval(() => {
                try {
                    this.targetManager.updateTargetsObservingInfo();
                } catch (e) {
                    // ignore timing errors
                }
            }, 60000);
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
            }
        }

        updateCustomLocation() {
            const lat = parseFloat(document.getElementById('latitude').value);
            const lon = parseFloat(document.getElementById('longitude').value);

            if (!isNaN(lat) && !isNaN(lon)) {
                this.locationManager.setLocation(lat, lon, 'Custom Location');
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

        showAddTargetForm() {
            document.getElementById('add-target-form').style.display = 'block';
            document.getElementById('target-name').focus();
        }

        hideAddTargetForm() {
            document.getElementById('add-target-form').style.display = 'none';
            this.clearAddTargetForm();
        }

        clearAddTargetForm() {
            document.getElementById('target-name').value = '';
            document.getElementById('target-ra').value = '';
            document.getElementById('target-dec').value = '';
        }

        saveNewTarget() {
            const name = document.getElementById('target-name').value.trim();
            const ra = document.getElementById('target-ra').value.trim();
            const dec = document.getElementById('target-dec').value.trim();

            if (!name || !ra || !dec) {
                alert('Please fill in all target fields.');
                return;
            }

            try {
                this.targetManager.addTarget(name, ra, dec);
                this.hideAddTargetForm();
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
                alert(errorMessage);
                console.error('Target add error:', error);
            }
        }
    }

    // Initialize application when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        window.minairApp = new MinairApp();
    });

})();
