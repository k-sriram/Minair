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
            this.sharedState = this.parseSharedState();

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
                            const targetRaInput = document.getElementById('target-ra');
                            const targetDecInput = document.getElementById('target-dec');
                            targetRaInput.value = this.coordinateFormatter.formatRA(coords.raHours);
                            targetDecInput.value = this.coordinateFormatter.formatDec(coords.decDeg);
                            targetRaInput.focus();
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
            });

            document.getElementById('plot-refresh')?.addEventListener('click', () => {
                this.updatePlot();
            });

            // Export targets table as CSV
            document.getElementById('target-export-csv')?.addEventListener('click', () => {
                this.exportTargetsToCsv();
            });

            // Share current state as a GET link
            document.getElementById('target-share-link')?.addEventListener('click', () => {
                this.shareCurrentState();
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
            if (this.targetManager.loadTargetsPromise) {
                await this.targetManager.loadTargetsPromise;
            }
            this.populateLocationDropdown();
            this.updateLocationUI();

            const sharedStateApplied = this.applySharedState(this.sharedState);

            if (!sharedStateApplied) {
                // Set observation date to tonight's observing session (after location is fully loaded)
                const location = this.locationManager.getLocation();
                const tonightDate = window.MinairAstronomy.getLocalDayOfTonightAtNow(location.lon);
                const dateString = tonightDate.toISOString().split('T')[0];
                document.getElementById('observation-date').value = dateString;
                // Update the TargetManager with the initial observation date
                this.targetManager.updateRiseSetTimes();
            }

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

        parseSharedState() {
            const params = new URLSearchParams(window.location.search);
            const relevantKeys = ['location', 'lat', 'lon', 'date', 'minAlt', 'timeRef', 'timezone', 'targets', 'selected'];
            const hasRelevantParams = relevantKeys.some(key => params.has(key));

            if (!hasRelevantParams) {
                return null;
            }

            let targets = null;
            let targetsProvided = false;
            if (params.has('targets')) {
                targetsProvided = true;
                try {
                    targets = JSON.parse(params.get('targets'));
                } catch (error) {
                    console.warn('Failed to parse shared targets:', error);
                    targets = [];
                }
            }

            let selectedIndices = [];
            let selectedProvided = false;
            if (params.has('selected')) {
                selectedProvided = true;
                const selectedParam = params.get('selected') || '';
                selectedIndices = selectedParam
                    .split(',')
                    .map(value => parseInt(value, 10))
                    .filter(index => Number.isInteger(index) && index >= 0);
            }

            return {
                location: params.get('location'),
                lat: params.get('lat'),
                lon: params.get('lon'),
                date: params.get('date'),
                minAlt: params.get('minAlt'),
                timeRef: params.get('timeRef'),
                timezone: params.get('timezone'),
                targets,
                targetsProvided,
                selectedIndices,
                selectedProvided
            };
        }

        applySharedState(sharedState) {
            if (!sharedState) {
                return false;
            }

            const locationSelect = document.getElementById('location-select');
            const latInput = document.getElementById('latitude');
            const lonInput = document.getElementById('longitude');
            const obsDateInput = document.getElementById('observation-date');
            const minAltInput = document.getElementById('min-altitude');
            const timezoneSelect = document.getElementById('timezone-select');
            let locationChanged = false;

            if (sharedState.location) {
                if (sharedState.location === 'custom' && sharedState.lat !== null && sharedState.lon !== null && sharedState.lat !== '' && sharedState.lon !== '') {
                    const lat = parseFloat(sharedState.lat);
                    const lon = parseFloat(sharedState.lon);
                    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                        this.locationManager.setLocation(lat, lon, 'Custom Location', null);
                        locationSelect.value = 'custom';
                        if (this.customDropdowns?.location) {
                            this.customDropdowns.location.updateValue('custom');
                        }
                        locationChanged = true;
                    }
                } else if (this.locationManager.observatories[sharedState.location]) {
                    this.locationManager.setObservatory(sharedState.location);
                    locationSelect.value = sharedState.location;
                    if (this.customDropdowns?.location) {
                        this.customDropdowns.location.updateValue(sharedState.location);
                    }
                    locationChanged = true;
                }
            }

            if (locationChanged) {
                this.updateLocationUI();
            }

            if (sharedState.date) {
                obsDateInput.value = sharedState.date;
            }

            if (sharedState.minAlt !== null && sharedState.minAlt !== undefined && sharedState.minAlt !== '') {
                minAltInput.value = sharedState.minAlt;
                const minAlt = parseFloat(sharedState.minAlt);
                if (!Number.isNaN(minAlt)) {
                    this.plotManager.setMinAltitude(minAlt);
                }
            }

            if (sharedState.timeRef) {
                this.timeManager.setTimeReference(sharedState.timeRef);
                this.plotManager.setTimeReference(sharedState.timeRef);
            }

            if (sharedState.timezone && timezoneSelect) {
                timezoneSelect.value = sharedState.timezone;
                if (this.customDropdowns?.timezone) {
                    this.customDropdowns.timezone.updateValue(sharedState.timezone);
                }
            }

            if (sharedState.targetsProvided) {
                this.targetManager.removeAllTargets();
                if (Array.isArray(sharedState.targets)) {
                    sharedState.targets.forEach(target => {
                        if (target && target.name && target.ra && target.dec) {
                            this.targetManager.addTarget(target.name, target.ra, target.dec);
                        }
                    });
                }

                if (sharedState.selectedProvided) {
                    const selectedIds = new Set();
                    sharedState.selectedIndices.forEach(index => {
                        const target = this.targetManager.targets[index];
                        if (target) {
                            selectedIds.add(String(target.id));
                        }
                    });

                    this.targetManager.selectedTargetIds = new Set(selectedIds);
                    this.targetManager.saveSelectedTargetIdsToStorage(selectedIds);
                    this.targetManager.updateTargetTable();
                }
            }

            this.targetManager.updateRiseSetTimes();
            this.updatePlot();
            return true;
        }

        escapeCsvValue(value) {
            const text = String(value ?? '').replace(/\r?\n|\r/g, ' ').trim();
            return `"${text.replace(/"/g, '""')}"`;
        }

        generateShareUrl() {
            const url = new URL(window.location.href);
            const params = new URLSearchParams();
            const location = this.locationManager.getLocation();
            const locationSelect = document.getElementById('location-select');
            const observationDate = document.getElementById('observation-date')?.value || '';
            const minAlt = document.getElementById('min-altitude')?.value || '';
            const timezoneSelect = document.getElementById('timezone-select');
            const targets = this.targetManager.targets.map(target => ({
                name: target.name,
                ra: this.coordinateFormatter.formatRA(target.ra),
                dec: this.coordinateFormatter.formatDec(target.dec)
            }));
            const selectedIndices = this.targetManager.targets
                .map((target, index) => ({ target, index }))
                .filter(({ target }) => this.targetManager.selectedTargetIds.has(String(target.id)))
                .map(({ index }) => index);

            params.set('location', locationSelect?.value || 'custom');
            if (!locationSelect || locationSelect.value === 'custom') {
                params.set('lat', String(location.lat));
                params.set('lon', String(location.lon));
            }
            if (observationDate) {
                params.set('date', observationDate);
            }
            if (minAlt !== '') {
                params.set('minAlt', minAlt);
            }
            params.set('timeRef', this.timeManager.selectedTimeReference || 'utc');
            if (timezoneSelect?.value) {
                params.set('timezone', timezoneSelect.value);
            }
            params.set('targets', JSON.stringify(targets));
            params.set('selected', selectedIndices.join(','));

            url.search = params.toString();
            url.hash = '';
            return url.toString();
        }

        async shareCurrentState() {
            const shareUrl = this.generateShareUrl();

            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(shareUrl);
                    this.showNotification('Share link copied to clipboard.', 'success');
                } else {
                    window.prompt('Copy this share link:', shareUrl);
                }
            } catch (error) {
                console.error('Share link copy failed:', error);
                window.prompt('Copy this share link:', shareUrl);
            }
        }

        exportTargetsToCsv() {
            const table = document.getElementById('target-table');
            const tbody = document.getElementById('target-table-body');
            if (!table || !tbody) {
                this.showNotification('Target table not found.', 'error');
                return;
            }

            const headerCells = Array.from(table.querySelectorAll('thead th'));
            const headers = headerCells
                .map(th => th.textContent.trim())
                .filter(text => text && text !== 'Actions');

            const rows = Array.from(tbody.querySelectorAll('tr')).map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                return cells.slice(0, headers.length).map(cell => cell.textContent.trim());
            });

            const location = this.locationManager.getLocation();
            const obsDate = document.getElementById('observation-date')?.value || '';
            const minAlt = document.getElementById('min-altitude')?.value || '';
            const selectedRef = this.timeManager.selectedTimeReference || 'utc';
            const selectedRefDisplay = selectedRef.toUpperCase();
            const selectedRefTime = document.getElementById(`${selectedRef}-time`)?.textContent?.trim() || '';
            const generatedAt = new Date().toISOString();

            const metadata = [
                ['Generated At (UTC)', generatedAt],
                ['Observing Location', location.name || ''],
                ['Observing Latitude', location.lat],
                ['Observing Longitude', location.lon],
                ['Observation Date', obsDate],
                ['Minimum Altitude (deg)', minAlt],
                ['Selected Time Reference', selectedRefDisplay],
                ['Current Time (' + selectedRefDisplay + ')', selectedRefTime]
            ];

            const csvLines = [];
            metadata.forEach(([key, value]) => {
                csvLines.push([this.escapeCsvValue(key), this.escapeCsvValue(value)].join(','));
            });
            csvLines.push('');
            csvLines.push(headers.map(value => this.escapeCsvValue(value)).join(','));
            rows.forEach(row => {
                csvLines.push(row.map(value => this.escapeCsvValue(value)).join(','));
            });

            const csvContent = csvLines.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `minair-targets-${timestamp}.csv`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.showNotification(`Exported ${rows.length} target(s) to CSV.`, 'success');
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
