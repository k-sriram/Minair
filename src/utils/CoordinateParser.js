/* CoordinateParser.js — Coordinate parsing utilities for Minair
 */

/**
 * Comprehensive coordinate parser that handles multiple formats
 * @param {string|number} coordStr - Coordinate string to parse
 * @param {string} default_unit - Default unit: 'ha' for hour angles, 'deg' for degrees
 * @returns {number} Parsed coordinate value
 */
/**
 * Preprocess coordinate string to extract sign from directional suffixes
 * @param {string} coordStr - Coordinate string to preprocess
 * @returns {object} Object with sign and cleaned string
 */
function preprocessDirectionalSuffix(coordStr) {
    // Clean up the input string - remove extra spaces and normalize
    let cleaned = coordStr.toString().trim().replace(/\s+/g, ' ');
    let sign = 1;

    // Check for directional suffixes at the end
    const directionMatch = cleaned.match(/^(.+?)\s*([NSEW])$/i);
    if (directionMatch) {
        const direction = directionMatch[2].toUpperCase();
        cleaned = directionMatch[1].trim();

        // N and E are positive, S and W are negative
        if (direction === 'S' || direction === 'W') {
            sign = -1;
        }
    }

    // If there's already a +/- sign in the cleaned string, respect it
    // but combine with directional sign
    const signMatch = cleaned.match(/^([+-])/);
    if (signMatch) {
        const explicitSign = signMatch[1] === '-' ? -1 : 1;
        sign = sign * explicitSign;
        // Remove the explicit sign since we've captured it
        cleaned = cleaned.replace(/^[+-]/, '');
    }

    return { sign, cleaned };
}

export function parseCoordinate(coordStr, default_unit) {
    if (typeof coordStr === 'number') return coordStr;

    // Preprocess to handle directional suffixes
    const { sign: directionSign, cleaned } = preprocessDirectionalSuffix(coordStr);

    // Handle different format patterns with unit metadata
    // Note: sign is now handled by preprocessing, so patterns don't need sign capture groups
    const patterns = [
        // HMS/DMS with colons: "12:34:56.7" or "12:34:56"
        { regex: /^([0-9]{1,3}):([0-9]{1,2}):([0-9]{1,2}(?:\.[0-9]+)?)$/, unit: 'default', type: 'dms' },
        // HM/DM with colons: "12:34" (partial format)
        { regex: /^([0-9]{1,3}):([0-9]{1,2})$/, unit: 'default', type: 'dms' },
        // HMS/DMS with spaces: "12 34 56.7" or "12 34 56"
        { regex: /^([0-9]{1,3})\s+([0-9]{1,2})\s+([0-9]{1,2}(?:\.[0-9]+)?)$/, unit: 'default', type: 'dms' },
        // HM/DM with spaces: "12 34" (partial format)
        { regex: /^([0-9]{1,3})\s+([0-9]{1,2})$/, unit: 'default', type: 'dms' },
        // Compact format: "123456" or "123456.7"
        { regex: /^([0-9]{2})([0-9]{2})([0-9]{2}(?:\.[0-9]+)?)$/, unit: 'default', type: 'dms' },
        // Compact partial format: "1234" (HHMM)
        { regex: /^([0-9]{2})([0-9]{2})$/, unit: 'default', type: 'dms' },
        // With hour suffixes: "12h34m56s" or "12h34m"
        { regex: /^([0-9]{1,3})h\s*([0-9]{1,2})m\s*([0-9]{1,2}(?:\.[0-9]+)?)s$/, unit: 'ha', type: 'dms' },
        { regex: /^([0-9]{1,3})h\s*([0-9]{1,2})m$/, unit: 'ha', type: 'dms' },
        // With degree suffixes: "12d34m56s" or "12d34m"
        { regex: /^([0-9]{1,3})d\s*([0-9]{1,2})m\s*([0-9]{1,2}(?:\.[0-9]+)?)s$/, unit: 'deg', type: 'dms' },
        { regex: /^([0-9]{1,3})d\s*([0-9]{1,2})m$/, unit: 'deg', type: 'dms' },
        // Degrees with symbols: "12°34'56.7"" or "12°34'56""
        { regex: /^([0-9]{1,3})°([0-9]{1,2})'([0-9]{1,2}(?:\.[0-9]+)?)"$/, unit: 'deg', type: 'dms' },
        // Degrees with symbols (partial): "12°34'" (degrees and arcminutes only)
        { regex: /^([0-9]{1,3})°([0-9]{1,2})'$/, unit: 'deg', type: 'dms' },
        // Decimal degrees with symbol: "123.456°"
        { regex: /^([0-9]{1,3}(?:\.[0-9]+))°$/, unit: 'deg', type: 'decimal' },
        // Pure decimal: "123.456"
        { regex: /^([0-9]{1,3}(?:\.[0-9]+))$/, unit: 'deg', type: 'decimal' }
    ];

    // Try each pattern
    for (const patternObj of patterns) {
        const match = cleaned.match(patternObj.regex);
        if (match) {
            // Determine the unit for this pattern
            let patternUnit = patternObj.unit;
            if (patternUnit === 'default') {
                patternUnit = default_unit;
            }

            if (patternObj.type === 'decimal') {
                // Decimal format
                const decimal = parseFloat(match[1]);
                let result = directionSign * decimal;

                // Convert to target unit if needed
                if (patternUnit === 'deg' && default_unit === 'ha') {
                    result = result / 15; // degrees to hours
                } else if (patternUnit === 'ha' && default_unit === 'deg') {
                    result = result * 15; // hours to degrees
                }

                return result;
            } else {
                // DMS/HMS format (full or partial)
                const major = parseFloat(match[1]);
                const minor = parseFloat(match[2] || 0);
                const seconds = parseFloat(match[3] || 0);

                let result = major + minor / 60 + seconds / 3600;

                // Apply the directional sign
                result = directionSign * result;

                // Convert to target unit if needed
                if (patternUnit === 'deg' && default_unit === 'ha') {
                    result = result / 15; // degrees to hours
                } else if (patternUnit === 'ha' && default_unit === 'deg') {
                    result = result * 15; // hours to degrees
                }

                return result;
            }
        }
    }    // Fallback: try to parse as a simple number
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