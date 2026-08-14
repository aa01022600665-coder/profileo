(function () {
  'use strict'

  const API_BASE = 'https://profileo-api.aa01022600665.workers.dev'
  const DOWNLOAD_URL = 'https://github.com/aa01022600665-coder/profileo/releases/latest/download/Profileo.Setup.1.3.6.exe'

  const PLANS = [
    { id: 'mini', name: 'Mini', price: 5, profiles: 5 },
    { id: 'starter', name: 'Starter', price: 9.99, profiles: 30 },
    { id: 'base', name: 'Base', price: 19.99, profiles: 100 },
    { id: 'team', name: 'Team', price: 29.99, profiles: 300 },
    { id: 'business', name: 'Business', price: 69.99, profiles: 1000 },
  ]

  const PERIODS = [
    { id: 'monthly', label: 'Monthly', months: 1, discount: 0 },
    { id: '3months', label: '3 Months', months: 3, discount: 0.20 },
    { id: '6months', label: '6 Months', months: 6, discount: 0.30 },
    { id: '12months', label: '12 Months', months: 12, discount: 0.50 },
  ]

  const SUCCESS_STATUSES = ['confirmed', 'finished', 'sending']
  const PROGRESS_STATUSES = ['confirming', 'partially_paid', 'waiting']
  const FAIL_STATUSES = ['expired', 'failed', 'refunded']

  let currentUser = null
  let selectedPeriod = 'monthly'
  let queuedPlanId = null
  let pollTimer = null
  let activePendingPayment = null

  const $ = (selector) => document.querySelector(selector)

  function getPeriod(periodId) {
    return PERIODS.find(period => period.id === periodId) || PERIODS[0]
  }

  function getPlan(planId) {
    return PLANS.find(plan => plan.id === planId)
  }

  function getTotalPrice(basePrice, periodId) {
    const period = getPeriod(periodId)
    return Math.round(basePrice * (1 - period.discount) * period.months * 100) / 100
  }

  function getMonthlyPrice(basePrice, periodId) {
    const period = getPeriod(periodId)
    return Math.round(basePrice * (1 - period.discount) * 100) / 100
  }

  function buildOrderId(planId, periodId) {
    const owner = String(currentUser?.uid || 'no_uid').replace(/[^a-zA-Z0-9_-]/g, '')
    return `profileo-${planId}-${periodId}-${owner}-${Date.now()}`
  }

  function pendingKey() {
    if (!currentUser?.uid) return null
    return `profileo_pending_payment_${currentUser.uid}`
  }

  function savePendingPayment(payment) {
    const key = pendingKey()
    if (!key) return
    localStorage.setItem(key, JSON.stringify(payment))
  }

  function loadPendingPayment() {
    const key = pendingKey()
    if (!key) return null
    try {
      return JSON.parse(localStorage.getItem(key) || 'null')
    } catch (_) {
      return null
    }
  }

  function clearPendingPayment() {
    const key = pendingKey()
    if (key) localStorage.removeItem(key)
  }

  async function callApi(path, body, method) {
    const user = firebase.auth().currentUser
    if (!user) throw new Error('Not logged in')
    const token = await user.getIdToken()
    const options = {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
    if (body !== undefined) options.body = JSON.stringify(body)
    const response = await fetch(`${API_BASE}${path}`, options)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
    return data
  }

  function showPaymentModal(html) {
    const overlay = $('#paymentOverlay')
    const content = $('#paymentContent')
    if (!overlay || !content) return
    overlay.classList.add('active')
    content.innerHTML = html
    const close = $('#paymentClose')
    if (close) close.addEventListener('click', hidePaymentModal)
  }

  function hidePaymentModal() {
    const overlay = $('#paymentOverlay')
    if (overlay) overlay.classList.remove('active')
  }

  function showError(message) {
    const status = $('.payment-status-area')
    if (status) status.innerHTML = `<div class="payment-error-msg">${message}</div>`
  }

  function formatStatus(status) {
    if (!status) return 'waiting'
    return String(status).replace(/_/g, ' ')
  }

  function renderCreating(plan, period, total) {
    showPaymentModal(`
      <div class="payment-header">
        <h3>Complete Payment</h3>
        <button class="auth-close" id="paymentClose">&times;</button>
      </div>
      <div class="payment-summary">
        <div class="payment-plan-name">${plan.name} Plan</div>
        <div class="payment-plan-detail">${plan.profiles} Browser Profiles &middot; ${period.label}</div>
        <div class="payment-price">$${getMonthlyPrice(plan.price, period.id)}<span>/mo</span></div>
        <div class="payment-total">Total: <strong>$${total}</strong></div>
        <div class="payment-total">Account: <strong>${currentUser.email}</strong></div>
      </div>
      <div class="payment-status-area">
        <div class="payment-spinner"></div>
        <p>Creating invoice...</p>
      </div>
    `)
  }

  function renderAwaiting(payment) {
    const status = $('.payment-status-area')
    if (!status) return
    status.innerHTML = `
      <a href="${payment.invoiceUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-block payment-open-btn" id="openPaymentBtn">
        Open Payment Page
      </a>
      <div class="payment-waiting" id="paymentWaiting">
        <div class="payment-spinner"></div>
        <p>Waiting for payment confirmation...</p>
        <span class="payment-live-status">Checking NOWPayments every few seconds</span>
        <p class="payment-hint">Keep this tab open, or return after payment. The same email must be used in Profileo: <strong>${currentUser.email}</strong></p>
      </div>
    `
  }

  function renderProgress(payment) {
    const waiting = $('#paymentWaiting')
    if (!waiting) return
    const status = formatStatus(payment?.payment_status || payment?.invoiceStatus || payment?.status)
    waiting.innerHTML = `
      <div class="payment-spinner"></div>
      <p>Payment detected. Confirming...</p>
      <span class="payment-live-status">NOWPayments status: ${status}</span>
      <p class="payment-hint">This usually completes automatically after the crypto network confirmation.</p>
    `
  }

  function renderSuccess(planData) {
    const plan = getPlan(planData.planId)
    const status = $('.payment-status-area') || $('#paymentContent')
    if (!status) return
    status.innerHTML = `
      <div class="payment-success">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="8 12 11 15 16 9"/>
        </svg>
        <h3>Payment Confirmed!</h3>
        <p>Your <strong>${plan?.name || planData.planId}</strong> plan is active for <strong>${currentUser.email}</strong>.</p>
        <p class="payment-hint">Download Profileo and sign in with this same email to activate the package.</p>
        <a href="${DOWNLOAD_URL}" class="btn btn-primary btn-block">Download Profileo</a>
      </div>
    `
  }

  async function activatePlan(payment, pending) {
    const plan = getPlan(pending.planId)
    const period = getPeriod(pending.periodId)
    if (!plan) throw new Error('Plan not found')

    const startDate = new Date().toISOString()
    const expiration = new Date()
    expiration.setMonth(expiration.getMonth() + period.months)

    const planData = {
      planId: plan.id,
      periodId: period.id,
      startDate,
      expirationDate: expiration.toISOString(),
      price: pending.total,
      profileLimit: plan.profiles,
      paymentId: String(payment?.payment_id || pending.invoiceId),
      invoiceId: pending.invoiceId,
      orderId: pending.orderId,
      accountEmail: currentUser.email.toLowerCase(),
      accountUid: currentUser.uid || '',
      isActive: true,
      source: 'web',
    }

    await callApi('/billing/save', {
      email: currentUser.email,
      uid: currentUser.uid,
      plan: planData,
    })

    clearPendingPayment()
    activePendingPayment = null
    renderSuccess(planData)
  }

  async function pollPayment(pending) {
    try {
      const result = await callApi(`/payments-by-invoice?invoiceId=${encodeURIComponent(pending.invoiceId)}`, undefined, 'GET')
      const payments = result.data || []
      const directStatus = result.payment_status || result.invoiceStatus || result.status
      const directPayment = directStatus ? {
        payment_status: directStatus,
        payment_id: result.payment_id || result.id || pending.invoiceId,
      } : null
      const success = payments.find(payment => SUCCESS_STATUSES.includes(payment.payment_status))
        || (directPayment && SUCCESS_STATUSES.includes(directPayment.payment_status) ? directPayment : null)
      if (success) {
        clearInterval(pollTimer)
        pollTimer = null
        await activatePlan(success, pending)
        return
      }
      const progress = payments.find(payment => PROGRESS_STATUSES.includes(payment.payment_status))
        || (directPayment && PROGRESS_STATUSES.includes(directPayment.payment_status) ? directPayment : null)
      if (progress) renderProgress(progress)
      if (payments.length > 0 && payments.every(payment => FAIL_STATUSES.includes(payment.payment_status))) {
        clearInterval(pollTimer)
        pollTimer = null
        activePendingPayment = null
        clearPendingPayment()
        showError('Payment expired or failed. Please try again.')
        return
      }
      if (directPayment && FAIL_STATUSES.includes(directPayment.payment_status)) {
        clearInterval(pollTimer)
        pollTimer = null
        activePendingPayment = null
        clearPendingPayment()
        showError('Payment expired or failed. Please try again.')
      }
    } catch (error) {
      console.error('Payment poll failed:', error)
    }
  }

  function startPolling(pending) {
    if (pollTimer) clearInterval(pollTimer)
    activePendingPayment = pending
    pollPayment(pending)
    pollTimer = setInterval(() => pollPayment(pending), 4000)
  }

  async function createCheckout(plan) {
    if (!currentUser) {
      queuedPlanId = plan.id
      const overlay = $('#authOverlay')
      const registerTab = $('#tabRegister')
      if (overlay) overlay.classList.add('active')
      if (registerTab) registerTab.click()
      return
    }

    const period = getPeriod(selectedPeriod)
    const total = getTotalPrice(plan.price, period.id)
    const orderId = buildOrderId(plan.id, period.id)
    renderCreating(plan, period, total)

    try {
      const result = await callApi('/create-invoice', {
        price_amount: total,
        price_currency: 'usd',
        order_id: orderId,
        order_description: `Profileo ${plan.name} Plan - ${period.label} - ${currentUser.email}`,
        success_url: `${window.location.origin}${window.location.pathname}?payment=success`,
        cancel_url: `${window.location.origin}${window.location.pathname}?payment=cancelled`,
      })

      if (result.error || !result.invoice_url) {
        showError(result.error || 'Failed to create payment. Please try again.')
        return
      }

      const pending = {
        invoiceId: result.id,
        invoiceUrl: result.invoice_url,
        orderId,
        planId: plan.id,
        periodId: period.id,
        total,
        email: currentUser.email,
        uid: currentUser.uid,
        createdAt: new Date().toISOString(),
      }
      savePendingPayment(pending)
      renderAwaiting(pending)
      startPolling(pending)
    } catch (error) {
      showError(`Failed to create payment: ${error.message}`)
    }
  }

  function restorePendingIfNeeded() {
    const pending = loadPendingPayment()
    if (!pending) return
    if (pending.email && currentUser?.email && pending.email.toLowerCase() !== currentUser.email.toLowerCase()) return

    const plan = getPlan(pending.planId)
    const period = getPeriod(pending.periodId)
    if (plan && period) renderCreating(plan, period, pending.total)
    renderAwaiting(pending)
    startPolling(pending)
  }

  function updatePlanButtons() {
    document.querySelectorAll('.price-card .btn-block').forEach((button) => {
      const planId = button.dataset.plan
      if (!planId) return
      const plan = getPlan(planId)
      if (!plan) return
      button.textContent = `Choose ${plan.name}`
      button.disabled = false
      button.classList.remove('btn-disabled')
    })
  }

  firebase.auth().onAuthStateChanged((user) => {
    currentUser = user
    updatePlanButtons()
    if (currentUser) {
      restorePendingIfNeeded()
      if (queuedPlanId) {
        const plan = getPlan(queuedPlanId)
        queuedPlanId = null
        if (plan) setTimeout(() => createCheckout(plan), 300)
      }
    }
  })

  document.querySelectorAll('.period-btn').forEach((button) => {
    button.addEventListener('click', () => {
      selectedPeriod = button.dataset.period || 'monthly'
    })
  })

  const paymentOverlay = $('#paymentOverlay')
  if (paymentOverlay) {
    paymentOverlay.addEventListener('click', (event) => {
      if (event.target === paymentOverlay) hidePaymentModal()
    })
  }

  window.addEventListener('focus', () => {
    if (activePendingPayment) pollPayment(activePendingPayment)
  })

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && activePendingPayment) pollPayment(activePendingPayment)
  })

  const planIds = ['mini', 'starter', 'base', 'team', 'business']
  document.querySelectorAll('.price-card').forEach((card, index) => {
    const plan = getPlan(planIds[index])
    const button = card.querySelector('.btn-block')
    if (!plan || !button) return
    button.dataset.plan = plan.id
    button.href = '#'
    button.addEventListener('click', (event) => {
      event.preventDefault()
      createCheckout(plan)
    })
  })
})()
