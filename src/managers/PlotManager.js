/* PlotManager.js — Chart visualization management for Minair
 */

import { convertDateToSelectedTimeReference } from '../utils/TimeConverter.js';

export class PlotManager {
    constructor(locationManager, timeManager, targetManager) {
        this.locationManager = locationManager;
        this.timeManager = timeManager;
        this.targetManager = targetManager;
        this.chart = null;
        this.isVisible = false;
        this.colors = this.getTargetColors();
    }

    getTargetColors() {
        // Get CSS custom properties for target colors
        const root = document.documentElement;
        const colors = [];
        const hoverColors = [];

        for (let i = 1; i <= 8; i++) {
            const color = getComputedStyle(root).getPropertyValue(`--target-color-${i}`).trim();
            const hoverColor = getComputedStyle(root).getPropertyValue(`--target-hover-${i}`).trim();
            colors.push(color);
            hoverColors.push(hoverColor);
        }

        return { normal: colors, hover: hoverColors };
    }

    getTimeAxisLabel() {
        // Get current time reference and format appropriate label
        const selectedRef = this.timeManager.selectedTimeReference;

        if (selectedRef === 'utc') {
            return 'Time (UTC)';
        } else if (selectedRef === 'lst') {
            return 'Time (LST)';
        } else { // 'local' or selected timezone
            const timezoneSelect = document.getElementById('timezone-select');
            if (timezoneSelect) {
                const selectedTimezone = timezoneSelect.value;
                return `Time (${selectedTimezone})`;
            }
            return 'Time (Local)';
        }
    }

    initializeChart() {
        console.log('Initializing chart...');
        const canvas = document.getElementById('visibility-chart');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get canvas context!');
            return;
        }

        console.log('Creating Chart.js instance...');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-tertiary').trim(),
                        titleColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                        bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim(),
                        borderWidth: 1,
                        callbacks: {
                            title: function (context) {
                                const timeStr = context[0].label;
                                return `Time: ${timeStr}`;
                            },
                            label: function (context) {
                                const targetName = context.dataset.label;
                                const altitude = context.parsed.y.toFixed(1);
                                return `${targetName}: ${altitude}°`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                hour: 'HH:mm',
                                minute: 'HH:mm'
                            },
                            tooltipFormat: 'HH:mm'
                        },
                        title: {
                            display: true,
                            text: this.getTimeAxisLabel(),
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
                            maxTicksLimit: 12
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Altitude (degrees)',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()
                        },
                        min: 0,
                        max: 90,
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                        }
                    }
                },
                onHover: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const datasetIndex = activeElements[0].datasetIndex;
                        this.highlightTarget(datasetIndex);
                    } else {
                        this.clearHighlight();
                    }
                }
            }
        });
    }

    async calculateSunriseSunset(date, lat, lon) {
        // Calculate sunrise and sunset times for the given date and location
        const astro = window.MinairAstronomy;
        if (!astro || !astro.sunAltitude) {
            console.warn('Sun calculation not available, using fallback times');
            // Fallback: approximate sunrise at 6:00, sunset at 18:00
            const sunrise = new Date(date);
            sunrise.setHours(6, 0, 0, 0);
            const sunset = new Date(date);
            sunset.setHours(18, 0, 0, 0);
            return { sunrise, sunset };
        }

        // Sample throughout the day to find sunrise and sunset
        const baseDate = new Date(date);
        baseDate.setHours(0, 0, 0, 0);

        let sunrise = null;
        let sunset = null;
        let prevAlt = null;

        console.log(`Calculating sunrise/sunset for ${date.toDateString()} at lat=${lat}, lon=${lon}`);

        for (let hour = 0; hour < 24; hour += 0.25) { // 15-minute intervals
            const testTime = new Date(baseDate.getTime() + hour * 60 * 60 * 1000);
            const sunAlt = astro.sunAltitude(testTime, lat, lon);

            if (prevAlt !== null) {
                // Check for sunrise (crossing from below to above horizon)
                if (prevAlt < 0 && sunAlt >= 0 && !sunrise) {
                    sunrise = new Date(testTime.getTime() - 15 * 60 * 1000); // Approximate
                    console.log(`Sunrise found at: ${sunrise.toISOString()}`);
                }
                // Check for sunset (crossing from above to below horizon)
                if (prevAlt >= 0 && sunAlt < 0 && !sunset) {
                    sunset = new Date(testTime.getTime() - 15 * 60 * 1000); // Approximate
                    console.log(`Sunset found at: ${sunset.toISOString()}`);
                }
            }
            prevAlt = sunAlt;
        }

        // If no sunrise/sunset found, use fallback times
        if (!sunrise || !sunset) {
            console.warn('No sunrise/sunset crossings found, using fallback');
            if (!sunrise) {
                sunrise = new Date(date);
                sunrise.setHours(6, 0, 0, 0);
            }
            if (!sunset) {
                sunset = new Date(date);
                sunset.setHours(18, 0, 0, 0);
            }
        }

        return { sunrise, sunset };
    }

    async calculatePlotTimeRange() {
        // Calculate time range from 30 minutes before sunset to 30 minutes after sunrise
        const location = this.locationManager.getLocation();
        const obsDateInput = document.getElementById('observation-date');
        const obsDateStr = obsDateInput ? obsDateInput.value : new Date().toISOString().split('T')[0];
        const obsDate = new Date(obsDateStr);

        const { sunrise, sunset } = await this.calculateSunriseSunset(obsDate, location.lat, location.lon);

        let startTime, endTime;

        if (sunset && sunrise) {
            // 30 minutes before sunset
            startTime = new Date(sunset.getTime() - 30 * 60 * 1000);

            // Handle sunrise next day
            let nextSunrise = sunrise;
            if (sunrise < sunset) {
                // Sunrise is next day
                nextSunrise = new Date(sunrise.getTime() + 24 * 60 * 60 * 1000);
            }

            // 30 minutes after sunrise
            endTime = new Date(nextSunrise.getTime() + 30 * 60 * 1000);
        } else {
            // Fallback: use 18:00 to 06:00 local time
            startTime = new Date(obsDate);
            startTime.setHours(18, 0, 0, 0);
            endTime = new Date(obsDate);
            endTime.setHours(30, 0, 0, 0); // Will automatically roll to next day as 06:00
        }

        return { startTime, endTime };
    }

    async updatePlot() {
        if (!this.chart || !this.isVisible) {
            console.log('Plot update skipped: chart not initialized or not visible');
            return;
        }

        console.log('Updating plot...');
        const { startTime, endTime } = await this.calculatePlotTimeRange();
        const astro = window.MinairAstronomy;
        const location = this.locationManager.getLocation();
        const targets = this.targetManager.targets;

        console.log(`Plot time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);
        console.log(`Number of targets: ${targets.length}`);

        // Generate time points (every 10 minutes for smooth curves)
        const timePoints = [];
        const stepMinutes = 10;
        let currentTime = new Date(startTime);

        while (currentTime <= endTime) {
            timePoints.push(new Date(currentTime));
            currentTime = new Date(currentTime.getTime() + stepMinutes * 60 * 1000);
        }

        console.log(`Generated ${timePoints.length} time points`);

        // Calculate datasets for each target
        const datasets = targets.map((target, index) => {
            const colorIndex = index % this.colors.normal.length;
            const altitudes = timePoints.map((time, timeIndex) => {
                const altAz = astro.raDecToAltAz(target.ra, target.dec, time, location.lat, location.lon);
                // Convert time to selected time reference for display
                const displayTime = convertDateToSelectedTimeReference(time, this.timeManager);
                return {
                    x: displayTime,
                    y: altAz.alt // Keep actual altitude values, including negative ones
                };
            });

            console.log(`Target ${target.name}: ${altitudes.length} altitude points calculated`);

            return {
                label: target.name,
                data: altitudes,
                borderColor: this.colors.normal[colorIndex],
                backgroundColor: this.colors.normal[colorIndex] + '20', // Add transparency
                borderWidth: 2,
                fill: false,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                hoverBorderColor: this.colors.hover[colorIndex],
                hoverBorderWidth: 3
            };
        });

        console.log(`Created ${datasets.length} datasets for chart`);

        // Update chart data
        this.chart.data.datasets = datasets;
        this.chart.update('none'); // Skip animation for better performance

        console.log('Plot update completed');
    }

    highlightTarget(datasetIndex) {
        if (!this.chart) return;

        // Highlight the selected dataset
        this.chart.data.datasets.forEach((dataset, index) => {
            if (index === datasetIndex) {
                dataset.borderWidth = 4;
                dataset.borderColor = this.colors.hover[index % this.colors.hover.length];
            } else {
                dataset.borderWidth = 2;
                dataset.borderColor = this.colors.normal[index % this.colors.normal.length];
            }
        });

        this.chart.update('none');
    }

    clearHighlight() {
        if (!this.chart) return;

        // Reset all datasets to normal appearance
        this.chart.data.datasets.forEach((dataset, index) => {
            dataset.borderWidth = 2;
            dataset.borderColor = this.colors.normal[index % this.colors.normal.length];
        });

        this.chart.update('none');
    }

    show() {
        console.log('Showing graph...');
        const container = document.getElementById('graph-container');
        const button = document.getElementById('toggle-graph-btn');

        if (container && button) {
            container.style.display = 'block';
            button.textContent = 'Hide Graph';
            this.isVisible = true;

            if (!this.chart) {
                console.log('Chart not initialized, creating...');
                this.initializeChart();
            }

            // Update colors when theme changes
            this.colors = this.getTargetColors();
            console.log('Calling updatePlot...');
            this.updatePlot();
        } else {
            console.error('Graph container or button not found!');
        }
    }

    hide() {
        const container = document.getElementById('graph-container');
        const button = document.getElementById('toggle-graph-btn');

        if (container && button) {
            container.style.display = 'none';
            button.textContent = 'Show Graph';
            this.isVisible = false;
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // Update when theme changes
    onThemeChange() {
        this.colors = this.getTargetColors();
        if (this.chart) {
            // Update chart colors for theme
            const root = document.documentElement;
            const textPrimary = getComputedStyle(root).getPropertyValue('--text-primary').trim();
            const textSecondary = getComputedStyle(root).getPropertyValue('--text-secondary').trim();
            const borderColor = getComputedStyle(root).getPropertyValue('--border-color').trim();
            const bgTertiary = getComputedStyle(root).getPropertyValue('--bg-tertiary').trim();

            // Update chart options
            this.chart.options.plugins.legend.labels.color = textPrimary;
            this.chart.options.plugins.tooltip.backgroundColor = bgTertiary;
            this.chart.options.plugins.tooltip.titleColor = textPrimary;
            this.chart.options.plugins.tooltip.bodyColor = textPrimary;
            this.chart.options.plugins.tooltip.borderColor = borderColor;
            this.chart.options.scales.x.title.color = textPrimary;
            this.chart.options.scales.x.title.text = this.getTimeAxisLabel(); // Update axis label
            this.chart.options.scales.x.ticks.color = textSecondary;
            this.chart.options.scales.x.grid.color = borderColor;
            this.chart.options.scales.y.title.color = textPrimary;
            this.chart.options.scales.y.ticks.color = textSecondary;
            this.chart.options.scales.y.grid.color = borderColor;

            this.updatePlot();
        }
    }

    updateTimeAxisLabel() {
        // Update axis label when time reference changes
        if (this.chart) {
            this.chart.options.scales.x.title.text = this.getTimeAxisLabel();
            // Also update the plot data to reflect new time reference
            this.updatePlot();
        }
    }
}