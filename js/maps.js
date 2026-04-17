/**
 * maps.js — Google Maps JS integration
 * Renders venue map with markers and crowd density colour overlay
 */
let _map, _markers = [];

/** Called by Google Maps callback once script loads */
export function initMap() {
  _map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 12.9716, lng: 77.5946 },
    zoom: 18,
    mapTypeId: "satellite",
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
  });
  _addVenueMarkers();
}

/** Place markers for all concessions, restrooms, gates */
function _addVenueMarkers() {
  const s = window.STADIUM;
  if (!s) return;
  const markerDefs = [
    ...(s.concessions || []).map(c => ({ ...c, type: "food",     label: "F" })),
    ...(s.restrooms || []).map(r =>   ({ ...r, type: "restroom", label: "R" })),
    ...(s.gates || []).map(g =>       ({ ...g, type: "gate",     label: g.id })),
    ...(s.exits || []).map(e =>       ({ ...e, type: "exit",     label: "X" })),
  ];
  markerDefs.forEach(def => {
    const marker = new google.maps.Marker({
      position: { lat: def.lat, lng: def.lng },
      map: _map,
      title: def.name || def.id,
      label: { text: def.label, fontSize: "11px", fontWeight: "500" },
    });
    _markers.push({ marker, def });
  });
}

/**
 * Update gate marker colours based on live capacity from Firebase
 * @param {Object} gateData - from getLiveContext().gates
 */
export function updateGateOverlay(gateData) {
  if (!gateData) return;
  _markers
    .filter(m => m.def.type === "gate")
    .forEach(({ marker, def }) => {
      const pct = gateData[def.id]?.capacityPct ?? 0;
      const color = pct > 70 ? "#E24B4A" : pct > 40 ? "#EF9F27" : "#639922";
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: color,
        fillOpacity: 0.9,
        strokeColor: "#fff",
        strokeWeight: 1.5,
      });
    });
}

/** Centre map and zoom on a specific lat/lng */
export function focusLocation(lat, lng) {
  if (!_map) return;
  _map.panTo({ lat, lng });
  _map.setZoom(19);
}
