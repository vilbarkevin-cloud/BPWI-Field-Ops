import React, { useState } from 'react';
import { Droplet, Lock, User, Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface LoginViewProps {
  onLogin: (username: string, uid: string) => void;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Trim values to avoid accidental trailing space issues (very common with autocomplete)
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedDisplayName = displayName.trim();

    if (!trimmedEmail || !trimmedPassword || (isSignUp && !trimmedDisplayName)) {
      setError('Please fill in all required fields');
      return;
    }

    if (isSignUp && trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoggingIn(true);
    try {
      if (isSignUp) {
        const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        let finalUsername = trimmedDisplayName;
        
        if (trimmedDisplayName.toLowerCase() === 'kevin vilbar' || trimmedDisplayName.toLowerCase() === 'admin' || trimmedDisplayName.toLowerCase() === 'kevin.vilbar') {
          finalUsername = 'Kevin Vilbar - Tech Head';
        }
        
        await updateProfile(userCred.user, { displayName: finalUsername });
        // onLogin(finalUsername, userCred.user.uid); handled by App.tsx
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        // onLogin(finalUsername, userCred.user.uid); handled by App.tsx
      }
    } catch (err: any) {
      console.error("Firebase Login Error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is disabled. Please go to Firebase Console -> Authentication -> Sign-in method and enable "Email/Password".');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email is already in use. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setError('The email address format is invalid.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password. If you do not have an account yet, please switch to the "Sign up" tab below.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please check your spelling or sign up.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please verify and try again.');
      } else {
        setError('Authentication failed: ' + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-[90%] max-w-[448px] min-w-[280px] bg-surface border border-outline-variant rounded-2xl shadow-lg p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary-container text-primary rounded-full flex items-center justify-center mb-4">
            <Droplet className="w-8 h-8" />
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">BPWI Field Ops</h1>
          <p className="text-on-surface-variant font-body-md mt-2">
            {isSignUp ? 'Create a new account' : 'Sign in to your account'}
          </p>
        </div>

        {error && (
          <div className="bg-error-container text-error p-3 rounded-lg mb-4 text-sm font-medium border border-error">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          {isSignUp && (
            <div>
              <label className="block text-label-md font-semibold text-on-surface-variant mb-1.5 flex items-center gap-2">
                <User className="w-4 h-4" /> Full Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Kevin Vilbar"
                className="form-input"
                autoFocus={isSignUp}
              />
            </div>
          )}

          <div>
            <label className="block text-label-md font-semibold text-on-surface-variant mb-1.5 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. kevin@example.com"
              className="form-input"
              autoFocus={!isSignUp}
            />
          </div>
          
          <div>
            <label className="block text-label-md font-semibold text-on-surface-variant mb-1.5 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isSignUp && (
              <p className="text-xs text-on-surface-variant mt-1.5 pl-1">
                Must be at least 6 characters
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full btn-primary py-3.5 mt-2"
          >
            {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {isLoggingIn ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="text-primary font-medium hover:underline text-sm"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
