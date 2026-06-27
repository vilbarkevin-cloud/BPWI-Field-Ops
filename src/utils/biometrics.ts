export async function isBiometricAvailable() {
  if (window.PublicKeyCredential) {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }
  return false;
}

export async function registerBiometric(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: "BPWI Field Ops",
        id: window.location.hostname
      },
      user: {
        id: userId,
        name: email,
        displayName: email
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required"
      },
      timeout: 60000,
    };

    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
    if (credential) {
      localStorage.setItem(`biometricAuth_${email}`, btoa(String.fromCharCode(...new Uint8Array(credential.rawId))));
      return { success: true };
    }
    return { success: false, error: "Failed to create credential" };
  } catch (error: any) {
    let errorMessage = error.message || "An unknown error occurred";
    if (errorMessage.includes("publickey-credentials-create") || errorMessage.includes("cross-origin child frames")) {
      errorMessage = "Biometric authentication is not supported in this preview iframe. Please open the app in a new tab to enable it.";
      console.warn("Biometric registration skipped in iframe preview:", errorMessage);
    } else {
      console.error("Biometric registration failed:", error);
    }
    return { success: false, error: errorMessage };
  }
}

export async function verifyBiometric(email: string) {
  try {
    const rawIdStr = localStorage.getItem(`biometricAuth_${email}`);
    if (!rawIdStr) return false;

    const rawId = Uint8Array.from(atob(rawIdStr), c => c.charCodeAt(0));
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [{
        id: rawId,
        type: "public-key"
      }],
      userVerification: "required",
      timeout: 60000,
      rpId: window.location.hostname
    };

    const credential = await navigator.credentials.get({ publicKey });
    return !!credential;
  } catch (error: any) {
    if (error.message && (error.message.includes("publickey-credentials-get") || error.message.includes("cross-origin child frames"))) {
        console.warn("Biometric verification skipped in iframe preview:", error.message);
        alert("Biometric authentication is not supported in this preview iframe. Please open the app in a new tab to login with biometrics.");
    } else {
        console.error("Biometric verification failed:", error);
    }
    return false;
  }
}

export function hasBiometricEnrolled(email: string) {
  return !!localStorage.getItem(`biometricAuth_${email}`);
}
