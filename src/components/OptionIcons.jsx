import React from 'react'

export function OsOptionIcon({ os }) {
  const name = String(os || '').toLowerCase()

  if (name.includes('windows')) {
    return (
      <svg className="option-icon option-icon-windows" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 5.2l7.2-1v7H3v-6zM11.5 4L21 2.7v8.5h-9.5V4zM3 12.7h7.2v7.1L3 18.8v-6.1zM11.5 12.7H21v8.6l-9.5-1.3v-7.3z" fill="currentColor"/>
      </svg>
    )
  }

  if (name.includes('android')) {
    return (
      <svg className="option-icon option-icon-android" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 9h10v7.5c0 .83-.67 1.5-1.5 1.5h-7A1.5 1.5 0 017 16.5V9z" fill="currentColor"/>
        <path d="M8.5 7.8A3.9 3.9 0 0112 5.7a3.9 3.9 0 013.5 2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M9 4.3l1.1 1.9M15 4.3l-1.1 1.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="10.1" cy="7.8" r=".55" fill="#06101f"/>
        <circle cx="13.9" cy="7.8" r=".55" fill="#06101f"/>
        <path d="M5 10v5.3M19 10v5.3M10 18v2.8M14 18v2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    )
  }

  if (name.includes('ios')) {
    return (
      <svg className="option-icon option-icon-ios" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2.8" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M10.5 4.6h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="12" cy="18.6" r=".9" fill="currentColor"/>
      </svg>
    )
  }

  if (name.includes('mac')) {
    return (
      <svg className="option-icon option-icon-macos" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18.6 19.3c-.82 1.23-1.68 2.41-3.01 2.43-1.32.03-1.75-.78-3.25-.78-1.51 0-1.97.76-3.23.81-1.29.05-2.27-1.3-3.1-2.5-1.69-2.43-2.98-6.91-1.24-9.93.86-1.5 2.4-2.45 4.06-2.48 1.26-.02 2.47.86 3.24.86.78 0 2.23-1.05 3.75-.89.64.03 2.44.26 3.59 1.95-.09.06-2.14 1.26-2.12 3.76.03 2.98 2.62 3.98 2.65 3.99-.03.07-.41 1.42-1.34 2.78zM13 3.4c.72-.82 1.91-1.44 2.9-1.48.13 1.15-.34 2.32-1.03 3.14-.68.84-1.8 1.49-2.91 1.4-.15-1.13.4-2.31 1.04-3.06z" fill="currentColor"/>
      </svg>
    )
  }

  return (
    <svg className="option-icon option-icon-linux" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12.5 2C10 2 8.2 4.1 8.2 7c0 1.3.4 2.5 1 3.5L7 14c-.8 1-1.5 2.2-1.5 3.5 0 .8.3 1.5.8 2 .5.6 1.2 1 2 1.2.7.2 1.5.3 2.2.3h3c.7 0 1.5-.1 2.2-.3.8-.2 1.5-.6 2-1.2.5-.5.8-1.2.8-2 0-1.3-.7-2.5-1.5-3.5l-2.2-3.5c.6-1 1-2.2 1-3.5 0-2.9-1.8-5-4.3-5z" fill="currentColor"/>
      <circle cx="10.5" cy="6.5" r="1" fill="#152033"/>
      <circle cx="14.5" cy="6.5" r="1" fill="#152033"/>
      <path d="M10.5 9c0 0 .7 1.2 2 1.2s2-1.2 2-1.2" stroke="#152033" strokeWidth=".8" fill="none"/>
    </svg>
  )
}

export function BrowserOptionIcon({ browser }) {
  const name = String(browser || 'Chrome').toLowerCase()

  if (name.includes('edge')) {
    return (
      <svg className="option-icon option-icon-edge" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21.7 12.5c0 5.4-4.35 9.3-9.63 9.3-5.2 0-9.45-3.88-9.45-9.4 0-2.93 1.3-5.58 3.35-7.34 1.72-1.49 4-2.35 6.36-2.35 4.68 0 8.39 3.03 8.39 6.94 0 2.35-1.44 4.08-3.47 4.82-1.14.42-2.42.38-3.55-.1-1.08-.47-2.27-.2-3.08.68 1.22 1.22 3.07 1.83 5.05 1.57 2.65-.35 4.75-1.88 6.03-4.12z" fill="url(#edgeA)"/>
        <path d="M3.08 13.4c.32-5.78 4.95-10.5 10.33-10.5 4.39 0 7.85 2.86 7.85 6.63 0 2.16-1.23 3.88-3.2 4.65-.8-.76-1.9-1.18-3.15-1.18-1.32 0-2.4.43-3.36 1.08-.76.51-1.63.78-2.68.78-2.45 0-4.39-.63-5.79-1.46z" fill="url(#edgeB)"/>
        <path d="M21.15 9.14c0 2.7-2.27 4.66-5.32 4.66-1.4 0-2.72.42-3.65 1.18.77-1.52.54-3.13-.6-4.24-1.5-1.45-3.95-1.4-5.7-.27.94-4.53 4.01-7.57 7.7-7.57 4.32 0 7.57 2.66 7.57 6.24z" fill="url(#edgeC)"/>
        <path d="M20.73 13.65c-1.03 4.44-4.92 7.31-9.37 7.31-3.53 0-6.56-1.85-8.13-4.68 1.53 1.66 3.7 2.55 6.23 2.55 3.05 0 4.98-1.31 5.65-2.82 2.03.19 3.96-.49 5.62-2.36z" fill="url(#edgeD)"/>
        <defs>
          <linearGradient id="edgeA" x1="3" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0cc0ff"/>
            <stop offset="1" stopColor="#0fb67f"/>
          </linearGradient>
          <linearGradient id="edgeB" x1="4" y1="4" x2="18" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#35d6ff"/>
            <stop offset="1" stopColor="#0078d7"/>
          </linearGradient>
          <linearGradient id="edgeC" x1="10" y1="2.9" x2="18.8" y2="13.6" gradientUnits="userSpaceOnUse">
            <stop stopColor="#56e5ff"/>
            <stop offset="1" stopColor="#0971d4"/>
          </linearGradient>
          <linearGradient id="edgeD" x1="5" y1="16" x2="19" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0fb67f"/>
            <stop offset="1" stopColor="#0aa7cf"/>
          </linearGradient>
        </defs>
      </svg>
    )
  }

  if (name.includes('brave')) {
    return (
      <svg className="option-icon option-icon-brave" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 1.95l3.3 1.58 3.43.58 1.58 4.07-1.2 7.02L12 22.05 4.9 15.2 3.7 8.18l1.58-4.07 3.43-.58L12 1.95z" fill="url(#braveShield)"/>
        <path d="M8 7.2l2.04 1.2L12 5.96l1.96 2.44L16 7.2l.78 4.12-1.72 4.28L12 18.08 8.94 15.6l-1.72-4.28L8 7.2z" fill="#fff6ea"/>
        <path d="M9.15 10.95l1.45-.7.54 1.3-1.14.73-.85-1.33zM14.85 10.95l-1.45-.7-.54 1.3 1.14.73.85-1.33z" fill="#f26522"/>
        <path d="M10.55 14.18h2.9L12 15.35l-1.45-1.17z" fill="#f26522"/>
        <path d="M8.1 7.4L6.9 5.28l2.53.4M15.9 7.4l1.2-2.12-2.53.4" stroke="#8d3415" strokeWidth=".8" strokeLinecap="round" opacity=".62"/>
        <defs>
          <linearGradient id="braveShield" x1="5" y1="3" x2="18.5" y2="20.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff9b32"/>
            <stop offset=".5" stopColor="#f15b22"/>
            <stop offset="1" stopColor="#b93614"/>
          </linearGradient>
        </defs>
      </svg>
    )
  }

  if (name.includes('opera')) {
    return (
      <svg className="option-icon option-icon-opera" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse cx="12" cy="12" rx="8.35" ry="10.05" fill="url(#operaOuter)"/>
        <ellipse cx="12" cy="12" rx="4.45" ry="6.45" fill="#111827"/>
        <path d="M12 2.15c3.53 0 6.08 4.2 6.08 9.85S15.53 21.85 12 21.85c5.42 0 9.65-4.27 9.65-9.85S17.42 2.15 12 2.15z" fill="url(#operaSide)" opacity=".86"/>
        <defs>
          <linearGradient id="operaOuter" x1="5.4" y1="3.1" x2="18.4" y2="20.9" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff5264"/>
            <stop offset=".45" stopColor="#ff1736"/>
            <stop offset="1" stopColor="#a30019"/>
          </linearGradient>
          <linearGradient id="operaSide" x1="13" y1="2.3" x2="20.6" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff7c88"/>
            <stop offset="1" stopColor="#7b0017"/>
          </linearGradient>
        </defs>
      </svg>
    )
  }

  if (name.includes('yandex')) {
    return (
      <svg className="option-icon option-icon-yandex" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.6" fill="url(#yandexDisc)"/>
        <circle cx="12" cy="12" r="8.2" fill="#ffffff"/>
        <path d="M12.25 18.75h-2.18v-4.82L6.35 5.25h2.42l2.46 6.08 2.56-6.08h2.35l-3.89 8.73v4.77z" fill="#e31d1c"/>
        <defs>
          <linearGradient id="yandexDisc" x1="5" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff"/>
            <stop offset=".58" stopColor="#eceff5"/>
            <stop offset="1" stopColor="#c7cfdd"/>
          </linearGradient>
        </defs>
      </svg>
    )
  }

  return (
    <svg className="option-icon option-icon-chrome" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#fbbc05"/>
      <path d="M12 12h9.8A10 10 0 005.4 4.6L12 12z" fill="#ea4335"/>
      <path d="M12 12l-5 8.7A10 10 0 0021.8 12H12z" fill="#34a853"/>
      <path d="M12 12L5.4 4.6A10 10 0 007 20.7L12 12z" fill="#fbbc05"/>
      <circle cx="12" cy="12" r="4.2" fill="#4285f4" stroke="#fff" strokeWidth="1.6"/>
    </svg>
  )
}
