/* astronomy.js — minimal astronomy utilities for Minair
   Units: angles are degrees unless otherwise noted; internal helpers convert to radians.
*/
(function (global) {
    const deg2rad = d => d * Math.PI / 180;
    const rad2deg = r => r * 180 / Math.PI;
    const hoursToDeg = h => h * 15;
    const wrapDeg = d => ((d % 360) + 360) % 360;
    const wrapHours = h => ((h % 24) + 24) % 24;

    function toJulianDate(date) {
        // Accepts JS Date (assumed UTC)
        return date.getTime() / 86400000 + 2440587.5;
    }

    function gmstFromJulian(JD) {
        // Approximate Greenwich Mean Sidereal Time in hours
        // Source: Meeus simplified formula
        const D = JD - 2451545.0;
        const gmst = 18.697374558 + 24.06570982441908 * D;
        return wrapHours(gmst);
    }

    function lstFromJulian(JD, lonDeg) {
        // lonDeg: east positive
        const gmst = gmstFromJulian(JD);
        const lonHours = lonDeg / 15;
        return wrapHours(gmst + lonHours);
    }

    function hourAngle(lstHours, raHours) {
        // both in hours -> result in radians (HA = LST - RA)
        const haHours = wrapHours(lstHours - raHours);
        // convert to -12..12 range for computation
        const wrapped = haHours > 12 ? haHours - 24 : haHours;
        return deg2rad(wrapped * 15);
    }

    function raDecToAltAz(raHours, decDeg, date, latDeg, lonDeg) {
        // returns {alt, az} in degrees (az measured from North=0 -> East=90)
        const JD = toJulianDate(date);
        const lst = lstFromJulian(JD, lonDeg);
        const ha = hourAngle(lst, raHours); // radians
        const dec = deg2rad(decDeg);
        const lat = deg2rad(latDeg);

        const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
        const alt = Math.asin(sinAlt);

        // azimuth formula: atan2(sin(HA), cos(HA)*sin(lat) - tan(dec)*cos(lat))
        const y = Math.sin(ha);
        const x = Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat);
        let az = Math.atan2(y, x); // radians from -pi..pi, where 0 = towards South? we'll convert
        // Convert to degrees and adjust to compass bearing: 0 = North
        az = rad2deg(az);
        // The formula above returns degrees from -180..180 where 0 points to ??? To get bearing from North:
        // Transform: bearing = (az + 180 + 360) % 360
        const bearing = (az + 180 + 360) % 360;

        return { alt: rad2deg(alt), az: bearing };
    }

    // ---- Solar position (approximate) ----
    function sunRaDec(JD) {
        // Compute approximate Sun RA/Dec (J2000) using simplified solar position
        // Based on NOAA/astronomical approximations (sufficient for twilight estimation)
        const T = (JD - 2451545.0) / 36525.0;
        // Sun's mean longitude
        let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        L0 = wrapDeg(L0);
        // Mean anomaly
        const M = wrapDeg(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
        // Ecliptic longitude
        const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(deg2rad(M))
            + (0.019993 - 0.000101 * T) * Math.sin(deg2rad(2 * M))
            + 0.000289 * Math.sin(deg2rad(3 * M));
        const trueLong = L0 + C;

        // Obliquity of the ecliptic
        const eps0 = 23 + (26 + ((21.448 - T * (46.815 + T * (0.00059 - T * 0.001813)))) / 60) / 60;
        const eps = eps0 + 0.00256 * Math.cos(deg2rad(125.04 - 1934.136 * T));

        // Sun's apparent longitude
        const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(deg2rad(125.04 - 1934.136 * T));

        // Convert to RA/Dec
        const lambdaRad = deg2rad(lambda);
        const epsRad = deg2rad(eps);
        const sinAlpha = Math.sin(lambdaRad) * Math.cos(epsRad);
        const cosAlpha = Math.cos(lambdaRad);
        const alpha = Math.atan2(sinAlpha, cosAlpha); // radians
        const delta = Math.asin(Math.sin(lambdaRad) * Math.sin(epsRad));

        // Convert RA to hours
        let raHours = rad2deg(alpha) / 15;
        raHours = ((raHours % 24) + 24) % 24;
        const decDeg = rad2deg(delta);
        return { raHours, decDeg };
    }

    function sunAltitude(date, latDeg, lonDeg) {
        const JD = toJulianDate(date);
        const sun = sunRaDec(JD);
        const altAz = raDecToAltAz(sun.raHours, sun.decDeg, date, latDeg, lonDeg);
        return altAz.alt;
    }

    // Expose API
    global.MinairAstronomy = {
        toJulianDate,
        gmstFromJulian,
        lstFromJulian,
        raDecToAltAz,
        sunRaDec,
        sunAltitude
    };
})(window);
