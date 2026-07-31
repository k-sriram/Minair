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

const [
    { ThemeManager },
    { LocationManager },
    { TimeManager },
    { TargetManager },
    { PlotManager },
    { CustomDropdown },
    { CustomNumberInput },
    { CustomDatePicker },
    { parseCoordinate: CoordinateParser },
    CoordinateFormatter,
    { formatDateHHMMWithTimeZone: TimeConverter },
    Icons
] = await Promise.all([
    import('./managers/ThemeManager.js'),
    import('./managers/LocationManager.js'),
    import('./managers/TimeManager.js'),
    import('./managers/TargetManager.js'),
    import('./managers/PlotManager.js'),
    import('./components/CustomDropdown.js'),
    import('./components/CustomNumberInput.js'),
    import('./components/CustomDatePicker.js'),
    import('./utils/CoordinateParser.js'),
    import('./utils/CoordinateFormatter.js'),
    import('./utils/TimeConverter.js'),
    import('./utils/Icons.js')
]);

    // Make them available globally for the main app
    window.MinairModules = {
        ThemeManager,
        LocationManager,
        TimeManager,
        TargetManager,
        PlotManager,
        CustomDropdown,
        CustomNumberInput,
        CustomDatePicker,
        CoordinateParser,
        CoordinateFormatter,
        TimeConverter,
        Icons
    };

    // Signal that modules are loaded
    window.dispatchEvent(new CustomEvent('modulesLoaded'));
})();