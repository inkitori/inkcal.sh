# inkcal.sh

minimalist todo + calendar — vim-flavored, single JSON file, themeable.

## run

```sh
npm install
npm run dev      # dev with HMR
npm run dist     # build a packaged .dmg
```

## capture syntax (⌘K)

```
today: write report                  todo due today
fri: 331 hw3                          todo due next friday
2026-05-12: pay rent                  todo on a specific date
mwf 10:00-11:00 lecture               recurring (mon/wed/fri)
daily 08:00 take meds                 recurring every day
someday: pick up lexapro              inbox / no date
note: random thought                  note
write report                          bare → inbox
```

day combos use single letters: `m t w r f s u` (r = thursday, u = sunday). e.g. `tr` = tue+thu.

the `*recurring` marker after the time is optional.

## keys

**global**

| key      | action          |
|----------|-----------------|
| ⌘1 / ⌘2 / ⌘3 | todo / calendar / notes |
| ⌘K       | capture         |
| ⌘P       | command palette |
| /        | capture (alias) |
| ⌥Space   | toggle window from anywhere |

**lists & calendar**

| key       | action                |
|-----------|-----------------------|
| j / k     | move down / up        |
| space, x  | toggle done           |
| dd        | delete (5s undo)      |
| u         | undo last delete      |
| o         | new todo for today    |
| n         | new note (notes view) |
| gg / G    | top / bottom          |
| Esc       | blur input            |

inputs accept normal typing. `Enter` submits, `Esc` cancels.

## themes

three ship by default: `dark`, `pink`, `light`. switch via ⌘P → `theme pink` etc.

themes are JSON files at `~/Library/Application Support/inkcal-sh/themes/`. drop a new `.json` in there → it appears in the palette automatically (hot reload).

minimum theme:

```json
{
  "name": "mytheme",
  "vars": {
    "--bg": "#101010",
    "--text": "#eee",
    "--accent": "#d4a574"
  },
  "transparency": { "enabled": false }
}
```

every CSS var in `src/renderer/styles/globals.css` is overridable. macOS vibrancy:

```json
"transparency": { "enabled": true, "vibrancy": "under-window", "alpha": 0.85 }
```

⌘P → `enable/disable transparency` toggles it for the active theme.

## data

a single human-readable file:

```
~/Library/Application Support/inkcal-sh/data.json
```

⌘P → `reveal data.json` to open it. `export data` writes a copy anywhere; `import data` swaps in another file (current state is backed up first). daily snapshots are kept in `backups/` for 30 days.

## stack

electron-vite · react · tailwind · zustand · single json · ~1k loc.
