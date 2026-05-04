# TruckScan Dashboard Demo

Static temporary dashboard for TruckScan. It is designed for GitHub Pages and reads anonymized demo events from `./data/events.json`.

This demo is only a presentation frontend. It is not connected to ROS2, GCP, databases, authentication, backend services, local folders, or production TruckScan data.

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
git commit -m "Update dashboard demo data"
git push
```

## GitHub Pages Deployment

1. Push this repository to GitHub.
2. Open the repository settings.
3. Go to `Pages`.
4. Set the source to the `main` branch and `/root` folder.
5. Save the configuration and wait for GitHub Pages to publish.

The site uses relative paths such as `./styles.css`, `./dashboard.js`, and `./data/events.json`, so it works under project URLs like:

```text
https://USERNAME.github.io/REPOSITORY_NAME/
```

## Sharing the Link

After GitHub Pages publishes, share the Pages URL. Future updates to `data/events.json` keep the same public link; users can refresh the browser or wait for the dashboard auto-refresh.

## External Dependency

The dashboard uses Chart.js from the jsDelivr CDN in `index.html`. No build step, Node.js server, or backend runtime is required.
