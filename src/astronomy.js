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

    // Time Coordination Class
    class TimeCoordinator {
        constructor(observationLat, observationLon, userTimezoneOffset = null) {
            this.observationLat = observationLat;
            this.observationLon = observationLon;
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

        convertLSTtoUTC(lstTime) {
            const lstHours = this.extractLSTHours(lstTime);

            // Convert LST to GMST by subtracting longitude
            const gmstHours = wrapHours(lstHours - (this.observationLon / 15));

            // Find the Julian Date that corresponds to this GMST
            // This is an iterative approximation since we need to invert the GMST formula
            const baseDate = new Date(lstTime);
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
            utcTime = new Date((bestJD - 2440587.5) * 86400000);
            return utcTime;
        }

        convertUTCtoLST(utcTime) {
            const JD = toJulianDate(utcTime);
            const lstHours = lstFromJulian(JD, this.observationLon);
            // Create a date representing LST (preserve the date but set time to LST)
            const lstDate = this.createLSTTime(lstHours, new Date());
            return lstDate;
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


        // Get current time in any representation
        now(timeType = 'utc') {
            const currentUTC = new Date();
            const localSolarTime = this.toLocalSolarTime(currentUTC, 'utc');
            return this.fromLocalSolarTime(localSolarTime, timeType);
        }

        // Create a time series in local solar time for calculations
        createTimeSeriesLocal(startTime, endTime, stepMinutes, inputTimeType = 'utc') {
            const startLocal = this.toLocalSolarTime(startTime, inputTimeType);
            const endLocal = this.toLocalSolarTime(endTime, inputTimeType);

            const series = [];
            let currentTime = new Date(startLocal);

            while (currentTime <= endLocal) {
                series.push(new Date(currentTime));
                currentTime = new Date(currentTime.getTime() + stepMinutes * 60000);
            }

            return series;
        }

        // Convert a local solar time series to display time series
        convertSeriesForDisplay(localSolarTimeSeries, targetTimeType = 'utc') {
            return localSolarTimeSeries.map(localTime =>
                this.fromLocalSolarTime(localTime, targetTimeType)
            );
        }

        // Create an LST time from hours (for input purposes)
        createLSTTime(lstHours) {
            const lstDate = new Date();
            const lstHoursInt = Math.floor(lstHours);
            const lstMinutes = Math.floor((lstHours - lstHoursInt) * 60);
            const lstSeconds = Math.floor(((lstHours - lstHoursInt) * 60 - lstMinutes) * 60);
            lstDate.setUTCHours(lstHoursInt, lstMinutes, lstSeconds, 0);
            return lstDate;
        }

        // Extract LST hours from an LST Date object
        extractLSTHours(lstDate) {
            return lstDate.getUTCHours() + lstDate.getUTCMinutes() / 60 + lstDate.getUTCSeconds() / 3600;
        }

        // Helper: Format time type for display
        getTimeTypeLabel(timeType, userTimezoneStr = null) {
            switch (timeType) {
                case 'utc':
                    return 'Time (UTC)';
                case 'user':
                    return userTimezoneStr ? `Time (${userTimezoneStr})` : 'Time (Local)';
                case 'local':
                    return 'Time (Local Solar)';
                case 'lst':
                    return 'Time (LST)';
                default:
                    return 'Time';
            }
        }
    }

    // Expose API
    global.MinairAstronomy = {
        toJulianDate,
        gmstFromJulian,
        lstFromJulian,
        raDecToAltAz,
        sunRaDec,
        sunAltitude,
        TimeCoordinator
    };
})(window);
