'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'

interface GoogleMapProps {
  latitude: number
  longitude: number
  name: string
  address: string
  zoom?: number
  height?: string
}

export function GoogleMap({
  latitude,
  longitude,
  name,
  address,
  zoom = 15,
  height = '400px'
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Verificar se Google Maps já está carregado
    if (typeof window !== 'undefined' && window.google?.maps) {
      initializeMap()
      return
    }

    // Aguardar carregamento do script
    const checkGoogleMaps = setInterval(() => {
      if (window.google?.maps) {
        clearInterval(checkGoogleMaps)
        initializeMap()
      }
    }, 100)

    // Timeout após 10 segundos
    setTimeout(() => {
      clearInterval(checkGoogleMaps)
      if (!window.google?.maps) {
        setError('Falha ao carregar Google Maps')
      }
    }, 10000)

    return () => clearInterval(checkGoogleMaps)
  }, [latitude, longitude])

  function initializeMap() {
    if (!mapRef.current || !window.google?.maps) return

    try {
      const position = { lat: latitude, lng: longitude }

      // Criar mapa
      const map = new window.google.maps.Map(mapRef.current, {
        center: position,
        zoom,
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      })

      // Criar marcador customizado
      new window.google.maps.Marker({
        position,
        map,
        title: name,
        animation: window.google.maps.Animation.DROP,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="20" fill="#667eea" opacity="0.2"/>
              <circle cx="24" cy="24" r="16" fill="#667eea"/>
              <path d="M24 14C19.6 14 16 17.6 16 22C16 27 24 34 24 34C24 34 32 27 32 22C32 17.6 28.4 14 24 14ZM24 24.5C22.6 24.5 21.5 23.4 21.5 22C21.5 20.6 22.6 19.5 24 19.5C25.4 19.5 26.5 20.6 26.5 22C26.5 23.4 25.4 24.5 24 24.5Z" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(48, 48),
          anchor: new window.google.maps.Point(24, 24)
        }
      })

      // InfoWindow com endereço
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; font-family: system-ui, sans-serif;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #333;">${name}</h3>
            <p style="margin: 0; font-size: 14px; color: #666;">${address}</p>
          </div>
        `
      })

      // Abrir InfoWindow ao clicar no marcador
      const marker = new window.google.maps.Marker({
        position,
        map
      })

      marker.addListener('click', () => {
        infoWindow.open(map, marker)
      })

      setMapLoaded(true)
    } catch (err: any) {
      console.error('Error initializing map:', err)
      setError(err.message)
    }
  }

  function getDirectionsUrl(): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <MapPin className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        ref={mapRef}
        className="w-full rounded-lg overflow-hidden shadow-md"
        style={{ height }}
      >
        {!mapLoaded && (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-3"></div>
              <p className="text-gray-600">Carregando mapa...</p>
            </div>
          </div>
        )}
      </div>

      {mapLoaded && (
        <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex-1">
            <div className="flex items-start gap-2">
              <MapPin className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{name}</p>
                <p className="text-sm text-gray-600">{address}</p>
              </div>
            </div>
          </div>

          <a
            href={getDirectionsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
          >
            <Navigation className="w-4 h-4" />
            Como Chegar
          </a>
        </div>
      )}
    </div>
  )
}

declare global {
  interface Window {
    google: any
  }
}
