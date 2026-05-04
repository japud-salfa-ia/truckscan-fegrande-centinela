# AGENTS.md

## Project context

This repository contains a temporary static demo dashboard for TruckScan.

The goal is to build a GitHub Pages-ready static website that visually matches the provided dashboard reference image. The page must read demo data from a local JSON file and render filters, a table, and charts.

This repository is intentionally isolated from the real TruckScan ROS2, Ubuntu, Python, and GCP pipeline. Do not assume access to any external TruckScan files or services.

## Hard constraints

- Work only inside this repository.
- Do not add backend code.
- Do not add Python scripts.
- Do not add Node.js server code.
- Do not add GCP, ROS2, database, authentication, or deployment automation logic.
- The final site must be static and compatible with GitHub Pages.
- Use relative paths only.
- The main page must work under a GitHub Pages project URL such as: https://USERNAME.github.io/REPOSITORY_NAME/
- The dashboard must read data from: ./data/events.json
- Add cache busting when fetching the JSON.
- Use fake or anonymized demo data only.
- Do not include secrets, credentials, service account files, internal system paths, or sensitive operational data.

## Required files

The final repository must include:

- index.html
- styles.css
- dashboard.js
- data/events.json
- README.md
- JSON_FORMAT.txt
- .gitignore

## Visual requirements

The dashboard must match the provided reference image as closely as possible.

Required visual elements:

- Large gradient background.
- Main title: Dashboard truckscan
- Subtitle: FE GRANDE - Centinela
- Filter area with:
  - Desde
  - Hasta
  - Patente
  - Carga
  - Dirección
  - Alerta
  - Aplicar filtros
- Main table with:
  - Fecha
  - Hora
  - Patente
  - Carga
  - Dirección
  - Volumen
  - Observación
  - Alerta
- Right-side chart column with:
  - Line chart: Carga acumulada
  - Doughnut chart: Volumen por camión
  - Stacked or grouped bar chart: Volumen por día/camión

## Frontend requirements

- Use plain HTML, CSS, and JavaScript.
- Use Chart.js unless there is a strong reason not to.
- The frontend may filter the already-loaded JSON data.
- The frontend must not implement real business logic from the production system.
- The page must handle:
  - Empty JSON event lists.
  - Missing optional fields.
  - Invalid or failed JSON loading.
  - Filters with no matching results.
- Prefer readable, maintainable code over excessive abstraction.

## Documentation requirements

README.md must explain:

- What this project is.
- How to test it locally.
- How to update data/events.json.
- How to deploy it with GitHub Pages.
- How to share the final link.

JSON_FORMAT.txt must explain:

- The expected JSON structure.
- Metadata fields.
- Event fields.
- Valid alert levels.
- How table and charts use the data.

## Local testing

The site should be testable with:

python -m http.server 8000

Then open:

http://localhost:8000

Do not rely on opening index.html directly from the filesystem because browser CORS behavior may block JSON loading.
