import React from 'react';
import { Track } from '../hooks/useDetections';
import { Box, Typography, Chip } from '@mui/material';

interface DetectionSummaryProps {
  tracks: Map<number, Track>;
}

const DetectionSummary: React.FC<DetectionSummaryProps> = ({ tracks }) => {
  const data = Array.from(tracks.values())
    .reduce((acc, track) => {
      const existing = acc.find(item => item.name === track.class_name);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({ name: track.class_name, count: 1 });
      }
      return acc;
    }, [] as { name: string; count: number }[]);

  if (data.length === 0) {
    return (
      <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">Awaiting detections...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      {data.map(item => (
        <Chip 
          key={item.name} 
          label={`${item.name}: ${item.count}`} 
          variant="outlined"
          size="small"
          sx={{ color: 'white' }}
        />
      ))}
    </Box>
  );
};

export default DetectionSummary; 