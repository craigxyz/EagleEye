import { useState, useEffect } from 'react';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

export const useBatteryStatus = () => {
  const [batteryStatus, setBatteryStatus] = useState({
    charging: false,
    level: 100,
    supported: true,
  });

  useEffect(() => {
    const navigatorWithBattery: NavigatorWithBattery = navigator;

    if (!navigatorWithBattery.getBattery) {
      setBatteryStatus(prev => ({ ...prev, supported: false }));
      return;
    }

    let battery: BatteryManager;

    const updateBatteryStatus = () => {
      setBatteryStatus({
        charging: battery.charging,
        level: battery.level * 100,
        supported: true,
      });
    };

    navigatorWithBattery.getBattery().then(bat => {
      battery = bat;
      updateBatteryStatus();

      bat.addEventListener('chargingchange', updateBatteryStatus);
      bat.addEventListener('levelchange', updateBatteryStatus);
    });

    return () => {
      if (battery) {
        battery.removeEventListener('chargingchange', updateBatteryStatus);
        battery.removeEventListener('levelchange', updateBatteryStatus);
      }
    };
  }, []);

  return batteryStatus;
}; 