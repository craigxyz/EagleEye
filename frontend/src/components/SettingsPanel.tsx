import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  styled,
  IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useSettings } from '../contexts/SettingsContext';

interface SettingsPanelProps {
  onClose: () => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 1300, // Higher than the AppBar
  width: 400,
  backgroundColor: 'rgba(30, 30, 30, 0.9)',
  backdropFilter: 'blur(10px)',
  color: theme.palette.common.white,
}));

const ColorOption = styled(Box)<{ color: string; selected: boolean }>(({ theme, color, selected }) => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  backgroundColor: color,
  cursor: 'pointer',
  border: selected ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
  display: 'inline-block',
  margin: '0 8px',
}));

const colorOptions = ['#34D399', '#F87171', '#60A5FA', '#FBBF24', '#A78BFA'];

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const { settings, setSettings } = useSettings();

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <StyledCard>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Settings</Typography>
          <IconButton onClick={onClose} size="small">
            <Close sx={{ color: 'white' }}/>
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2, backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />

        <Box sx={{ mb: 2 }}>
          <Typography gutterBottom>Bounding Box Color</Typography>
          <Box>
            {colorOptions.map(color => (
              <ColorOption
                key={color}
                color={color}
                selected={settings.boxColor === color}
                onClick={() => handleSettingChange('boxColor', color)}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography gutterBottom>Bounding Box Thickness</Typography>
          <Slider
            value={settings.boxThickness}
            onChange={(_, value) => handleSettingChange('boxThickness', value)}
            aria-labelledby="thickness-slider"
            valueLabelDisplay="auto"
            step={0.5}
            min={1}
            max={10}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography gutterBottom>Confidence Threshold</Typography>
          <Slider
            value={settings.confidenceThreshold}
            onChange={(_, value) => handleSettingChange('confidenceThreshold', value)}
            aria-labelledby="confidence-slider"
            valueLabelDisplay="auto"
            step={0.05}
            min={0}
            max={1}
          />
        </Box>
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.showLabels}
              onChange={(e) => handleSettingChange('showLabels', e.target.checked)}
            />
          }
          label="Show Labels"
        />

        <FormControlLabel
          control={
            <Switch
              checked={settings.showTrails}
              onChange={(e) => handleSettingChange('showTrails', e.target.checked)}
            />
          }
          label="Show Trails"
        />

      </CardContent>
    </StyledCard>
  );
};

export default SettingsPanel; 