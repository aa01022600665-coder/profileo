(() => {
  const carousel = document.querySelector('[data-partner-carousel]')
  if (!carousel) return

  const slides = [...carousel.querySelectorAll('[data-partner-slide]')]
  const controls = [...carousel.querySelectorAll('[data-partner-direction]')]
  const delay = 7000

  if (slides.length < 2 || controls.length === 0) return

  let activeIndex = slides.findIndex(slide => slide.classList.contains('is-active'))
  let autoAdvanceId
  let isPaused = false

  if (activeIndex < 0) activeIndex = 0

  const showSlide = nextIndex => {
    activeIndex = (nextIndex + slides.length) % slides.length

    slides.forEach((slide, index) => {
      const isActive = index === activeIndex
      slide.classList.toggle('is-active', isActive)
      slide.setAttribute('aria-hidden', String(!isActive))
    })
  }

  const stopAutoAdvance = () => {
    window.clearInterval(autoAdvanceId)
  }

  const startAutoAdvance = () => {
    stopAutoAdvance()
    autoAdvanceId = window.setInterval(() => {
      showSlide(activeIndex + 1)
    }, delay)
  }

  const pauseCarousel = () => {
    if (isPaused) return
    isPaused = true
    carousel.classList.add('is-paused')
    stopAutoAdvance()
  }

  const resumeCarousel = () => {
    if (!isPaused) return
    isPaused = false
    carousel.classList.remove('is-paused')
    startAutoAdvance()
  }

  controls.forEach(control => {
    control.addEventListener('click', () => {
      const offset = control.dataset.partnerDirection === 'next' ? 1 : -1
      showSlide(activeIndex + offset)
      startAutoAdvance()
    })
  })

  carousel.addEventListener('mouseenter', pauseCarousel)
  carousel.addEventListener('mouseleave', resumeCarousel)
  carousel.addEventListener('focusin', pauseCarousel)
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) resumeCarousel()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseCarousel()
    else resumeCarousel()
  })

  startAutoAdvance()
})()
