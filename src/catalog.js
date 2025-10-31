/* catalog.js — External catalog query services for Minair
   Handles coordinate lookups from astronomical databases like SIMBAD and CDS Sesame
*/
(function (global) {
    'use strict';

    class CatalogService {
        constructor() {
            this._lastLookupTime = 0; // for rate-limiting external queries (ms)
        }

        // Rate-limit helper: ensure at least 100ms between external queries
        async _rateLimitQuery() {
            const minInterval = 100; // ms
            const now = Date.now();
            const since = now - (this._lastLookupTime || 0);
            if (since < minInterval) {
                await new Promise(r => setTimeout(r, minInterval - since));
            }
            this._lastLookupTime = Date.now();
        }

        // Lookup coordinates for an object name using CDS/SIMBAD services.
        // Returns { raHours, decDeg }
        async lookupCoordinates(name) {
            if (!name || !name.trim()) throw new Error('Empty name');
            await this._rateLimitQuery();

            // First try CDS Sesame text resolver which often returns a '%J' line with J2000 decimal degrees
            const sesameUrl = `https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oI?${encodeURIComponent(name)}`;
            try {
                const res = await fetch(sesameUrl);
                if (res.ok) {
                    const txt = await res.text();
                    const lines = txt.split(/\r?\n/);
                    for (const line of lines) {
                        // %J RA DEC (degrees)
                        const m = line.match(/^%J\s+([+-]?[0-9\.Ee+-]+)\s+([+-]?[0-9\.Ee+-]+)/);
                        if (m) {
                            const raDeg = parseFloat(m[1]);
                            const decDeg = parseFloat(m[2]);
                            if (!isNaN(raDeg) && !isNaN(decDeg)) {
                                return { raHours: raDeg / 15.0, decDeg };
                            }
                        }
                    }
                }
            } catch (e) {
                // ignore and try SIMBAD VOTABLE next
                console.warn('Sesame lookup failed:', e);
            }

            // Second attempt: SIMBAD VOTABLE output (may be blocked by CORS in browsers)
            const simbadUrl = `https://simbad.u-strasbg.fr/simbad/sim-id?Ident=${encodeURIComponent(name)}&output.format=VOTABLE`;
            try {
                const res2 = await fetch(simbadUrl);
                if (res2.ok) {
                    const xmlText = await res2.text();
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(xmlText, 'application/xml');

                    // Build field name -> index map
                    const fields = Array.from(xml.querySelectorAll('FIELD')).map(f => ({ name: f.getAttribute('name') || '', id: f.getAttribute('ID') || '' }));
                    let raIdx = -1, decIdx = -1;
                    for (let i = 0; i < fields.length; i++) {
                        const nm = (fields[i].name || fields[i].id || '').toLowerCase();
                        if (nm.includes('ra') && raIdx === -1) raIdx = i;
                        if (nm.includes('dec') && decIdx === -1) decIdx = i;
                    }

                    // Fallback: pick first two numeric TDs in first TR
                    const firstTR = xml.querySelector('TR');
                    if (firstTR) {
                        const tds = Array.from(firstTR.querySelectorAll('TD'));
                        if (raIdx >= 0 && decIdx >= 0 && tds.length > Math.max(raIdx, decIdx)) {
                            const raVal = parseFloat(tds[raIdx].textContent);
                            const decVal = parseFloat(tds[decIdx].textContent);
                            if (!isNaN(raVal) && !isNaN(decVal)) return { raHours: raVal / 15.0, decDeg: decVal };
                        }
                        // Try scanning for two numeric columns
                        const numeric = tds.map(td => parseFloat(td.textContent)).filter(n => !isNaN(n));
                        if (numeric.length >= 2) {
                            // Assume first is RA (deg) and second is Dec (deg)
                            return { raHours: numeric[0] / 15.0, decDeg: numeric[1] };
                        }
                    }
                }
            } catch (e) {
                console.warn('SIMBAD VOTABLE lookup failed:', e);
            }

            throw new Error('Unable to resolve object coordinates. Please check the object name and try again.');
        }
    }

    // Expose API - create a singleton instance
    global.MinairCatalog = new CatalogService();

})(window);