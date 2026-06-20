import React, {createContext, useContext} from "react";
import {useSettings} from "../hooks/useSettings";

type SettingsContextValue = ReturnType<typeof useSettings>;

const defaultSettings: SettingsContextValue = {
  isHapticsEnabled: true,
  isSoundEnabled: true,
  toggleHapticsEnabled: () => {},
  toggleSoundEnabled: () => {},
};

const SettingsContext = createContext<SettingsContextValue>(defaultSettings);

export const SettingsProvider = ({children}: {children: React.ReactNode}) => {
  const settings = useSettings();

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
};

export const useAppSettings = (): SettingsContextValue => {
  return useContext(SettingsContext);
};
