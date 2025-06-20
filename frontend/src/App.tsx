import { useState } from 'react';
import React from 'react';
import VideoCanvas from './components/VideoCanvas';
import TrackBoard from './components/TrackBoard';
import { Menu as MenuIcon, Settings as SettingsIcon } from '@mui/icons-material';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  Backdrop,
  ButtonGroup,
  Button,
} from '@mui/material';
import { useDetections } from './hooks/useDetections';
import { useGeolocation } from './hooks/useGeolocation';
import { useBatteryStatus } from './hooks/useBatteryStatus';
import Minimap from './components/Minimap';
import InfoPanel from './components/InfoPanel';
import { useTheme } from '@mui/material/styles';
import EagleEyeLogo from './components/EagleEyeLogo';
import DetectionSummary from './components/DetectionSummary';
import SettingsPanel from './components/SettingsPanel';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';

const DRAWER_WIDTH = 360;

type ViewMode = 'fusion' | 'rgb' | 'thermal' | 'event';

function App() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('fusion');
  const { boxes, tracks, setTracks, connectionStatus, heatmap } = useDetections();
  const { location: userLocation, error: locationError } = useGeolocation();
  const batteryStatus = useBatteryStatus();
  const theme = useTheme();
  const { heading, error: orientationError } = useDeviceOrientation();

  const handleBoxClick = (id: number) => {
    setSelectedId(id);
    setIsPanelOpen(true);
  };

  const handleTrackSelect = (id: number | null) => {
    setSelectedId(id);
  };

  const handleTogglePanel = () => {
    setIsPanelOpen((prev) => !prev);
  };

  const handleImageCapture = (trackId: number, dataUrl: string) => {
    setTracks(prevTracks => {
      const newTracks = new Map(prevTracks);
      const track = newTracks.get(trackId);
      if (track && !track.image) {
        track.image = dataUrl;
      }
      return newTracks;
    });
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          ...(isPanelOpen && {
            width: `calc(100% - ${DRAWER_WIDTH}px)`,
            marginRight: `${DRAWER_WIDTH}px`,
          }),
        }}
      >
        <Toolbar>
          <EagleEyeLogo sx={{ mr: 2 }} />
          <Typography variant="h6" noWrap component="div" sx={{ flexShrink: 0 }}>
            EagleEye Live
          </Typography>
          <ButtonGroup variant="contained" aria-label="view switcher" sx={{ ml: 4 }}>
            <Button onClick={() => setViewMode('fusion')} variant={viewMode === 'fusion' ? 'contained' : 'outlined'}>Fusion</Button>
            <Button onClick={() => setViewMode('rgb')} variant={viewMode === 'rgb' ? 'contained' : 'outlined'}>RGB</Button>
            <Button onClick={() => setViewMode('thermal')} variant={viewMode === 'thermal' ? 'contained' : 'outlined'}>Thermal</Button>
            <Button onClick={() => setViewMode('event')} variant={viewMode === 'event' ? 'contained' : 'outlined'}>Event</Button>
          </ButtonGroup>
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            {['rgb', 'fusion'].includes(viewMode) && <DetectionSummary tracks={tracks} />}
          </Box>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleTogglePanel}
            sx={{
              position: 'fixed',
              top: 8,
              right: 16,
              zIndex: (theme) => theme.zIndex.drawer + 2,
            }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ position: 'relative', flexGrow: 1, height: '100%', width: '100%' }}>
        <Toolbar />
        <VideoCanvas 
          boxes={boxes} 
          tracks={tracks}
          onBoxClick={handleBoxClick} 
          onImageCapture={handleImageCapture}
          viewMode={viewMode}
          heatmap={heatmap}
        />
        
        {isMinimapVisible && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 20,
              left: 20,
              width: 300,
              height: 200,
              zIndex: 1000,
              border: '2px solid white',
              borderRadius: '4px',
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
          >
            <Minimap userLocation={userLocation} heading={heading} tracks={tracks} boxes={boxes} />
          </Box>
        )}
        
        <InfoPanel
          trackCount={tracks.size}
          connectionStatus={connectionStatus}
          batteryStatus={batteryStatus}
          gpsStatus={{
            hasLocation: !!userLocation,
            accuracy: userLocation ? 0 : null,
          }}
          isMinimapVisible={isMinimapVisible}
          onToggleMinimap={setIsMinimapVisible}
          isPanelOpen={isPanelOpen}
          locationError={locationError}
          onOpenSettings={() => setIsSettingsOpen(true)}
          heading={heading}
          orientationError={orientationError}
        />
      </Box>

      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={isSettingsOpen}
      >
        <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
      </Backdrop>
      
      <Drawer
        anchor="right"
        open={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', p: 2 }}>
          <TrackBoard
            tracks={tracks}
            selectedId={selectedId}
            onSelectTrack={handleTrackSelect}
          />
        </Box>
      </Drawer>
    </Box>
  );
}

export default App; 