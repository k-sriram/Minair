/* modules.js — Simple module loader for Minair
 */
(async function () {
    'use strict';

    // Helper function to load ES6 modules and make them available globally
    async function loadModule(path, exportName) {
        try {
            const module = await import(path);
            return module[exportName];
        } catch (error) {
            console.error(`Failed to load module ${path}:`, error);
            return null;
        }
    }

    // Load all managers and utilities
    const ThemeManager = await loadModule('./managers/ThemeManager.js', 'ThemeManager');
    const LocationManager = await loadModule('./managers/LocationManager.js', 'LocationManager');
    const TimeManager = await loadModule('./managers/TimeManager.js', 'TimeManager');
    const TargetManager = await loadModule('./managers/TargetManager.js', 'TargetManager');
    const PlotManager = await loadModule('./managers/PlotManager.js', 'PlotManager');
    const CustomDropdown = await loadModule('./components/CustomDropdown.js', 'CustomDropdown');

    // Load utilities
    const CoordinateParser = await loadModule('./utils/CoordinateParser.js', 'parseCoordinate');
    const CoordinateFormatter = await loadModule('./utils/CoordinateFormatter.js', 'formatRA');
    const TimeConverter = await loadModule('./utils/TimeConverter.js', 'formatDateHHMMWithTimeZone');

    // Make them available globally for the main app
    window.MinairModules = {
        ThemeManager,
        LocationManager,
        TimeManager,
        TargetManager,
        PlotManager,
        CustomDropdown,
        CoordinateParser,
        CoordinateFormatter,
        TimeConverter
    };

    // Signal that modules are loaded
    window.dispatchEvent(new CustomEvent('modulesLoaded'));
})();