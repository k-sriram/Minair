/* ThemeManager.js — Theme management for Minair
 */
export class ThemeManager {
    constructor() {
        this.currentTheme = this.loadTheme();
        this.applyTheme(this.currentTheme);
    }

    loadTheme() {
        const saved = localStorage.getItem('minair-theme');
        if (saved) {
            return saved;
        }

        // No saved theme - default to dark unless user specifically prefers light
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        } else {
            return 'dark';
        }
    }

    saveTheme(theme) {
        localStorage.setItem('minair-theme', theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.saveTheme(theme);

        // Update theme selector
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = theme;
        }
    }

    switchTheme(theme) {
        this.applyTheme(theme);
    }
}