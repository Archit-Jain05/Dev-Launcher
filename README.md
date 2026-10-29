# Dev-Launcher

A tiny terminal menu for starting dev servers. Type `launch`, pick a project, press Enter: it `cd`s into the project and runs its dev server in the same terminal. Each row also shows git status, so you can see unpulled changes before you start.

No dependencies, just Node 18+ and git.

## Features

- Arrow-key menu (`↑` `↓` or `j` `k`), Enter to launch
- Git status per project, fetched in parallel on open: branch, `↓N behind`, `↑N ahead`, `● uncommitted`
- Pull the selected project with one key (`git pull --ff-only`, never creates merge commits)
- Picks `pnpm` / `yarn` / `bun` / `npm` from the lockfile, and runs `dev` (falling back to `start`), or a per-project `cmd` override
- Auto-installs dependencies when `node_modules` is missing or a pull changed them
- Works in PowerShell and cmd on Windows

## Keys

| Key | Action |
| --- | --- |
| `↑` `↓` / `j` `k` | Select project |
| `Enter` | `cd` into the project and start the dev server |
| `p` | Pull (fast-forward only) |
| `r` | Re-fetch the selected project |
| `a` | Add the current directory (needs a `package.json`) || `d` | Remove the selected project (asks `y/n`) |
| `q` / `Esc` | Quit |

## Setup (Windows)

```powershell
git clone https://github.com/Archit-Jain05/QuickDevLaunch D:\Projects\launch
cd D:\Projects\launch
copy projects.example.json projects.json   # then edit, or add projects from the menu with `a`
```

A program can't change its parent shell's directory, so `launch` is a thin wrapper that runs the menu and then executes the `cd` + dev command it writes out.

**PowerShell**: add to your `$PROFILE`:

```powershell
function launch {
    $f = Join-Path $env:TEMP "launch-$PID.ps1"
    node D:\Projects\launch\launch.mjs $f ps
    if (Test-Path $f) { $s = Get-Content $f -Raw; Remove-Item $f; Invoke-Expression $s }
}
```

**cmd**: add the repo folder to your `PATH`; `launch.cmd` does the rest.

## Config

`projects.json` is a list of absolute project paths (git-ignored, since paths are machine-specific). An entry can also be an object with a `cmd` to override the auto-detected command:

```json
[
  "D:\\Projects\\my-app",
  { "dir": "D:\\Projects\\monorepo", "cmd": "pnpm --filter web dev --port 4000" }
]
```

Dependencies are installed automatically before launch when `node_modules` is missing, or when a pull from the menu changed `package.json` or the lockfile.

## Test

```
node launch.test.mjs
```

## License

[MIT](LICENSE)
