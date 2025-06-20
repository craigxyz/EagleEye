import React from 'react';
import { Box } from '@mui/material';

const EagleEyeLogo: React.FC<{ sx?: object }> = ({ sx }) => {
  return (
    <Box sx={{ ...sx, display: 'flex', alignItems: 'center' }}>
      <img src="/logo.png" alt="EagleEye Logo" style={{ height: '32px' }} />
    </Box>
  );
};

export default EagleEyeLogo; 