/* LocationManager.js — Location management for Minair
 */
export class LocationManager {
    constructor() {
        this.observatories = {
            'greenwich': { name: 'Greenwich, UK', lat: 51.4779, lon: -0.0015 },
            'mauna-kea': { name: 'Mauna Kea, Hawaii', lat: 19.8283, lon: -155.4783 },
            'atacama': { name: 'Atacama Desert, Chile', lat: -24.6272, lon: -70.4042 },
            'palomar': { name: 'Palomar Observatory, CA', lat: 33.3563, lon: -116.8650 }
        };
        this.currentLocation = this.loadLocation();
    }

    loadLocation() {
        const saved = localStorage.getItem('minair-location');
        if (saved) {
            return JSON.parse(saved);
        }
        return { lat: 51.4779, lon: -0.0015, name: 'Greenwich, UK' };
    }

    saveLocation(location) {
        localStorage.setItem('minair-location', JSON.stringify(location));
    }

    setLocation(lat, lon, name = 'Custom Location') {
        this.currentLocation = { lat, lon, name };
        this.saveLocation(this.currentLocation);
    }

    getLocation() {
        return this.currentLocation;
    }

    setObservatory(key) {
        if (this.observatories[key]) {
            const obs = this.observatories[key];
            this.setLocation(obs.lat, obs.lon, obs.name);
            return obs;
        }
        return null;
    }
}