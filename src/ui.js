/* ui.js — Main UI controller for Minair astronomical observation planner
 */
(function () {
    'use strict';

    // Get imported managers from global scope
    function getManagers() {
        if (window.MinairModules) {
            return window.MinairModules;
        }
        throw new Error('Modules not loaded yet');
    }



    // Main Application Controller
    class MinairApp {
        constructor() {
            const modules = getManagers();

            this.themeManager = new modules.ThemeManager();
            this.locationManager = new modules.LocationManager();
            this.timeManager = new modules.TimeManager(this.locationManager);
            this.targetManager = new modules.TargetManager();
            this.plotManager = new modules.PlotManager();

            this.setupEventListeners();
            this.initializeUI();
        }

        setupEventListeners() {
            // Theme selector
            document.getElementById('theme-select').addEventListener('change', (e) => {
                this.themeManager.switchTheme(e.target.value);
                this.plotManager.resetTheme();
            });

            // Location selector
            document.getElementById('location-select').addEventListener('change', (e) => {
                this.handleLocationChange(e.target.value);
            });

            // Time clock buttons
            document.querySelectorAll('.time-clock').forEach(clock => {
                clock.addEventListener('click', (e) => {
                    const timeRef = e.currentTarget.dataset.timezone;
                    this.timeManager.setTimeReference(timeRef);
                    // Time reference changed - update rise/set display and plot
                    this.targetManager.updateRiseSetTimes();
                    this.plotManager.setTimeReference(timeRef);
                });
            });

            // Timezone selector
            document.getElementById('timezone-select').addEventListener('change', () => {
                // Update TimeCoordinator with new timezone
                this.updateTimeCoordinator();

                // Time will update on next clock tick
                // Timezone changed - update rise/set display
                this.targetManager.updateRiseSetTimes();
            });

            // Target management - Add button
            document.getElementById('add-target-btn').addEventListener('click', () => {
                this.addNewTarget();
            });

            // Enter key handling for form inputs
            ['target-name', 'target-ra', 'target-dec'].forEach(id => {
                document.getElementById(id).addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.addNewTarget();
                    }
                });
            });

            // Lookup button for target name -> query SIMBAD/Sesame
            const lookupBtn = document.getElementById('lookup-target-btn');
            if (lookupBtn) {
                lookupBtn.addEventListener('click', async () => {
                    const name = document.getElementById('target-name').value.trim();
                    if (!name) {
                        this.showLookupMessage('Please enter a target name before lookup.', 'error');
                        return;
                    }
                    try {
                        lookupBtn.disabled = true;
                        const origText = lookupBtn.textContent;
                        lookupBtn.textContent = 'Looking...';
                        const coords = await this.targetManager.lookupCoordinates(name);
                        if (coords) {
                            // coords: { raHours, decDeg }
                            document.getElementById('target-ra').value = this.targetManager.formatRA(coords.raHours);
                            document.getElementById('target-dec').value = this.targetManager.formatDec(coords.decDeg);
                            this.showLookupMessage('Coordinates found and filled in.', 'success');
                        } else {
                            this.showLookupMessage('No coordinates found for "' + name + '". Please check the object name.', 'error');
                        }
                    } catch (err) {
                        console.error('Lookup error:', err);
                        this.showLookupMessage('Lookup failed: ' + err.message, 'error');
                    } finally {
                        lookupBtn.disabled = false;
                        lookupBtn.textContent = 'Lookup';
                    }
                });
            }



            // Custom location inputs
            document.getElementById('latitude').addEventListener('change', () => {
                this.updateCustomLocation();
            });

            document.getElementById('longitude').addEventListener('change', () => {
                this.updateCustomLocation();
            });

            // Observation date changes
            document.getElementById('observation-date').addEventListener('change', () => {
                // Date changed - update rise/set times and plot
                this.targetManager.updateRiseSetTimes();
                this.updatePlot();
            });

            // Min altitude changes
            document.getElementById('min-altitude').addEventListener('change', (e) => {
                const minAlt = parseFloat(e.target.value) || 0;
                this.plotManager.setMinAltitude(minAlt);
                // Min altitude changed - update rise/set times
                this.targetManager.updateRiseSetTimes();
            });

            // Plot controls
            document.getElementById('plot-clear-selection')?.addEventListener('click', () => {
                this.plotManager.clearSelection();
            });

            document.getElementById('plot-refresh')?.addEventListener('click', () => {
                this.updatePlot();
            });

            // Window resize handler for plot
            window.addEventListener('resize', () => {
                this.plotManager.handleResize();
            });
        }

        initializeUI() {
            // Set today's date
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('observation-date').value = today;

            // Initialize custom dropdowns
            this.initializeCustomDropdowns();

            // Initialize location UI
            this.updateLocationUI();

            // Initialize plot manager
            setTimeout(() => {
                this.plotManager.initialize();
                // Set initial time reference from TimeManager
                this.plotManager.setTimeReference(this.timeManager.selectedTimeReference);
                this.updatePlot();
            }, 100);

            // Update alt/az every second for real-time tracking
            setInterval(() => {
                try {
                    this.targetManager.updateCurrentAltAz();
                } catch (e) {
                    // ignore timing errors
                }
            }, 1000);

            // Redraw the plot every 60 seconds to keep visuals (clock labels, min-alt line, etc.) up-to-date
            setInterval(() => {
                try {
                    this.plotManager.redraw();
                } catch (e) {
                    // ignore redraw errors
                }
            }, 60000);
        }

        initializeCustomDropdowns() {
            // Replace select elements with custom dropdowns
            const modules = getManagers();
            const selectElements = [
                document.getElementById('theme-select'),
                document.getElementById('location-select'),
                document.getElementById('timezone-select')
            ];

            selectElements.forEach(select => {
                if (select) {
                    new modules.CustomDropdown(select);
                }
            });
        }

        handleLocationChange(value) {
            const customLocation = document.getElementById('custom-location');

            if (value === 'custom') {
                customLocation.style.display = 'flex';
                const location = this.locationManager.getLocation();
                document.getElementById('latitude').value = location.lat;
                document.getElementById('longitude').value = location.lon;
            } else {
                customLocation.style.display = 'none';
                this.locationManager.setObservatory(value);

                // Location changed - update rise/set times and plot
                this.targetManager.updateRiseSetTimes();
                this.updatePlot();
            }
        }

        updateCustomLocation() {
            const lat = parseFloat(document.getElementById('latitude').value);
            const lon = parseFloat(document.getElementById('longitude').value);

            if (!isNaN(lat) && !isNaN(lon)) {
                this.locationManager.setCustomLocation(lat, lon);

                // Location changed - update rise/set times and plot
                this.targetManager.updateRiseSetTimes();
                this.updatePlot();
            }
        }

        updateLocationUI() {
            const location = this.locationManager.getLocation();
            const locationSelect = document.getElementById('location-select');

            // Check if current location matches any observatory
            let matchedObservatory = null;
            for (const [key, obs] of Object.entries(this.locationManager.observatories)) {
                if (Math.abs(obs.lat - location.lat) < 0.001 && Math.abs(obs.lon - location.lon) < 0.001) {
                    matchedObservatory = key;
                    break;
                }
            }

            if (matchedObservatory) {
                locationSelect.value = matchedObservatory;
                document.getElementById('custom-location').style.display = 'none';
            } else {
                locationSelect.value = 'custom';
                document.getElementById('custom-location').style.display = 'flex';
                document.getElementById('latitude').value = location.lat;
                document.getElementById('longitude').value = location.lon;
            }
        }

        // Helper to get current user timezone offset in minutes
        getUserTimezoneOffsetMinutes() {
            const timezoneSelect = document.getElementById('timezone-select');
            if (!timezoneSelect) {
                // Fallback to browser timezone
                return -new Date().getTimezoneOffset();
            }

            const selectedTimezone = timezoneSelect.value;
            const match = selectedTimezone.match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/);
            if (!match) {
                return -new Date().getTimezoneOffset();
            }

            const sign = match[1] === '+' ? 1 : -1;
            const hours = parseInt(match[2]);
            const minutes = parseInt(match[3] || '0');
            return sign * (hours * 60 + minutes);
        }

        // Helper to get current observation parameters
        getObservationParameters() {
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

        clearAddTargetForm() {
            document.getElementById('target-name').value = '';
            document.getElementById('target-ra').value = '';
            document.getElementById('target-dec').value = '';
            this.hideLookupMessage();
            // Focus back to target name for next entry
            document.getElementById('target-name').focus();
        }

        showLookupMessage(message, type = 'info') {
            const messageEl = document.getElementById('lookup-message');
            messageEl.textContent = message;
            messageEl.className = 'lookup-message ' + type;
            messageEl.style.display = 'block';

            // Auto-hide success and info messages after 5 seconds
            if (type === 'success' || type === 'info') {
                setTimeout(() => {
                    this.hideLookupMessage();
                }, 5000);
            }
        }

        hideLookupMessage() {
            const messageEl = document.getElementById('lookup-message');
            messageEl.style.display = 'none';
            messageEl.className = 'lookup-message';
        }

        updatePlot() {
            const targets = this.targetManager.targets;
            const observationParams = this.getObservationParameters();
            this.plotManager.updateTargetData(targets, observationParams);
        }

        addNewTarget() {
            const name = document.getElementById('target-name').value.trim();
            const ra = document.getElementById('target-ra').value.trim();
            const dec = document.getElementById('target-dec').value.trim();

            if (!name || !ra || !dec) {
                this.showLookupMessage('Please fill in all target fields.', 'error');
                return;
            }

            try {
                this.targetManager.addTarget(name, ra, dec);
                this.showLookupMessage('Target "' + name + '" added successfully.', 'success');
                this.clearAddTargetForm();
                // Trigger immediate update of observing info and plot for the new target
                setTimeout(() => {
                    this.targetManager.updateTargetsObservingInfo();
                    this.updatePlot();
                }, 100);
            } catch (error) {
                // Provide more specific error feedback based on the parsing error
                let errorMessage = 'Error adding target: ';
                if (error.message.includes('coordinate')) {
                    errorMessage += 'Invalid coordinate format. ';
                    errorMessage += 'Examples: 12:34:56, 12h34m56s, 12 34 56, 123456, or 185.25 (degrees)';
                } else {
                    errorMessage += error.message;
                }
                this.showLookupMessage(errorMessage, 'error');
                console.error('Target add error:', error);
            }
        }
    }

    // Initialize application when both DOM and modules are loaded
    let domLoaded = false;
    let modulesLoaded = false;

    function tryInitialize() {
        if (domLoaded && modulesLoaded) {
            window.minairApp = new MinairApp();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        domLoaded = true;
        tryInitialize();
    });

    window.addEventListener('modulesLoaded', () => {
        modulesLoaded = true;
        tryInitialize();
    });

})();
