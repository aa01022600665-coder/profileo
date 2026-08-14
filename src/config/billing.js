export const BILLING_PLANS = [
  { id: 'mini', name: 'Mini', price: 5, profiles: 5 },
  { id: 'starter', name: 'Starter', price: 9.99, profiles: 30 },
  { id: 'base', name: 'Base', price: 19.99, profiles: 100 },
  { id: 'team', name: 'Team', price: 29.99, profiles: 300 },
  { id: 'business', name: 'Business', price: 69.99, profiles: 1000 },
]

export const BILLING_PERIODS = [
  { id: 'monthly', label: 'Monthly', months: 1, discount: 0 },
  { id: '3months', label: '3 Months', months: 3, discount: 0.20 },
  { id: '6months', label: '6 Months', months: 6, discount: 0.30 },
  { id: '12months', label: '12 Months', months: 12, discount: 0.50 },
]

export const PAYMENT_SUCCESS_STATUSES = ['confirmed', 'finished', 'sending', 'partially_paid', 'confirming']

export function getBillingPlan(planId) {
  return BILLING_PLANS.find(plan => plan.id === planId)
}

export function getBillingPeriod(periodId) {
  return BILLING_PERIODS.find(period => period.id === periodId)
}

export function getTotalPrice(basePrice, periodId) {
  const period = getBillingPeriod(periodId) || BILLING_PERIODS[0]
  return Math.round(basePrice * (1 - period.discount) * period.months * 100) / 100
}

export function buildProfileoOrderId(planId, periodId, user) {
  const owner = String(user?.uid || 'no_uid').replace(/[^a-zA-Z0-9_-]/g, '')
  return `profileo-${planId}-${periodId}-${owner}-${Date.now()}`
}

export function parseProfileoOrderId(orderId) {
  const value = String(orderId || '')
  if (!value.startsWith('profileo-') && !value.startsWith('profileo_')) return null

  const separator = value.startsWith('profileo_') ? '_' : '-'
  const parts = value.split(separator)
  if (parts.length < 4) return null

  return {
    planId: parts[1],
    periodId: parts[2],
    ownerId: parts.length >= 5 ? parts[3] : '',
    timestamp: parts.length >= 5 ? parts.slice(4).join(separator) : parts[3],
    legacy: parts.length < 5,
  }
}

function normalized(value) {
  return String(value || '').trim().toLowerCase()
}

export function paymentMatchesUser(payment, user) {
  const email = normalized(user?.email)
  const uid = String(user?.uid || '')
  const parsed = parseProfileoOrderId(payment?.order_id)

  if (parsed?.ownerId && uid && parsed.ownerId === uid) return true

  const paymentEmails = [
    payment?.customer_email,
    payment?.buyer_email,
    payment?.payer_email,
    payment?.email,
    payment?.order_email,
  ].map(normalized)

  if (email && paymentEmails.includes(email)) return true

  const description = normalized(payment?.order_description || payment?.description)
  if (email && description.includes(email)) return true

  return false
}

export function buildPlanDataFromPayment(payment, user) {
  const parsed = parseProfileoOrderId(payment?.order_id)
  if (!parsed) return null

  const plan = getBillingPlan(parsed.planId)
  const period = getBillingPeriod(parsed.periodId)
  if (!plan || !period) return null

  const start = new Date(payment?.created_at || payment?.updated_at || Date.now())
  if (Number.isNaN(start.getTime())) start.setTime(Date.now())

  const expiration = new Date(start)
  expiration.setMonth(expiration.getMonth() + period.months)

  return {
    planId: plan.id,
    periodId: period.id,
    startDate: start.toISOString(),
    expirationDate: expiration.toISOString(),
    price: Number(payment?.price_amount) || getTotalPrice(plan.price, period.id),
    profileLimit: plan.profiles,
    paymentId: String(payment?.payment_id || payment?.id || payment?.invoice_id || ''),
    orderId: payment?.order_id || '',
    accountEmail: normalized(user?.email),
    accountUid: user?.uid || '',
    isActive: new Date() < expiration,
    restoredFromPayment: true,
  }
}

export function findRestorablePayment(payments, user) {
  const sorted = [...(payments || [])].sort((a, b) => {
    const aTime = new Date(a?.created_at || a?.updated_at || 0).getTime()
    const bTime = new Date(b?.created_at || b?.updated_at || 0).getTime()
    return bTime - aTime
  })

  for (const payment of sorted) {
    if (!PAYMENT_SUCCESS_STATUSES.includes(payment?.payment_status)) continue
    if (!paymentMatchesUser(payment, user)) continue
    const plan = buildPlanDataFromPayment(payment, user)
    if (plan?.isActive) return plan
  }

  return null
}
