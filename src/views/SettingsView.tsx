import React, { useState, useEffect } from "react";
import { MonitorPlay, Smartphone, Bell, Shield, Moon, Sun } from "lucide-react";
import { useWakeLock } from "../utils/useWakeLock";
import { haptics } from "../utils/haptics";

interface SettingsViewProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export function SettingsView({ isDarkMode, toggleTheme }: SettingsViewProps) {
  const { isSupported } = useWakeLock();
  
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(() => {
    return localStorage.getItem('setting_keepScreenAwake') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('setting_keepScreenAwake', keepAwakeEnabled.toString());
    window.dispatchEvent(new Event('wakelock-setting-changed'));
  }, [keepAwakeEnabled]);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24">
      <div className="mb-6">
        <h1 className="font-headline-md text-on-surface mb-2">Settings</h1>
        <p className="text-on-surface-variant text-body-md">Manage your application preferences and device settings.</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Appearance Settings */}
        <div className="bg-surface-container rounded-xl overflow-hidden border border-outline-variant shadow-sm">
          <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h2 className="font-label-lg font-semibold text-on-surface">Appearance</h2>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-on-surface">Dark Theme</p>
                <p className="text-sm text-on-surface-variant">Switch between light and dark modes.</p>
              </div>
              <button
                onClick={() => {
                  haptics.tap();
                  toggleTheme();
                }}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-primary' : 'bg-surface-variant'}`}
              >
                <div className={`w-4 h-4 rounded-full shadow-sm transform transition-transform ${isDarkMode ? 'translate-x-6 bg-on-primary' : 'translate-x-0 bg-on-surface-variant'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Device Settings */}
        <div className="bg-surface-container rounded-xl overflow-hidden border border-outline-variant shadow-sm">
          <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center gap-2">
            <MonitorPlay className="w-5 h-5 text-primary" />
            <h2 className="font-label-lg font-semibold text-on-surface">Device Features</h2>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <p className="font-medium text-on-surface">Keep Screen Awake</p>
                <p className="text-sm text-on-surface-variant">Prevent the screen from sleeping during active field inspections or data entry.</p>
                {!isSupported && (
                  <p className="text-xs text-error mt-1 font-medium">Your browser does not support this feature.</p>
                )}
              </div>
              <button
                disabled={!isSupported}
                onClick={() => {
                  haptics.tap();
                  setKeepAwakeEnabled(!keepAwakeEnabled);
                }}
                className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 disabled:opacity-50 ${keepAwakeEnabled ? 'bg-primary' : 'bg-surface-variant'}`}
              >
                <div className={`w-4 h-4 rounded-full shadow-sm transform transition-transform ${keepAwakeEnabled ? 'translate-x-6 bg-on-primary' : 'translate-x-0 bg-on-surface-variant'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
