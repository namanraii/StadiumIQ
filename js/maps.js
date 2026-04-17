/**
 * maps.js
 * @module maps
 * @description Google Maps JavaScript API integration.
 * Renders the venue satellite map with custom facility markers and
 * applies real-time crowd density colour overlays on gate markers.
 *
 * Google Services used:
 *  - Maps JavaScript API (maps.googleapis.com) — satellite basemap + custom overlays
 *
 * @see https://developers.google.com/maps/documentation/javascript
 */

/** @type {google.maps.Map|null} Singleton map instance */
let _map = null;

/**
 * @typedef {Object} MarkerEntry
 * @property {google.maps.Marker} marker - The Google Maps marker instance
 * @property {{ lat: number, lng: number, type: string, id?: string, name?: string, label: string }} def
 *   Original marker definition data
 */

/** @type {MarkerEntry[]} All active markers on the map */
let _markers = [];

/** @constant {{ lat: number, lng: number }} Default map centre (Bengaluru MetroArena) */
const DEFAULT_CENTRE = { lat: 12.9716, lng: 77.5946 };

/** @constant {number} Default zoom level — shows individual stadium sections */
const DEFAULT_ZOOM = 18;

/**
 * Colour thresholds for gate capacity overlays.
 * Gates above HIGH_THRESHOLD are shown red; above MED_THRESHOLD, amber; else green.
 * @constant {{ HIGH: number, MED: number }}
 */
const CAPACITY_THRESHOLDS = { HIGH: 70, MED: 40 };

/** @constant {{ HIGH: string, MED: string, LOW: string }} Hex colours for capacity dots */
const CAPACITY_COLOURS = { HIGH: "#E24B4A", MED: "#EF9F27", LOW: "#639922" };

/**
 * Initialise and render the Google Maps satellite view.
 * Called by the `onMapsLoaded` callback in index.html once the Maps JS API has loaded.
 * Requires `window.STADIUM` to be populated (fetched from `data/stadium.json`).
 *
 * @returns {void}
 */
export function initMap() {
  _map = new google.maps.Map(document.getElementById("map"), {
    center:             DEFAULT_CENTRE,
    zoom:               DEFAULT_ZOOM,
    mapTypeId:          "satellite",
    disableDefaultUI:   false,
    zoomControl:        true,
    mapTypeControl:     false,
    streetViewControl:  false,
  });
  _addVenueMarkers();
}

/**
 * Place labelled markers for all concessions, restrooms, gates, and exits
 * defined in `window.STADIUM` (loaded from `data/stadium.json`).
 * Gate markers use a default colour; call {@link updateGateOverlay} to apply crowd colours.
 *
 * @returns {void}
 * @private
 */
function _addVenueMarkers() {
  const s = window.STADIUM;
  if (!s || !_map) return;

  /** @type {Array<{ lat: number, lng: number, type: string, label: string, name?: string, id?: string }>} */
  const markerDefs = [
    ...(s.concessions || []).map(c => ({ ...c, type: "food",     label: "F" })),
    ...(s.restrooms   || []).map(r => ({ ...r, type: "restroom", label: "R" })),
    ...(s.gates       || []).map(g => ({ ...g, type: "gate",     label: g.id })),
    ...(s.exits       || []).map(e => ({ ...e, type: "exit",     label: "X" })),
  ];

  markerDefs.forEach(def => {
    const marker = new google.maps.Marker({
      position: { lat: def.lat, lng: def.lng },
      map:      _map,
      title:    def.name || def.id || def.label,
      label:    { text: def.label, fontSize: "11px", fontWeight: "500" },
    });
    _markers.push({ marker, def });
  });
}

/**
 * Update gate marker icon colours based on live capacity data from Firebase.
 * Gates exceeding {@link CAPACITY_THRESHOLDS.HIGH}% render red,
 * above {@link CAPACITY_THRESHOLDS.MED}% render amber, otherwise green.
 *
 * @param {Object<string, { capacityPct: number }>} gateData
 *   Map of gate IDs to current capacity percentage. From `getLiveContext().gates`.
 * @returns {void}
 *
 * @example
 * updateGateOverlay({ A: { capacityPct: 82 }, D: { capacityPct: 18 } });
 * // Gate A → red dot, Gate D → green dot
 */
export function updateGateOverlay(gateData) {
  if (!gateData || !_map) return;
  _markers
    .filter(m => m.def.type === "gate")
    .forEach(({ marker, def }) => {
      const pct = gateData[def.id]?.capacityPct ?? 0;
      const color =
        pct > CAPACITY_THRESHOLDS.HIGH ? CAPACITY_COLOURS.HIGH :
        pct > CAPACITY_THRESHOLDS.MED  ? CAPACITY_COLOURS.MED  :
                                         CAPACITY_COLOURS.LOW;
      marker.setIcon({
        path:          google.maps.SymbolPath.CIRCLE,
        scale:         10,
        fillColor:     color,
        fillOpacity:   0.9,
        strokeColor:   "#fff",
        strokeWeight:  1.5,
      });
    });
}

/**
 * Smoothly pan the map to a specific location and zoom in.
 * Used when a user asks for directions and the route destination is known.
 *
 * @param {number} lat - Target latitude
 * @param {number} lng - Target longitude
 * @param {number} [zoom=19] - Optional zoom level override
 * @returns {void}
 */
export function focusLocation(lat, lng, zoom = 19) {
  if (!_map) return;
  _map.panTo({ lat, lng });
  _map.setZoom(zoom);
}

/**
 * Return all markers of a specified type from the internal marker registry.
 * Useful for querying specific facility markers externally (e.g. for testing).
 *
 * @param {"food"|"restroom"|"gate"|"exit"} type - Marker type to filter by
 * @returns {MarkerEntry[]} Filtered array of matching marker entries
 */
export function getMarkersByType(type) {
  return _markers.filter(m => m.def.type === type);
}
