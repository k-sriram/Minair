# Minair Development Planning

## Current State
- Basic astronomy calculations (coordinate transformations, solar position)
- Simple target catalog with celestial coordinates
- Minimal UI with basic plotting
- Observation window detection logic
- Static site ready for GitHub Pages deployment

## Development Roadmap

### Phase 1: Core User Experience (High Priority)

#### 1.1 Location & Time Management
- [x] User location input (lat/lon coordinates)
- [x] City/location lookup with geocoding
- [x] Time zone detection and handling
- [x] Date/time picker for observation planning
- [x] Save user preferences in localStorage

#### 1.2 Enhanced Visualization
- [ ] ~~Replace basic plotting with proper timeline/Gantt chart~~
- [ ] Interactive observation windows (hover, zoom, pan)
- [ ] Color-coded visibility periods
- [x] Target elevation curves over time
- [ ] Moon phase visualization
- [ ] Solar position indicators

#### 1.3 UI/UX Design & Theming
- [x] Modern, clean interface design
- [x] Dark theme optimized for astronomy use (preserves night vision)
- [x] Red-on-black night vision theme (red light preserves scotopic vision better)
- [x] Light theme for daytime planning
- [ ] Responsive layout for mobile/tablet/desktop
- [ ] Intuitive navigation and information hierarchy
- [ ] ~~Astronomy-themed color palette (deep blues, star whites, nebula purples)~~
- [ ] Professional typography (readable at all sizes)
- [ ] Consistent spacing and visual rhythm
- [ ] Loading states and smooth transitions
- [ ] Accessibility compliance (WCAG 2.1)

#### 1.4 Improved Target Management
- [ ] ~~Expand target catalog (Messier objects, bright stars, planets)~~
- [x] Custom target input (RA/Dec entry)
- [x] Target search and filtering
- [ ] ~~Target categories and tagging~~
- [ ] Import/export target lists

### Phase 2: Astronomical Accuracy (Medium Priority)

#### 2.1 Enhanced Calculations
- [ ] Proper precession handling
- [ ] Atmospheric refraction corrections
- [ ] More accurate solar/lunar position algorithms
- [ ] Twilight calculations (civil, nautical, astronomical)
- [ ] Moon illumination and phase calculations

#### 2.2 Observation Constraints
- [x] Minimum altitude thresholds
- [ ] Maximum airmass limits
- [ ] Moon avoidance for deep sky objects
- [ ] Light pollution considerations
- [ ] Weather integration (optional)

### Phase 3: Advanced Features (Future)

#### 3.1 Planning & Export
- [ ] Save/load observation plans
- [ ] Export to calendar formats (ICS)
- [ ] PDF observation schedules
- [ ] Observation session planning
- [ ] Equipment scheduling integration

#### 3.2 Performance & Mobile
- [ ] Web worker offloading for calculations
- [ ] Progressive loading for large catalogs
- [ ] Mobile-responsive design
- [ ] Offline capability (service worker)
- [ ] Touch-friendly controls

#### 3.3 Collaboration & Sharing
- [ ] Share observation plans via URL
- [ ] Collaborative planning sessions
- [ ] Observatory scheduling integration
- [ ] Social features (observation logs)

### Phase 4: Advanced Astronomy Features

#### 4.1 Advanced Targets
- [ ] Solar system objects (planets, asteroids, comets)
- [ ] Variable star predictions
- [ ] Satellite tracking
- [ ] Transient event alerts
- [ ] Integration with astronomical databases (SIMBAD, etc.)

#### 4.2 Observatory Features
- [ ] Multiple observer locations
- [ ] Telescope control integration
- [ ] Imaging sequence planning
- [ ] Filter scheduling
- [ ] Automated observation scripts

## Technical Considerations

### Architecture Decisions
- **Client-side focus**: Keep calculations in browser for responsiveness
- **Progressive enhancement**: Basic functionality works without JavaScript
- **Mobile-first**: Design for mobile devices primarily
- **Dark-theme optimized**: Primary interface preserves night vision
- **Accessibility-first**: WCAG 2.1 compliance from the start
- **Component-based**: Reusable UI components for consistency
- **Offline-capable**: Cache calculations and catalogs locally
- **Modular**: Keep astronomy, UI, and data layers separate

### Performance Targets
- [ ] < 2s initial load time
- [ ] < 100ms calculation response time
- [ ] < 50MB total asset size
- [ ] Works on 3G connections
- [ ] Responsive on mobile devices

### Browser Support
- **Primary**: Modern Chrome, Firefox, Safari, Edge
- **Secondary**: Mobile browsers (iOS Safari, Chrome Mobile)
- **Graceful degradation**: Basic functionality on older browsers

## Implementation Notes

### Dependencies to Consider
- **Visualization**: D3.js, Chart.js, or Plotly.js for advanced charts
- **UI Framework**: Consider Lit, Alpine.js, or vanilla components
- **CSS Framework**: Tailwind CSS, or custom CSS with design tokens
- **Icons**: Lucide, Heroicons, or astronomy-specific icon sets
- **Fonts**: Inter, Source Sans Pro, or astronomy-themed fonts
- **Astronomy**: Evaluate existing JS astronomy libraries vs custom
- **Mapping**: Leaflet for location selection
- **Date/Time**: Temporal API (when available) or date-fns

### Data Sources
- **Star catalogs**: Hipparcos, Tycho, or curated subsets
- **Deep sky**: Messier, NGC, Caldwell catalogs
- **Planets**: VSOP87 or simplified ephemeris
- **Time data**: IERS for leap seconds, time zones

### Testing Strategy
- **Unit tests**: Core astronomy calculations
- **Integration tests**: End-to-end user workflows
- **Visual tests**: Chart rendering and interactions
- **Performance tests**: Large catalog handling
- **Astronomy validation**: Compare with established tools

## Success Metrics

### User Experience
- Time to first meaningful calculation
- User retention and return visits
- Mobile usage patterns
- Feature adoption rates

### Accuracy
- Coordinate transformation precision
- Timing accuracy for observations
- Comparison with professional tools
- User feedback on accuracy

### Performance
- Page load times
- Calculation response times
- Memory usage patterns
- Battery impact on mobile

---

*This planning document should evolve as the project grows and user feedback is incorporated.*