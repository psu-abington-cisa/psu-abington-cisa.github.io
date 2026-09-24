# Come Hack presentations

Slides and recordings from **Come Hack**, CISA's hands-on cybersecurity sessions at Penn State
Abington. This folder is a small static site served by GitHub Pages at
`cisa.cybernet.rocks/come-hack-presentations/`: no build step, no framework, no third-party
requests. It uses the same look as the main [CISA site](https://cisa.cybernet.rocks/), including
the light/dark toggle, and the theme choice carries over between the two.

- **`index.html`** lists every presentation, newest first, with search. A green **Recording**
  badge shows up on a card once its Kaltura link is filled in.
- **`view.html?id=<id>`** shows the PDF in the browser, a download button, and a link to the
  Kaltura recording (or "Recording coming soon" while `kaltura` is empty).

Everything on both pages comes from one file: [`data/presentations.json`](data/presentations.json).
The pages fetch it every time they load, so edits show up without changing any code.

## Add a presentation

1. Upload the PDF into [`presentations/`](presentations/). Stick to letters, numbers, `-`, `_`
   and `.` in the filename, e.g. `come-hack-10-01-2026.pdf`.
2. Open [`data/presentations.json`](data/presentations.json), click the pencil (✏️) icon, and add
   an entry to the `presentations` list. Order doesn't matter; the site sorts newest first.

   ```json
   {
     "id": "2026-10-01-web-hacking",
     "title": "Web App Hacking",
     "date": "2026-10-01",
     "session": 2,
     "pdf": "presentations/come-hack-10-01-2026.pdf",
     "kaltura": ""
   }
   ```

   Put a comma between entries, but not after the last one.
3. Commit. The site updates within about a minute.

**Adding the recording later:** paste the Kaltura link into that entry's `kaltura` field, e.g.
`"kaltura": "https://psu.mediaspace.kaltura.com/media/..."`, and commit. The Recording badge
and the "Watch the recording" button show up on their own.

### Field reference

| Field | Required? | Format | Notes |
|---|---|---|---|
| `id` | yes | lowercase letters, digits, `-` | Must be unique. It becomes the page URL (`view.html?id=...`), so don't change it once shared. Date + topic works well: `2026-10-01-web-hacking`. |
| `title` | yes | string | Shown on the card and the viewer page. |
| `date` | yes | `YYYY-MM-DD` | Session date. Used for newest-first sorting. |
| `session` | yes | whole number, no quotes | `2`, not `"2"`. Shown as "Session 2". |
| `pdf` | yes | `presentations/<file>.pdf` | Must match the uploaded file exactly, including upper/lower case. |
| `kaltura` | no | `""` or an `http(s)://` URL | Leave `""` until the recording is up. Only `http://` and `https://` links are accepted. |

Any other field name (a typo like `kalutra`, for example) is flagged by the validator.

## Checks

```
python3 scripts/validate.py    # validates data/presentations.json
node scripts/test-app.js       # unit tests for the page helpers (escaping, URL checks, search)
```

`scripts/validate.py` checks that the file is valid JSON, required fields are present, there are no
unknown fields, `id`s are unique and URL-safe, dates are real, `session` is a positive whole
number, each `pdf` exists under `presentations/`, and `kaltura` is empty or an http(s) URL. PDFs in
`presentations/` that no entry points to are listed as warnings.

The main repo's GitHub Action ([`.github/workflows/validate-data.yml`](../.github/workflows/validate-data.yml))
runs both checks on every push and pull request that touches the data, the PDFs, or the scripts,
so a typo shows up as a red ❌ on the commit.

## Preview locally

Run a local server from the **repo root** (the stylesheet loads the shared font from the root
`assets/fonts/` folder):

```
python3 -m http.server 8080
```

Then open <http://localhost:8080/come-hack-presentations/>. Alternatively, run the same command
inside this folder and open <http://localhost:8080/> (everything but the font works there).
Opening `index.html` straight from disk won't work, because browsers block `fetch()` on `file://`
URLs.

## Project layout

```
index.html                       Presentation list with search
view.html                        PDF viewer + recording link (view.html?id=...)
assets/css/style.css             Styles (same tokens/components as the CISA site)
assets/js/app.js                 Loads the JSON and renders both pages
(no assets/fonts/)               Roboto is shared from the repo root: ../assets/fonts/roboto-latin.woff2 (OFL)
assets/img/cisa-logo.jpg         Club logo (also the favicon)
data/presentations.json          The list of presentations. Edit this one.
presentations/                   The PDFs
scripts/validate.py              Validates data/presentations.json (used by CI)
scripts/test-app.js              Node unit tests for assets/js/app.js helpers
```
