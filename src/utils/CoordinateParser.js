/* CoordinateParser.js — Coordinate parsing utilities for Minair
 */

/**
 * Comprehensive coordinate parser that handles multiple formats
 * @param {string|number} coordStr - Coordinate string to parse
 * @param {string} default_unit - Default unit: 'ha' for hour angles, 'deg' for degrees
 * @returns {number} Parsed coordinate value
 */
export function parseCoordinate(coordStr, default_unit) {
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
                    // If this looks like it was specified in hours (h suffix), convert to degrees
                    if (cleaned.includes('h')) {
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

/**
 * Parse Right Ascension coordinate string
 * @param {string|number} raStr - RA string to parse
 * @returns {number} RA in decimal hours
 */
export function parseRA(raStr) {
    return parseCoordinate(raStr, 'ha');
}

/**
 * Parse Declination coordinate string  
 * @param {string|number} decStr - Dec string to parse
 * @returns {number} Dec in decimal degrees
 */
export function parseDec(decStr) {
    return parseCoordinate(decStr, 'deg');
}