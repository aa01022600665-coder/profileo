export const ANDROID_ENABLED = import.meta.env.VITE_ENABLE_ANDROID === 'true'

export const OS_OPTIONS = ANDROID_ENABLED
  ? ['Windows', 'MacOS', 'Linux', 'Android', 'iOS']
  : ['Windows', 'MacOS', 'Linux', 'iOS']

export function normalizeOs(os) {
  if (!ANDROID_ENABLED && os === 'Android') return 'Windows'
  return os || 'Windows'
}

export function isAndroidFolder(folder) {
  const id = String(folder?.id || '').trim().toLowerCase()
  const name = String(folder?.name || '').trim().toLowerCase()
  return id === 'android' || name === 'android'
}

export function getVisibleFolders(folders) {
  if (ANDROID_ENABLED) return folders
  return folders.filter(folder => !isAndroidFolder(folder))
}

export function getVisibleProfiles(profiles) {
  if (ANDROID_ENABLED) return profiles
  return profiles.filter(profile => profile.os !== 'Android')
}
