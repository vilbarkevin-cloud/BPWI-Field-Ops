import { useState, useEffect } from 'react';

export function useNetworkInfo() {
  const [isLowDataMode, setIsLowDataMode] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const updateConnectionStatus = () => {
        const type = connection.type || 'unknown';
        const effectiveType = connection.effectiveType || 'unknown';
        const saveData = connection.saveData === true;
        
        setConnectionType(type);
        
        if (saveData) {
          setIsLowDataMode(true);
        } else if (type && type !== 'wifi' && type !== 'ethernet' && type !== 'unknown') {
          setIsLowDataMode(true);
        } else if (effectiveType && (effectiveType === '2g' || effectiveType === '3g')) {
          setIsLowDataMode(true);
        } else {
          setIsLowDataMode(false);
        }
      };
      
      updateConnectionStatus();
      connection.addEventListener('change', updateConnectionStatus);
      return () => connection.removeEventListener('change', updateConnectionStatus);
    } else {
      // Fallback if Network Information API is not supported
      setIsLowDataMode(false);
    }
  }, []);

  return { isLowDataMode, connectionType };
}
