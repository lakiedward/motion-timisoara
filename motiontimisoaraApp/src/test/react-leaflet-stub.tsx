/* eslint-disable react-refresh/only-export-components -- test double: hooks + a click helper live next to stub components */
import { useEffect, type ReactNode } from 'react'

type ClickHandler = (e: { latlng: { lat: number; lng: number } }) => void

const MAP_CLICK_EVENT = 'leaflet-test-click'

/** Used by tests to simulate a click on the map surface. */
export function triggerMapClick(lat: number, lng: number) {
  window.dispatchEvent(new CustomEvent(MAP_CLICK_EVENT, { detail: { lat, lng } }))
}

export function MapContainer({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div data-testid="leaflet-map" className={className}>
      {children}
    </div>
  )
}

export function TileLayer() {
  return null
}

export function Marker({
  position,
  eventHandlers,
}: {
  position: [number, number]
  draggable?: boolean
  icon?: unknown
  eventHandlers?: {
    dragend?: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => void
  }
}) {
  return (
    <button
      type="button"
      data-testid="map-pin"
      aria-label="Pin pe hartă"
      onClick={() =>
        eventHandlers?.dragend?.({
          target: {
            getLatLng: () => ({ lat: position[0] + 0.001, lng: position[1] + 0.001 }),
          },
        })
      }
    >
      pin
    </button>
  )
}

export function useMap() {
  return {
    flyTo: () => undefined,
    invalidateSize: () => undefined,
  }
}

export function useMapEvents(handlers: { click?: ClickHandler }) {
  useEffect(() => {
    const listener = (event: Event) => {
      const { lat, lng } = (event as CustomEvent<{ lat: number; lng: number }>).detail
      handlers.click?.({ latlng: { lat, lng } })
    }
    window.addEventListener(MAP_CLICK_EVENT, listener)
    return () => window.removeEventListener(MAP_CLICK_EVENT, listener)
  }, [handlers, handlers.click])
  return {}
}

export function useMapEvent() {
  return {}
}
