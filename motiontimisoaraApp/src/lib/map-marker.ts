import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Leaflet's default marker (Icon.Default) prepends an auto-detected `imagePath`
// to its icon URLs, which mangles the hashed asset URLs Vite produces — so the
// marker images 404 and only the "Marker" alt text shows. Build an explicit icon
// from the bundled assets instead (plain L.Icon does not prepend imagePath).
export const markerIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})
