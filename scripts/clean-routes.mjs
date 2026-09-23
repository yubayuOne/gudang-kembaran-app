import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = process.cwd()
const staleFiles = [
  resolve(projectRoot, 'src/routes/production..tsx'),
  resolve(projectRoot, 'src/routeTree.gen.ts'),
]

for (const file of staleFiles) {
  if (existsSync(file)) {
    rmSync(file, { force: true })
    console.log(`[clean-routes] removed ${file}`)
  }
}
