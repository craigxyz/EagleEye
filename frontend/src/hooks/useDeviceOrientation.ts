import { useState, useEffect } from 'react';

// Extend the global Window interface for browsers that have this specific permission API
declare global {
  interface Window {
    DeviceOrientationEvent?: {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
  }
}

export const useDeviceOrientation = () => {
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        // The compass heading in degrees (0-360)
        setHeading(360 - event.alpha); 
      }
    };

    const requestPermission = async () => {
      if (typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
        // This is for iOS 13+
        try {
          const permissionState = await window.DeviceOrientationEvent.requestPermission();
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          } else {
            setError('Permission denied for device orientation.');
          }
        } catch (err) {
          setError('Error requesting device orientation permission.');
        }
      } else {
        // For other browsers
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    requestPermission();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  return { heading, error };
}; 