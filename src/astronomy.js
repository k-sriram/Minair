/* astronomy.js — minimal astronomy utilities for Minair
   Units: angles are degrees unless otherwise noted; internal helpers convert to radians.
   date assumes UTC.
*/
(function (global) {
    const deg2Rad = d => d * Math.PI / 180;
    const rad2Deg = r => r * 180 / Math.PI;
    const hour2Deg = h => h * 15;
    const deg2Hour = d => d / 15;
    const wrapDeg = d => ((d % 360) + 360) % 360;
    const wrapHours = h => ((h % 24) + 24) % 24;
    const hours2ms = h => h * 3600000;

    function linInterp(x0, y0, x1, y1, x) {
        // Linear interpolation to find y at x given (x0,y0) and (x1,y1)
        if (x1 === x0) return y0; // avoid division by zero
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }

    function timeSeries(startDate, endDate, stepMinutes) {
        const series = [];
        for (let dt = startDate; dt <= endDate; dt = new Date(dt.getTime() + hours2ms(stepMinutes / 60))) {
            series.push(new Date(dt.getTime()));
        }
        return series;
    }

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
        const lonHours = deg2Hour(lonDeg);
        const lstHours = wrapHours(gmst + lonHours);
        return lstHours;
    }

    function lstFromUTC(date, lonDeg) {
        const JD = toJulianDate(date);
        const lstHours = lstFromJulian(JD, lonDeg);
        return lstHours;

    }

    function calcAltAz(raHours, decDeg, date, obsLatDeg, obsLonDeg) {
        // returns {alt, az} in degrees (az measured from North=0 -> East=90)
        const lstHours = lstFromUTC(date, obsLonDeg);
        const haRad = deg2Rad(hour2Deg(calcHourAngle(lstHours, raHours))); // radians
        const decRad = deg2Rad(decDeg);
        const latRad = deg2Rad(obsLatDeg);

        const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
        const alt = Math.asin(sinAlt);

        // azimuth formula: atan2(sin(HA), cos(HA)*sin(lat) - tan(dec)*cos(lat))
        const y = Math.sin(haRad);
        const x = Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad);
        let az = Math.atan2(y, x); // radians from -pi..pi, where 0 = towards South? we'll convert
        // Convert to degrees and adjust to compass bearing: 0 = North
        az = rad2Deg(az);
        // The formula above returns degrees from -180..180 where 0 points to ??? To get bearing from North:
        // Transform: bearing = (az + 180 + 360) % 360
        const bearing = (az + 180 + 360) % 360;

        return { alt: rad2Deg(alt), az: bearing };
    }

    // Calculates the hour angle in hours
    function calcHourAngle(lstHours, raHours) {
        // both in hours -> result in radians (HA = LST - RA)
        const haHours = wrapHours(lstHours - raHours);
        // convert to -12..12 range for computation
        return haHours > 12 ? haHours - 24 : haHours;
    }

    function calcAirmass(altDeg) {
        if (altDeg === undefined || altDeg === null || altDeg < 0) return NaN;
        const zenithAngle = 90 - altDeg;
        const zenithRad = deg2Rad(zenithAngle);
        let airmass = 1 / Math.cos(zenithRad);

        // Use Kasten-Young formula for better accuracy at low altitudes
        if (altDeg < 60) {
            const altRad = deg2Rad(altDeg);
            airmass = 1 / (Math.sin(altRad) + 0.50572 * Math.pow(altDeg + 6.07995, -1.6364));
        }
        return airmass;
    }

    // ---- Solar position (approximate) ----
    function sunRaDec(date) {
        JD = toJulianDate(date);
        // Compute approximate Sun RA/Dec (J2000) using simplified solar position
        // Based on NOAA/astronomical approximations (sufficient for twilight estimation)
        const T = (JD - 2451545.0) / 36525.0;
        // Sun's mean longitude
        let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        L0 = wrapDeg(L0);
        // Mean anomaly
        const M = wrapDeg(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
        // Ecliptic longitude
        const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(deg2Rad(M))
            + (0.019993 - 0.000101 * T) * Math.sin(deg2Rad(2 * M))
            + 0.000289 * Math.sin(deg2Rad(3 * M));
        const trueLong = L0 + C;

        // Obliquity of the ecliptic
        const eps0 = 23 + (26 + ((21.448 - T * (46.815 + T * (0.00059 - T * 0.001813)))) / 60) / 60;
        const eps = eps0 + 0.00256 * Math.cos(deg2Rad(125.04 - 1934.136 * T));

        // Sun's apparent longitude
        const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(deg2Rad(125.04 - 1934.136 * T));

        // Convert to RA/Dec
        const lambdaRad = deg2Rad(lambda);
        const epsRad = deg2Rad(eps);
        const sinAlpha = Math.sin(lambdaRad) * Math.cos(epsRad);
        const cosAlpha = Math.cos(lambdaRad);
        const alpha = Math.atan2(sinAlpha, cosAlpha); // radians
        const delta = Math.asin(Math.sin(lambdaRad) * Math.sin(epsRad));

        // Convert RA to hours
        let raHours = deg2Hour(rad2Deg(alpha));
        raHours = wrapHours(raHours);
        const decDeg = rad2Deg(delta);
        return { raHours, decDeg };
    }

    function createObsDayTimeSeries(obsLonDeg, obsDay, stepMinutes, startHours = 12, duration = 24) {
        const startDateUTC = new Date(obsDay.getTime() + hours2ms(startHours) - hours2ms(deg2Hour((obsLonDeg))));
        const endDateUTC = new Date(startDateUTC.getTime() + hours2ms(duration));
        return timeSeries(startDateUTC, endDateUTC, stepMinutes);
    }

    function calcRiseSet(raHours, decDeg, obsLatDeg, obsLonDeg, obsDay, altitudeDeg = 0) {
        const dayTimeSeries = createObsDayTimeSeries(obsLonDeg, obsDay, 5, 12, 24);
        let riseTime = null;
        let setTime = null;
        const altSeries = dayTimeSeries.map(date =>
            calcAltAz(raHours, decDeg, date, obsLatDeg, obsLonDeg).alt
        );
        const n = dayTimeSeries.length;

        for (let i = 1; i < dayTimeSeries.length; i++) {
            const prevAlt = altSeries[i - 1];
            const currAlt = altSeries[i];
            const prevTime = dayTimeSeries[i - 1].getTime();
            const currTime = dayTimeSeries[i].getTime();
            if (prevAlt < altitudeDeg && currAlt >= altitudeDeg && !riseTime) {
                riseTime = linInterp(prevAlt, prevTime, currAlt, currTime, altitudeDeg);
                riseTime = new Date(riseTime);
            }
            if (prevAlt >= altitudeDeg && currAlt < altitudeDeg && !setTime) {
                setTime = linInterp(prevAlt, prevTime, currAlt, currTime, altitudeDeg);
                setTime = new Date(setTime);
            }
        }
        return { riseTime, setTime };
    }

    function calcSunriseSunset(obsLatDeg, obsLonDeg, obsDay) {
        const sun = sunRaDec(new Date(obsDay.getTime() + 86400000));
        return calcRiseSet(sun.raHours, sun.decDeg, obsLatDeg, obsLonDeg, obsDay, -0.833);
    }

    function calcAltSeries(raHours, decDeg, obsLatDeg, obsLonDeg, obsDay, stepMinutes = 10) {
        const timeSeries = createObsDayTimeSeries(obsLonDeg, obsDay, stepMinutes);
        const altitudeSeries = timeSeries.map(date => calcAltAz(raHours, decDeg, date, obsLatDeg, obsLonDeg).alt);
        return {time: timeSeries, alt: altitudeSeries};
    }

    function getLocalDayOfTonightAtNow(obsLonDeg) {
        return getLocalDayOfTonightAtDate(obsLonDeg, new Date());
    }

    function getLocalDayOfTonightAtDate(obsLonDeg, date) {
        const localDate = new Date(date.getTime() + hours2ms(deg2Hour((obsLonDeg))));
        // If time is before noon, tonight is yesterday's else today's
        if (localDate.getUTCHours() < 12) {
            localDate.setUTCDate(localDate.getDate() - 1);
        }
        localDate.setUTCHours(0, 0, 0, 0);
        return localDate;
    }

    // Expose API
    global.MinairAstronomy = {
        calcAltAz,
        lstFromUTC,
        calcHourAngle,
        calcAirmass,
        calcRiseSet,
        calcSunriseSunset,
        calcAltSeries,
        getLocalDayOfTonightAtNow,
    };
})(window);
