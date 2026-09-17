import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
mkdirSync('dist/.well-known', { recursive: true })
copyFileSync('../docs/client-demos/2026-09-17.html', 'dist/prezentare.html')
writeFileSync(
  'dist/.well-known/motion-build.json',
  JSON.stringify({
    commit,
    builtAt: new Date().toISOString(),
    channel: 'client-demo',
    branch: 'master',
  }),
)
writeFileSync(
  'dist/_redirects',
  '/descarca https://github.com/lakiedward/motion-timisoara/releases/download/android-client-demo/motion-demo.apk 302\n/* /index.html 200\n',
)
writeFileSync(
  'dist/_headers',
  '/*\n  X-Robots-Tag: noindex, nofollow\n/index.html\n  Cache-Control: no-cache, no-store, must-revalidate\n/.well-known/motion-build.json\n  Cache-Control: no-store\n',
)
