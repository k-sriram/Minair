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
            this.plotManager = new modules.PlotManager(this.targetManager);
            this.icons = modules.Icons.Icons;

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
            const targetNameInput = document.getElementById('target-name');
            const targetRaInput = document.getElementById('target-ra');
            const targetDecInput = document.getElementById('target-dec');

            targetNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const lookupButton = document.getElementById('lookup-target-btn');
                    if (lookupButton) {
                        lookupButton.click();
                    }
                }
            });

            [targetRaInput, targetDecInput].forEach(input => {
                input.addEventListener('keydown', (e) => {
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
                        this.showNotification('Please enter a target name before lookup.', 'error');
                        return;
                    }
                    const origText = lookupBtn.innerHTML;
                    try {
                        lookupBtn.disabled = true;
                        lookupBtn.innerHTML = this.icons.loader;
                        const coords = await this.targetManager.lookupCoordinates(name);
                        if (coords) {
                            // coords: { raHours, decDeg }
                            document.getElementById('target-ra').value = this.coordinateFormatter.formatRA(coords.raHours);
                            document.getElementById('target-dec').value = this.coordinateFormatter.formatDec(coords.decDeg);
                            this.showNotification('Coordinates found and filled in.', 'success');
                        } else {
                            this.showNotification('No coordinates found for "' + name + '". Please check the object name.', 'error');
                        }
                    } catch (err) {
                        console.error('Lookup error:', err);
                        this.showNotification('Lookup failed: ' + err.message, 'error');
                    } finally {
                        lookupBtn.disabled = false;
                        lookupBtn.innerHTML = origText;
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

            // Geolocation button
            document.getElementById('geolocation-btn').addEventListener('click', () => {
                this.getCurrentLocation();
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
                document.getElementById('plot-clear-selection').disabled = true;
            });

            document.getElementById('plot-refresh')?.addEventListener('click', () => {
                this.updatePlot();
            });

            // Remove all targets button
            document.getElementById('target-remove-all')?.addEventListener('click', () => {
                this.targetManager.removeAllTargets();
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
            // Update the TargetManager with the initial observation date
            this.targetManager.updateRiseSetTimes();

            // Initialize custom date picker after setting the date
            this.initializeCustomDatePicker();

            // Initialize plot manager
            setTimeout(() => {
                this.plotManager.initialize(this.timeManager.selectedTimeReference);
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

        initializeCustomDatePicker() {
            // Initialize custom date picker functionality using the component
            const modules = getManagers();
            if (modules.CustomDatePicker) {
                modules.CustomDatePicker.initializeAll();
            } else {
                console.warn('CustomDatePicker component not loaded');
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
            const geolocationBtn = document.getElementById('geolocation-btn');

            // Always show the custom location section
            customLocation.style.display = 'flex';

            // Always keep inputs and button enabled
            latInput.disabled = false;
            lonInput.disabled = false;
            geolocationBtn.disabled = false;

            if (value === 'custom') {
                // Load current location values and save as custom location
                const location = this.locationManager.getLocation();
                latInput.value = location.lat;
                lonInput.value = location.lon;

                // Update localStorage to reflect this is now a custom location (no observatory ID)
                this.locationManager.setLocation(location.lat, location.lon, 'Custom Location', null);
            } else {
                // Set observatory and get its coordinates, but keep inputs active
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
                // Always set as custom location when coordinates are manually changed
                this.locationManager.setLocation(lat, lon, 'Custom Location', null);

                // Update dropdown to show 'custom' selection
                const locationSelect = document.getElementById('location-select');
                locationSelect.value = 'custom';
                if (this.customDropdowns && this.customDropdowns.location) {
                    this.customDropdowns.location.updateValue('custom');
                }

                // Location changed - update rise/set times and plot
                this.targetManager.updateRiseSetTimes();
                this.updatePlot();
            }
        }

        getCurrentLocation() {
            const geolocationBtn = document.getElementById('geolocation-btn');
            const latInput = document.getElementById('latitude');
            const lonInput = document.getElementById('longitude');

            // Check if geolocation is supported
            if (!navigator.geolocation) {
                this.showNotification('Geolocation is not supported by this browser.', 'error');
                return;
            }

            // Disable button and show loading state
            geolocationBtn.disabled = true;
            geolocationBtn.classList.add('loading');
            const originalText = geolocationBtn.innerHTML;
            geolocationBtn.innerHTML = this.icons.loader;

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Success callback
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    // Fill in the coordinate inputs
                    latInput.value = lat.toFixed(6);
                    lonInput.value = lon.toFixed(6);

                    // Update the location manager as custom location
                    this.locationManager.setLocation(lat, lon, 'Current Location', null);

                    // Update dropdown to show 'custom' selection
                    const locationSelect = document.getElementById('location-select');
                    locationSelect.value = 'custom';
                    if (this.customDropdowns && this.customDropdowns.location) {
                        this.customDropdowns.location.updateValue('custom');
                    }

                    // Update rise/set times and plot
                    this.targetManager.updateRiseSetTimes();
                    this.updatePlot();

                    this.showNotification(`Location detected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');

                    // Restore button state
                    geolocationBtn.disabled = false;
                    geolocationBtn.classList.remove('loading');
                    geolocationBtn.innerHTML = originalText;
                },
                (error) => {
                    // Error callback
                    let errorMessage = 'Failed to get your location: ';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Location access denied by user.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Location request timed out.';
                            break;
                        default:
                            errorMessage += 'An unknown error occurred.';
                            break;
                    }
                    this.showNotification(errorMessage, 'error');

                    // Restore button state
                    geolocationBtn.disabled = false;
                    geolocationBtn.classList.remove('loading');
                    geolocationBtn.innerHTML = originalText;
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        }

        updateLocationUI() {
            const location = this.locationManager.getLocation();
            const locationSelect = document.getElementById('location-select');
            const customLocation = document.getElementById('custom-location');
            const latInput = document.getElementById('latitude');
            const lonInput = document.getElementById('longitude');
            const geolocationBtn = document.getElementById('geolocation-btn');

            // Always show the custom location section
            customLocation.style.display = 'flex';

            // Always keep inputs and button enabled for user interaction
            latInput.disabled = false;
            lonInput.disabled = false;
            geolocationBtn.disabled = false;

            // Update coordinate display and dropdown selection
            latInput.value = location.lat;
            lonInput.value = location.lon;

            // Set dropdown selection based on location
            if (location.id && this.locationManager.observatories[location.id]) {
                locationSelect.value = location.id;
                // Update custom dropdown display
                if (this.customDropdowns && this.customDropdowns.location) {
                    this.customDropdowns.location.updateValue(location.id);
                }
            } else {
                locationSelect.value = 'custom';
                // Update custom dropdown display
                if (this.customDropdowns && this.customDropdowns.location) {
                    this.customDropdowns.location.updateValue('custom');
                }
            }
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
            // Focus back to target name for next entry
            document.getElementById('target-name').focus();
        }

        showNotification(message, type = 'info') {
            this.createFloatingNotification(message, type);
        }

        createFloatingNotification(message, type) {
            // Create notification container if it doesn't exist
            let container = document.getElementById('notification-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'notification-container';
                container.className = 'notification-container';
                document.body.appendChild(container);
            }

            // Create notification element
            const notification = document.createElement('div');
            notification.className = `floating-notification ${type}`;

            // Create message content
            const messageSpan = document.createElement('span');
            messageSpan.className = 'notification-message';
            messageSpan.textContent = message;

            // Create close button
            const closeButton = document.createElement('button');
            closeButton.className = 'notification-close';
            closeButton.innerHTML = this.icons.x;
            closeButton.setAttribute('aria-label', 'Close notification');

            // Assemble notification
            notification.appendChild(messageSpan);
            notification.appendChild(closeButton);
            container.appendChild(notification);

            // Show notification with animation
            requestAnimationFrame(() => {
                notification.classList.add('show');
            });

            // Auto-hide after 5 seconds
            const timeoutId = setTimeout(() => {
                this.removeNotification(notification);
            }, 5000);

            // Close button handler
            closeButton.addEventListener('click', () => {
                clearTimeout(timeoutId);
                this.removeNotification(notification);
            });

            return notification;
        }

        removeNotification(notification) {
            if (!notification || !notification.parentNode) return;

            notification.classList.remove('show');
            notification.classList.add('hide');

            // Remove after animation completes
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
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
                this.showNotification('Please fill in all target fields.', 'error');
                return;
            }

            try {
                this.targetManager.addTarget(name, ra, dec);
                this.showNotification('Target "' + name + '" added successfully.', 'success');
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
                this.showNotification(errorMessage, 'error');
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
