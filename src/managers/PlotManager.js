import { formatDateHHMM } from "../utils/CoordinateFormatter.js";

/* PlotManager.js — Plot management for Minair altitude tracking
 */
export class PlotManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isInitialized = false;
        this.targetData = new Map(); // Store plot data for each target
        this.selectedTargets = new Set(); // Track which targets to plot
        this.plotConfig = {
            padding: { top: 40, right: 200, bottom: 60, left: 80 },
            gridColor: 'var(--border-color)',
            textColor: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-secondary)',
            axisColor: 'var(--text-primary)',
            targetColors: [
                'var(--target-color-1)', 'var(--target-color-2)', 'var(--target-color-3)',
                'var(--target-color-4)', 'var(--target-color-5)', 'var(--target-color-6)',
                'var(--target-color-7)', 'var(--target-color-8)'
            ]
        };
        this.minAltitude = 0;
        this.startTime = null;
        this.endTime = null;
        this.timeReference = 'utc'; // Default time reference
        this.xticks = [];
        this.xnow = null;
        this.isMobile = false;
        this.isTablet = false;
        this.updateDeviceType();
    }

    initialize() {
        if (this.isInitialized) return;

        this.canvas = document.getElementById('altitude-plot-canvas');
        if (!this.canvas) {
            console.error('Plot canvas not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.updateDeviceType();
        this.updatePlotConfigForDevice();
        this.setupCanvas();

        // Read initial minAltitude value from DOM
        const minAltInput = document.getElementById('min-altitude');
        if (minAltInput) {
            this.minAltitude = parseFloat(minAltInput.value) || 0;
        }

        this.isInitialized = true;
    }

    updateDeviceType() {
        // Check for mobile/tablet using multiple methods
        this.isMobile = window.matchMedia('(max-width: 768px)').matches;
        this.isTablet = window.matchMedia('(max-width: 1024px)').matches && !this.isMobile;

        // Also check for touch devices
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Override if it's clearly a mobile device based on screen size
        if (window.innerWidth <= 480) {
            this.isMobile = true;
            this.isTablet = false;
        } else if (window.innerWidth <= 768) {
            this.isMobile = true;
            this.isTablet = false;
        } else if (window.innerWidth <= 1024 && isTouchDevice) {
            this.isTablet = true;
            this.isMobile = false;
        }
    }

    updatePlotConfigForDevice() {
        if (this.isMobile) {
            // Mobile: legend below plot, smaller padding
            this.plotConfig.padding = { top: 30, right: 20, bottom: 120, left: 60 };
        } else if (this.isTablet) {
            // Tablet: smaller right padding for legend
            this.plotConfig.padding = { top: 35, right: 150, bottom: 60, left: 70 };
        } else {
            // Desktop: original padding
            this.plotConfig.padding = { top: 40, right: 200, bottom: 60, left: 80 };
        }
    }

    setupCanvas() {
        // Set canvas size to match container
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Use device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = 400 * dpr; // Fixed height for plot
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = '400px';

        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = true;
    }

    updateTargetData(targets, observationParams) {
        if (!this.isInitialized || !targets || targets.length === 0) return;

        const { obsLat, obsLon, obsDay } = observationParams;
        this.targetData.clear();

        // Calculate start and end time for the observation night
        let startTime = null;
        let endTime = null;
        try {
            const sunriseSunset = window.MinairAstronomy.calcSunriseSunset(obsLat, obsLon, obsDay);
            if (!sunriseSunset.riseTime || !sunriseSunset.setTime) {
                startTime = null;
                endTime = null;
            } else {
                startTime = sunriseSunset.setTime;
                endTime = sunriseSunset.riseTime;
            }
        } catch (error) {
            console.error('Error calculating start/end time:', error);
            startTime = null;
            endTime = null;
        }
        if (!startTime || !endTime || startTime >= endTime) {
            // Set to null
            startTime = null;
            endTime = null;
        }
        this.startTime = null;
        this.endTime = null;

        // Calculate altitude data for each target
        targets.forEach((target, index) => {
            try {
                // Get altitude series for 24 hours with 10-minute intervals
                const altData = window.MinairAstronomy.calcAltSeries(
                    target.ra, target.dec, obsLat, obsLon, obsDay, 10
                );

                // Trim the time data if startTime and endTime are defined
                const trimmedTimes = [];
                const trimmedAlts = [];
                if (startTime && endTime) {
                    for (let i = 0; i < altData.time.length; i++) {
                        const time = altData.time[i];
                        if (time >= startTime && time <= endTime) {
                            trimmedTimes.push(time);
                            trimmedAlts.push(altData.alt[i]);
                        }
                    }
                } else {
                    // If no start/end time, use full data
                    trimmedTimes.push(...altData.time);
                    trimmedAlts.push(...altData.alt);
                }

                this.targetData.set(target.id, {
                    name: target.name,
                    times: trimmedTimes,
                    altitudes: trimmedAlts,
                    color: this.plotConfig.targetColors[index % this.plotConfig.targetColors.length],
                    visible: this.selectedTargets.has(target.id) || this.selectedTargets.size === 0
                });

                // Set plot time range
                if (!this.startTime || trimmedTimes[0] < this.startTime) {
                    this.startTime = trimmedTimes[0];
                }
                if (!this.endTime || trimmedTimes[trimmedTimes.length - 1] > this.endTime) {
                    this.endTime = trimmedTimes[trimmedTimes.length - 1];
                }
            } catch (error) {
                console.error(`Error calculating altitude data for ${target.name}:`, error);
            }
        });

        this.redraw();
    }

    toggleTarget(targetId, forceAction = null) {
        // forceAction: null (toggle), 'add' (always add), 'remove' (always remove)
        // Default toggle behavior
        if (this.selectedTargets.has(targetId)) {
            if (forceAction !== 'add') {
                this.selectedTargets.delete(targetId);
            }
        } else {
            if (forceAction !== 'remove') {
                this.selectedTargets.add(targetId);
            }
        }

        // Update visibility in target data
        for (const [id, data] of this.targetData) {
            data.visible = this.selectedTargets.has(id) || this.selectedTargets.size === 0;
        }

        this.redraw();
    }

    clearSelection() {
        this.selectedTargets.clear();
        // Show all targets when none are selected
        for (const data of this.targetData.values()) {
            data.visible = true;
        }
        this.redraw();
    }

    redraw() {
        if (!this.isInitialized || !this.ctx) return;

        const canvas = this.canvas;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = 400;

        // Clear canvas
        this.ctx.fillStyle = this.getComputedColor(this.plotConfig.backgroundColor);
        this.ctx.fillRect(0, 0, width, height);

        const plotArea = {
            left: this.plotConfig.padding.left,
            right: width - this.plotConfig.padding.right,
            top: this.plotConfig.padding.top,
            bottom: height - this.plotConfig.padding.bottom
        };

        this.updateXTicks();
        this.drawGrid(plotArea, width, height);
        this.drawTargetCurves(plotArea);
        this.drawAxes(plotArea, width, height);
        this.drawLegend(plotArea, width, height);
    }

    updateXTicks() {
        // Current time marker
        const now = new Date();
        const nowFraction = (now - this.startTime) / (this.endTime - this.startTime);
        this.xnow = (nowFraction >= 0 && nowFraction <= 1) ? nowFraction : null;

        this.xticks = [];
        if (!this.startTime || !this.endTime) return;

        // Calculate start and end times in the current time reference
        let start = new Date(this.startTime);
        let end = new Date(this.endTime);
        if (this.timeReference === 'utc') {
            // UTC times, no change needed
        }
        else if (this.timeReference === 'lst') {
            // Convert to LST-based times
            const obsLon = window.minairApp.getObservationParameters().obsLon;
            const lstStartHours = window.MinairAstronomy.lstFromUTC(this.startTime, obsLon);
            const lstEndHours = window.MinairAstronomy.lstFromUTC(this.endTime, obsLon);
            start.setUTCHours(Math.floor(lstStartHours), Math.floor((lstStartHours % 1) * 60), 0, 0);
            end.setUTCHours(Math.floor(lstEndHours), Math.floor((lstEndHours % 1) * 60), 0, 0);
            if (end <= start) {
                end.setUTCDate(end.getUTCDate() + 1);
            }
        } else {
            // User timezone or selected timezone
            const offsetMinutes = window.minairApp.timeManager.getUserTimezoneOffset();
            start = new Date(this.startTime.getTime() + (offsetMinutes * 60000));
            end = new Date(this.endTime.getTime() + (offsetMinutes * 60000));
        }

        // Get all hour marks between start and end
        const current = new Date(start);
        current.setUTCHours(current.getUTCHours() + 1, 0, 0, 0);
        while (current <= end) {
            // Calculate fraction of position between start and end
            const fraction = (current - start) / (end - start);
            this.xticks.push([new Date(current), fraction]);
            current.setUTCHours(current.getUTCHours() + 1);
        }
        // Ensure that at least two ticks exist
        if (this.xticks.length < 2) {
            this.xticks = [
                [new Date(start), 0],
                [new Date(end), 1]
            ];
        }
    }

    drawGrid(plotArea, width, height) {
        this.ctx.strokeStyle = this.getComputedColor(this.plotConfig.gridColor);
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);

        // Horizontal grid lines (altitude)
        for (let alt = 0; alt <= 90; alt += 15) {
            const y = plotArea.bottom - (alt / 90) * (plotArea.bottom - plotArea.top);
            this.ctx.beginPath();
            this.ctx.moveTo(plotArea.left, y);
            this.ctx.lineTo(plotArea.right, y);
            this.ctx.stroke();
        }

        // Vertical grid lines (time)
        for (const [tickTime, fraction] of this.xticks) {
            const x = plotArea.left + fraction * (plotArea.right - plotArea.left);
            this.ctx.beginPath();
            this.ctx.moveTo(x, plotArea.top);
            this.ctx.lineTo(x, plotArea.bottom);
            this.ctx.stroke();
        }

        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 2;

        // A solid line at minAltitude
        const minAltitude = this.minAltitude;
        if (minAltitude !== undefined) {
            const y = plotArea.bottom - (minAltitude / 90) * (plotArea.bottom - plotArea.top);
            this.ctx.beginPath();
            this.ctx.moveTo(plotArea.left, y);
            this.ctx.lineTo(plotArea.right, y);
            this.ctx.stroke();
        }
        // Current time indicator
        if (this.xnow !== null) {
            const x = plotArea.left + this.xnow * (plotArea.right - plotArea.left);
            this.ctx.beginPath();
            this.ctx.moveTo(x, plotArea.top);
            this.ctx.lineTo(x, plotArea.bottom);
            this.ctx.stroke();
        }
    }

    drawAxes(plotArea, width, height) {
        this.ctx.strokeStyle = this.getComputedColor(this.plotConfig.axisColor);
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px sans-serif';
        this.ctx.fillStyle = this.getComputedColor(this.plotConfig.textColor);

        // X-axis
        this.ctx.beginPath();
        this.ctx.moveTo(plotArea.left, plotArea.bottom);
        this.ctx.lineTo(plotArea.right, plotArea.bottom);
        this.ctx.stroke();

        // Y-axis
        this.ctx.beginPath();
        this.ctx.moveTo(plotArea.left, plotArea.top);
        this.ctx.lineTo(plotArea.left, plotArea.bottom);
        this.ctx.stroke();

        // X-axis labels (time)
        if (this.isMobile) {
            // Rotate labels 90 degrees on mobile screens
            this.ctx.textAlign = 'left';
            for (const [tickTime, fraction] of this.xticks) {
                const x = plotArea.left + fraction * (plotArea.right - plotArea.left);
                this.ctx.save();
                this.ctx.translate(x, plotArea.bottom + 20);
                this.ctx.rotate(Math.PI / 2); // 90 degrees
                this.ctx.fillText(formatDateHHMM(tickTime), 0, 0);
                this.ctx.restore();
            }
        } else {
            // Normal horizontal labels
            this.ctx.textAlign = 'center';
            for (const [tickTime, fraction] of this.xticks) {
                const x = plotArea.left + fraction * (plotArea.right - plotArea.left);
                this.ctx.fillText(formatDateHHMM(tickTime), x, plotArea.bottom + 20);
            }
        }

        // Y-axis labels (altitude)
        this.ctx.textAlign = 'right';
        for (let alt = 0; alt <= 90; alt += 15) {
            const y = plotArea.bottom - (alt / 90) * (plotArea.bottom - plotArea.top);
            this.ctx.fillText(`${alt}°`, plotArea.left - 10, y + 4);
        }

        // Axis titles
        this.ctx.fillStyle = this.getComputedColor(this.plotConfig.axisColor);
        this.ctx.font = 'bold 14px sans-serif';

        // X-axis title
        let clockLabel = window.minairApp.timeManager.getClockLabel();
        clockLabel = !clockLabel ? 'Time' : `Time (${clockLabel})`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(clockLabel, (plotArea.left + plotArea.right) / 2, height - 10);

        // Y-axis title (rotated)
        this.ctx.save();
        this.ctx.translate(20, (plotArea.top + plotArea.bottom) / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Altitude (°)', 0, 0);
        this.ctx.restore();
    }

    drawTargetCurves(plotArea) {
        if (this.targetData.size === 0) return;

        this.ctx.lineWidth = 2;

        for (const [targetId, data] of this.targetData) {
            if (!data.visible || !data.times || data.times.length === 0) continue;

            this.ctx.strokeStyle = this.getComputedColor(data.color);
            this.ctx.beginPath();

            let firstPoint = true;
            const startTime = data.times[0].getTime();
            const timeSpan = this.endTime.getTime() - this.startTime.getTime();

            for (let i = 0; i < data.times.length; i++) {
                const time = data.times[i];
                let altitude = data.altitudes[i];

                // Clamp altitude to [0, 90] for visual clipping
                if (altitude < 0) altitude = 0;
                if (altitude > 90) altitude = 90;

                // Calculate x position based on time
                const timeOffset = time.getTime() - startTime;
                const timeRatio = timeOffset / timeSpan;
                const x = plotArea.left + timeRatio * (plotArea.right - plotArea.left);

                // Calculate y position based on altitude
                const altRatio = altitude / 90;
                const y = plotArea.bottom - altRatio * (plotArea.bottom - plotArea.top);

                if (firstPoint) {
                    this.ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    this.ctx.lineTo(x, y);
                }
            }

            this.ctx.stroke();
        }
    }

    drawLegend(plotArea, width, height) {
        if (this.targetData.size === 0) return;

        let legendX, legendY, legendDirection;
        const lineHeight = this.isMobile ? 16 : 18;
        const fontSize = this.isMobile ? '11px' : '12px';

        if (this.isMobile) {
            // Mobile: legend below plot in horizontal layout
            // Push legend down further to account for rotated tick labels
            legendDirection = 'horizontal';
            legendX = plotArea.left + 10;
            legendY = plotArea.bottom + 70; // Increased from 50 to 70

            this.drawHorizontalLegend(plotArea, width, height, legendX, legendY, fontSize);
        } else {
            // Desktop/Tablet: legend on the right side
            legendDirection = 'vertical';
            legendX = plotArea.right + 10;
            legendY = plotArea.top + 20;

            this.drawVerticalLegend(plotArea, width, height, legendX, legendY, fontSize, lineHeight);
        }
    }

    drawVerticalLegend(plotArea, width, height, legendX, legendY, fontSize, lineHeight) {
        const availableWidth = width - legendX - 10;
        const textStartX = legendX + 20;
        const maxTextWidth = availableWidth - 25;

        this.ctx.font = `${fontSize} sans-serif`;
        this.ctx.textAlign = 'left';

        for (const [targetId, data] of this.targetData) {
            if (!data.visible) continue;

            // Draw color line
            this.ctx.strokeStyle = this.getComputedColor(data.color);
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(legendX, legendY + 2);
            this.ctx.lineTo(legendX + 15, legendY + 2);
            this.ctx.stroke();

            // Draw target name with text wrapping
            this.ctx.fillStyle = this.getComputedColor(this.plotConfig.textColor);

            const targetName = data.name;
            const words = targetName.split(' ');
            const wrappedLines = this.wrapText(words, maxTextWidth);

            // Draw each line of wrapped text
            let currentY = legendY + 4;
            for (let i = 0; i < wrappedLines.length; i++) {
                this.ctx.fillText(wrappedLines[i], textStartX, currentY);
                if (i < wrappedLines.length - 1) {
                    currentY += lineHeight;
                }
            }

            // Move to next legend entry
            legendY += lineHeight * Math.max(1, wrappedLines.length) + 2;
        }
    }

    drawHorizontalLegend(plotArea, width, height, startX, startY, fontSize) {
        this.ctx.font = `${fontSize} sans-serif`;
        this.ctx.textAlign = 'left';

        let currentX = startX;
        let currentY = startY;
        const itemSpacing = 15;
        const rowHeight = 20;
        const maxRowWidth = width - 40; // Leave some margin

        for (const [targetId, data] of this.targetData) {
            if (!data.visible) continue;

            // Calculate text width for this item
            const targetName = data.name;
            const textWidth = this.ctx.measureText(targetName).width;
            const itemWidth = 20 + textWidth + itemSpacing; // color line + text + spacing

            // Check if we need to wrap to next row
            if (currentX + itemWidth > maxRowWidth && currentX > startX) {
                currentX = startX;
                currentY += rowHeight;
            }

            // Draw color line
            this.ctx.strokeStyle = this.getComputedColor(data.color);
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(currentX, currentY + 2);
            this.ctx.lineTo(currentX + 15, currentY + 2);
            this.ctx.stroke();

            // Draw target name
            this.ctx.fillStyle = this.getComputedColor(this.plotConfig.textColor);
            this.ctx.fillText(targetName, currentX + 20, currentY + 4);

            // Move to next position
            currentX += itemWidth;
        }
    }

    // Helper method to wrap text within a given width
    wrapText(words, maxWidth) {
        if (words.length === 0) return [''];

        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testWidth = this.ctx.measureText(testLine).width;

            if (testWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                // Current line is full, start a new line
                lines.push(currentLine);
                currentLine = words[i];
            }
        }

        // Add the last line
        lines.push(currentLine);

        // Limit to maximum 2 lines to prevent legend from becoming too tall
        if (lines.length > 2) {
            lines[1] = lines[1] + '...';
            return lines.slice(0, 2);
        }

        return lines;
    } getComputedColor(cssVar) {
        // Handle CSS variables by getting computed style
        if (cssVar.startsWith('var(')) {
            const varName = cssVar.slice(4, -1);
            return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        }
        return cssVar;
    }

    handleResize() {
        if (this.isInitialized) {
            this.updateDeviceType();
            this.updatePlotConfigForDevice();
            this.setupCanvas();
            this.redraw();
        }
    }

    setMinAltitude(minAlt) {
        this.minAltitude = minAlt;
        this.redraw();
    }

    setTimeReference(timeRef) {
        this.timeReference = timeRef;
        this.redraw();
    }

    resetTheme() {
        // Refresh plotConfig color values from current CSS variables
        const style = getComputedStyle(document.documentElement);
        this.plotConfig.gridColor = style.getPropertyValue('--border-color').trim();
        this.plotConfig.textColor = style.getPropertyValue('--text-secondary').trim();
        this.plotConfig.backgroundColor = style.getPropertyValue('--bg-secondary').trim();
        this.plotConfig.axisColor = style.getPropertyValue('--text-primary').trim();
        this.plotConfig.targetColors = [
            style.getPropertyValue('--target-color-1').trim(),
            style.getPropertyValue('--target-color-2').trim(),
            style.getPropertyValue('--target-color-3').trim(),
            style.getPropertyValue('--target-color-4').trim(),
            style.getPropertyValue('--target-color-5').trim(),
            style.getPropertyValue('--target-color-6').trim(),
            style.getPropertyValue('--target-color-7').trim(),
            style.getPropertyValue('--target-color-8').trim()
        ];
        this.redraw();
    }

    destroy() {
        this.targetData.clear();
        this.selectedTargets.clear();
        this.isInitialized = false;
    }
}