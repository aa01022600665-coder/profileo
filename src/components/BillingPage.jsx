import React, { useState, useEffect, useRef } from 'react'
import { saveBillingToCloud } from '../firebase'

// ===== CONSTANTS =====
const PLANS = [
  { id: 'mini', name: 'Mini', icon: '👤', desc: 'Best for individuals to manage personal accounts.', price: 5, profiles: 5 },
  { id: 'starter', name: 'Starter', icon: '🚀', desc: 'Best for small teams and professionals working with multiple accounts.', price: 9.99, profiles: 30 },
  { id: 'base', name: 'Base', icon: '⭐', desc: 'Best for growing teams to optimize team workflows.', price: 19.99, profiles: 100, recommended: true },
  { id: 'team', name: 'Team', icon: '👥', desc: 'Best for mid-sized teams to operate flexibly and scale efficiently.', price: 29.99, profiles: 300 },
  { id: 'business', name: 'Business', icon: '🏢', desc: 'Best for large teams managing a high number of accounts with full advanced features.', price: 69.99, profiles: 1000 },
]

const PERIODS = [
  { id: 'monthly', label: 'Monthly', months: 1, discount: 0 },
  { id: '3months', label: '3 Months', months: 3, discount: 0.20 },
  { id: '6months', label: '6 Months', months: 6, discount: 0.30 },
  { id: '12months', label: '12 Months', months: 12, discount: 0.50 },
]

const COMPARE_FEATURES = [
  { name: 'Browser Profiles', key: 'profiles', type: 'value' },
  { name: 'Automation Scripts', values: { mini: '5', starter: '15', base: 'Unlimited', team: 'Unlimited', business: 'Unlimited' }, type: 'custom' },
  { name: 'Team Members', values: { mini: '1', starter: '1', base: '3', team: '10', business: 'Unlimited' }, type: 'custom' },
  { name: 'Proxy Management', values: { mini: true, starter: true, base: true, team: true, business: true }, type: 'bool' },
  { name: 'Fingerprint Customization', values: { mini: true, starter: true, base: true, team: true, business: true }, type: 'bool' },
  { name: 'Cookie Management', values: { mini: false, starter: true, base: true, team: true, business: true }, type: 'bool' },
  { name: 'Cloud Sync', values: { mini: false, starter: false, base: true, team: true, business: true }, type: 'bool' },
  { name: 'API Access', values: { mini: false, starter: false, base: true, team: true, business: true }, type: 'bool' },
  { name: 'Priority Support', values: { mini: false, starter: false, base: false, team: true, business: true }, type: 'bool' },
  { name: 'Custom Integrations', values: { mini: false, starter: false, base: false, team: false, business: true }, type: 'bool' },
]

function BillingPage({ user, onPlanUpdated }) {
  const [billingTab, setBillingTab] = useState('plans')
  const [selectedPeriod, setSelectedPeriod] = useState('monthly')
  const [showCompare, setShowCompare] = useState(false)
  const [currentPlan, setCurrentPlan] = useState(null)
  const [paymentModal, setPaymentModal] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [paymentUrl, setPaymentUrl] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [planActivated, setPlanActivated] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    loadPlan()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const loadPlan = async () => {
    try {
      if (!user?.email) return
      const plan = await window.electronAPI.getBillingPlan(user.email)
      if (plan) {
        const now = new Date()
        const exp = new Date(plan.expirationDate)
        plan.isActive = now < exp
        setCurrentPlan(plan)
        // Sync existing plan to cloud for other devices
        if (plan.isActive) {
          saveBillingToCloud(user.email, plan).catch(() => {})
        }
      } else {
        setCurrentPlan(null)
      }
    } catch (e) { /* no plan */ }
  }

  const getDiscountedPrice = (basePrice, periodId) => {
    const period = PERIODS.find(p => p.id === periodId)
    return Math.round(basePrice * (1 - period.discount) * 100) / 100
  }

  const getTotalPrice = (basePrice, periodId) => {
    const period = PERIODS.find(p => p.id === periodId)
    return Math.round(basePrice * (1 - period.discount) * period.months * 100) / 100
  }

  const handleChoosePlan = async (plan) => {
    const period = PERIODS.find(p => p.id === selectedPeriod)
    const total = getTotalPrice(plan.price, selectedPeriod)
    setPaymentModal({ plan, period, total })
    setPaymentStatus('creating')
    setPaymentUrl('')
    setPaymentLoading(true)

    try {
      const orderId = `profileo-${plan.id}-${selectedPeriod}-${Date.now()}`
      const result = await window.electronAPI.createPayment({
        amount: total,
        currency: 'usd',
        orderId,
        description: `Profileo ${plan.name} Plan - ${period.label}`
      })

      if (result.invoice_url) {
        setPaymentUrl(result.invoice_url)
        setPaymentStatus('awaiting')
        // Start polling
        startPolling(result.id, plan, period, total)
      } else {
        setPaymentStatus('error')
      }
    } catch (e) {
      console.error('Payment creation failed:', e)
      setPaymentStatus('error')
    }
    setPaymentLoading(false)
  }

  const startPolling = (invoiceId, plan, period, total) => {
    if (pollRef.current) clearInterval(pollRef.current)

    const SUCCESS_STATUSES = ['confirmed', 'finished', 'sending', 'partially_paid', 'confirming']
    const FAIL_STATUSES = ['expired', 'failed', 'refunded']

    const activatePlan = async (paymentId) => {
      clearInterval(pollRef.current)
      pollRef.current = null
      setPaymentStatus('confirmed')
      const startDate = new Date().toISOString()
      const expDate = new Date()
      expDate.setMonth(expDate.getMonth() + period.months)
      const planData = {
        planId: plan.id,
        periodId: period.id,
        startDate,
        expirationDate: expDate.toISOString(),
        price: total,
        profileLimit: plan.profiles,
        paymentId: paymentId || invoiceId,
        isActive: true
      }
      await window.electronAPI.saveBillingPlan(user.email, planData)
      // Sync to cloud so other devices can see it
      await saveBillingToCloud(user.email, planData)
      setCurrentPlan(planData)
      setPlanActivated(true)
      if (onPlanUpdated) onPlanUpdated()
      // Always show the confirmed modal
      setPaymentModal({ plan, period, total })
      // Auto-hide success after 5 seconds
      setTimeout(() => setPlanActivated(false), 5000)
    }

    pollRef.current = setInterval(async () => {
      try {
        const result = await window.electronAPI.getPaymentStatus(invoiceId)
        console.log('Poll result:', JSON.stringify(result))

        // Check payments array
        if (result.data && result.data.length > 0) {
          const successPayment = result.data.find(p => SUCCESS_STATUSES.includes(p.payment_status))
          if (successPayment) {
            await activatePlan(String(successPayment.payment_id))
            return
          }
          const allFailed = result.data.every(p => FAIL_STATUSES.includes(p.payment_status))
          if (allFailed) {
            clearInterval(pollRef.current)
            pollRef.current = null
            setPaymentStatus('failed')
          }
        }

        // Also check invoice-level status from the response
        if (result.invoiceStatus && ['finished', 'confirmed', 'confirming', 'sending'].includes(result.invoiceStatus)) {
          await activatePlan(invoiceId)
          return
        }

        // Check payment_status at top level too
        if (result.payment_status && SUCCESS_STATUSES.includes(result.payment_status)) {
          await activatePlan(String(result.payment_id || invoiceId))
          return
        }
      } catch (e) {
        console.error('Poll error:', e)
      }
    }, 8000)
  }

  const closePaymentModal = () => {
    if (pollRef.current) {
      // Polling still running — keep it running in background, just hide modal
      setPaymentModal(null)
      setPaymentUrl('')
      // Don't clear paymentStatus or stop polling
      return
    }
    setPaymentModal(null)
    setPaymentStatus(null)
    setPaymentUrl('')
  }

  const isCurrentPlan = (planId) => {
    return currentPlan?.isActive && currentPlan?.planId === planId && currentPlan?.periodId === selectedPeriod
  }

  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState('')

  const restorePurchase = async () => {
    setRestoring(true)
    setRestoreMsg('')
    try {
      const result = await window.electronAPI.listPayments()
      if (result.data && result.data.length > 0) {
        // Find the most recent finished/confirmed payment with a profileo order
        const validPayment = result.data.find(p =>
          (p.payment_status === 'finished' || p.payment_status === 'confirmed' || p.payment_status === 'confirming' || p.payment_status === 'sending') &&
          p.order_id && p.order_id.startsWith('profileo-')
        )
        if (validPayment) {
          // Parse order_id: profileo-{planId}-{periodId}-{timestamp}
          const parts = validPayment.order_id.split('-')
          const planId = parts[1]
          const periodId = parts[2]
          const plan = PLANS.find(p => p.id === planId)
          const period = PERIODS.find(p => p.id === periodId)
          if (plan && period) {
            const createdAt = new Date(validPayment.created_at || validPayment.updated_at)
            const expDate = new Date(createdAt)
            expDate.setMonth(expDate.getMonth() + period.months)
            const planData = {
              planId: plan.id,
              periodId: period.id,
              startDate: createdAt.toISOString(),
              expirationDate: expDate.toISOString(),
              price: Math.round(plan.price * (1 - period.discount) * period.months * 100) / 100,
              profileLimit: plan.profiles,
              paymentId: String(validPayment.payment_id),
              isActive: new Date() < expDate
            }
            await window.electronAPI.saveBillingPlan(user.email, planData)
            await saveBillingToCloud(user.email, planData)
            setCurrentPlan(planData)
            if (onPlanUpdated) onPlanUpdated()
            setRestoreMsg(`Plan restored: ${plan.name} (${period.label})`)
          } else {
            setRestoreMsg('Payment found but plan could not be identified.')
          }
        } else {
          setRestoreMsg('No completed Profileo payments found.')
        }
      } else {
        setRestoreMsg('No payments found on this account.')
      }
    } catch (e) {
      console.error('Restore failed:', e)
      setRestoreMsg('Failed to check payments. Please try again.')
    }
    setRestoring(false)
  }

  // ===== RENDER =====
  return (
    <div className="billing-page">
      <div className="billing-page-header">
        <div className="billing-header-left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <h1>BILLING</h1>
        </div>
      </div>

      <div className="billing-layout">
        {/* Internal sub-nav tabs */}
        <div className="billing-sub-nav">
          <button className={`billing-sub-tab ${billingTab === 'plans' ? 'active' : ''}`} onClick={() => setBillingTab('plans')} title="Plans">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"/>
              <polyline points="12 3 20 9 12 15 4 9 12 3"/>
            </svg>
          </button>
          <button className={`billing-sub-tab ${billingTab === 'billing' ? 'active' : ''}`} onClick={() => setBillingTab('billing')} title="Billing Details">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
              <line x1="6" y1="15" x2="10" y2="15"/>
            </svg>
          </button>
        </div>

        <div className="billing-content">
          {billingTab === 'plans' && (
            <div className="billing-plans-content">
              <div className="billing-plans-header">
                <div>
                  <h2 className="billing-title">Choose a plan that fits</h2>
                  <p className="billing-subtitle">No contracts. No surprise fees.</p>
                </div>
                {/* Period Toggle */}
                <div className="period-toggle">
                  {PERIODS.map(p => (
                    <button
                      key={p.id}
                      className={`period-btn ${selectedPeriod === p.id ? 'active' : ''}`}
                      onClick={() => setSelectedPeriod(p.id)}
                    >
                      {p.label}
                      {p.discount > 0 && <span className="period-discount">-{p.discount * 100}%</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Cards */}
              <div className="plans-grid">
                {PLANS.map(plan => {
                  const monthlyPrice = getDiscountedPrice(plan.price, selectedPeriod)
                  const total = getTotalPrice(plan.price, selectedPeriod)
                  const period = PERIODS.find(p => p.id === selectedPeriod)
                  const isCurrent = isCurrentPlan(plan.id)

                  return (
                    <div key={plan.id} className={`plan-card ${plan.recommended ? 'plan-recommended' : ''} ${isCurrent ? 'plan-current' : ''}`}>
                      {plan.recommended && <div className="plan-badge">Recommended</div>}
                      <div className="plan-icon">{plan.icon}</div>
                      <h3 className="plan-name">{plan.name}</h3>
                      <div className="plan-price">
                        <span className="plan-price-amount">${monthlyPrice}</span>
                        <span className="plan-price-period">/Month</span>
                      </div>
                      <p className="plan-desc">{plan.desc}</p>
                      <div className="plan-features">
                        <div className="plan-feature">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          {plan.profiles} Browser Profiles
                        </div>
                      </div>
                      {isCurrent ? (
                        <button className="btn plan-btn plan-btn-current" disabled>Your plan</button>
                      ) : (
                        <button className="btn btn-primary plan-btn" onClick={() => handleChoosePlan(plan)}>Choose</button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Compare Plans Link */}
              <div className="compare-section">
                <button className="compare-link" onClick={() => setShowCompare(!showCompare)}>
                  Compare plans and features
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showCompare ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              </div>

              {/* Compare Table */}
              {showCompare && (
                <div className="compare-table-wrap">
                  <table className="compare-table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        {PLANS.map(p => <th key={p.id}>{p.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARE_FEATURES.map(feat => (
                        <tr key={feat.name}>
                          <td>{feat.name}</td>
                          {PLANS.map(plan => (
                            <td key={plan.id}>
                              {feat.type === 'value' ? (
                                <span>{plan[feat.key]}</span>
                              ) : feat.type === 'bool' ? (
                                feat.values[plan.id] ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                ) : (
                                  <span className="compare-cross">—</span>
                                )
                              ) : (
                                <span>{feat.values[plan.id]}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Flexible Plans */}
              <div className="flexible-section">
                <h2 className="flexible-title">Flexible plans</h2>
                <p className="flexible-subtitle">Customize your plan or share resources based on your specific requirements.</p>
                <div className="flexible-grid">
                  <div className="flex-plan-card">
                    <div className="flex-plan-header">
                      <div className="flex-plan-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                      </div>
                      <div>
                        <h3>Custom</h3>
                        <p className="flex-plan-desc">Full control with premium flexibility.</p>
                      </div>
                    </div>
                    <div className="flex-plan-features">
                      <span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Any profile quantity
                      </span>
                      <span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Using your own server
                      </span>
                      <span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Unlimited Shareable Profiles/Folders
                      </span>
                    </div>
                    <button className="btn btn-ghost flex-plan-btn">Contact us</button>
                  </div>

                  <div className="flex-plan-card">
                    <div className="flex-plan-header">
                      <div className="flex-plan-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                      </div>
                      <div>
                        <h3>Share</h3>
                        <div className="flex-plan-price">
                          <span className="flex-price-amount">$3</span>
                          <span className="flex-price-period"> /Month</span>
                        </div>
                        <p className="flex-plan-desc">Shared profiles access with essential features.</p>
                      </div>
                    </div>
                    <div className="flex-plan-features">
                      <span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Can't create new profiles
                      </span>
                      <span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Only work with shared profiles/folders
                      </span>
                      <span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Works as sub-account
                      </span>
                    </div>
                    <button className="btn btn-ghost flex-plan-btn">Contact us</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {billingTab === 'billing' && (
            <div className="billing-overview">
              {!currentPlan || !currentPlan.isActive ? (
                <div className="billing-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                  <p>No active plan</p>
                  <span>Choose a plan to get started</span>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button className="btn btn-primary" onClick={() => setBillingTab('plans')}>View Plans</button>
                    <button className="btn btn-ghost" onClick={restorePurchase} disabled={restoring}>
                      {restoring ? 'Checking...' : 'Restore Purchase'}
                    </button>
                  </div>
                  {restoreMsg && <span style={{ marginTop: 8, fontSize: 12, color: restoreMsg.includes('restored') ? 'var(--success)' : 'var(--text-muted)' }}>{restoreMsg}</span>}
                </div>
              ) : (
                <>
                  {/* Overview Card */}
                  <div className="billing-overview-row">
                    <div className="billing-due-card">
                      <span className="billing-due-label">Estimated Due:</span>
                      <span className="billing-due-amount">${currentPlan.price}</span>
                      <div className="billing-plan-meta">
                        <span>Your plan: <strong>{PLANS.find(p => p.id === currentPlan.planId)?.name}</strong></span>
                        <span className="billing-period-badge">{PERIODS.find(p => p.id === currentPlan.periodId)?.label}</span>
                      </div>
                      <span className="billing-exp-date">Expiration date: {new Date(currentPlan.expirationDate).toLocaleDateString()}</span>
                      <button className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', marginTop: 8 }} onClick={() => setBillingTab('plans')}>
                        Upgrade plan <span style={{ marginLeft: 4 }}>{'\u2197'}</span>
                      </button>
                    </div>

                    <div className="billing-payment-card">
                      <h3>Payment method</h3>
                      <div className="billing-payment-option active">
                        <input type="radio" checked readOnly />
                        <span>Pay with Crypto (NOWPayments)</span>
                      </div>
                    </div>
                  </div>

                  {/* Billing Details Table */}
                  <div className="billing-details-section">
                    <h3>Billing details</h3>
                    <p className="billing-details-hint">Including the price of your plan and sub-accounts (All fees included)</p>
                    <table className="billing-details-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Accounts (01)</th>
                          <th>Plan</th>
                          <th>Expiration date</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>1</td>
                          <td>
                            <div className="billing-user-info">
                              <div className="billing-user-avatar">{(user?.displayName || user?.email || 'U')[0].toUpperCase()}</div>
                              <div>
                                <div className="billing-user-name">{user?.displayName || 'User'} (You)</div>
                                <div className="billing-user-email">{user?.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>{PLANS.find(p => p.id === currentPlan.planId)?.name}</td>
                          <td>{new Date(currentPlan.expirationDate).toLocaleDateString()}</td>
                          <td>${currentPlan.price}</td>
                        </tr>
                        <tr className="billing-total-row">
                          <td></td>
                          <td><strong>Total</strong></td>
                          <td></td>
                          <td></td>
                          <td><strong>${currentPlan.price}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={closePaymentModal}>
          <div className="modal-box payment-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Payment — {paymentModal.plan.name} Plan ({paymentModal.period.label})</h3>
              <button className="modal-close" onClick={closePaymentModal}>{'\u2715'}</button>
            </div>
            <div className="modal-body">
              <div className="payment-summary">
                <div className="payment-summary-row">
                  <span>Plan</span>
                  <strong>{paymentModal.plan.name}</strong>
                </div>
                <div className="payment-summary-row">
                  <span>Period</span>
                  <strong>{paymentModal.period.label}</strong>
                </div>
                <div className="payment-summary-row payment-total-row">
                  <span>Total</span>
                  <strong>${paymentModal.total} USD</strong>
                </div>
              </div>

              {paymentStatus === 'creating' && (
                <div className="payment-status-box">
                  <div className="payment-spinner"></div>
                  <p>Creating payment...</p>
                </div>
              )}

              {paymentStatus === 'error' && (
                <div className="payment-status-box payment-error">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <p>Failed to create payment. Please try again.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => handleChoosePlan(paymentModal.plan)}>Retry</button>
                </div>
              )}

              {paymentStatus === 'awaiting' && paymentUrl && (
                <div className="payment-awaiting">
                  <p className="payment-instruction">Complete your payment using the button below. Your default browser will open with the payment page. We accept BTC, USDT, and 350+ other cryptocurrencies via NOWPayments.</p>
                  <button className="btn btn-primary payment-pay-btn" onClick={() => window.electronAPI.openExternal(paymentUrl)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Open Payment Page — ${paymentModal.total} USD
                  </button>
                  <div className="payment-waiting-indicator">
                    <div className="payment-spinner-sm"></div>
                    <span>Waiting for payment confirmation... (Do not close this window)</span>
                  </div>
                </div>
              )}

              {paymentStatus === 'confirmed' && (
                <div className="payment-status-box payment-success">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <p>Payment confirmed!</p>
                  <span>Your {paymentModal.plan.name} plan has been activated.</span>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={closePaymentModal}>Done</button>
                </div>
              )}

              {paymentStatus === 'failed' && (
                <div className="payment-status-box payment-error">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <p>Payment expired or failed.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => handleChoosePlan(paymentModal.plan)}>Try Again</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BillingPage
