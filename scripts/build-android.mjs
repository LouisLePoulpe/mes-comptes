import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const production = process.argv.includes('--production')
const file = 'android/app/google-services.json'
if (production) {
  if (!existsSync(file)) throw new Error('Configuration Firebase Android requise : android/app/google-services.json')
  const config = JSON.parse(readFileSync(file, 'utf8'))
  if (config.project_info?.project_id !== 'comptes-44440' || !config.client?.some(c => c.client_info?.android_client_info?.package_name === 'fr.louislepoulpe.mescomptes')) throw new Error('Le fichier Firebase ne correspond pas à cette application.')
}
const env = { ...process.env, VITE_NATIVE: 'true', VITE_V2_USE_PRODUCTION: String(production), VITE_ANDROID_CONFIGURED: String(production) }
const originalConfig = readFileSync('capacitor.config.json', 'utf8')
const config = JSON.parse(originalConfig)
// Without Firebase Android configuration, loading its native plugin would crash.
if (production) config.includePlugins.push('@capacitor-firebase/authentication')
try {
  writeFileSync('capacitor.config.json', JSON.stringify(config, null, 2))
  for (const args of [['vite', 'build'], ['cap', 'sync', 'android']]) {
    const result = spawnSync('npx', args, { env, stdio: 'inherit', shell: process.platform === 'win32' })
    if (result.status !== 0) throw new Error(`Android preparation failed (${result.status})`)
  }
} finally { writeFileSync('capacitor.config.json', originalConfig) }
