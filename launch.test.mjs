import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { devCmd, counts, plan } from './launch.mjs'

const mk = (scripts, lock) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-'))
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ scripts }))
  if (lock) fs.writeFileSync(path.join(d, lock), '')
  return d
}
assert.equal(devCmd(mk({ dev: 'x' })), 'npm run dev')
assert.equal(devCmd(mk({ dev: 'x' }, 'pnpm-lock.yaml')), 'pnpm dev')
assert.equal(devCmd(mk({ start: 'x' })), 'npm start')
assert.equal(devCmd(mk({ start: 'x' }, 'yarn.lock')), 'yarn start')
assert.equal(devCmd(mk({ build: 'x' })), null)
assert.deepEqual(counts('2\t5\n'), { ahead: 2, behind: 5 })

// plan: install when node_modules missing or stale; cmd override wins; nothing runnable -> null
const a = mk({ dev: 'x' }, 'pnpm-lock.yaml')
assert.deepEqual(plan({ dir: a }, false), { cmd: 'pnpm dev', install: 'pnpm install' })
fs.mkdirSync(path.join(a, 'node_modules'))
assert.deepEqual(plan({ dir: a }, false), { cmd: 'pnpm dev', install: null })
assert.deepEqual(plan({ dir: a }, true), { cmd: 'pnpm dev', install: 'pnpm install' })
assert.deepEqual(plan({ dir: a, cmd: 'pnpm --filter web dev' }, false), { cmd: 'pnpm --filter web dev', install: null })
assert.equal(plan({ dir: mk({ build: 'x' }) }, false), null)
console.log('ok')
