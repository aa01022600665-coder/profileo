import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyD_R2lygZHw8TYLQXtmq1QuGbTSPRe1iCc",
  authDomain: "profileo-504cb.firebaseapp.com",
  projectId: "profileo-504cb",
  storageBucket: "profileo-504cb.firebasestorage.app",
  messagingSenderId: "14581108565",
  appId: "1:14581108565:web:7a172527c0247c45ef69dc",
  measurementId: "G-9LSTQCJ88W"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)

// Billing sync via Firestore
export async function saveBillingToCloud(email, planData) {
  try {
    const safeEmail = email.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    await setDoc(doc(db, 'billing', safeEmail), {
      ...planData,
      email: email.toLowerCase(),
      updatedAt: new Date().toISOString()
    })
    console.log('[Firestore] Billing plan saved to cloud')
    return true
  } catch (e) {
    console.error('[Firestore] Save billing failed:', e.message)
    return false
  }
}

export async function getBillingFromCloud(email) {
  try {
    const safeEmail = email.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    const snap = await getDoc(doc(db, 'billing', safeEmail))
    if (snap.exists()) {
      console.log('[Firestore] Billing plan loaded from cloud')
      return snap.data()
    }
    return null
  } catch (e) {
    console.error('[Firestore] Get billing failed:', e.message)
    return null
  }
}

export const GOOGLE_CLIENT_ID = '14581108565-vrfbmc1vql2qjm9rjaj93mebhd6e6322.apps.googleusercontent.com'

export default app
