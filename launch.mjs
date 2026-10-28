// Dev-server launcher menu (alt screen, no dependencies).
// usage: node launch.mjs <outfile> <ps|cmd>  — on enter, writes a cd + run script to <outfile> for the shell wrapper to execute.
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const CONF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'projects.json')
const BG = 233, SEL = 237, GREY = 245, DIM = 242, TEXT = 188, ACCENT = 173, OK = 108, WARN = 179, BAD = 167
const HINT = '↑↓ select · enter launch · p pull · r refresh · a add current dir · d remove · q quit'

export const load = () => { try { return JSON.parse(fs.readFileSync(CONF, 'utf8')) } catch { return [] } }
const save = l => fs.writeFileSync(CONF, JSON.stringify(l, null, 2))

// lockfile -> package manager; "dev" script, else "start"
export function devCmd(dir) {
  let scripts
  try { scripts = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts ?? {} } catch { return null }
  const s = scripts.dev ? 'dev' : scripts.start ? 'start' : null
  if (!s) return null
  const has = f => fs.existsSync(path.join(dir, f))
  const pm = has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : has('bun.lockb') || has('bun.lock') ? 'bun' : 'npm'
  return pm === 'npm' ? (s === 'dev' ? 'npm run dev' : 'npm start') : `${pm} ${s}`
}

// "ahead\tbehind" from `rev-list --left-right --count HEAD...@{u}`
export const counts = t => { const [ahead, behind] = t.trim().split(/\s+/).map(Number); return { ahead, behind } }

const git = (dir, args) => new Promise(res =>
  execFile('git', args, { cwd: dir, timeout: 60000 }, (e, out, err) => res({ ok: !e, out: (out ?? '').trim(), err: (err || e?.message || '').trim() })))

async function status(p, fetch) {
  const s = { branch: '', ahead: 0, behind: 0, dirty: false, note: '' }
  if (!(await git(p.dir, ['rev-parse', '--git-dir'])).ok) return { ...s, note: 'not a git repo' }
  if (fetch && !(await git(p.dir, ['fetch', '--quiet'])).ok) s.note = 'fetch failed'
  s.branch = (await git(p.dir, ['branch', '--show-current'])).out || 'detached'
  const r = await git(p.dir, ['rev-list', '--left-right', '--count', 'HEAD...@{u}'])
  if (r.ok) Object.assign(s, counts(r.out)); else s.note ||= 'no upstream'
  s.dirty = !!(await git(p.dir, ['status', '--porcelain'])).out
  return s
}

function line(segs, cols, bg = BG) {
  let used = 0
  const body = segs.map(([fg, t, b]) => { used += [...t].length; return `\x1b[${b ? '1;' : ''}38;5;${fg};48;5;${bg}m${t}` }).join('')
  return body + `\x1b[48;5;${bg}m${' '.repeat(Math.max(0, cols - used))}\x1b[0m`
}

export function frame(st, cols = 80, rows = 24) {
  const out = [line([], cols)]
  if (!st.list.length) out.push(line([[GREY, '   no projects yet — cd into one and press a']], cols))
  st.list.forEach((p, i) => {
    const bg = i === st.sel ? SEL : BG, g = st.git[p.dir]
    const tag = !g ? [[DIM, '…']]
      : g.note === 'not a git repo' ? [[DIM, 'not a git repo']]
      : [[GREY, g.branch + '  '],
         ...(g.behind ? [[WARN, `↓${g.behind} behind  `, true]] : []),
         ...(g.ahead ? [[OK, `↑${g.ahead} ahead  `]] : []),
         ...(!g.behind && !g.ahead && !g.note ? [[OK, '✓ up to date  ']] : []),
         ...(g.dirty ? [[ACCENT, '● uncommitted  ']] : []),
         ...(g.note ? [[BAD, g.note]] : [])]
    out.push(line([[ACCENT, i === st.sel ? '  ▸' : '   '], [i === st.sel ? TEXT : GREY, ` ${i + 1}  `, true], [TEXT, p.name]], cols, bg))
    out.push(line([[0, '       '], ...tag, ...(st.busy[p.dir] ? [[WARN, ` ${st.busy[p.dir]}`]] : [])], cols, bg))
    out.push(line([], cols))
  })
  while (out.length < rows - 3) out.push(line([], cols))
  const m = st.confirm ? `remove ${st.list[st.sel].name} from the list? (y/n)` : st.msg ?? ''
  out.push(line([[st.err ? BAD : OK, '   ' + m.split('\n')[0].slice(0, cols - 4)]], cols))
  out.push(line([[DIM, '   ' + HINT]], cols))
  return out.slice(0, rows).join('\r\n')
}

const items = () => load().map(dir => ({ dir, name: path.basename(dir) }))

async function refresh(st, p, fetch, draw) {
  st.busy[p.dir] = fetch ? 'fetching…' : ''
  draw()
  st.git[p.dir] = await status(p, fetch)
  st.busy[p.dir] = ''
  draw()
}

// returns false to quit
function onKey(st, key, ch, draw, finish) {
  const p = st.list[st.sel], n = st.list.length
  if (st.confirm) {
    if (key === 'y') { save(load().filter(d => d !== p.dir)); st.list = items(); st.sel = Math.max(0, Math.min(st.sel, st.list.length - 1)) }
    st.confirm = false
    return true
  }
  st.msg = null; st.err = false
  if (key === 'q' || key === 'escape' || key === 'ctrl-c') return false
  if ((key === 'down' || key === 'j') && n) st.sel = (st.sel + 1) % n
  else if ((key === 'up' || key === 'k') && n) st.sel = (st.sel - 1 + n) % n
  else if (key === 'return' && n) {
    const cmd = devCmd(p.dir)
    if (!cmd) { st.msg = 'no dev/start script in package.json'; st.err = true }
    else { finish(p.dir, cmd); return false }
  }
  else if (key === 'r' && n) refresh(st, p, true, draw)
  else if (key === 'p' && n) {
    st.busy[p.dir] = 'pulling…'
    git(p.dir, ['pull', '--ff-only']).then(async r => {
      st.msg = r.ok ? r.out.split('\n').pop() : r.err.split('\n')[0]; st.err = !r.ok
      await refresh(st, p, false, draw)
    })
  }
  else if (key === 'a') {
    const dir = path.resolve(process.cwd())
    if (!fs.existsSync(path.join(dir, 'package.json'))) { st.msg = 'no package.json in current dir'; st.err = true }
    else if (load().includes(dir)) { st.msg = 'already in the list'; st.err = true }
    else { save([...load(), dir]); st.list = items(); st.sel = st.list.length - 1; refresh(st, st.list[st.sel], true, draw) }
  }
  else if (key === 'd' && n) st.confirm = true
  return true
}

function main() {
  const [outfile, shell] = process.argv.slice(2)
  const o = process.stdout
  const st = { list: items(), sel: 0, git: {}, busy: {}, msg: null }
  let picked
  const draw = () => o.write('\x1b[H' + frame(st, o.columns, o.rows))
  const finish = (dir, cmd) => { picked = shell === 'cmd' ? `cd /d "${dir}"\r\n${cmd}\r\n` : `Set-Location -LiteralPath '${dir.replace(/'/g, "''")}'\r\n${cmd}\r\n` }
  const done = () => {
    o.write('\x1b[?25h\x1b[?1049l'); process.stdin.setRawMode(false)
    if (picked && outfile) fs.writeFileSync(outfile, picked)
    process.exit(0)
  }
  o.write('\x1b[?1049h\x1b[?25l')
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.on('keypress', (ch, k) => {
    const key = k?.ctrl && k.name === 'c' ? 'ctrl-c' : (k?.name ?? ch)
    if (!onKey(st, key, ch, draw, finish)) return done()
    draw()
  })
  o.on('resize', draw)
  draw()
  st.list.forEach(p => refresh(st, p, true, draw))
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main()
