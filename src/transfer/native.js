import { Capacitor, registerPlugin } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export const isAndroid = () => Capacitor.getPlatform() === 'android'
const ExportFile = registerPlugin('ExportFile')
async function base64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let result = ''
  for (let start = 0; start < bytes.length; start += 8192) result += String.fromCharCode(...bytes.subarray(start, start + 8192))
  return btoa(result)
}
export async function saveAndroidExport(file) {
  return ExportFile.save({ data: await base64(file), name: file.name, mimeType: file.type })
}
export async function shareAndroidExport(file) {
  const path = `exports/${Date.now()}-${file.name}`
  const saved = await Filesystem.writeFile({ path, directory: Directory.Cache, data: await base64(file), recursive: true })
  await Share.share({ title: 'Mes Comptes', files: [saved.uri], dialogTitle: 'Enregistrer ou partager l’export' })
  // File is in the app cache, not world-readable storage. Clean up previous exports
  // on the next invocation so receiving apps can finish reading this one.
  const listing = await Filesystem.readdir({ path: 'exports', directory: Directory.Cache })
  await Promise.all(listing.files.filter(entry => entry.name !== path.split('/').pop()).map(entry => Filesystem.deleteFile({ path: `exports/${entry.name}`, directory: Directory.Cache }).catch(() => {})))
}
