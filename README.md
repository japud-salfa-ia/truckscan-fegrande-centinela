# TruckScan Dashboard Demo

Static temporary dashboard for TruckScan. It is designed for GitHub Pages and reads anonymized demo events from `./data/events.json`.

## Local Test

Serve the repository root with a static HTTP server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Do not open `index.html` directly with `file://`; browser CORS rules can block loading `data/events.json`.

## Updating Demo Data

Edit:

```text
data/events.json
```

Keep the JSON valid. The dashboard fetches the file with a cache-busting query string, so updates are visible after GitHub Pages redeploys and the browser refreshes or the auto-refresh runs.

Typical update workflow:

```bash
git add data/events.json
git commit -m "Update dashboard data {date}"
git push
```

## Sharing the Link

After GitHub Pages publishes, share the Pages URL. Future updates to `data/events.json` keep the same public link; users can refresh the browser or wait for the dashboard auto-refresh.
