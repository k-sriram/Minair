/* TimeManager.js — Time management for Minair
 */
export class TimeManager {
    constructor(locationManager) {
        this.locationManager = locationManager;
        this.selectedTimeReference = this.loadTimeReference();
        this.currentTime = new Date();
        this.timezone = this.detectTimezone();
        this.startClock();
    }

    loadTimeReference() {
        const saved = localStorage.getItem('minair-time-reference');
        return saved || 'utc';
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

        // User Time (using selected timezone)
        const userTime = this.getTimeForSelectedTimezone();
        document.getElementById('user-time').textContent = userTime;

        // Local Sidereal Time - accumulate at sidereal rate
        // Sidereal rate: 1.00273790935 sidereal seconds per solar second
        this.lstAccumulator += 0.1 * 1.00273790935; // 0.1 seconds at sidereal rate

        if (this.lstAccumulator >= 1.0) {
            this.lstAccumulator -= 1.0;
            // Calculate and update LST
            const location = this.locationManager.getLocation();
            const lstTime = window.MinairAstronomy.lstFromUTC(this.currentTime, location.lon);
            document.getElementById('lst-time').textContent = this.formatTime(lstTime);
        }

        // Update active clock indicator
        this.updateActiveClockIndicator();
    }

    getTimeForSelectedTimezone() {
        const timezoneSelect = document.getElementById('timezone-select');
        if (!timezoneSelect) return this.currentTime.toLocaleTimeString([], { hour12: false });

        const offsetMinutes = this.getUserTimezoneOffset();
        if (offsetMinutes === 0 && !timezoneSelect.value.includes('UTC+0')) {
            return this.currentTime.toLocaleTimeString([], { hour12: false });
        }

        // Calculate time in selected timezone
        const utcTime = this.currentTime.getTime() + (this.currentTime.getTimezoneOffset() * 60000);
        const timezoneTime = new Date(utcTime + (offsetMinutes * 60000));

        return timezoneTime.toLocaleTimeString([], { hour12: false });
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

    getUserTimezoneOffset() {
        const timezoneSelect = document.getElementById('timezone-select');
        if (!timezoneSelect) return 0;

        const selectedTimezone = timezoneSelect.value;
        const match = selectedTimezone.match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/);
        if (!match) return 0;

        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2]);
        const minutes = parseInt(match[3] || '0');
        return sign * (hours * 60 + minutes); // return offset in minutes
    }
}