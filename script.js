// Navbar scroll effect
const navbar = document.getElementById('navbar')
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40)
})

// Mobile menu
const mobileMenu = document.getElementById('mobileMenu')
const navLinks = document.getElementById('navLinks')
mobileMenu.addEventListener('click', () => {
  navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex'
  navLinks.style.position = 'absolute'
  navLinks.style.top = '70px'
  navLinks.style.left = '0'
  navLinks.style.right = '0'
  navLinks.style.background = 'rgba(6,6,15,.97)'
  navLinks.style.flexDirection = 'column'
  navLinks.style.padding = '24px'
  navLinks.style.gap = '20px'
  navLinks.style.borderBottom = '1px solid #1e1e3a'
})

// FAQ accordion
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement
    const wasOpen = item.classList.contains('open')
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'))
    if (!wasOpen) item.classList.add('open')
  })
})

// Pricing period toggle
const discounts = { monthly: 0, '3months': 0.20, '6months': 0.30, '12months': 0.50 }
const months = { monthly: 1, '3months': 3, '6months': 6, '12months': 12 }
const DOWNLOAD_FALLBACK_URL = 'https://github.com/aa01022600665-coder/profileo/releases/latest/download/Profileo.Setup.1.3.7.exe'
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/aa01022600665-coder/profileo/releases/latest'
let downloadFileName = 'Profileo.Setup.1.3.7.exe'

window.PROFILEO_DOWNLOAD_URL = DOWNLOAD_FALLBACK_URL
window.PROFILEO_DOWNLOAD_FILE_NAME = downloadFileName

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const period = btn.dataset.period
    const discount = discounts[period]
    const mo = months[period]
    document.querySelectorAll('.price-num').forEach(el => {
      const base = parseFloat(el.dataset.base)
      if (discount === 0) {
        el.textContent = Number.isInteger(base) ? base : base.toFixed(2)
      } else {
        el.textContent = Math.round(base * (1 - discount))
      }
    })
    document.querySelectorAll('.price-period').forEach(el => {
      el.textContent = period === 'monthly' ? '/mo' : `/${period.replace('months', 'mo')}`
    })
  })
})

// Keep download buttons pointed at the real latest GitHub release asset.
async function refreshDownloadLinks() {
  try {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!response.ok) return
    const release = await response.json()
    const asset = Array.isArray(release.assets)
      ? release.assets.find(item => /^Profileo\.Setup\.\d+\.\d+\.\d+\.exe$/.test(item.name))
      : null
    if (!asset || !asset.browser_download_url) return

    downloadFileName = asset.name
    window.PROFILEO_DOWNLOAD_URL = asset.browser_download_url
    window.PROFILEO_DOWNLOAD_FILE_NAME = asset.name
    document.querySelectorAll('a[href*="Profileo.Setup"]').forEach(link => {
      link.href = asset.browser_download_url
    })
  } catch (error) {
    console.warn('Could not refresh Profileo download link', error)
  }
}

refreshDownloadLinks()

// GA Download Event Tracking
document.querySelectorAll('a[href*="Profileo.Setup"]').forEach(link => {
  link.addEventListener('click', function() {
    if (typeof gtag === 'function') {
      gtag('event', 'download', {
        event_category: 'App',
        event_label: document.title,
        file_name: window.PROFILEO_DOWNLOAD_FILE_NAME || downloadFileName,
        page_location: window.location.href
      })
    }
  })
})

// Smooth reveal on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1'
      entry.target.style.transform = 'translateY(0)'
    }
  })
}, { threshold: 0.1 })

document.querySelectorAll('.feature-card, .price-card, .faq-item, .auto-content, .auto-visual').forEach(el => {
  el.style.opacity = '0'
  el.style.transform = 'translateY(20px)'
  el.style.transition = 'opacity 0.5s, transform 0.5s'
  observer.observe(el)
})
