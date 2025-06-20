import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  styled,
  IconButton,
} from '@mui/material';
import {
  BatteryChargingFull,
  BatteryFull,
  SignalWifi4Bar,
  SignalWifiStatusbarConnectedNoInternet4,
  SignalWifiOff,
  GpsFixed,
  GpsNotFixed,
  Settings as SettingsIcon,
  Explore,
} from '@mui/icons-material';
import { ConnectionStatus } from '../hooks/useDetections';

const DRAWER_WIDTH = 360;

interface InfoPanelProps {
  trackCount: number;
  connectionStatus: ConnectionStatus;
  batteryStatus: {
    charging: boolean;
    level: number;
    supported: boolean;
  };
  gpsStatus: {
    hasLocation: boolean;
    accuracy: number | null;
  };
  isMinimapVisible: boolean;
  onToggleMinimap: (visible: boolean) => void;
  isPanelOpen: boolean;
  locationError: string | null;
  onOpenSettings: () => void;
  heading: number | null;
  orientationError: string | null;
}

const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'isPanelOpen',
})<{ isPanelOpen?: boolean }>(({ theme, isPanelOpen }) => ({
  position: 'fixed',
  bottom: 20,
  right: 20,
  zIndex: 1000,
  width: 320,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(5px)',
  color: theme.palette.common.white,
  pointerEvents: 'auto',
  transition: theme.transitions.create('transform', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  transform: isPanelOpen ? `translateX(-${DRAWER_WIDTH}px)` : 'none',
}));

const InfoRow = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
});

const ConnectionIndicator = ({ status }: { status: ConnectionStatus }) => {
  if (status === 'open') {
    return <Chip icon={<SignalWifi4Bar />} label="Connected" color="success" size="small" variant="outlined" />;
  }
  if (status === 'connecting') {
    return <Chip icon={<SignalWifiStatusbarConnectedNoInternet4 />} label="Connecting" color="warning" size="small" variant="outlined" />;
  }
  return <Chip icon={<SignalWifiOff />} label="Disconnected" color="error" size="small" variant="outlined" />;
};

const BatteryIndicator = ({ batteryStatus }: { batteryStatus: InfoPanelProps['batteryStatus'] }) => {
  if (!batteryStatus.supported) {
    return <Typography variant="body2">Battery API not supported</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {batteryStatus.charging ? <BatteryChargingFull sx={{ mr: 1 }} /> : <BatteryFull sx={{ mr: 1 }} />}
      <LinearProgress
        variant="determinate"
        value={batteryStatus.level}
        sx={{ flexGrow: 1, mr: 1, height: 8, borderRadius: 4 }}
        color={batteryStatus.level > 20 ? 'success' : 'error'}
      />
      <Typography variant="body2">{batteryStatus.level.toFixed(0)}%</Typography>
    </Box>
  );
};

const GpsIndicator = ({ gpsStatus, locationError }: { gpsStatus: InfoPanelProps['gpsStatus'], locationError: string | null }) => {
  if (locationError) {
    return <Chip icon={<GpsNotFixed />} label="GPS Error" color="error" size="small" variant="outlined" />;
  }
  if (!gpsStatus.hasLocation) {
    return <Chip icon={<GpsNotFixed />} label="No GPS Signal" color="warning" size="small" variant="outlined" />;
  }
  return <Chip icon={<GpsFixed />} label={`GPS Acc: ${gpsStatus.accuracy?.toFixed(1)}m`} color="success" size="small" variant="outlined" />;
}

const InfoPanel: React.FC<InfoPanelProps> = ({
  trackCount,
  connectionStatus,
  batteryStatus,
  gpsStatus,
  isMinimapVisible,
  onToggleMinimap,
  isPanelOpen,
  locationError,
  onOpenSettings,
  heading,
  orientationError,
}) => {
  return (
    <StyledCard isPanelOpen={isPanelOpen}>
      <CardContent>
        <InfoRow>
          <Typography variant="body2">Connection:</Typography>
          <ConnectionIndicator status={connectionStatus} />
        </InfoRow>
        <InfoRow>
          <Typography variant="body2">GPS:</Typography>
          <GpsIndicator gpsStatus={gpsStatus} locationError={locationError} />
        </InfoRow>
        <InfoRow>
          <Typography variant="body2">Active Tracks:</Typography>
          <Typography variant="h6" component="span">{trackCount}</Typography>
        </InfoRow>
        {batteryStatus.supported && (
          <InfoRow>
            <Typography variant="body2">Battery:</Typography>
            <Box sx={{ width: '60%' }}>
              <BatteryIndicator batteryStatus={batteryStatus} />
            </Box>
          </InfoRow>
        )}
        <InfoRow>
          <Typography variant="body2">Compass:</Typography>
          <Chip icon={<Explore />} label={heading ? `${heading.toFixed(0)}°` : '...'} size="small" variant="outlined" />
        </InfoRow>
        <Divider sx={{ my: 1, backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormControlLabel
            control={<Switch checked={isMinimapVisible} onChange={(e) => onToggleMinimap(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Show Minimap</Typography>}
            labelPlacement="start"
            sx={{ m: 0 }}
          />
          <IconButton onClick={onOpenSettings} size="small">
            <SettingsIcon sx={{ color: 'white' }}/>
          </IconButton>
        </Box>
      </CardContent>
    </StyledCard>
  );
};

export default InfoPanel; 