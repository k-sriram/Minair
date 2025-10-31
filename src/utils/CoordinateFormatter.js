/* CoordinateFormatter.js — Coordinate formatting utilities for Minair
 */

/**
 * Format Right Ascension in hours:minutes:seconds format
 * @param {number} ra - RA in decimal hours
 * @returns {string} Formatted RA string (hh:mm:ss.ss)
 */
export function formatRA(ra) {
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

/**
 * Format Declination in degrees:minutes:seconds format
 * @param {number} dec - Dec in decimal degrees
 * @returns {string} Formatted Dec string (+dd:mm:ss.s)
 */
export function formatDec(dec) {
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

/**
 * Format an angle in decimal degrees to dd:mm:ss (signed)
 * @param {number} angle - Angle in decimal degrees
 * @returns {string} Formatted angle string (±dd:mm:ss)
 */
export function formatAngleDeg(angle) {
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

/**
 * Format azimuth without sign, 0-360 as dd:mm:ss
 * @param {number} angle - Angle in decimal degrees
 * @returns {string} Formatted azimuth string (dd:mm:ss)
 */
export function formatAngleDegUnsigned(angle) {
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

/**
 * Format hour angle in hours and minutes (±HH:MM format)
 * @param {number} hours - Hour angle in decimal hours
 * @returns {string} Formatted hour angle string (±hh:mm)
 */
export function formatHourAngle(hours) {
    const sign = hours >= 0 ? '+' : '-';
    const absHours = Math.abs(hours);
    const h = Math.floor(absHours);
    const m = Math.floor((absHours - h) * 60);

    return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format a Date to hh:mm (24-hour) in UTC
 * @param {Date} date - Date object to format
 * @returns {string} Formatted time string (hh:mm)
 */
export function formatDateHHMM(date) {
    if (!date || !(date instanceof Date)) return '--:--';

    const h = date.getUTCHours().toString().padStart(2, '0');
    const m = date.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}