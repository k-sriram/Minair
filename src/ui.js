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
            this.selectedTimeReference = 'local'; // 'utc', 'lst', 'local'
            this.currentTime = new Date();
            this.timezone = this.detectTimezone();
            this.startClock();
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
            this.updateClocks();
            setInterval(() => {
                this.currentTime = new Date();
                this.updateClocks();
            }, 1000);
        }

        updateClocks() {
            // UTC Time
            const utcTime = this.currentTime.toUTCString().split(' ')[4];
            document.getElementById('utc-time').textContent = utcTime;

            // Local Sidereal Time
            const location = this.locationManager.getLocation();
            const lstTime = this.calculateLST(this.currentTime, location.lon);
            document.getElementById('lst-time').textContent = this.formatTime(lstTime);

            // Local Time
            const localTime = this.currentTime.toLocaleTimeString();
            document.getElementById('local-time').textContent = localTime;

            // Update active clock indicator
            this.updateActiveClockIndicator();
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
            // Handle both "h:m:s" and decimal hours format
            if (typeof raStr === 'number') return raStr;
            if (raStr.includes(':')) {
                const parts = raStr.split(':').map(p => parseFloat(p));
                return parts[0] + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
            }
            return parseFloat(raStr);
        }

        parseDec(decStr) {
            // Handle both "d:m:s" and decimal degrees format
            if (typeof decStr === 'number') return decStr;
            if (decStr.includes(':')) {
                const parts = decStr.split(':').map(p => parseFloat(p));
                const sign = parts[0] < 0 ? -1 : 1;
                return parts[0] + sign * ((parts[1] || 0) / 60 + (parts[2] || 0) / 3600);
            }
            return parseFloat(decStr);
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
                <td>${target.name}</td>
                <td>${this.formatRA(target.ra)}</td>
                <td>${this.formatDec(target.dec)}</td>
                <td>--°</td>
                <td>--°</td>
                <td>--:--</td>
                <td>--:--</td>
                <td>
                    <button onclick="minairApp.targetManager.removeTarget(${target.id})" style="background: #dc3545; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer;">Remove</button>
                </td>
            `;
            return row;
        }

        formatRA(ra) {
            const hours = Math.floor(ra);
            const minutes = Math.floor((ra - hours) * 60);
            const seconds = Math.floor(((ra - hours) * 60 - minutes) * 60);
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        formatDec(dec) {
            const sign = dec >= 0 ? '+' : '-';
            const absDec = Math.abs(dec);
            const degrees = Math.floor(absDec);
            const minutes = Math.floor((absDec - degrees) * 60);
            const seconds = Math.floor(((absDec - degrees) * 60 - minutes) * 60);
            return `${sign}${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"`;
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
            } catch (error) {
                alert('Error adding target. Please check your RA/Dec format.');
                console.error('Target add error:', error);
            }
        }
    }

    // Initialize application when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        window.minairApp = new MinairApp();
    });

})();
