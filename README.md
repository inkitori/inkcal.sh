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
today: write report                   todo due today
fri: 331 hw3                          todo due next friday
2026-05-12: pay rent                  todo on a specific date
today 14:00-15:00 deep work           one-off block of time
mwf 10:00-11:00 lecture               recurring (mon/wed/fri)
daily 08:00 stretch                   recurring every day
someday: read more books              inbox / no date
note: random thought                  note
write report                          bare → inbox
!may 6 at noon doctor appt            chrono natural-language
!next friday call mom                 chrono natural-language
```

day combos use single letters: `m t w r f s u` (r = thursday, u = sunday). e.g. `tr` = tue+thu.

the colon after a date keyword is optional (`today write report` works too). a trailing `*recurring` marker after a recurring time is also accepted but not required.

a leading `!` routes the rest through [chrono](https://github.com/wanasit/chrono) for natural-language dates and times. the matched phrase becomes the schedule, and whatever's left becomes the title.

## keys

**global**

| key      | action                              |
|----------|-------------------------------------|
| ⌘1 / ⌘2 / ⌘3 | todo / calendar / notes         |
| ⌘K       | capture                             |
| ⌘P       | command palette                     |
| /        | search (scoped to the current view) |
| u        | undo last delete                    |
| ⌥Space   | toggle window from anywhere         |
| Esc      | close any open overlay              |

**todo & notes lists**

| key       | action                       |
|-----------|------------------------------|
| j / k     | move down / up               |
| gg / G    | top / bottom                 |
| space, x  | toggle done                  |
| dd  /  ⌫  | delete (5s undo)             |
| o         | new todo for today           |
| n         | new note (notes view)        |
| i         | rename selected (inline)     |
| e         | edit properties (todo view)  |

**calendar**

| key       | action                       |
|-----------|------------------------------|
| h / l     | prev / next (day or week)    |
| t         | jump to today                |
| d / w     | switch to day / week mode    |

inputs accept normal typing. `Enter` submits, `Esc` cancels.

## search

press `/` to open a scoped fuzzy search:

- **todo / calendar views** → search across all todos and recurring tasks
- **notes view** → search note bodies

`↑/↓` (or `⌃p/⌃n`) move, `↵` jumps to the matching item in its view, `Esc` cancels.

## themes

three ship by default: `dark`, `pink`, `light`. switch via ⌘P → `theme pink` etc.

themes are JSON files at `~/Library/Application Support/inkcal-sh/themes/`. drop a new `.json` in there → it appears in the palette automatically (hot reload). bundled themes are copied into that folder on first run.

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

electron-vite · react · tailwind · zustand · chrono-node · fuse.js · single json.
