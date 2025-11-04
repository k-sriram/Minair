/* LocationManager.js — Location management for Minair
 */
export class LocationManager {
    constructor() {
        this.observatories = {};
        this.currentLocation = this.loadLocation();
        this.loadObservatories();
    }

    async loadObservatories() {
        try {
            const response = await fetch('data/observatories.json');
            if (!response.ok) {
                throw new Error(`Failed to load observatories: ${response.status}`);
            }
            this.observatories = await response.json();
        } catch (error) {
            console.error('Error loading observatories:', error);
            // Fallback to hardcoded observatories if file fails to load
            this.observatories = {
                'greenwich': { id: 'greenwich', name: 'Greenwich, UK', lat: 51.4779, lon: -0.0015 },
                'mauna-kea': { id: 'mauna-kea', name: 'Mauna Kea, Hawaii', lat: 19.8283, lon: -155.4783 },
                'atacama': { id: 'atacama', name: 'Atacama Desert, Chile', lat: -24.6272, lon: -70.4042 },
                'palomar': { id: 'palomar', name: 'Palomar Observatory, CA', lat: 33.3563, lon: -116.8650 }
            };
        }
    }

    loadLocation() {
        const saved = localStorage.getItem('minair-location');
        if (saved) {
            return JSON.parse(saved);
        }
        return { id: 'greenwich', lat: 51.4779, lon: -0.0015, name: 'Greenwich, UK' };
    }

    saveLocation(location) {
        localStorage.setItem('minair-location', JSON.stringify(location));
    }

    setLocation(lat, lon, name = 'Custom Location', id = null) {
        this.currentLocation = { id, lat, lon, name };
        this.saveLocation(this.currentLocation);
    }

    getLocation() {
        return this.currentLocation;
    }

    setObservatory(key) {
        if (this.observatories[key]) {
            const obs = this.observatories[key];
            this.setLocation(obs.lat, obs.lon, obs.name, obs.id);
            return obs;
        }
        return null;
    }
}