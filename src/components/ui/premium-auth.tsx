'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  KeyRound,
  Loader2,
} from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'reset';

interface AuthFormProps {
  onSuccess?: () => void;
  className?: string;
  initialMode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
  rememberMe: boolean;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreeToTerms?: string;
  general?: string;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
  const score = Object.values(requirements).filter(Boolean).length;
  const feedback: string[] = [];
  if (!requirements.length) feedback.push('At least 8 characters');
  if (!requirements.uppercase) feedback.push('One uppercase letter');
  if (!requirements.lowercase) feedback.push('One lowercase letter');
  if (!requirements.number) feedback.push('One number');
  if (!requirements.special) feedback.push('One special character');
  return { score, feedback };
}

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { score, feedback } = calculatePasswordStrength(password);
  if (!password) return null;

  const color =
    score <= 1 ? 'text-destructive' :
    score <= 2 ? 'text-orange-500' :
    score <= 3 ? 'text-yellow-500' :
    score <= 4 ? 'text-blue-500' : 'text-primary';

  const label =
    score <= 1 ? 'Very Weak' :
    score <= 2 ? 'Weak' :
    score <= 3 ? 'Fair' :
    score <= 4 ? 'Good' : 'Strong';

  return (
    <div className="mt-2 space-y-2 animate-in fade-in-50 slide-in-from-bottom-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full ${color} bg-current rounded-full transition-all duration-300`}
            style={{ width: `${(score / 5) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-16 text-right">{label}</span>
      </div>
      {feedback.length > 0 && (
        <div className="grid grid-cols-2 gap-1">
          {feedback.map((item, i) => (
            <div key={i} className="flex items-center gap-1 text-xs text-amber-500">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuthForm({ onSuccess, className, initialMode = 'login', onModeChange }: AuthFormProps) {
  const [supabase] = useState(() => createClient());
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    rememberMe: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validate = useCallback((field: keyof FormData, value: string | boolean): string => {
    switch (field) {
      case 'firstName':
        if (authMode === 'signup' && typeof value === 'string' && !value.trim())
          return 'First name is required';
        break;
      case 'lastName':
        if (authMode === 'signup' && typeof value === 'string' && !value.trim())
          return 'Last name is required';
        break;
      case 'email':
        if (!value) return 'Email is required';
        if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          return 'Please enter a valid email address';
        break;
      case 'password':
        if (!value) return 'Password is required';
        // No strength rules enforced here — Supabase is the source of truth.
        // If the password doesn't meet the project's policy, Supabase returns
        // a descriptive error that is shown in the general error banner.
        break;
      case 'confirmPassword':
        if (authMode === 'signup' && value !== formData.password)
          return 'Passwords do not match';
        break;
      case 'agreeToTerms':
        if (authMode === 'signup' && !value)
          return 'You must agree to the terms';
        break;
    }
    return '';
  }, [authMode, formData.password]);

  function handleChange(field: keyof FormData, value: string | boolean) {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const err = validate(field, value);
      setErrors(prev => ({ ...prev, [field]: err || undefined }));
    }
  }

  function handleBlur(field: keyof FormData) {
    setTouched(prev => ({ ...prev, [field]: true }));
    const err = validate(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: err || undefined }));
  }

  function validateAll(): boolean {
    const fields: (keyof FormData)[] =
      authMode === 'signup'
        ? ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'agreeToTerms']
        : authMode === 'reset'
        ? ['email']
        : ['email', 'password'];
    const newErrors: FormErrors = {};
    fields.forEach(f => {
      const err = validate(f, formData[f]);
      if (err) newErrors[f as keyof FormErrors] = err;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function switchMode(next: AuthMode) {
    setAuthMode(next);
    onModeChange?.(next);
    setErrors({});
    setSuccessMessage('');
    setTouched({});
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
      rememberMe: false,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;
    setIsLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      if (authMode === 'login') {
        // 1. Hit the API gate so server-side rate-limit increments.
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrors({ general: json.error ?? 'Sign-in failed. Please try again.' });
        } else {
          // 2. Run the actual sign-in on the client so onAuthStateChange fires
          //    and the header/UI updates without a hard refresh.
          const { error } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
          if (error) {
            setErrors({ general: error.message });
          } else {
            onSuccess?.();
          }
        }
      } else if (authMode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: `${formData.firstName} ${formData.lastName}`.trim(),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrors({ general: json.error ?? 'Signup failed. Please try again.' });
        } else {
          const fullName = `${formData.firstName} ${formData.lastName}`.trim();
          const { error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
              ...(fullName ? { data: { name: fullName } } : {}),
            },
          });
          if (error) {
            setErrors({ general: error.message });
          } else {
            setSuccessMessage('Account created! Check your email and spam folder to verify your account before signing in.');
          }
        }
      } else {
        // password reset
        const res = await fetch('/api/auth/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrors({ general: json.error ?? 'Reset failed. Please try again.' });
        } else {
          setSuccessMessage('Password reset email sent! Check your inbox and spam folder.');
          setTimeout(() => switchMode('login'), 3000);
        }
      }
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Password reset form ───────────────────────────────────────────────────
  if (authMode === 'reset') {
    return (
      <div className={cn("p-6 space-y-4 animate-in fade-in-50 slide-in-from-right-5", className)}>
        <div className="text-center mb-6">
          <KeyRound className="h-11 w-11 text-primary mx-auto mb-3" />
          <h3 className="text-xl font-semibold mb-1">Password Recovery</h3>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {errors.general && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {errors.general}
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                className={cn(
                  "w-full pl-10 pr-4 py-3 bg-muted/50 border rounded-xl text-sm placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                  errors.email ? "border-destructive" : "border-input"
                )}
              />
            </div>
            {errors.email && (
              <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{errors.email}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || !formData.email}
            className="w-full bg-primary text-primary-foreground font-medium py-3 px-6 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><KeyRound className="h-4 w-4" /> Send Reset Link</>}
          </button>
        </form>

        <div className="text-center">
          <button type="button" onClick={() => switchMode('login')} className="text-sm text-primary hover:text-primary/80 transition-colors">
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  // ── Main login / signup form ──────────────────────────────────────────────
  return (
    <div className={cn("p-6", className)}>
      {/* Mode tabs */}
      <div className="flex bg-muted rounded-xl p-1 mb-6 gap-1">
        {(['login', 'signup'] as AuthMode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150",
              authMode === m
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      {/* Global messages */}
      {errors.general && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />{errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4 animate-in fade-in-50 slide-in-from-right-5">
        {/* Name — signup only */}
        {authMode === 'signup' && (
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={e => handleChange('firstName', e.target.value)}
                  onBlur={() => handleBlur('firstName')}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-muted/50 border rounded-xl text-sm placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                    errors.firstName ? "border-destructive" : "border-input"
                  )}
                />
              </div>
              {errors.firstName && (
                <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />{errors.firstName}
                </p>
              )}
            </div>
            <div className="flex-1">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={e => handleChange('lastName', e.target.value)}
                  onBlur={() => handleBlur('lastName')}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-muted/50 border rounded-xl text-sm placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                    errors.lastName ? "border-destructive" : "border-input"
                  )}
                />
              </div>
              {errors.lastName && (
                <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />{errors.lastName}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Email */}
        <div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              autoComplete="email"
              className={cn(
                "w-full pl-10 pr-4 py-3 bg-muted/50 border rounded-xl text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                errors.email ? "border-destructive" : "border-input"
              )}
            />
          </div>
          {errors.email && (
            <p className="text-destructive text-xs mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />{errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={formData.password}
              onChange={e => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              onCopy={e => e.preventDefault()}
              onPaste={e => e.preventDefault()}
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              className={cn(
                "w-full pl-10 pr-12 py-3 bg-muted/50 border rounded-xl text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                errors.password ? "border-destructive" : "border-input"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-destructive text-xs mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />{errors.password}
            </p>
          )}
          {authMode === 'signup' && <PasswordStrengthIndicator password={formData.password} />}
        </div>

        {/* Confirm password — signup only */}
        {authMode === 'signup' && (
          <div>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={e => handleChange('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                onPaste={e => e.preventDefault()}
                autoComplete="new-password"
                className={cn(
                  "w-full pl-10 pr-12 py-3 bg-muted/50 border rounded-xl text-sm placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                  errors.confirmPassword ? "border-destructive" : "border-input"
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{errors.confirmPassword}
              </p>
            )}
          </div>
        )}

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          {authMode === 'login' ? (
            <>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={e => handleChange('rememberMe', e.target.checked)}
                  className="w-4 h-4 rounded border-input"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={e => handleChange('agreeToTerms', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-input"
              />
              <span className="text-sm text-muted-foreground">
                I agree to the{' '}
                <a href="#" className="text-primary hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              </span>
            </label>
          )}
        </div>

        {errors.agreeToTerms && (
          <p className="text-destructive text-xs flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />{errors.agreeToTerms}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "w-full bg-primary text-primary-foreground font-semibold py-3 px-6 rounded-xl",
            "hover:opacity-90 active:scale-[0.98] transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
        >
          {isLoading
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : authMode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
