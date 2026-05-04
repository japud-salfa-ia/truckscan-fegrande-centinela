# TruckScan Static Demo Dashboard — Codex Context

## 1. Goal

Build a fully static demo dashboard for **TruckScan** that can be deployed directly with **GitHub Pages**.

This is a temporary presentation version. It is **not** connected to ROS2, Ubuntu services, local folders, Google Cloud Storage, Python scripts, databases, or any live backend. The only purpose is to show how the final dashboard will look and behave while the real-time connected version is still under development.

The final user must only open a shared URL and view the page in a browser.

## 2. Critical Scope Constraints

The implementation must be created in a completely new folder/repository. It must not assume access to any existing TruckScan source code, ROS2 package, Ubuntu environment, GCP bucket, service account, Python script, or local dataset.

Do not implement:

- Python code.
- Backend services.
- Node.js server.
- Flask, FastAPI, Django, Express, or similar.
- GCP integration.
- ROS2 integration.
- Local filesystem watchers.
- Authentication systems.
- Database connections.
- Build systems that require a server at runtime.

The result must be a static site composed of files that GitHub Pages can serve directly.

## 3. Main Visual Requirement

The dashboard page must visually match the provided reference image as closely as possible.

The reference image is the source of truth for:

- Overall composition.
- Layout proportions.
- Background style.
- Color palette.
- Typography hierarchy.
- Card shapes.
- Filter location.
- Table location.
- Chart types.
- Button style.
- Spacing.
- General presentation quality.

The desired page is a polished, professional dashboard suitable for presenting to a supervisor or project stakeholder.

## 4. Expected Dashboard Layout

The page must replicate the reference layout with the following elements:

### 4.1 Page Header

- Large title: `Dashboard truckscan`
- Subtitle: `FE GRANDE - Centinela`
- Title and subtitle must be placed over a modern gradient background.
- The page should feel like a compact operational dashboard, not a generic table page.

### 4.2 Filter Panel

The dashboard must include a filter panel similar to the reference image.

Required controls:

- `Desde` date input.
- `Hasta` date input.
- `Patente` selector.
- `Carga` selector.
- `Dirección` selector.
- `Alerta` selector.
- `Aplicar filtros` button.

The labels must remain in Spanish because the dashboard is intended for Spanish-speaking operational users.

The filter panel should be placed in the upper-left area, matching the visual reference.

### 4.3 Main Table

The central-left section must contain an event table with the following visible columns:

- `Fecha`
- `Hora`
- `Patente`
- `Carga`
- `Dirección`
- `Volumen`
- `Observación`
- `Alerta`

The table must look visually similar to the reference image.

The alert column must be visually encoded:

- Green/positive style for OK events.
- Yellow/orange style for warning events.
- Red style for error or critical events.
- Gray style for unknown or missing states.

### 4.4 Right-Side Charts

The right side of the dashboard must contain three chart cards:

1. `Carga acumulada`
   - Recommended chart type: line chart.
   - Shows accumulated volume over time after filters are applied.

2. `Volumen por camión`
   - Recommended chart type: doughnut or pie chart.
   - Shows total volume grouped by truck plate.

3. `Volumen por día/camión`
   - Recommended chart type: stacked or grouped bar chart.
   - Shows daily volume grouped by truck plate.

Use the chart types and placement shown in the reference image.

## 5. Data Source

The site must read data from a static JSON file committed to the repository.

The developer is free to define the exact JSON format, as long as:

- It is simple to edit manually.
- It is documented clearly in a `.txt` file.
- It supports all required table columns.
- It supports all required filters.
- It supports all required charts.
- It includes a metadata section with dashboard title, site name, and last update.

Recommended data file path:

```text
/data/events.json
```

The JavaScript must fetch the JSON file from the static site, for example:

```javascript
fetch(`./data/events.json?t=${Date.now()}`)
```

A cache-busting query parameter is required so that manual updates to the JSON are visible quickly after a GitHub Pages deployment.

## 6. Suggested JSON Format

Codex may adjust this format if needed, but the final project must include a clear explanation of the selected format in a text file.

Recommended example:

```json
{
  "metadata": {
    "dashboard_title": "Dashboard truckscan",
    "site_name": "FE GRANDE - Centinela",
    "last_update": "2026-05-03T12:00:00-04:00",
    "data_mode": "manual_demo"
  },
  "events": [
    {
      "event_id": "demo_001",
      "date": "2026-04-01",
      "time": "09:31:04",
      "plate": "AAAA11",
      "truck_code": "01",
      "load": "Arena",
      "direction": "Ida",
      "volume_m3": 17.58,
      "observation": "-",
      "alert_label": "OK",
      "alert_level": "ok"
    },
    {
      "event_id": "demo_002",
      "date": "2026-04-01",
      "time": "11:02:58",
      "plate": "BBBB22",
      "truck_code": "02",
      "load": "Vacío",
      "direction": "Vuelta",
      "volume_m3": 1.15,
      "observation": "Preguntar conductor",
      "alert_label": "No vaciado por completo",
      "alert_level": "warning"
    }
  ]
}
```

Required `alert_level` values:

- `ok`
- `warning`
- `error`
- `unknown`

The frontend must tolerate missing optional fields and display a reasonable fallback such as `-`, `Sin dato`, or `Desconocido`.

## 7. Frontend Behavior

### 7.1 Initial Load

On page load:

1. Fetch `/data/events.json`.
2. Validate that the JSON contains an `events` array.
3. Populate filter options dynamically from the data.
4. Render the table.
5. Render all charts.
6. Show the last update timestamp from `metadata.last_update`.

### 7.2 Filtering

When the user clicks `Aplicar filtros`:

1. Read all filter control values.
2. Filter the event list client-side.
3. Re-render the table.
4. Re-render all charts using the filtered events.

Filtering may be performed in JavaScript because this is a static demo version. However, keep the logic clean and readable.

### 7.3 Auto Refresh

Include an optional automatic JSON refresh.

Recommended behavior:

- Reload data every 30 seconds.
- Preserve the selected filters when data is refreshed.
- If the JSON fails to load, keep the previous data visible and show a small non-intrusive error message.

This allows a user to keep the dashboard open while the maintainer updates `data/events.json` in GitHub.

## 8. Charting Library

Use **Chart.js** unless there is a strong reason to choose another library.

Preferred integration for this temporary demo:

- Use a CDN script in `index.html` for simplicity.
- Document the CDN dependency in the README.

If avoiding external dependencies is easy, local vendoring is acceptable, but not required.

## 9. GitHub Pages Requirements

The project must be immediately deployable using GitHub Pages.

Do not require a build step unless absolutely necessary.

Preferred setup:

```text
repository-root/
  index.html
  styles.css
  dashboard.js
  data/
    events.json
  README.md
  JSON_FORMAT.txt
  .gitignore
```

This allows GitHub Pages to serve from:

- Branch: `main`
- Folder: `/root`

The project must work when opened from a path like:

```text
https://USERNAME.github.io/REPOSITORY_NAME/
```

Therefore, use relative paths such as:

```text
./styles.css
./dashboard.js
./data/events.json
```

Do not use absolute root paths like:

```text
/styles.css
/data/events.json
```

because those can break on project pages.

## 10. Required Files

The final project must include at least:

### 10.1 `index.html`

Main static page.

Must include:

- Dashboard layout.
- Filter controls.
- Table container.
- Chart containers.
- Script references.
- Responsive viewport metadata.

### 10.2 `styles.css`

All visual styling.

Must prioritize matching the reference image.

Must include:

- Gradient background.
- Dashboard panels/cards.
- Table styling.
- Filter styling.
- Button styling.
- Alert badges.
- Chart containers.
- Responsive behavior for narrower screens.

### 10.3 `dashboard.js`

Main frontend logic.

Must include:

- JSON fetch with cache busting.
- Data validation.
- Filter option generation.
- Filtering logic.
- Table rendering.
- Chart rendering.
- Chart cleanup/recreation to avoid duplicate Chart.js instances.
- Optional auto-refresh.
- Error display.

### 10.4 `data/events.json`

Demo data file.

Must include enough sample events to make all filters and charts meaningful.

Use anonymized/fake data only.

### 10.5 `README.md`

Must explain:

- What the project is.
- How to open locally.
- How to update the JSON.
- How to deploy with GitHub Pages.
- How to share the link.
- Cache considerations.
- That the demo is static and not connected to live ROS2/GCP data.

### 10.6 `JSON_FORMAT.txt`

Must explain:

- Expected JSON file path.
- Metadata fields.
- Event fields.
- Required fields.
- Optional fields.
- Allowed alert levels.
- Example event object.
- How table columns map to JSON fields.
- How charts are computed.

### 10.7 `.gitignore`

Must keep the repository clean.

Recommended content:

```gitignore
# OS files
.DS_Store
Thumbs.db

# Editor folders
.vscode/
.idea/

# Logs and temporary files
*.log
*.tmp
*.bak

# Python artifacts, in case local helper scripts are ever used manually
__pycache__/
*.pyc
.venv/
venv/

# Node artifacts, in case a local static server is used for testing
node_modules/

# Secrets must never be committed
.env
*.key
*.pem
*service-account*.json
```

Do not ignore the `data/` folder. The demo JSON must be committed.

## 11. Local Testing Requirement

Because browser security rules may block `fetch()` when opening `index.html` directly with `file://`, the README must recommend testing with a simple local static server.

Examples:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

This local test command is only for development. It is not required for end users after deployment.

## 12. Data Update Workflow

The README must explain the intended update workflow:

1. Edit `data/events.json`.
2. Commit the change.
3. Push to GitHub.
4. GitHub Pages redeploys automatically.
5. The shared link remains the same.
6. Users refresh the page or wait for the dashboard auto-refresh.

Example:

```bash
git add data/events.json
git commit -m "Update dashboard demo data"
git push
```

## 13. Security and Privacy Requirements

This is a public/static demo by default.

Use fake or anonymized data in `data/events.json`.

Do not include:

- Real credentials.
- GCP keys.
- Service account JSON files.
- Internal paths.
- Real private client data.
- Sensitive license plates unless explicitly approved.
- ROS2 logs or raw operational files.

## 14. Implementation Quality Requirements

The code must be clean, readable, and easy to edit.

Use:

- Descriptive function names.
- Simple modular JavaScript functions.
- No minified code.
- No unnecessary frameworks.
- No backend assumptions.
- Defensive JSON parsing.
- Clear fallback rendering for empty datasets.

The dashboard should still render gracefully when:

- The JSON file has zero events.
- A filter returns zero events.
- Some optional fields are missing.
- A volume is missing or invalid.

## 15. Acceptance Criteria

The task is complete when:

1. The folder can be pushed directly to a GitHub repository.
2. GitHub Pages can serve it from the repository root.
3. The page visually matches the provided reference image closely.
4. The page reads data from `./data/events.json`.
5. The table renders the JSON data.
6. The filters work.
7. The three charts update after filtering.
8. Updating `data/events.json` and pushing to GitHub updates the dashboard at the same shared link.
9. The README explains GitHub Pages deployment and JSON updates.
10. `JSON_FORMAT.txt` clearly documents the expected JSON structure.
11. `.gitignore` is present and prevents accidental upload of irrelevant or sensitive files.

## 16. Final Instruction for Codex

Create the complete static dashboard project. Prioritize visual fidelity to the reference image, GitHub Pages compatibility, simple manual JSON updates, and clear documentation. Do not add backend dependencies or connect to any external data source besides the static JSON file.
