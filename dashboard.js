"use strict";

const AUTO_REFRESH_MS = 30000;
const ALERT_LABELS = {
  ok: "OK",
  warning: "Advertencia",
  error: "Error",
  unknown: "Desconocido"
};
const ALERT_ORDER = ["ok", "warning", "error", "unknown"];
const CHART_COLORS = ["#477df0", "#a782ee", "#20b873", "#ffdc5c", "#ff4a50", "#7466f3"];
const GRID_COLOR = "rgba(0, 0, 0, 0.12)";
const TICK_COLOR = "rgba(0, 0, 0, 0.86)";

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
const state = {
  events: [],
  filteredEvents: [],
  metadata: {},
  charts: {}
};
const els = {};
let statusTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  loadDashboardData();
  window.setInterval(() => loadDashboardData({ silent: true }), AUTO_REFRESH_MS);
});

function cacheElements() {
  els.dashboardTitle = document.querySelector("#dashboardTitle");
  els.siteName = document.querySelector("#siteName");
  els.filterForm = document.querySelector("#filterForm");
  els.filterFrom = document.querySelector("#filterFrom");
  els.filterTo = document.querySelector("#filterTo");
  els.filterPlate = document.querySelector("#filterPlate");
  els.filterLoad = document.querySelector("#filterLoad");
  els.filterDirection = document.querySelector("#filterDirection");
  els.filterAlert = document.querySelector("#filterAlert");
  els.filterRowLimit = document.querySelector("#filterRowLimit");
  els.lastUpdate = document.querySelector("#lastUpdate");
  els.recordCount = document.querySelector("#recordCount");
  els.statusMessage = document.querySelector("#statusMessage");
  els.tableBody = document.querySelector("#eventsTableBody");
  els.cumulativeChart = document.querySelector("#cumulativeChart");
  els.truckVolumeChart = document.querySelector("#truckVolumeChart");
  els.dailyTruckChart = document.querySelector("#dailyTruckChart");
}

function bindEvents() {
  els.filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });

  window.addEventListener("resize", debounce(resizeCharts, 120));

  [els.filterFrom, els.filterTo].forEach((input) => {
    input.addEventListener("input", syncDateInputClasses);
    input.addEventListener("change", syncDateInputClasses);
  });
}

async function loadDashboardData(options = {}) {
  const previousFilters = getFilterValues();

  try {
    const response = await fetch("./data/events.json?t=" + Date.now(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.events)) {
      throw new Error("El JSON debe contener un arreglo events.");
    }

    state.metadata = isPlainObject(payload.metadata) ? payload.metadata : {};
    state.events = payload.events.map(normalizeEvent);

    applyMetadata();
    populateFilters(previousFilters);
    applyFilters();
    setStatus(options.silent ? "Datos actualizados." : "Datos cargados.", "ok");
  } catch (error) {
    console.error(error);
    if (!state.events.length) {
      state.events = [];
      populateFilters(previousFilters);
      applyFilters();
    }
    setStatus("No se pudo cargar data/events.json. Se mantiene la última vista disponible.", "error");
  }
}

function applyMetadata() {
  const title = fallbackText(state.metadata.dashboard_title, "Truckscan");
  const siteName = fallbackText(state.metadata.site_name, "Fegrande - Centinela");

  els.dashboardTitle.textContent = title;
  els.siteName.textContent = siteName;
  document.title = title;

  const lastUpdate = fallbackText(state.metadata.last_update, "");
  els.lastUpdate.textContent = "Última actualización: " + (lastUpdate ? formatTimestamp(lastUpdate) : "Sin dato");
}

function populateFilters(previousFilters) {
  setSelectOptions(els.filterPlate, uniqueValues(state.events.map((event) => event.plate)), "Patente", previousFilters.plate);
  setSelectOptions(els.filterLoad, uniqueValues(state.events.map((event) => event.load)), "Carga", previousFilters.load);
  setSelectOptions(
    els.filterDirection,
    uniqueValues(state.events.map((event) => event.direction)),
    "Dirección",
    previousFilters.direction
  );
  setSelectOptions(els.filterAlert, ALERT_ORDER, "Alerta", previousFilters.alert, ALERT_LABELS);
  els.filterRowLimit.value = previousFilters.rowLimit || "";

  els.filterFrom.value = previousFilters.from || "";
  els.filterTo.value = previousFilters.to || "";
  syncDateInputClasses();
}

function setSelectOptions(select, values, placeholder, selectedValue, labels = {}) {
  const optionValues = uniqueValues(values);
  if (selectedValue && !optionValues.includes(selectedValue)) {
    optionValues.unshift(selectedValue);
  }

  select.replaceChildren();
  select.appendChild(createOption("", placeholder));

  optionValues.forEach((value) => {
    select.appendChild(createOption(value, labels[value] || value));
  });

  select.value = selectedValue && optionValues.includes(selectedValue) ? selectedValue : "";
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function applyFilters() {
  const filters = getFilterValues();
  const filteredEvents = state.events.filter((event) => {
    if (filters.from && (!event.date || event.date < filters.from)) return false;
    if (filters.to && (!event.date || event.date > filters.to)) return false;
    if (filters.plate && event.plate !== filters.plate) return false;
    if (filters.load && event.load !== filters.load) return false;
    if (filters.direction && event.direction !== filters.direction) return false;
    if (filters.alert && event.alert_level !== filters.alert) return false;
    return true;
  });

  state.filteredEvents = filteredEvents;
  const tableEvents = applyRowLimit(filteredEvents, filters.rowLimit);
  renderRecordCount(tableEvents.length, filteredEvents.length, state.events.length);
  renderTable(tableEvents, filteredEvents.length);
  renderCharts(filteredEvents);
}

function getFilterValues() {
  return {
    from: els.filterFrom ? els.filterFrom.value : "",
    to: els.filterTo ? els.filterTo.value : "",
    plate: els.filterPlate ? els.filterPlate.value : "",
    load: els.filterLoad ? els.filterLoad.value : "",
    direction: els.filterDirection ? els.filterDirection.value : "",
    alert: els.filterAlert ? els.filterAlert.value : "",
    rowLimit: els.filterRowLimit ? els.filterRowLimit.value : ""
  };
}

function syncDateInputClasses() {
  [els.filterFrom, els.filterTo].forEach((input) => {
    input.classList.toggle("has-value", Boolean(input.value));
  });
}

function applyRowLimit(events, rowLimit) {
  const limit = Number(rowLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    return getSortedEvents(events);
  }
  return getSortedEvents(events).slice(0, limit);
}

function renderRecordCount(visibleCount, filteredCount, totalCount) {
  if (visibleCount < filteredCount) {
    els.recordCount.textContent =
      visibleCount +
      " de " +
      filteredCount +
      " " +
      pluralize(filteredCount, "registro filtrado", "registros filtrados");
    return;
  }

  if (filteredCount === totalCount) {
    els.recordCount.textContent = filteredCount + " " + pluralize(filteredCount, "registro", "registros");
    return;
  }

  els.recordCount.textContent =
    filteredCount + " de " + totalCount + " " + pluralize(totalCount, "registro", "registros");
}

function renderTable(events, filteredCount) {
  els.tableBody.replaceChildren();

  if (!events.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "empty-cell";
    cell.colSpan = 8;
    cell.textContent = filteredCount || state.events.length
      ? "Sin resultados para los filtros seleccionados."
      : "Sin eventos disponibles en data/events.json.";
    row.appendChild(cell);
    els.tableBody.appendChild(row);
    return;
  }

  events.forEach((event) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.dataset.label = "Fecha";
    const datePill = document.createElement("span");
    datePill.className = "date-pill";
    datePill.textContent = formatDisplayDate(event.date);
    dateCell.appendChild(datePill);
    row.appendChild(dateCell);

    row.appendChild(createTextCell(formatDisplayTime(event.time), "Hora"));
    row.appendChild(createTextCell(event.plate, "Patente"));
    row.appendChild(createTextCell(event.load, "Carga"));
    row.appendChild(createTextCell(event.direction, "Dirección"));
    row.appendChild(createTextCell(formatVolume(event.volume_m3), "Volumen"));
    row.appendChild(createTextCell(event.observation, "Observación"));

    const alertCell = document.createElement("td");
    alertCell.dataset.label = "Alerta";
    alertCell.className = "alert-cell alert-" + event.alert_level;
    alertCell.title = event.alert_label;
    alertCell.setAttribute("aria-label", event.alert_label);
    alertCell.textContent = event.alert_level === "ok" ? "" : event.alert_label;
    row.appendChild(alertCell);

    els.tableBody.appendChild(row);
  });
}

function createTextCell(text, label) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = text;
  return cell;
}

function renderCharts(events) {
  destroyCharts();

  if (!window.Chart) {
    setStatus("Chart.js no se pudo cargar. Revise la conexión al CDN.", "error");
    return;
  }

  state.charts.cumulative = createCumulativeChart(events);
  state.charts.truckVolume = createTruckVolumeChart(events);
  state.charts.dailyTruck = createDailyTruckChart(events);
}

function destroyCharts() {
  Object.values(state.charts).forEach((chart) => {
    if (chart) {
      chart.destroy();
    }
  });
  state.charts = {};
}

function resizeCharts() {
  Object.values(state.charts).forEach((chart) => {
    if (chart) {
      chart.resize();
    }
  });
}

function createCumulativeChart(events) {
  const sortedEvents = getSortedEvents(events);
  let cumulative = 0;
  const labels = [];
  const values = [];

  sortedEvents.forEach((event) => {
    cumulative += chartVolume(event);
    labels.push(shortTime(event.time));
    values.push(roundTwo(cumulative));
  });

  const chartData = labels.length
    ? { labels, values }
    : { labels: ["Sin datos"], values: [0] };

  return new Chart(els.cumulativeChart, {
    type: "line",
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: "Carga acumulada",
          data: chartData.values,
          borderColor: "#8172ff",
          backgroundColor: "rgba(129, 114, 255, 0.15)",
          pointBackgroundColor: "#8172ff",
          pointBorderColor: "#8172ff",
          pointRadius: 3,
          borderWidth: 3,
          tension: 0.36,
          fill: false
        }
      ]
    },
    options: lineChartOptions()
  });
}

function createTruckVolumeChart(events) {
  const totals = groupTotals(events, (event) => event.plate);
  const labels = Object.keys(totals).sort(collator.compare);
  const values = labels.map((label) => roundTwo(totals[label]));
  const hasVolume = values.some((value) => value > 0);

  return new Chart(els.truckVolumeChart, {
    type: "doughnut",
    data: {
      labels: hasVolume ? labels : ["Sin datos"],
      datasets: [
        {
          data: hasVolume ? values : [1],
          backgroundColor: hasVolume ? labels.map((_, index) => colorAt(index)) : ["rgba(180, 180, 180, 0.75)"],
          borderWidth: 0,
          hoverOffset: 4
        }
      ]
    },
    options: doughnutChartOptions(hasVolume)
  });
}

function createDailyTruckChart(events) {
  const dates = uniqueValues(events.map((event) => event.date || "Sin fecha"));
  const plates = uniqueValues(events.map((event) => event.plate));

  const labels = dates.length ? dates.map(formatDisplayDate) : ["Sin datos"];
  const datasets = plates.length
    ? plates.map((plate, index) => ({
        label: plate,
        data: dates.map((date) =>
          roundTwo(
            events
              .filter((event) => (event.date || "Sin fecha") === date && event.plate === plate)
              .reduce((sum, event) => sum + chartVolume(event), 0)
          )
        ),
        backgroundColor: colorAt(index),
        borderWidth: 0,
        borderRadius: 12,
        borderSkipped: false
      }))
    : [
        {
          label: "Sin datos",
          data: [0],
          backgroundColor: "rgba(180, 180, 180, 0.75)",
          borderWidth: 0
        }
      ];

  return new Chart(els.dailyTruckChart, {
    type: "bar",
    data: { labels, datasets },
    options: barChartOptions()
  });
}

function lineChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => "Acumulado: " + formatChartNumber(context.parsed.y) + " m3"
        }
      }
    },
    layout: {
      padding: {
        right: 8
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: TICK_COLOR,
          maxTicksLimit: 6,
          maxRotation: 0,
          autoSkip: true,
          font: { size: 11 }
        }
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID_COLOR },
        ticks: {
          color: TICK_COLOR,
          font: { size: 11 }
        }
      }
    }
  };
}

function doughnutChartOptions(hasVolume) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    cutout: "50%",
    plugins: {
      legend: {
        display: hasVolume,
        position: "bottom",
        labels: {
          color: TICK_COLOR,
          boxWidth: 9,
          boxHeight: 9,
          padding: 12,
          font: { size: 11 }
        }
      },
      tooltip: {
        enabled: hasVolume,
        callbacks: {
          label: (context) => context.label + ": " + formatChartNumber(context.parsed) + " m3"
        }
      }
    }
  };
}

function barChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: TICK_COLOR,
          boxWidth: 9,
          boxHeight: 9,
          padding: 10,
          font: { size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => context.dataset.label + ": " + formatChartNumber(context.parsed.y) + " m3"
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: TICK_COLOR, font: { size: 11 } }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: GRID_COLOR },
        ticks: { color: TICK_COLOR, font: { size: 11 } }
      }
    }
  };
}

function normalizeEvent(rawEvent) {
  const event = isPlainObject(rawEvent) ? rawEvent : {};
  const alertLevel = normalizeAlertLevel(event.alert_level);

  return {
    event_id: fallbackText(event.event_id, ""),
    date: normalizeDate(event.date),
    time: normalizeTime(event.time),
    plate: fallbackText(event.plate, "Sin dato"),
    truck_code: fallbackText(event.truck_code, ""),
    load: fallbackText(event.load, "Sin dato"),
    direction: fallbackText(event.direction, "Sin dato"),
    volume_m3: parseVolume(event.volume_m3),
    observation: fallbackText(event.observation, "-"),
    alert_label: fallbackText(event.alert_label, ALERT_LABELS[alertLevel]),
    alert_level: alertLevel
  };
}

function normalizeAlertLevel(level) {
  const normalized = fallbackText(level, "unknown").toLowerCase();
  return ALERT_ORDER.includes(normalized) ? normalized : "unknown";
}

function normalizeDate(date) {
  const value = fallbackText(date, "");
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function normalizeTime(time) {
  const value = fallbackText(time, "");
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return value.length === 5 ? value + ":00" : value;
  }
  return value || "";
}

function parseVolume(value) {
  const volume = Number(value);
  return Number.isFinite(volume) ? volume : null;
}

function chartVolume(event) {
  return Number.isFinite(event.volume_m3) ? event.volume_m3 : 0;
}

function groupTotals(events, keyGetter) {
  return events.reduce((totals, event) => {
    const key = fallbackText(keyGetter(event), "Sin dato");
    totals[key] = (totals[key] || 0) + chartVolume(event);
    return totals;
  }, {});
}

function getSortedEvents(events) {
  return [...events].sort((a, b) => {
    const aKey = (a.date || "9999-99-99") + "T" + (a.time || "99:99:99");
    const bKey = (b.date || "9999-99-99") + "T" + (b.time || "99:99:99");
    return aKey.localeCompare(bKey);
  });
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => fallbackText(value, "")).filter(Boolean))].sort(collator.compare);
}

function fallbackText(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const text = String(value).trim();
  return text ? text : fallback;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatDisplayDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value || "Sin dato";
  }
  return Number(match[3]) + "/" + Number(match[2]) + "/" + match[1];
}

function formatDisplayTime(value) {
  return value || "Sin dato";
}

function shortTime(value) {
  return value ? value.slice(0, 5) : "Sin dato";
}

function formatVolume(value) {
  if (!Number.isFinite(value)) {
    return "Sin dato";
  }
  return value === 0 ? "0 m3" : value.toFixed(2) + " m3";
}

function formatChartNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return number.toLocaleString("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function roundTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function colorAt(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

function debounce(callback, waitMs) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), waitMs);
  };
}

function setStatus(message, type) {
  window.clearTimeout(statusTimer);
  els.statusMessage.textContent = message;
  els.statusMessage.className = type === "error" ? "status-error" : "status-ok";

  if (message && type !== "error") {
    statusTimer = window.setTimeout(() => {
      els.statusMessage.textContent = "";
      els.statusMessage.className = "";
    }, 4500);
  }
}
