import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// Define the shape of your settings
interface Settings {
  boxColor: string;
  boxThickness: number;
  confidenceThreshold: number;
  showLabels: boolean;
  showTrails: boolean;
}

// Define the shape of the context
interface SettingsContextProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const SETTINGS_KEY = 'eagleeye-settings';

const defaultSettings: Settings = {
  boxColor: '#34D399', // Emerald green
  boxThickness: 2,
  confidenceThreshold: 0,
  showLabels: true,
  showTrails: true,
};

// Create the context with a default value
const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

// Create the provider component
export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const storedSettings = window.localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        // Make sure stored settings have all keys from default settings
        const parsed = JSON.parse(storedSettings);
        return { ...defaultSettings, ...parsed };
      }
    } catch (error) {
      console.error("Error reading settings from localStorage", error);
    }
    return defaultSettings;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error writing settings to localStorage", error);
    }
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

// Create a custom hook for easy access to the context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}; 