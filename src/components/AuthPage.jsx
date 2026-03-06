import React, { useState, useEffect, useRef } from 'react'
import { auth, GOOGLE_CLIENT_ID } from '../firebase'
import appIcon from '../assets/icon.png'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCredential, GoogleAuthProvider, sendPasswordResetEmail, updateProfile, signOut } from 'firebase/auth'

function AuthPage({ onAuth, onPendingVerify }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  // Verification state
  const [verifyMode, setVerifyMode] = useState(false)
  const [verifyEmail, setVerifyEmail] = useState('')
  const [verifyPassword, setVerifyPassword] = useState('')
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifySuccess, setVerifySuccess] = useState('')
  const inputRefs = useRef([])

  // Timer countdown
  useEffect(() => {
    if (!verifyMode || canResend) return
    if (timer <= 0) {
      setCanResend(true)
      return
    }
    const interval = setInterval(() => setTimer(t => t - 1), 1000)
    return () => clearInterval(interval)
  }, [verifyMode, timer, canResend])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please fill in all fields'); return }
    setLoading(true)
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      onAuth(result.user)
    } catch (err) {
      switch (err.code) {
        case 'auth/invalid-email': setError('Invalid email address'); break
        case 'auth/user-not-found': setError('No account found with this email'); break
        case 'auth/wrong-password': setError('Incorrect password'); break
        case 'auth/invalid-credential': setError('Invalid email or password'); break
        case 'auth/too-many-requests': setError('Too many attempts. Try again later'); break
        default: setError(err.message)
      }
    }
    setLoading(false)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password || !name) { setError('Please fill in all fields'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    // Block auto-login during verification
    if (onPendingVerify) onPendingVerify(true)
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(result.user, { displayName: name })
      // Sign out — don't allow access until verified
      await signOut(auth)

      // Store credentials for after verification
      setVerifyEmail(email)
      setVerifyPassword(password)

      // Send verification code
      const res = await window.electronAPI.sendVerificationCode(email)
      if (res.success) {
        setVerifyMode(true)
        setTimer(60)
        setCanResend(false)
        setCodeDigits(['', '', '', '', '', ''])
        setVerifyError('')
        setVerifySuccess('')
      } else {
        // If email sending fails, still let user in
        if (onPendingVerify) onPendingVerify(false)
        setError('Could not send verification email: ' + (res.error || 'SMTP not configured'))
        const loginResult = await signInWithEmailAndPassword(auth, email, password)
        onAuth(loginResult.user)
      }
    } catch (err) {
      if (onPendingVerify) onPendingVerify(false)
      switch (err.code) {
        case 'auth/email-already-in-use': setError('This email is already registered'); break
        case 'auth/invalid-email': setError('Invalid email address'); break
        case 'auth/weak-password': setError('Password is too weak'); break
        default: setError(err.message)
      }
    }
    setLoading(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setResetSent(false)
    if (!email) { setError('Please enter your email address first'); return }
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setResetSent(true)
    } catch (err) {
      switch (err.code) {
        case 'auth/invalid-email': setError('Invalid email address'); break
        case 'auth/user-not-found': setError('No account found with this email'); break
        default: setError(err.message)
      }
    }
    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await window.electronAPI.googleAuth(GOOGLE_CLIENT_ID)
      const credential = GoogleAuthProvider.credential(null, result.accessToken)
      const firebaseResult = await signInWithCredential(auth, credential)
      onAuth(firebaseResult.user)
    } catch (err) {
      if (err.message !== 'Auth window closed') {
        setError(err.message || 'Google sign-in failed')
      }
    }
    setLoading(false)
  }

  // Code input handlers
  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return // Only digits
    const newDigits = [...codeDigits]
    newDigits[index] = value.slice(-1) // Only last char
    setCodeDigits(newDigits)
    setVerifyError('')

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleCodePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setCodeDigits(pasted.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  const handleVerify = async () => {
    const code = codeDigits.join('')
    if (code.length !== 6) { setVerifyError('Please enter the complete 6-digit code'); return }
    setLoading(true)
    setVerifyError('')
    try {
      const res = await window.electronAPI.verifyCode(verifyEmail, code)
      if (res.verified) {
        setVerifySuccess('Verified successfully!')
        // Clear pending flag and sign in
        setTimeout(async () => {
          try {
            if (onPendingVerify) onPendingVerify(false)
            const loginResult = await signInWithEmailAndPassword(auth, verifyEmail, verifyPassword)
            onAuth(loginResult.user)
          } catch (e) {
            setVerifyError('Verification succeeded but login failed. Please sign in manually.')
            setVerifyMode(false)
          }
        }, 800)
      } else {
        setVerifyError(res.error || 'Invalid code')
        setCodeDigits(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (e) {
      setVerifyError('Verification failed')
    }
    setLoading(false)
  }

  const handleResend = async () => {
    setVerifyError('')
    setVerifySuccess('')
    setLoading(true)
    try {
      const res = await window.electronAPI.sendVerificationCode(verifyEmail)
      if (res.success) {
        setTimer(60)
        setCanResend(false)
        setCodeDigits(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else {
        setVerifyError('Failed to resend code: ' + (res.error || ''))
      }
    } catch (e) {
      setVerifyError('Failed to resend code')
    }
    setLoading(false)
  }

  const windowControls = (
    <div className="auth-window-controls">
      <button className="win-btn" onClick={() => window.electronAPI.minimizeWindow()} title="Minimize">{'\u2500'}</button>
      <button className="win-btn" onClick={() => window.electronAPI.maximizeWindow()} title="Maximize">{'\u25A1'}</button>
      <button className="win-btn win-close" onClick={() => window.electronAPI.closeWindow()} title="Close">{'\u2715'}</button>
    </div>
  )

  // ===== VERIFICATION SCREEN =====
  if (verifyMode) {
    return (
      <div className="auth-page">
        {windowControls}
        <div className="auth-card">
          <div className="auth-logo">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="5" fill="#61dafb"/>
              <ellipse cx="32" cy="32" rx="28" ry="11" stroke="#61dafb" strokeWidth="2.5" fill="none"/>
              <ellipse cx="32" cy="32" rx="28" ry="11" stroke="#61dafb" strokeWidth="2.5" fill="none" transform="rotate(60 32 32)"/>
              <ellipse cx="32" cy="32" rx="28" ry="11" stroke="#61dafb" strokeWidth="2.5" fill="none" transform="rotate(120 32 32)"/>
            </svg>
            <h1>Profileo</h1>
          </div>

          <div className="verify-screen">
            <div className="verify-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4285f4" strokeWidth="1.5">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <polyline points="22,4 12,13 2,4"/>
              </svg>
            </div>
            <h2 className="verify-title">Verify Your Email</h2>
            <p className="verify-subtitle">
              We sent a 6-digit code to<br/>
              <strong>{verifyEmail}</strong>
            </p>

            {verifyError && <div className="auth-error">{verifyError}</div>}
            {verifySuccess && <div className="auth-success">{verifySuccess}</div>}

            <div className="verify-code-inputs" onPaste={handleCodePaste}>
              {codeDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="verify-code-input"
                  value={digit}
                  onChange={e => handleCodeChange(i, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button className="btn btn-primary auth-submit" onClick={handleVerify} disabled={loading || codeDigits.join('').length !== 6}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <div className="verify-timer">
              {canResend ? (
                <button className="verify-resend" onClick={handleResend} disabled={loading}>
                  Resend Code
                </button>
              ) : (
                <span>Resend code in <strong>{timer}s</strong></span>
              )}
            </div>

            <button type="button" className="auth-back-link" onClick={() => { setVerifyMode(false); setError(''); if (onPendingVerify) onPendingVerify(false) }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===== AUTH FORMS =====
  return (
    <div className="auth-page">
      {windowControls}
      <div className="auth-card">
        <div className="auth-logo">
          <img src={appIcon} alt="Profileo" style={{width: 48, height: 48, borderRadius: 12}} />
          <h1>Profileo</h1>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); setShowForgot(false) }}>Sign In</button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); setShowForgot(false) }}>Create Account</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {mode === 'login' && !showForgot ? (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="np-input" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" className="np-input" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="auth-forgot-row">
              <button type="button" className="auth-forgot-link" onClick={() => { setShowForgot(true); setError(''); setResetSent(false) }}>
                Forgot Password?
              </button>
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button type="button" className="auth-google-btn" onClick={handleGoogleSignIn} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          </form>
        ) : mode === 'login' && showForgot ? (
          <form onSubmit={handleForgotPassword} className="auth-form">
            {resetSent && (
              <div className="auth-success">
                Password reset email sent! Check your inbox.
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="np-input" placeholder="Enter your email address" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button type="button" className="auth-back-link" onClick={() => { setShowForgot(false); setError(''); setResetSent(false) }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back to Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="np-input" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label>Name</label>
              <input type="text" className="np-input" placeholder="Enter your name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" className="np-input" placeholder="Create a password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" className="np-input" placeholder="Re-enter your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button type="button" className="auth-google-btn" onClick={handleGoogleSignIn} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default AuthPage
