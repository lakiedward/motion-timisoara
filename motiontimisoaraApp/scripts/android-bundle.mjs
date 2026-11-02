import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const androidDir = join(appDir, 'android')
const windows = process.platform === 'win32'
const skipWeb = process.argv.includes('--skip-web')
const signingKeys = {
  storeFile: 'MT_UPLOAD_STORE_FILE',
  storePassword: 'MT_UPLOAD_STORE_PASSWORD',
  keyAlias: 'MT_UPLOAD_KEY_ALIAS',
  keyPassword: 'MT_UPLOAD_KEY_PASSWORD',
}

function fail(message) {
  console.error(`\n[android:bundle] ${message}`)
  process.exit(1)
}

function readProperties(file) {
  if (!existsSync(file)) return {}
  const entries = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    })
  return Object.fromEntries(entries)
}

function javaTool(name) {
  const executable = windows ? `${name}.exe` : name
  return process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', executable) : executable
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: windows })
  if (result.status !== 0) {
    fail(
      `${command} ${args.join(' ')} failed: ${result.error?.message ?? `exit code ${result.status}`}.`,
    )
  }
}

function gradleEnv() {
  if (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT) return process.env
  if (readProperties(join(androidDir, 'local.properties'))['sdk.dir']) return process.env
  const fallback = windows
    ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
    : join(
        process.env.HOME ?? '',
        process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk',
      )
  if (!existsSync(fallback))
    fail('Android SDK not found. Set ANDROID_HOME or sdk.dir in android/local.properties.')
  return { ...process.env, ANDROID_HOME: fallback }
}

function checkSigning() {
  const properties = readProperties(join(androidDir, 'keystore.properties'))
  const missing = Object.entries(signingKeys)
    .filter(([property, variable]) => !(process.env[variable] || properties[property]))
    .map(([property, variable]) => `${property} (${variable})`)
  if (missing.length > 0) {
    fail(
      `Upload key is not configured. Missing in android/keystore.properties or the environment: ${missing.join(', ')}.`,
    )
  }
  const storeFile = resolve(androidDir, process.env.MT_UPLOAD_STORE_FILE || properties.storeFile)
  if (!existsSync(storeFile))
    fail('The upload keystore file named in android/keystore.properties does not exist.')
}

function checkWebConfig() {
  const fileValues = Object.assign(
    {},
    ...['.env', '.env.production', '.env.local', '.env.production.local'].map((name) =>
      readProperties(join(appDir, name)),
    ),
  )
  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(
    (name) => !(process.env[name] || fileValues[name]),
  )
  if (missing.length > 0) fail(`Missing web build variables: ${missing.join(', ')}.`)
  const url = process.env.VITE_SUPABASE_URL || fileValues.VITE_SUPABASE_URL
  if (!url.includes('ehdzafadshbaaghzdzdo'))
    fail('VITE_SUPABASE_URL does not point at the product Supabase project.')
  if (!(process.env.VITE_STRIPE_PUBLISHABLE_KEY || fileValues.VITE_STRIPE_PUBLISHABLE_KEY)) {
    console.warn(
      '[android:bundle] VITE_STRIPE_PUBLISHABLE_KEY is empty: the build will offer cash payment only.',
    )
  }
}

if (!existsSync(join(androidDir, 'app', 'google-services.json'))) {
  fail(
    'android/app/google-services.json is missing: push notifications would not work in this build.',
  )
}
checkSigning()
if (!skipWeb) {
  checkWebConfig()
  run('npm', ['run', 'build:native'], appDir)
  run('npx', ['cap', 'sync', 'android'], appDir)
} else {
  run(
    'node',
    ['scripts/native-bundle-scan.mjs', join('android', 'app', 'src', 'main', 'assets', 'public')],
    appDir,
  )
}
run(
  windows ? `"${join(androidDir, 'gradlew.bat')}"` : 'sh',
  [...(windows ? [] : ['./gradlew']), '--no-daemon', ':app:bundleRelease'],
  androidDir,
  gradleEnv(),
)

const bundle = join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
if (!existsSync(bundle)) fail('Gradle finished but app-release.aab was not produced.')
const verify = spawnSync(javaTool('jarsigner'), ['-verify', bundle], { encoding: 'utf8' })
if (verify.status !== 0 || !/jar verified/i.test(verify.stdout))
  fail('app-release.aab is not signed. Check the upload key configuration.')
const certificate = spawnSync(javaTool('keytool'), ['-printcert', '-jarfile', bundle], {
  encoding: 'utf8',
})
const sha256 = certificate.stdout?.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1] ?? 'unknown'
console.log(`\n[android:bundle] Signed bundle: ${bundle}`)
console.log(`[android:bundle] Size: ${(statSync(bundle).size / 1048576).toFixed(1)} MB`)
console.log(`[android:bundle] Upload certificate SHA-256: ${sha256}`)
