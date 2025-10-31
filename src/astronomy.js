/* astronomy.js — minimal astronomy utilities for Minair
   Units: angles are degrees unless otherwise noted; internal helpers convert to radians.
*/
(function (global) {
    const deg2Rad = d => d * Math.PI / 180;
    const rad2Deg = r => r * 180 / Math.PI;
    const deg2Hour = d => d / 15;
    const wrapDeg = d => ((d % 360) + 360) % 360;
    const wrapHours = h => ((h % 24) + 24) % 24;

    function toJulianDate(dateUTC) {
        // Accepts JS Date (assumed UTC)
        return dateUTC.getTime() / 86400000 + 2440587.5;
    }

    function fromJulianDate(JDUTC) {
        // Returns JS Date in UTC
        return new Date((JDUTC - 2440587.5) * 86400000);
    }

    function gmstFromJulian(JDUTC) {
        // Approximate Greenwich Mean Sidereal Time in hours
        // Source: Meeus simplified formula
        const D = JDUTC - 2451545.0;
        const gmst = 18.697374558 + 24.06570982441908 * D;
        return wrapHours(gmst);
    }

    function lstFromJulian(JDUTC, lonDeg) {
        // lonDeg: east positive
        const gmst = gmstFromJulian(JDUTC);
        const lonHours = deg2Hour(lonDeg);
        const lstHours = wrapHours(gmst + lonHours);
        return lstHours;
    }

    function hourAngle(lstHours, raHours) {
        // both in hours -> result in radians (HA = LST - RA)
        const haHours = wrapHours(lstHours - raHours);
        // convert to -12..12 range for computation
        const wrapped = haHours > 12 ? haHours - 24 : haHours;
        return deg2Rad(wrapped * 15);
    }

    function raDecToAltAz(raHours, decDeg, dateUTC, latDeg, lonDeg) {
        // returns {alt, az} in degrees (az measured from North=0 -> East=90)
        const JD = toJulianDate(dateUTC);
        const lstHours = lstFromJulian(JD, lonDeg);
        const ha = hourAngle(lstHours, raHours); // radians
        const dec = deg2Rad(decDeg);
        const lat = deg2Rad(latDeg);

        const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
        const alt = Math.asin(sinAlt);

        // azimuth formula: atan2(sin(HA), cos(HA)*sin(lat) - tan(dec)*cos(lat))
        const y = Math.sin(ha);
        const x = Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat);
        let az = Math.atan2(y, x); // radians from -pi..pi, where 0 = towards South? we'll convert
        // Convert to degrees and adjust to compass bearing: 0 = North
        az = rad2Deg(az);
        // The formula above returns degrees from -180..180 where 0 points to ??? To get bearing from North:
        // Transform: bearing = (az + 180 + 360) % 360
        const bearing = (az + 180 + 360) % 360;

        return { alt: rad2Deg(alt), az: bearing };
    }

    // ---- Solar position (approximate) ----
    function sunRaDec(JDUTC) {
        // Compute approximate Sun RA/Dec (J2000) using simplified solar position
        // Based on NOAA/astronomical approximations (sufficient for twilight estimation)
        const T = (JDUTC - 2451545.0) / 36525.0;
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

    function linInterp(x0, y0, x1, y1, x) {
        // Linear interpolation to find y at x given (x0,y0) and (x1,y1)
        if (x1 === x0) return y0; // avoid division by zero
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }

    // Time Coordination Class
    class TimeCoordinator {
        constructor(observationLat, observationLon, observationDay, userTimezoneOffset = null) {
            this.observationLat = observationLat;
            this.observationLon = observationLon;
            this.observationDay = observationDay;
            // userTimezoneOffset in minutes from UTC (e.g., -300 for UTC-5, +330 for UTC+5:30)
            this.userTimezoneOffset = userTimezoneOffset || (new Date().getTimezoneOffset() * -1);
        }

        // Update location when user changes it
        setLocation(lat, lon) {
            this.observationLat = lat;
            this.observationLon = lon;
        }

        // Update user timezone when they change it
        setUserTimezone(offsetMinutes) {
            this.userTimezoneOffset = offsetMinutes;
        }

        // Parse timezone string like "UTC+5:30" to offset in minutes
        parseTimezoneString(timezoneStr) {
            const match = timezoneStr.match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/);
            if (!match) return 0;

            const sign = match[1] === '+' ? 1 : -1;
            const hours = parseInt(match[2]);
            const minutes = parseInt(match[3] || '0');
            return sign * (hours * 60 + minutes);
        }

        convertLSTtoUTC(lstHours) {
            // Convert LST to GMST by subtracting longitude
            const gmstHours = wrapHours(lstHours - (this.observationLon / 15));

            // Find the Julian Date that corresponds to this GMST
            // This is an iterative approximation since we need to invert the GMST formula
            const baseDate = new Date(this.observationDay + lstHours / 24); // Start at observation day
            baseDate.setUTCHours(0, 0, 0, 0);
            let bestJD = toJulianDate(baseDate);
            let bestError = Math.abs(gmstFromJulian(bestJD) - gmstHours);

            // Search within ±1 day with 1-minute precision
            for (let offsetMinutes = -1440; offsetMinutes <= 1440; offsetMinutes += 1) {
                const testJD = bestJD + (offsetMinutes / 1440); // Convert minutes to days
                const testGMST = gmstFromJulian(testJD);
                const error = Math.abs(wrapHours(testGMST - gmstHours));
                const wrappedError = Math.min(error, 24 - error); // Handle wrap-around

                if (wrappedError < bestError) {
                    bestError = wrappedError;
                    bestJD = testJD;
                }
            }

            // Convert Julian Date back to UTC time
            utcTime = fromJulianDate(bestJD);
            return utcTime;
        }

        convertUTCtoLST(utcTime) {
            const JD = toJulianDate(utcTime);
            const lstHours = lstFromJulian(JD, this.observationLon);
            // Create a date representing LST (preserve the date but set time to LST)
            return lstHours;
        }

        // CORE CONVERSION: From any time representation to Local Solar Time at observation location
        // This is the "true" time for astronomical calculations
        toLocalSolarTime(time, timeType = 'utc') {
            let utcTime;

            switch (timeType) {
                case 'utc':
                    utcTime = new Date(time.getTime());
                    break;
                case 'user':
                    // Convert from user timezone to UTC
                    utcTime = new Date(time.getTime() - (this.userTimezoneOffset * 60000));
                    break;
                case 'local':
                    // time is already local solar time at observation location
                    return new Date(time.getTime());
                case 'lst':
                    // Convert LST back to UTC
                    // Extract LST hours from the date
                    utcTime = this.convertLSTtoUTC(time);
                    break;
                default:
                    utcTime = new Date(time.getTime());
            }

            // Convert UTC to local solar time at observation location
            const longitudeOffsetMinutes = this.observationLon * 4; // 4 minutes per degree
            return new Date(utcTime.getTime() + (longitudeOffsetMinutes * 60000));
        }


        // Convert Local Solar Time to other time representations
        fromLocalSolarTime(localSolarTime, targetType = 'utc') {
            // First convert local solar time back to UTC
            const longitudeOffsetMinutes = this.observationLon * 4; // 4 minutes per degree
            const utcTime = new Date(localSolarTime.getTime() - (longitudeOffsetMinutes * 60000));

            switch (targetType) {
                case 'utc':
                    return utcTime;
                case 'user':
                    // Convert UTC to user timezone
                    return new Date(utcTime.getTime() + (this.userTimezoneOffset * 60000));
                case 'local':
                    return new Date(localSolarTime.getTime());
                case 'lst':
                    // Convert UTC to LST at observation location
                    const lstDate = this.convertUTCtoLST(utcTime);
                    return lstDate;
                default:
                    return utcTime;
            }
        }

        // Create a utc Date series starting from observation day noon local solar time
        createObsDayTimeSeries(stepMinutes, startHours = 12, duration = 24) {
            const startDateLocal = this.toLocalSolarTime(this.observationDay.getTime() + (startHours * 60 * 60000));
            const endDateLocal = new Date(startDateLocal.getTime() + (duration * 60 * 60000));

            return timeSeries(startDateLocal, endDateLocal, stepMinutes);
        }

        createObsNightTimeSeries(stepMinutes, padHours = 0.5) {
            // Get sunrise/sunset times
            const sunTimes = calculateSunriseSunset(this);
            // The rise and set time are already in local solar time
            const sunriseLocal = sunTimes.riseTime;
            const sunsetLocal = sunTimes.setTime;
            // If sunrise/sunset are null (polar day/night), return entire day using obs day time series
            if (!sunriseLocal || !sunsetLocal) {
                return this.createObsDayTimeSeries(stepMinutes, 12, 24);
            }
            // Create time series from (sunset - pad) to (sunrise + pad)
            const startLocal = new Date(sunsetLocal.getTime() - (padHours * 60 * 60000));
            const endLocal = new Date(sunriseLocal.getTime() + (padHours * 60 * 60000));
            return timeSeries(startLocal, endLocal, stepMinutes);
        }
    }

    function timeSeries(startDate, endDate, stepMinutes) {
        const series = [];
        let currentTime = startDate.getTime();
        const endTime = endDate.getTime();

        while (currentTime <= endTime) {
            series.push(new Date(currentTime));
            currentTime += stepMinutes * 60000;
        }
        return series;
    }

    function calculateAltAzHaAm(raHours, decDeg, dateUTC, timeCoordinator) {
        const altAz = calculateAltAz(raHours, decDeg, dateUTC, timeCoordinator);
        const lstHours = timeCoordinator.convertUTCtoLST(dateUTC);
        const ha = hourAngle(lstHours, raHours);
        let airmass = '--';
            if (altAz.alt > 0) {
                const zenithAngle = 90 - altAz.alt;
                const zenithRad = deg2Rad(zenithAngle);
                airmass = 1 / Math.cos(zenithRad);

                // Use Kasten-Young formula for better accuracy at low altitudes
                if (altAz.alt < 60) {
                    const altRad = deg2Rad(altAz.alt);
                    airmass = 1 / (Math.sin(altRad) + 0.50572 * Math.pow(altAz.alt + 6.07995, -1.6364));
                }
            }
        return { alt: altAz.alt, az: altAz.az, ha: ha, am: airmass };
    }

    function calculateAltAz(raHours, decDeg, dateUTC, timeCoordinator) {
        return raDecToAltAz(raHours, decDeg, dateUTC, timeCoordinator.observationLat, timeCoordinator.observationLon);
    }

    function calculateSunriseSunset(timeCoordinator) {
        const sun = sunRaDec(toJulianDate(timeCoordinator.observationDay));
        return calculateRiseSet(sun.raHours, sun.decDeg, timeCoordinator);
    }

    function calculateRiseSet(raHours, decDeg, timeCoordinator, altitudeDeg = 0) {
        const dayTimeSeries = timeCoordinator.createObsDayTimeSeries(5, 12, 24);
        let riseTime = null;
        let setTime = null;
        const currAlt = calculateAltAz(raHours, decDeg, dayTimeSeries[0], timeCoordinator).alt;

        for (let i = 1; i < dayTimeSeries.length; i++) {
            const prevAlt = currAlt;
            const currAlt = calculateAltAz(raHours, decDeg, dayTimeSeries[i], timeCoordinator).alt;
            if (prevAlt < altitudeDeg && currAlt >= altitudeDeg && !riseTime) {
                riseTime = linInterp(prevAlt, dayTimeSeries[i - 1].getTime(), currAlt, dayTimeSeries[i].getTime(), altitudeDeg);
                riseTime = new Date(riseTime);
            }
            if (prevAlt >= altitudeDeg && currAlt < altitudeDeg && !setTime) {
                setTime = linInterp(prevAlt, dayTimeSeries[i - 1].getTime(), currAlt, dayTimeSeries[i].getTime(), altitudeDeg);
                setTime = new Date(setTime);
            }
        }
        return { riseTime, setTime };
    }

    function calculateObjectAltitudeSeries(raHours, decDeg, timeCoordinator, stepMinutes = 10) {
        const timeSeries = timeCoordinator.createObsNightTimeSeries(stepMinutes);
        const altitudeSeries = timeSeries.map(dateUTC => {
            const altAz = calculateAltAz(raHours, decDeg, dateUTC, timeCoordinator);
            return { timeUTC: dateUTC, alt: altAz.alt, az: altAz.az };
        });
        return altitudeSeries;
    }

    // Expose API
    global.MinairAstronomy = {
        TimeCoordinator,
        calculateAltAz,
        calculateAltAzHaAm,
        calculateSunriseSunset,
        calculateRiseSet,
        calculateObjectAltitudeSeries,
    };
})(window);
