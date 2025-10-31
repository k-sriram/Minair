/* TimeConverter.js — Time conversion utilities for Minair
 */

import { formatDateHHMM } from './CoordinateFormatter.js';

/**
 * Convert a Date to the selected time reference
 * @param {Date} dateUTC - UTC Date to convert
 * @param {Object} timeManager - TimeManager instance
 * @returns {Date} Converted date
 */
export function convertDateToSelectedTimeReference(dateUTC, timeManager) {
    const selectedRef = timeManager.selectedTimeReference;

    if (selectedRef === 'utc') {
        // Show the correct UTC time
        return dateUTC;
    } else if (selectedRef === 'lst') {
        // Convert UTC time to LST at the observation location
        const location = timeManager.locationManager.getLocation();
        const lstHours = window.MinairAstronomy.lstFromUTC(dateUTC, location.lon);
        const lstDate = new Date(dateUTC);
        lstDate.setUTCHours(Math.floor(lstHours), Math.floor((lstHours % 1) * 60), 0, 0);
        return lstDate;
    } else { // 'local' or selected timezone
        const timezoneSelect = document.getElementById('timezone-select');
        if (!timezoneSelect) return dateUTC;

        const selectedTimezone = timezoneSelect.value;
        const match = selectedTimezone.match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/);
        if (!match) return dateUTC;

        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2]);
        const minutes = parseInt(match[3] || '0');
        const offsetMinutes = sign * (hours * 60 + minutes);

        // Convert from UTC to selected timezone
        const timezoneTime = new Date(dateUTC.getTime() + (offsetMinutes * 60000));
        return timezoneTime;
    }
}

/**
 * Format a Date to hh:mm in the selected time reference
 * @param {Date} date - Date to format
 * @param {Object} timeManager - TimeManager instance (optional)
 * @returns {string} Formatted time string (hh:mm)
 */
export function formatDateHHMMWithTimeZone(date, timeManager = null) {
    if (!date || !(date instanceof Date)) return '--:--';

    // If no timeManager provided, use UTC
    if (!timeManager) {
        return formatDateHHMM(date);
    }

    const convertedDate = convertDateToSelectedTimeReference(date, timeManager);
    return formatDateHHMM(convertedDate);
}