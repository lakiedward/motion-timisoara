import { readFile, writeFile } from 'node:fs/promises'

const file = new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url)
const current = await readFile(file, 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return null
  throw error
})
if (current !== null) {
  const normalized = current.replace(/path: "([^"]+)"/g, (_, path) => `path: "${path.replaceAll('\\', '/')}"`)
  if (normalized !== current) await writeFile(file, normalized)
}
