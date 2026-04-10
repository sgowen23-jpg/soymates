import { useCallback, useRef, useEffect, useState } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import { supabase } from '../../lib/supabase'
import { BNB_DATA } from '../../data/bnbData'
import { chainColor } from './chainColors'

const MAP_LIBRARIES = ['marker']
const MAP_CENTER = { lat: -33.8688, lng: 151.2093 }

function gapCount(name) {
  const data = BNB_DATA[name]
  if (!data?.products) return 0
  return Object.values(data.products).filter(p => p.dis === 0).length
}

function applyFilters(stores, filters) {
  return stores.filter(s => {
    if (filters.state !== 'All' && s.state !== filters.state) return false
    if (filters.rep !== 'All' && s.rep !== filters.rep) return false
    return true
  })
}

export default function MapView({ onStoreClick, filters, search }) {
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const searchMarkerRef = useRef(null)
  // Store data kept in a ref so addMarkers/applySearch always see the latest
  // value without needing to be re-created on every render.
  const storesRef = useRef([])
  const [storesLoading, setStoresLoading] = useState(true)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: MAP_LIBRARIES,
  })

  // Fetch stores from Supabase once on mount, map to the shape the rest of
  // the component (and StoreProfile) already expects.
  useEffect(() => {
    async function fetchStores() {
      const { data, error } = await supabase
        .from('stores')
        .select('store_id, store_name, state, store_region, rep_name, mso, banner, latitude, longitude, address, suburb')
      if (!error && data) {
        storesRef.current = data.map(s => ({
          id:      s.store_id,
          name:    s.store_name,
          rep:     s.rep_name,
          state:   s.state,
          region:  s.store_region,
          chain:   s.banner,
          lat:     parseFloat(s.latitude),
          lng:     parseFloat(s.longitude),
          address: s.address,
          suburb:  s.suburb,
        }))
      }
      setStoresLoading(false)
    }
    fetchStores()
  }, [])

  function addMarkers(map, filters) {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const filtered = applyFilters(storesRef.current, filters)
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

  function applySearch(map, search) {
    // Clear previous search marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setMap(null)
      searchMarkerRef.current = null
    }

    if (!search.trim()) return

    const term = search.trim().toLowerCase()
    const match = storesRef.current.find(s => s.name.toLowerCase().includes(term))
    if (!match) return

    // Dim all regular markers, highlight match
    markersRef.current.forEach(m => {
      const isMatch = m.getTitle().toLowerCase().includes(term)
      m.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: isMatch ? 12 : 6,
        fillColor: isMatch ? '#ff6b35' : '#aaa',
        fillOpacity: isMatch ? 1 : 0.4,
        strokeColor: '#fff',
        strokeWeight: isMatch ? 2.5 : 1,
      })
    })

    map.panTo({ lat: match.lat, lng: match.lng })
    map.setZoom(14)
  }

  // GoogleMap only mounts after both isLoaded and !storesLoading, so by the
  // time onLoad fires storesRef.current is already populated.
  const onLoad = useCallback((map) => {
    mapRef.current = map
    addMarkers(map, filters)
  }, [])

  useEffect(() => {
    if (mapRef.current) addMarkers(mapRef.current, filters)
  }, [filters.state, filters.rep, filters.client])

  useEffect(() => {
    if (mapRef.current) applySearch(mapRef.current, search)
  }, [search])

  if (loadError) return <div className="map-error">Failed to load Google Maps</div>
  if (!isLoaded || storesLoading) return <div className="map-loading">Loading map…</div>

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
