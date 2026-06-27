import { useEffect } from "react";
import { useWakeLock } from "./useWakeLock";

export function useWakeLockManager() {
  const { isSupported, requestWakeLock, releaseWakeLock } = useWakeLock();
  
  useEffect(() => {
    const handleSettingChange = () => {
      const isEnabled = localStorage.getItem('setting_keepScreenAwake') === 'true';
      if (isEnabled && isSupported) {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    };

    // Initial check
    handleSettingChange();

    // Listen for custom event when setting changes
    window.addEventListener('wakelock-setting-changed', handleSettingChange);
    
    // Also check on visibility change to re-acquire if lost
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleSettingChange();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('wakelock-setting-changed', handleSettingChange);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isSupported, requestWakeLock, releaseWakeLock]);
}
