import React, { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { isBiometricAvailable, registerBiometric } from '../utils/biometrics';

interface BiometricSetupBannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  email: string | null;
}

export function BiometricSetupBanner({ isOpen, onClose, onSuccess, email }: BiometricSetupBannerProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    isBiometricAvailable().then(setIsSupported);
  }, []);

  if (!isOpen || !isSupported || !email) return null;

  const handleEnroll = async () => {
    setIsEnrolling(true);
    setErrorMsg(null);
    const result = await registerBiometric(email);
    setIsEnrolling(false);
    
    if (result.success) {
      onSuccess();
    } else {
      if (result.error?.includes('publickey-credentials-create')) {
        setErrorMsg("Your browser block this in preview mode. Try opening in a new tab.");
      } else {
        setErrorMsg(result.error || "Failed to enable biometric login.");
      }
    }
  };

  return (
    <div className="m-4 md:m-6 bg-surface-container-low border border-outline-variant rounded-xl shadow-sm overflow-hidden animate-in fade-in zoom-in duration-300 relative">
      <button 
        onClick={onClose}
        className="absolute right-3 top-3 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>
      
      <div className="p-4 md:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <div className="shrink-0 w-12 h-12 bg-primary-container text-primary rounded-full flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-lg font-semibold text-on-surface mb-1">Enable Biometric Login</h2>
          <p className="text-sm text-on-surface-variant mb-4">
            Use your fingerprint or face ID for faster, more secure logins to Field Ops.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              onClick={handleEnroll}
              disabled={isEnrolling}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 text-sm"
            >
              {isEnrolling ? 'Enrolling...' : 'Enable Now'}
            </button>
            <button 
              onClick={onClose}
              className="bg-surface-variant text-on-surface-variant px-4 py-2 rounded-lg font-semibold hover:bg-surface-variant/80 transition-colors text-sm"
            >
              Maybe Later
            </button>
          </div>
          
          {errorMsg && (
            <p className="text-xs text-error mt-3 font-medium">
              {errorMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
