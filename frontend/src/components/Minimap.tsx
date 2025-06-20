import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Location } from '../hooks/useGeolocation';
import { Track, Box as DetectionBox } from '../hooks/useDetections';
import { Icon } from 'leaflet';
import { Box, IconButton } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';

// Using raw SVG strings to avoid client-side crash with react-dom/server
const myLocationSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1976d2" width="32px" height="32px"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>`;
const fmdGoodSvg = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="28px" height="28px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

type MinimapProps = {
  userLocation: Location | null;
  tracks: Map<number, Track>;
  boxes: DetectionBox[];
  heading: number | null;
};

const userIcon = new Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(myLocationSvg)}`,
  iconSize: [32, 32],
});

const objectIcon = (color: string) => new Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(fmdGoodSvg(color))}`,
  iconSize: [28, 28],
});

const getColorForClass = (classId: number) => {
  const colors = ['#f44336', '#9c27b0', '#3f51b5', '#03a9f4', '#009688', '#8bc34a'];
  return colors[classId % colors.length];
};

const CustomZoomControl = () => {
  const map = useMap();
  return (
    <Box sx={{
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <IconButton size="small" sx={{ mb: 1, backgroundColor: 'rgba(25, 118, 210, 0.8)', '&:hover': { backgroundColor: 'rgba(25, 118, 210, 1)' } }} onClick={() => map.zoomIn()}>
        <Add sx={{ color: 'white' }} />
      </IconButton>
      <IconButton size="small" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.8)', '&:hover': { backgroundColor: 'rgba(25, 118, 210, 1)' } }} onClick={() => map.zoomOut()}>
        <Remove sx={{ color: 'white' }} />
      </IconButton>
    </Box>
  )
}

const Minimap: React.FC<MinimapProps> = ({ userLocation, tracks, boxes, heading }) => {
  const userMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (userMarkerRef.current && userMarkerRef.current.getElement() && heading !== null) {
      userMarkerRef.current.getElement()!.style.transform = `rotate(${heading}deg)`;
    }
  }, [heading]);

  if (!userLocation) {
    return (
      <div style={{ background: '#333', color: 'white', padding: '10px' }}>
        Getting location...
      </div>
    );
  }

  const trackMarkers = Array.from(tracks.values()).map(track => {
    const box = boxes.find(b => b[4] === track.id);
    if (!box) return null;

    // Approximate projection of video coordinates to map coordinates.
    // This assumes the user is facing North and uses a simple linear projection.
    const VIDEO_WIDTH = 640;
    const VIDEO_HEIGHT = 480;
    const HORIZONTAL_FOV = 60; // degrees

    const [_x1, y1, x2, _y2] = box;
    const boxCenterX = (x2 + _x1) / 2;
    const boxBottomY = y1;

    // Use device heading if available, otherwise default to North (0 degrees)
    const deviceHeadingRad = heading ? (heading * Math.PI) / 180 : 0;

    const angleFromCenterDeg = (boxCenterX / VIDEO_WIDTH - 0.5) * HORIZONTAL_FOV;
    const totalAngleRad = deviceHeadingRad - (angleFromCenterDeg * (Math.PI / 180));

    // Distance: objects higher in the frame are further away.
    const maxDistance = 70; // meters
    const minDistance = 5;  // meters
    const distance = maxDistance - ((boxBottomY / VIDEO_HEIGHT) * (maxDistance - minDistance));

    // Convert bearing and distance to a GPS offset
    const latOffset = (distance * Math.cos(totalAngleRad)) / 111111;
    const lngOffset = (distance * Math.sin(totalAngleRad)) / (111111 * Math.cos(userLocation.lat * Math.PI / 180));

    return {
      ...track,
      lat: userLocation.lat + latOffset,
      lng: userLocation.lng + lngOffset,
    };
  }).filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <MapContainer 
      key={`${userLocation.lat}-${userLocation.lng}`}
      center={[userLocation.lat, userLocation.lng]} 
      zoom={18} 
      style={{ height: '100%', width: '100%', backgroundColor: '#222' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
      />
      <CustomZoomControl />
      
      {userLocation && (
        <Marker 
          ref={userMarkerRef}
          position={[userLocation.lat, userLocation.lng]} 
          icon={userIcon}
        >
          <Popup>You are here</Popup>
        </Marker>
      )}

      {trackMarkers.map(track => (
        <Marker 
          key={track.id} 
          position={[track.lat, track.lng]} 
          icon={objectIcon(getColorForClass(track.class_id))}
        >
          <Popup>
            Track #{track.id} <br />
            Type: {track.class_name}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default React.memo(Minimap); 