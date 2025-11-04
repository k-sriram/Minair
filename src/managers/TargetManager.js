/* TargetManager.js — Target management for Minair
 */
import { parseRA, parseDec } from '../utils/CoordinateParser.js';
import {
    formatRA,
    formatDec,
    formatAngleDeg,
    formatAngleDegUnsigned,
    formatHourAngle
} from '../utils/CoordinateFormatter.js';
import { formatDateHHMMWithTimeZone } from '../utils/TimeConverter.js';
import { Icons } from '../utils/Icons.js';

export class TargetManager {
    constructor() {
        this.targets = [];
        this.locationManager = null;
        this.timeManager = null;
        this.initialized = false;
    }

    // Initialize with required dependencies
    initialize(locationManager, timeManager) {
        this.locationManager = locationManager;
        this.timeManager = timeManager;
        this.initialized = true;
        this.loadDefaultTargets();
    }

    // localStorage persistence methods
    saveTargetsToStorage() {
        try {
            // Save all targets to localStorage
            localStorage.setItem('minair-user-targets', JSON.stringify(this.targets));
        } catch (error) {
            console.warn('Failed to save targets to localStorage:', error);
        }
    }

    loadTargetsFromStorage() {
        try {
            const saved = localStorage.getItem('minair-user-targets');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.warn('Failed to load targets from localStorage:', error);
            return [];
        }
    }

    async loadDefaultTargets() {
        try {
            // Load user targets from localStorage first
            const userTargets = this.loadTargetsFromStorage();

            // If user targets exist, use only those (skip defaults)
            if (userTargets.length > 0) {
                this.targets = userTargets;
            } else {
                // No user targets found - load default targets from JSON
                const response = await fetch('data/targets.json');
                const defaultTargets = await response.json();

                // Convert loaded default targets to internal format
                const defaultTargetsFormatted = defaultTargets.map(target => ({
                    name: target.name,
                    ra: target.raHours || target.ra,
                    dec: target.decDeg || target.dec,
                    id: 'default-' + target.name.toLowerCase().replace(/\s+/g, '-')
                }));

                this.targets = defaultTargetsFormatted;
            }

            this.updateTargetTable();
            // After populating table, compute current alt/az and rise/set for each target
            this.updateTargetsObservingInfo();
            // Update plot with loaded targets
            if (window.minairApp && window.minairApp.updatePlot) {
                setTimeout(() => {
                    window.minairApp.updatePlot();
                }, 200);
            }
        } catch (error) {
            console.error('Failed to load targets:', error);
            // Fallback to user targets if available, otherwise empty list
            this.targets = this.loadTargetsFromStorage();
            this.updateTargetTable();
            this.updateTargetsObservingInfo();
        }
    }

    addTarget(name, ra, dec) {
        const target = {
            name: name.trim(),
            ra: parseRA(ra),
            dec: parseDec(dec),
            id: Date.now() + Math.random() // Simple ID generation with random component
        };
        this.targets.push(target);
        this.updateTargetTable();
        this.saveTargetsToStorage(); // Persist to localStorage
        return target;
    }

    removeTarget(id) {
        this.targets = this.targets.filter(t => t.id !== id);
        this.updateTargetTable();
        this.updateTargetsObservingInfo();
        this.saveTargetsToStorage(); // Persist to localStorage
        // Toggle off the target visibility in the plot
        if (window.minairApp && window.minairApp.plotManager) {
            window.minairApp.plotManager.toggleTarget(id, 'remove');
        }
        // Update plot after removing target
        if (window.minairApp && window.minairApp.updatePlot) {
            setTimeout(() => {
                window.minairApp.updatePlot();
            }, 100);
        }
    }

    updateTargetTable() {
        const tbody = document.getElementById('target-table-body');

        // Preserve selection state before clearing table
        const selectedTargetIds = new Set();
        tbody.querySelectorAll('tr.target-selected').forEach(row => {
            const targetId = row.getAttribute('data-target-id');
            if (targetId) {
                selectedTargetIds.add(targetId);
            }
        });

        tbody.innerHTML = '';

        this.targets.forEach(target => {
            const row = this.createTargetRow(target);

            // Restore selection state if this target was previously selected
            if (selectedTargetIds.has(target.id.toString())) {
                row.classList.add('target-selected');
            }

            tbody.appendChild(row);
        });
    }

    async updateTableHeaderTimeLabels() {
        // Update header row labels for Rise/Set Time
        const thead = document.querySelector('#target-table thead tr');
        if (thead) {
            const timeManager = this.timeManager;
            const clockLabel = timeManager && typeof timeManager.getClockLabel === 'function'
                ? ' (' + timeManager.getClockLabel() + ')'
                : '';
            // Find header cells for Rise Time and Set Time
            const ths = thead.querySelectorAll('th');
            ths.forEach(th => {
                if (th.textContent.startsWith('Rise Time')) {
                    th.textContent = `Rise Time${clockLabel}`;
                }
                if (th.textContent.startsWith('Set Time')) {
                    th.textContent = `Set Time${clockLabel}`;
                }
            });
        }
    }

    createTargetRow(target) {
        const row = document.createElement('tr');
        row.setAttribute('data-target-id', target.id);
        row.innerHTML = `
            <td class="cell-name">${target.name}</td>
            <td class="cell-ra">${formatRA(target.ra)}</td>
            <td class="cell-dec">${formatDec(target.dec)}</td>
            <td class="cell-alt">--:--:--</td>
            <td class="cell-az">--:--:--</td>
            <td class="cell-ha">--h--m</td>
            <td class="cell-airmass">--.--</td>
            <td class="cell-rise">--:--</td>
            <td class="cell-set">--:--</td>
            <td class="cell-actions">
                <button class="btn btn-secondary btn-compact" data-target-id="${target.id}">${Icons.trash}</button>
            </td>
        `;

        // Add click handler for remove button
        const removeBtn = row.querySelector('button');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click
            this.removeTarget(target.id);
        });

        // Add click handler for plot interaction
        row.addEventListener('click', (e) => {
            // Don't trigger on button clicks
            if (e.target.tagName === 'BUTTON') return;

            if (window.minairApp && window.minairApp.plotManager) {
                window.minairApp.plotManager.toggleTarget(target.id);
                row.classList.toggle('target-selected');
            }
        });

        return row;
    }

    // Lightweight method to update only current alt/az for real-time tracking
    async updateCurrentAltAz() {
        const tbody = document.getElementById('target-table-body');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const astro = window.MinairAstronomy;
        const obsParams = this.getObservationParameters();

        // Convert current UTC time to local solar time for accurate calculations
        const utcNow = new Date();

        for (let i = 0; i < this.targets.length; i++) {
            const target = this.targets[i];
            const row = rows[i];
            if (!row) continue;

            // Current alt/az, hour angle, and airmass
            try {
                const altAz = astro.calcAltAz(target.ra, target.dec, utcNow, obsParams.obsLat, obsParams.obsLon);
                const lstHours = astro.lstFromUTC(utcNow, obsParams.obsLon);
                const ha = astro.calcHourAngle(lstHours, target.ra);
                const am = astro.calcAirmass(altAz.alt);

                row.querySelector('.cell-alt').textContent = formatAngleDeg(altAz.alt);
                row.querySelector('.cell-az').textContent = formatAngleDegUnsigned(altAz.az);
                row.querySelector('.cell-ha').textContent = formatHourAngle(ha);
                row.querySelector('.cell-airmass').textContent = isNaN(am) ? '--' : am.toFixed(2);
            } catch (e) {
                console.error(`Error updating alt/az for target ${target.name}:`, e);
                // Set error indicators in the table
                row.querySelector('.cell-alt').textContent = 'ERROR';
                row.querySelector('.cell-az').textContent = 'ERROR';
                row.querySelector('.cell-ha').textContent = 'ERROR';
                row.querySelector('.cell-airmass').textContent = 'ERROR';
            }
        }
    }

    // Method to update rise/set times (less frequent updates)
    async updateRiseSetTimes() {
        await this.updateTableHeaderTimeLabels();

        const tbody = document.getElementById('target-table-body');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const astro = window.MinairAstronomy;
        const obsParams = this.getObservationParameters();

        // Get minimum altitude from UI (default to 0° if not set)
        const minAltInput = document.getElementById('min-altitude');
        const minAlt = minAltInput ? parseFloat(minAltInput.value) || 0 : 0;

        // Loop through targets and compute rise/set times
        for (let i = 0; i < this.targets.length; i++) {
            const target = this.targets[i];

            const row = rows[i];
            if (!row) continue;

            // Rise/Set times: compute altitude curve for 24h from local noon
            try {
                const riseSet = astro.calcRiseSet(target.ra, target.dec, obsParams.obsLat, obsParams.obsLon, obsParams.obsDay, minAlt);
                const riseDateUTC = riseSet.riseTime ? riseSet.riseTime : null;
                const setDateUTC = riseSet.setTime ? riseSet.setTime : null;

                // Update display  
                const timeManager = this.timeManager;
                row.querySelector('.cell-rise').textContent = riseDateUTC ? formatDateHHMMWithTimeZone(riseDateUTC, timeManager) : '--:--';
                row.querySelector('.cell-set').textContent = setDateUTC ? formatDateHHMMWithTimeZone(setDateUTC, timeManager) : '--:--';
            } catch (e) {
                console.error(`Rise/set calculation error for ${target.name}:`, e);
            }
        }
    }

    // Compute and update current alt/az and rise/set times for targets
    async updateTargetsObservingInfo() {
        // Update both alt/az and rise/set times
        await this.updateCurrentAltAz();
        await this.updateRiseSetTimes();
    }

    // Helper to get current observation parameters
    getObservationParameters() {
        if (!this.locationManager) {
            // Fallback to default location if not initialized
            return {
                obsLat: 51.4779,
                obsLon: -0.0015,
                obsDay: new Date()
            };
        }

        const location = this.locationManager.getLocation();
        const obsDateInput = document.getElementById('observation-date');
        const obsDateStr = obsDateInput ? obsDateInput.value : new Date().toISOString().split('T')[0];
        const obsDate = new Date(obsDateStr);

        return {
            obsLat: location.lat,
            obsLon: location.lon,
            obsDay: obsDate
        };
    }

    // Lookup coordinates for an object name using external catalog services.
    // Delegates to the catalog service module.
    // Returns { raHours, decDeg }
    async lookupCoordinates(name) {
        return await window.MinairCatalog.lookupCoordinates(name);
    }


}