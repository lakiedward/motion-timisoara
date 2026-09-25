import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const appRoot = path.join(root, 'motiontimisoaraApp')
const output = path.join(root, 'test-results/ios-live-location')
const appId = 'com.motiontimisoara.app'
const index = path.join(appRoot, 'ios/App/App/public/index.html')
const builtApp = path.join(appRoot, 'ios/build/Build/Products/Debug-iphonesimulator/App.app')
const log = []
let device
let consoleProcess
let consoleFailure
let stoppingConsole = false
let consoleClosed = Promise.resolve()
let consoleTimeout
const nativeConsole = []
let originalIndex
let originalBuiltIndex
let lastResult
const timing = {}
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const stalledLocationHosts = [
  'gsp-ssl.ls.apple.com',
  'gspe1-ssl.ls.apple.com',
  'gspe19-ssl.ls.apple.com',
  'gspe35-ssl.ls.apple.com',
  'gs-loc.apple.com',
  'gsp9-ssl.apple.com',
  'gsp10-ssl.apple.com',
  'iphone-ld.apple.com',
  'cl2.apple.com',
  'cl3.apple.com',
  'cl4.apple.com',
  'configuration.ls.apple.com',
]
let locationLookupsRefused = false

async function command(binary, args, { timeout = 60000, acceptFailure = false, includeStderr = false, input = '' } = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const process = spawn(binary, args, { cwd: appRoot, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] })
    if (input) process.stdin.end(input)
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      process.kill('SIGKILL')
    }, timeout)
    process.stdout.on('data', (data) => { stdout += data })
    process.stderr.on('data', (data) => { stderr += data })
    process.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    process.on('close', (code) => {
      clearTimeout(timer)
      const finishedAt = Date.now()
      log.push({ binary, args, code, timedOut, startedAt, finishedAt, durationMs: finishedAt - startedAt, stdout, stderr })
      if (timedOut || (code !== 0 && !acceptFailure)) {
        reject(new Error(`${binary} ${args.join(' ')} failed (${timedOut ? 'timeout' : code}): ${stderr.slice(-1500)}`))
      } else resolve((includeStderr ? `${stdout}\n${stderr}` : stdout).trim())
    })
  })
}

const sim = (...args) => command('xcrun', ['simctl', ...args])
const event = (kind, session) => lastResult?.events.find((item) => item.kind === kind && (!session || item.session === session))
const point = (session, latitude) => lastResult?.events.find((item) => item.kind === 'point' && item.session === session && Math.abs(item.latitude - latitude) < 0.00001)

async function readResult() {
  if (consoleFailure) throw consoleFailure
  if (lastResult?.status === 'failed') throw new Error(JSON.stringify(lastResult.events.find((item) => item.kind === 'failure')))
}

function receiveConsoleLine(line) {
  nativeConsole.push(line)
  const marker = 'MOTION_FEATURE320_EVENT:'
  const offset = line.indexOf(marker)
  if (offset < 0) return
  try {
    const hostReceivedAt = Date.now()
    const message = JSON.parse(line.slice(offset + marker.length))
    assert.equal(message.version, 1, 'Unexpected native console protocol')
    assert(['running', 'passed', 'failed'].includes(message.status), 'Invalid native console status')
    assert.equal(message.event.sequence, (lastResult?.events.length || 0) + 1, 'Native event missing, duplicated or reordered')
    assert(Number.isFinite(message.event.observedAt), 'Callback timestamp required')
    assert.equal(typeof message.event.kind, 'string', 'Native event kind required')
    lastResult = {
      version: 1,
      status: message.status,
      events: [...(lastResult?.events || []), { ...message.event, hostReceivedAt }]
    }
  } catch (error) {
    consoleFailure ??= new Error(`Invalid live native event: ${error.message}`)
  }
}

async function launchHarness() {
  const help = await command('xcrun', ['simctl', 'help', 'launch'], { includeStderr: true })
  assert(help.includes('--console-pty'), 'Live native console PTY capture is required')
  const args = ['simctl', 'launch', '--console-pty', device, appId]
  const launchLog = { binary: 'xcrun', args, liveConsole: true }
  log.push(launchLog)
  timing.launchRequestedAt = Date.now()
  consoleProcess = spawn('xcrun', args, { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] })
  createInterface({ input: consoleProcess.stdout, crlfDelay: Infinity }).on('line', receiveConsoleLine)
  createInterface({ input: consoleProcess.stderr, crlfDelay: Infinity }).on('line', receiveConsoleLine)
  consoleClosed = new Promise((resolve) => {
    consoleProcess.on('error', (error) => { consoleFailure ??= error; resolve() })
    consoleProcess.on('close', (code) => {
      launchLog.code = code
      if (!stoppingConsole) consoleFailure ??= new Error(`Live native console closed unexpectedly (${code})`)
      clearTimeout(consoleTimeout)
      resolve()
    })
  })
}

async function waitFor(description, predicate, timeout = 35000) {
  const limit = Date.now() + timeout
  while (Date.now() < limit) {
    await readResult()
    if (predicate()) return
    await delay(500)
  }
  throw new Error(`Timeout waiting for ${description}; last result: ${JSON.stringify(lastResult)}`)
}

async function inject(latitude) {
  await sim('location', device, 'set', `${latitude},2.5`)
}

async function background(session) {
  timing[`${session}BackgroundRequestedAt`] = Date.now()
  await sim('launch', device, 'com.apple.mobilesafari')
  timing[`${session}BackgroundAt`] = Date.now()
  await delay(1500)
}

async function requireBackgroundDelivery(session, latitude) {
  try {
    await waitFor(`${session}: native console acknowledges JavaScript callback while still in background`, () => point(session, latitude), 15000)
    timing[`${session}Delivery`] = 'background'
  } catch {
    await foreground(session)
    await waitFor(`${session}: diagnostic callback after resume`, () => point(session, latitude), 5000).catch(() => undefined)
    timing[`${session}Delivery`] = point(session, latitude) ? 'after-resume-only' : 'missing'
    throw new Error(`${session}: background JavaScript delivery was not proved; diagnostic=${timing[`${session}Delivery`]}`)
  }
}

async function foreground(session) {
  timing[`${session}ForegroundAt`] = Date.now()
  await sim('launch', device, appId)
}

async function requestRestart(session) {
  await sim('launch', device, 'com.apple.mobilesafari')
  await delay(1500)
  await sim('launch', device, appId)
  await waitFor(`${session}: explicit foreground handshake starts next watcher`, () => event('start', session))
}

async function stopSimulator() {
  stoppingConsole = true
  clearTimeout(consoleTimeout)
  consoleTimeout = undefined
  if (device) {
    if (consoleProcess) await sim('terminate', device, appId).catch(() => undefined)
    await sim('shutdown', device).catch(() => undefined)
    await sim('delete', device).catch(() => undefined)
  }
  if (consoleProcess) {
    consoleProcess.kill('SIGKILL')
    await Promise.race([consoleClosed, delay(3000)])
  }
  device = undefined
  consoleProcess = undefined
  consoleFailure = undefined
  stoppingConsole = false
  consoleClosed = Promise.resolve()
  lastResult = undefined
}

function simulatorDiedBeforeReady(error) {
  return !lastResult && /harness ready|closed unexpectedly|server died|Mach error -308/.test(error.message)
}

async function startHarness() {
  await createSimulator()
  await command('xcrun', ['simctl', 'install', device, builtApp], { timeout: 180000 })
  await sim('privacy', device, 'grant', 'location-always', appId)
  await launchHarness()
  await waitFor('harness ready', () => event('ready'), 180000)
}

async function refuseStalledLocationLookups() {
  if (locationLookupsRefused || process.env.CI !== 'true') return
  locationLookupsRefused = true
  let hosts = ''
  try {
    hosts = await readFile('/etc/hosts', 'utf8')
  } catch {
    hosts = ''
  }
  const missing = stalledLocationHosts.filter((host) => !hosts.includes(` ${host}`) && !hosts.includes(`\t${host}`))
  if (missing.length === 0) return
  const block = `${missing.flatMap((host) => [`127.0.0.1 ${host}`, `::1 ${host}`]).join('\n')}\n`
  await command('sudo', ['-n', 'tee', '-a', '/etc/hosts'], { input: block, acceptFailure: true, includeStderr: true })
  await command('sudo', ['-n', 'killall', '-HUP', 'mDNSResponder'], { acceptFailure: true })
  await command('dscacheutil', ['-flushcache'], { acceptFailure: true })
}

async function createSimulator() {
  await refuseStalledLocationLookups()
  const help = await command('xcrun', ['simctl', 'help', 'privacy'], { includeStderr: true })
  assert(help.includes('location-always'), 'Simulator must support location-always permission')
  const locationHelp = await command('xcrun', ['simctl', 'help', 'location'], { includeStderr: true })
  assert(locationHelp.includes('set'), 'Simulator must support synthetic location injection')
  const inventory = JSON.parse(await sim('list', '--json'))
  const runtimes = inventory.runtimes.filter((item) => item.isAvailable && item.identifier.includes('.iOS-'))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
  for (const runtime of runtimes) {
    const existing = (inventory.devices[runtime.identifier] || []).find((item) => item.isAvailable && item.name.startsWith('iPhone'))
    const type = existing && inventory.devicetypes.find((item) => item.identifier === existing.deviceTypeIdentifier || item.name === existing.name)
    if (!type) continue
    device = await sim('create', `MotionFeature320-${process.pid}`, type.identifier, runtime.identifier)
    assert.match(device, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Expected an owned simulator UUID')
    await writeFile(path.join(output, 'simulator.json'), JSON.stringify({ device, type, runtime }, null, 2))
    await sim('boot', device)
    await command('xcrun', ['simctl', 'bootstatus', device, '-b'], { timeout: 600000 })
    return
  }
  throw new Error('No available iPhone simulator/runtime pair')
}

function verifyResults() {
  for (const session of ['manual', 'expiry']) {
    const sample = point(session, session === 'manual' ? 1.26 : 2.26)
    assert(sample, `${session}: native background sample required`)
    assert(sample.capturedAt >= timing[`${session}BackgroundAt`], `${session}: sample captured before background`)
    assert(sample.capturedAt <= timing[`${session}ForegroundAt`], `${session}: sample captured after foreground`)
    assert(sample.observedAt >= timing[`${session}BackgroundAt`], `${session}: callback arrived before background`)
    assert(sample.observedAt < timing[`${session}ForegroundAt`], `${session}: callback only arrived after resume`)
    assert(sample.hostReceivedAt < timing[`${session}ForegroundAt`], `${session}: native evidence only reached the host after resume`)
    assert(sample.hiddenAtDelivery || lastResult.events.some((item) => item.kind === 'app-state' && item.active === false && item.observedAt >= timing[`${session}BackgroundRequestedAt`] && item.observedAt <= sample.observedAt), `${session}: app must be inactive when the callback arrives`)
    assert.equal(timing[`${session}Delivery`], 'background')
  }
  const manualStoppedAt = event('manual-stopped').observedAt
  const expiresAt = event('start', 'expiry').expiresAt
  assert(!lastResult.events.some((item) => item.kind === 'point' && item.session === 'manual' && (item.capturedAt >= manualStoppedAt || Math.abs(item.latitude - 1.28) < 0.00001)), 'Stopped manual watcher must reject all later samples')
  assert(!lastResult.events.some((item) => item.kind === 'point' && item.session === 'expiry' && (item.capturedAt >= expiresAt || Math.abs(item.latitude - 2.28) < 0.00001)), 'Expired watcher must reject all later samples')
  assert(event('native-expired'), 'Native expiry callback required')
  assert(event('expired-start-rejected'), 'Expired start must be rejected')
  assert(point('after-expiry', 3.25), 'Restart after native expiry must receive a point')
  assert.equal(lastResult.status, 'passed')
}

try {
  assert.equal(process.platform, 'darwin', 'This isolated test requires macOS with Xcode')
  await mkdir(output, { recursive: true })
  originalIndex = await readFile(index)
  originalBuiltIndex = await readFile(path.join(builtApp, 'public/index.html'))
  const harness = await readFile(path.join(root, 'tests/native-location/ios-location-harness.html'))
  await writeFile(index, harness)
  await command('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-sdk', 'iphonesimulator', '-configuration', 'Debug', '-derivedDataPath', 'ios/build', 'CODE_SIGNING_ALLOWED=NO', 'build'], { timeout: 600000 })
  assert((await readFile(path.join(builtApp, 'public/index.html'))).equals(harness), 'Only the isolated harness may be installed in the test simulator')
  try {
    await startHarness()
  } catch (error) {
    if (!simulatorDiedBeforeReady(error)) throw error
    log.push({ retry: error.message })
    await stopSimulator()
    await startHarness()
  }
  timing.harnessReadyAt = Date.now()
  timing.startupDurationMs = timing.harnessReadyAt - timing.launchRequestedAt
  consoleTimeout = setTimeout(() => {
    consoleFailure ??= new Error('Live native console exceeded the bounded test duration')
    consoleProcess.kill('SIGKILL')
  }, 480000)
  await inject(1.25)
  await waitFor('foreground native point', () => point('manual', 1.25))
  await background('manual')
  await inject(1.26)
  await requireBackgroundDelivery('manual', 1.26)
  await foreground('manual')
  await inject(1.27)
  await waitFor('explicit idempotent native stop', () => event('manual-stopped'))
  assert(!event('start', 'expiry'), 'Stop observation arrived too late to exercise the stopped interval')
  await inject(1.28)
  await delay(3500)
  await readResult()
  assert(!event('start', 'expiry'), 'Stop interval must remain stopped while injecting forbidden locations')
  await requestRestart('expiry')
  await inject(2.25)
  await waitFor('restarted native point', () => point('expiry', 2.25))
  await background('expiry')
  await inject(2.26)
  await requireBackgroundDelivery('expiry', 2.26)
  const expiresAt = event('start', 'expiry').expiresAt
  await delay(Math.max(0, expiresAt + 2000 - Date.now()))
  await foreground('expiry')
  await waitFor('native expiry without a JavaScript stop timer', () => event('native-expired'))
  assert(!event('start', 'after-expiry'), 'Expiry observation arrived too late to exercise the stopped interval')
  await inject(2.28)
  await delay(2500)
  await readResult()
  assert(!event('start', 'after-expiry'), 'Expiry interval must remain stopped while injecting forbidden locations')
  await waitFor('expired start rejection', () => event('expired-start-rejected'))
  await requestRestart('after-expiry')
  await inject(3.25)
  await waitFor('all native assertions', () => event('complete'))
  verifyResults()
  console.log('PASS: iOS simulator foreground/background sample, manual stop, restart, native expiry and expired start')
} catch (error) {
  process.exitCode = 1
  console.error(error.message)
  log.push({ failure: error.message })
} finally {
  stoppingConsole = true
  clearTimeout(consoleTimeout)
  if (device) {
    if (consoleProcess) await sim('terminate', device, appId).catch(() => undefined)
    await sim('shutdown', device).catch(() => undefined)
    await sim('delete', device).catch(() => undefined)
  }
  if (consoleProcess) {
    consoleProcess.kill('SIGKILL')
    await Promise.race([consoleClosed, delay(3000)])
  }
  if (originalIndex) await writeFile(index, originalIndex)
  if (originalBuiltIndex) await writeFile(path.join(builtApp, 'public/index.html'), originalBuiltIndex)
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ timing, result: lastResult, backgroundDeliveryVerified: process.exitCode !== 1 && lastResult?.status === 'passed', physicalDeviceVerified: false }, null, 2))
  await writeFile(path.join(output, 'commands.json'), JSON.stringify(log, null, 2))
  await writeFile(path.join(output, 'native-console.log'), nativeConsole.join('\n'))
}
