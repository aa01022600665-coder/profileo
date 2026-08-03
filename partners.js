(() => {
  const slides = [...document.querySelectorAll('[data-partner-slide]')]
  const controls = [...document.querySelectorAll('[data-partner-direction]')]

  if (slides.length < 2 || controls.length === 0) return

  let activeIndex = slides.findIndex(slide => slide.classList.contains('is-active'))
  if (activeIndex < 0) activeIndex = 0

  const showSlide = nextIndex => {
    activeIndex = (nextIndex + slides.length) % slides.length

    slides.forEach((slide, index) => {
      const isActive = index === activeIndex
      slide.classList.toggle('is-active', isActive)
      slide.setAttribute('aria-hidden', String(!isActive))
    })
  }

  controls.forEach(control => {
    control.addEventListener('click', () => {
      const offset = control.dataset.partnerDirection === 'next' ? 1 : -1
      showSlide(activeIndex + offset)
    })
  })
})()
