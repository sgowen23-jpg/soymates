import { useCallback, useRef, useEffect } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import { STORES } from '../../data/stores'
import { BNB_DATA } from '../../data/bnbData'
import { chainColor } from './chainColors'

const MAP_LIBRARIES = ['marker']
const MAP_CENTER = { lat: -33.8688, lng: 151.2093 }

function gapCount(name) {
  const data = BNB_DATA[name]
  if (!data?.products) return 0
  return Object.values(data.products).filter(p => p.dis === 0).length
}

export default function MapView({ onStoreClick, stateFilter }) {
  const mapRef = useRef(null)
  const markersRef = useRef([])

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: MAP_LIBRARIES,
  })

  function addMarkers(map, filter) {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const filtered = filter === 'All' ? STORES : STORES.filter(s => s.state === filter)
    const bounds = new window.google.maps.LatLngBounds()

    filtered.forEach(store => {
      const gaps = gapCount(store.name)
      const color = chainColor(store.chain)
      const size = gaps > 3 ? 10 : 8

      const marker = new window.google.maps.Marker({
        position: { lat: store.lat, lng: store.lng },
        map,
        title: store.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: size,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 1.5,
        },
      })

      marker.addListener('click', () => onStoreClick(store))
      markersRef.current.push(marker)
      bounds.extend({ lat: store.lat, lng: store.lng })
    })

    if (filtered.length > 0) map.fitBounds(bounds)
  }

  const onLoad = useCallback((map) => {
    mapRef.current = map
    addMarkers(map, stateFilter)
  }, [])

  useEffect(() => {
    if (mapRef.current) addMarkers(mapRef.current, stateFilter)
  }, [stateFilter])

  if (loadError) return <div className="map-error">Failed to load Google Maps</div>
  if (!isLoaded) return <div className="map-loading">Loading map…</div>

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={MAP_CENTER}
      zoom={5}
      onLoad={onLoad}
      options={{
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
      }}
    />
  )
}
