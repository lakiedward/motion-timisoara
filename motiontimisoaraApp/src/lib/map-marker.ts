import L from 'leaflet'
import campMarkerSvg from './map-icons/camp-marker.svg?raw'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

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

export const campMarkerIcon = L.divIcon({
  className: 'mt-camp-marker',
  html: campMarkerSvg,
  iconSize: [44, 44],
  iconAnchor: [22, 44],
  popupAnchor: [0, -40],
})
