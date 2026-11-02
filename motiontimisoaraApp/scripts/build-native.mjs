import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, VITE_NATIVE_BUILD: '1' }
const shell = process.platform === 'win32'

for (const [command, args] of [
  ['npx', ['tsc', '-b']],
  ['npx', ['vite', 'build']],
  ['node', ['scripts/native-bundle-scan.mjs', 'dist']],
]) {
  const result = spawnSync(command, args, { cwd: appDir, env, stdio: 'inherit', shell })
  if (result.status !== 0) {
    console.error(`[build:native] ${command} ${args.join(' ')} failed.`)
    process.exit(result.status ?? 1)
  }
}
