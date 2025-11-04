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

            // Initialize TargetManager with dependencies
            this.targetManager.initialize(this.locationManager, this.timeManager);

            // Store coordinate formatter for easy access
            this.coordinateFormatter = modules.CoordinateFormatter;

            this.setupEventListeners();
            this.initialize();
        }

        async initialize() {
            await this.initializeUI();
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
                            document.getElementById('target-ra').value = this.coordinateFormatter.formatRA(coords.raHours);
                            document.getElementById('target-dec').value = this.coordinateFormatter.formatDec(coords.decDeg);
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
                // Also clear selection from target table rows
                document.querySelectorAll('.target-selected').forEach(row => {
                    row.classList.remove('target-selected');
                });
            });

            document.getElementById('plot-refresh')?.addEventListener('click', () => {
                this.updatePlot();
            });

            // Window resize handler for plot
            window.addEventListener('resize', () => {
                this.plotManager.handleResize();
            });
        }

        async initializeUI() {
            // Initialize custom dropdowns
            this.initializeCustomDropdowns();

            // Initialize custom number inputs
            this.initializeCustomNumberInputs();

            // Wait for observatories to load, then populate dropdown and initialize location UI
            await this.locationManager.loadObservatories();
            this.populateLocationDropdown();
            this.updateLocationUI();

            // Set observation date to tonight's observing session (after location is fully loaded)
            const location = this.locationManager.getLocation();
            const tonightDate = window.MinairAstronomy.getLocalDayOfTonightAtNow(location.lon);
            const dateString = tonightDate.toISOString().split('T')[0];
            document.getElementById('observation-date').value = dateString;

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
            this.customDropdowns = {};

            const selectElements = [
                { id: 'theme-select', key: 'theme' },
                { id: 'location-select', key: 'location' },
                { id: 'timezone-select', key: 'timezone' }
            ];

            selectElements.forEach(({ id, key }) => {
                const select = document.getElementById(id);
                if (select) {
                    this.customDropdowns[key] = new modules.CustomDropdown(select);
                }
            });
        }

        initializeCustomNumberInputs() {
            // Initialize custom number input functionality using the component
            const modules = getManagers();
            if (modules.CustomNumberInput) {
                modules.CustomNumberInput.initializeAll();
            } else {
                console.warn('CustomNumberInput component not loaded');
            }
        }

        populateLocationDropdown() {
            const locationSelect = document.getElementById('location-select');

            // Clear existing options except Custom Location
            const customOption = locationSelect.querySelector('option[value="custom"]');
            locationSelect.innerHTML = '';
            locationSelect.appendChild(customOption);

            // Add observatory options from loaded data
            for (const [key, observatory] of Object.entries(this.locationManager.observatories)) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = observatory.name;
                locationSelect.appendChild(option);
            }

            // Update the custom dropdown if it exists
            if (this.customDropdowns && this.customDropdowns.location) {
                // Destroy the old custom dropdown first
                this.customDropdowns.location.destroy();
                // Recreate the custom dropdown with new options
                const modules = getManagers();
                this.customDropdowns.location = new modules.CustomDropdown(locationSelect);
            }
        }

        handleLocationChange(value) {
            const customLocation = document.getElementById('custom-location');
            const latInput = document.getElementById('latitude');
            const lonInput = document.getElementById('longitude');

            // Always show the custom location section
            customLocation.style.display = 'flex';

            if (value === 'custom') {
                // Enable inputs for custom editing
                latInput.disabled = false;
                lonInput.disabled = false;

                // Load current location values and save as custom location
                const location = this.locationManager.getLocation();
                latInput.value = location.lat;
                lonInput.value = location.lon;

                // Update localStorage to reflect this is now a custom location (no observatory ID)
                this.locationManager.setLocation(location.lat, location.lon, 'Custom Location', null);
            } else {
                // Disable inputs but show preset coordinates
                latInput.disabled = true;
                lonInput.disabled = true;

                // Set observatory and get its coordinates
                this.locationManager.setObservatory(value);
                const location = this.locationManager.getLocation();
                latInput.value = location.lat.toFixed(4);
                lonInput.value = location.lon.toFixed(4);

                // Location changed - update rise/set times and plot
                this.targetManager.updateRiseSetTimes();
                this.updatePlot();
            }
        }

        updateCustomLocation() {
            const lat = parseFloat(document.getElementById('latitude').value);
            const lon = parseFloat(document.getElementById('longitude').value);

            if (!isNaN(lat) && !isNaN(lon)) {
                this.locationManager.setLocation(lat, lon, 'Custom Location', null);

                // Location changed - update rise/set times and plot
                this.targetManager.updateRiseSetTimes();
                this.updatePlot();
            }
        }

        updateLocationUI() {
            const location = this.locationManager.getLocation();
            const locationSelect = document.getElementById('location-select');
            const customLocation = document.getElementById('custom-location');
            const latInput = document.getElementById('latitude');
            const lonInput = document.getElementById('longitude');

            // Always show the custom location section
            customLocation.style.display = 'flex';

            // Initialize inputs to enabled state first
            latInput.disabled = false;
            lonInput.disabled = false;

            // Check if current location has an observatory ID
            if (location.id && this.locationManager.observatories[location.id]) {
                locationSelect.value = location.id;
                // Update custom dropdown display
                if (this.customDropdowns && this.customDropdowns.location) {
                    this.customDropdowns.location.updateValue(location.id);
                }
                // Disable inputs and show preset coordinates
                latInput.disabled = true;
                lonInput.disabled = true;
                latInput.value = location.lat.toFixed(4);
                lonInput.value = location.lon.toFixed(4);
            } else {
                locationSelect.value = 'custom';
                // Update custom dropdown display
                if (this.customDropdowns && this.customDropdowns.location) {
                    this.customDropdowns.location.updateValue('custom');
                }
                // Keep inputs enabled for custom editing
                latInput.value = location.lat;
                lonInput.value = location.lon;
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
