"use strict";

const AUTO_REFRESH_MS = 30000;
const ALERT_LABELS = {
  ok: "OK",
  warning: "Advertencia",
  error: "Error",
  unknown: "Desconocido"
};
const ALERT_ORDER = ["ok", "warning", "error", "unknown"];
const CHART_COLORS = ["#2563eb", "#06b6d4", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#ea580c"];
const GRID_COLOR = "rgba(148, 163, 184, 0.22)";
const TICK_COLOR = "#64748b";
const TEXT_COLOR = "#0f172a";

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
  els.resetFilters = document.querySelector("#resetFilters");
  els.refreshData = document.querySelector("#refreshData");
  els.lastUpdate = document.querySelector("#lastUpdate");
  els.recordCount = document.querySelector("#recordCount");
  els.statusMessage = document.querySelector("#statusMessage");
  els.tableBody = document.querySelector("#eventsTableBody");
  els.kpiVolumeTotal = document.querySelector("#kpiVolumeTotal");
  els.kpiVolumeIn = document.querySelector("#kpiVolumeIn");
  els.kpiVolumeOut = document.querySelector("#kpiVolumeOut");
  els.kpiRecordsTotal = document.querySelector("#kpiRecordsTotal");
  els.kpiRecordsIn = document.querySelector("#kpiRecordsIn");
  els.kpiRecordsOut = document.querySelector("#kpiRecordsOut");
  els.kpiAlertsTotal = document.querySelector("#kpiAlertsTotal");
  els.kpiAlertsIn = document.querySelector("#kpiAlertsIn");
  els.kpiAlertsOut = document.querySelector("#kpiAlertsOut");
  els.kpiAvgIn = document.querySelector("#kpiAvgIn");
  els.kpiAvgOut = document.querySelector("#kpiAvgOut");
  els.cumulativeChart = document.querySelector("#cumulativeChart");
  els.truckVolumeChart = document.querySelector("#truckVolumeChart");
  els.dailyTruckChart = document.querySelector("#dailyTruckChart");
}

function bindEvents() {
  els.filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });

  [
    els.filterFrom,
    els.filterTo,
    els.filterPlate,
    els.filterLoad,
    els.filterDirection,
    els.filterAlert,
    els.filterRowLimit
  ].forEach((input) => {
    input.addEventListener("change", applyFilters);
  });

  [els.filterFrom, els.filterTo].forEach((input) => {
    input.addEventListener("input", syncDateInputClasses);
    input.addEventListener("change", syncDateInputClasses);
  });

  els.resetFilters.addEventListener("click", resetFilters);
  els.refreshData.addEventListener("click", () => loadDashboardData());

  window.addEventListener("resize", debounce(resizeCharts, 120));
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
    applyFilters({ preserveStatus: true });
    setStatus(options.silent ? "Datos actualizados." : "Datos cargados.", "ok");
  } catch (error) {
    console.error(error);
    if (!state.events.length) {
      state.events = [];
      populateFilters(previousFilters);
      applyFilters({ preserveStatus: true });
    }
    setStatus("No se pudo cargar data/events.json. Se mantiene la última vista disponible.", "error");
  }
}

function applyMetadata() {
  const title = fallbackText(state.metadata.dashboard_title, "Truckscan");
  const siteName = fallbackText(state.metadata.site_name, "Operación volumétrica");

  els.dashboardTitle.textContent = title;
  els.siteName.textContent = siteName;
  document.title = title;

  const lastUpdate = fallbackText(state.metadata.last_update, "");
  els.lastUpdate.textContent = "Última actualización: " + (lastUpdate ? formatTimestamp(lastUpdate) : "Sin dato");
}

function populateFilters(previousFilters) {
  setSelectOptions(els.filterPlate, uniqueValues(state.events.map((event) => event.plate)), "Todas", previousFilters.plate);
  setSelectOptions(els.filterLoad, uniqueValues(state.events.map((event) => event.load)), "Todas", previousFilters.load);
  setSelectOptions(
    els.filterDirection,
    uniqueValues(state.events.map((event) => event.direction)),
    "Todas",
    previousFilters.direction
  );
  setSelectOptions(els.filterAlert, ALERT_ORDER, "Todas", previousFilters.alert, ALERT_LABELS);

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
    select.appendChild(createOption(value, labels[value] || formatTextLabel(value)));
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
  renderKpis(filteredEvents);
  renderRecordCount(tableEvents.length, filteredEvents.length, state.events.length);
  renderTable(tableEvents, filteredEvents.length);
  renderCharts(filteredEvents);
}

function resetFilters() {
  els.filterFrom.value = "";
  els.filterTo.value = "";
  els.filterPlate.value = "";
  els.filterLoad.value = "";
  els.filterDirection.value = "";
  els.filterAlert.value = "";
  els.filterRowLimit.value = "";
  syncDateInputClasses();
  applyFilters();
  setStatus("Filtros limpiados.", "ok");
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
  const sorted = getSortedEvents(events);
  if (!Number.isInteger(limit) || limit <= 0) {
    return sorted;
  }
  return sorted.slice(0, limit);
}

function renderKpis(events) {
  const summary = summarizeEvents(events);

  els.kpiVolumeTotal.textContent = formatSignedVolume(summary.volume.totalNet);
  els.kpiVolumeIn.textContent = formatVolumeCompact(summary.volume.ida);
  els.kpiVolumeOut.textContent = formatVolumeCompact(summary.volume.vuelta);

  els.kpiRecordsTotal.textContent = formatInteger(summary.records.total);
  els.kpiRecordsIn.textContent = formatInteger(summary.records.ida);
  els.kpiRecordsOut.textContent = formatInteger(summary.records.vuelta);

  els.kpiAlertsTotal.textContent = formatInteger(summary.alerts.total);
  els.kpiAlertsIn.textContent = formatInteger(summary.alerts.ida);
  els.kpiAlertsOut.textContent = formatInteger(summary.alerts.vuelta);

  els.kpiAvgIn.textContent = formatVolumeCompact(summary.averages.ida);
  els.kpiAvgOut.textContent = formatVolumeCompact(summary.averages.vuelta);
}

function summarizeEvents(events) {
  const idaEvents = events.filter(isIdaDirection);
  const vueltaEvents = events.filter(isVueltaDirection);

  const volumeIda = idaEvents.reduce((sum, event) => sum + rawVolume(event), 0);
  const volumeVuelta = vueltaEvents.reduce((sum, event) => sum + rawVolume(event), 0);
  const volumeTotalNet = events.reduce((sum, event) => sum + signedVolume(event), 0);

  const alertEvents = events.filter(isAlertEvent);
  const alertIdaEvents = idaEvents.filter(isAlertEvent);
  const alertVueltaEvents = vueltaEvents.filter(isAlertEvent);

  return {
    volume: {
      totalNet: volumeTotalNet,
      ida: volumeIda,
      vuelta: volumeVuelta
    },
    records: {
      total: events.length,
      ida: idaEvents.length,
      vuelta: vueltaEvents.length
    },
    alerts: {
      total: alertEvents.length,
      ida: alertIdaEvents.length,
      vuelta: alertVueltaEvents.length
    },
    averages: {
      ida: idaEvents.length ? volumeIda / idaEvents.length : 0,
      vuelta: vueltaEvents.length ? volumeVuelta / vueltaEvents.length : 0
    }
  };
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
    row.appendChild(createTextCell(formatTextLabel(event.load), "Carga"));
    row.appendChild(createTextCell(formatTextLabel(event.direction), "Dirección"));
    row.appendChild(createVolumeCell(event.volume_m3));
    row.appendChild(createTextCell(event.observation, "Observación"));

    const alertCell = document.createElement("td");
    alertCell.dataset.label = "Alerta";
    alertCell.className = "alert-cell alert-" + event.alert_level;
    alertCell.title = event.alert_label;
    alertCell.setAttribute("aria-label", event.alert_label);

    const alertBadge = document.createElement("span");
    alertBadge.className = "alert-badge";
    alertBadge.textContent = event.alert_label;
    alertCell.appendChild(alertBadge);
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

function createVolumeCell(value) {
  const cell = document.createElement("td");
  cell.dataset.label = "Volumen";

  const pill = document.createElement("span");
  pill.className = "volume-pill";
  pill.textContent = formatVolume(value);
  cell.appendChild(pill);

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
  const tooltipLabels = [];

  sortedEvents.forEach((event) => {
    cumulative += signedVolume(event);
    labels.push(event.date ? formatDisplayDate(event.date) : "Sin fecha");
    tooltipLabels.push(fullDateTime(event));
    values.push(roundTwo(cumulative));
  });

  const chartData = labels.length
    ? { labels, values, tooltipLabels }
    : { labels: ["Sin datos"], values: [0], tooltipLabels: ["Sin datos"] };

  return new Chart(els.cumulativeChart, {
    type: "line",
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: "Carga acumulada neta",
          data: chartData.values,
          eventLabels: chartData.tooltipLabels,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          pointBackgroundColor: "#2563eb",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 3,
          tension: 0.34,
          fill: true
        }
      ]
    },
    options: lineChartOptions()
  });
}

function createTruckVolumeChart(events) {
  const totals = groupTotals(events, (event) => event.plate, signedVolume);
  const allLabels = Object.keys(totals).sort(collator.compare);
  const positiveLabels = allLabels.filter((label) => totals[label] > 0);
  const labels = positiveLabels.length ? positiveLabels : allLabels;
  const values = labels.map((label) => roundTwo(Math.max(totals[label], 0)));
  const netValues = labels.map((label) => roundTwo(totals[label]));
  const hasVolume = values.some((value) => value > 0);

  return new Chart(els.truckVolumeChart, {
    type: "doughnut",
    data: {
      labels: hasVolume ? labels : ["Sin datos"],
      datasets: [
        {
          data: hasVolume ? values : [1],
          netValues: hasVolume ? netValues : [0],
          backgroundColor: hasVolume ? labels.map((_, index) => colorAt(index)) : ["rgba(148, 163, 184, 0.58)"],
          borderColor: "#ffffff",
          borderWidth: 3,
          hoverOffset: 5
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
              .reduce((sum, event) => sum + signedVolume(event), 0)
          )
        ),
        backgroundColor: colorAt(index),
        borderWidth: 0,
        borderRadius: stackedBarRadius,
        borderSkipped: false,
        barPercentage: 0.74,
        categoryPercentage: 0.68
      }))
    : [
        {
          label: "Sin datos",
          data: [0],
          backgroundColor: "rgba(148, 163, 184, 0.58)",
          borderWidth: 0
        }
      ];

  return new Chart(els.dailyTruckChart, {
    type: "bar",
    data: { labels, datasets },
    options: barChartOptions()
  });
}

function stackedBarRadius(context) {
  const value = Number(context.raw) || 0;
  if (value === 0) return 0;

  const radius = 7;
  const sign = value > 0 ? 1 : -1;
  const activeDatasetIndexes = context.chart.data.datasets
    .map((dataset, index) => ({ index, value: Number(dataset.data[context.dataIndex]) || 0 }))
    .filter((item) => (sign > 0 ? item.value > 0 : item.value < 0))
    .map((item) => item.index);

  if (!activeDatasetIndexes.length) return 0;

  const firstIndex = activeDatasetIndexes[0];
  const lastIndex = activeDatasetIndexes[activeDatasetIndexes.length - 1];
  const isFirst = context.datasetIndex === firstIndex;
  const isLast = context.datasetIndex === lastIndex;

  if (sign > 0) {
    return {
      topLeft: isLast ? radius : 0,
      topRight: isLast ? radius : 0,
      bottomLeft: isFirst ? radius : 0,
      bottomRight: isFirst ? radius : 0
    };
  }

  return {
    topLeft: isFirst ? radius : 0,
    topRight: isFirst ? radius : 0,
    bottomLeft: isLast ? radius : 0,
    bottomRight: isLast ? radius : 0
  };
}

function basePluginOptions() {
  return {
    legend: {
      labels: {
        color: TEXT_COLOR,
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: "circle",
        padding: 14,
        font: { size: 11, weight: "700" }
      }
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      titleColor: "#ffffff",
      bodyColor: "#e2e8f0",
      borderColor: "rgba(255, 255, 255, 0.14)",
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      titleFont: { size: 12, weight: "800" },
      bodyFont: { size: 12, weight: "650" }
    }
  };
}

function lineChartOptions() {
  const plugins = basePluginOptions();
  plugins.legend.display = false;
  plugins.tooltip.callbacks = {
    title: (items) => {
      const item = items && items.length ? items[0] : null;
      return item && item.dataset.eventLabels ? item.dataset.eventLabels[item.dataIndex] : "";
    },
    label: (context) => "Acumulado neto: " + formatSignedVolume(context.parsed.y)
  };

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins,
    layout: { padding: { top: 12, right: 10, left: 4, bottom: 2 } },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: TICK_COLOR,
          maxTicksLimit: 6,
          maxRotation: 0,
          autoSkip: true,
          font: { size: 11, weight: "650" }
        }
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID_COLOR, drawBorder: false },
        border: { display: false },
        ticks: {
          color: TICK_COLOR,
          font: { size: 11, weight: "650" },
          callback: (value) => formatChartNumber(value)
        }
      }
    }
  };
}

function doughnutChartOptions(hasVolume) {
  const plugins = basePluginOptions();
  plugins.legend.display = hasVolume;
  plugins.legend.position = "bottom";
  plugins.tooltip.enabled = hasVolume;
  plugins.tooltip.callbacks = {
    label: (context) => {
      const netValue = context.dataset.netValues ? context.dataset.netValues[context.dataIndex] : context.parsed;
      return context.label + ": " + formatSignedVolume(netValue);
    }
  };

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    cutout: "62%",
    plugins
  };
}

function barChartOptions() {
  const plugins = basePluginOptions();
  plugins.legend.position = "top";
  plugins.tooltip.callbacks = {
    label: (context) => context.dataset.label + ": " + formatSignedVolume(context.parsed.y)
  };

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins,
    layout: { padding: { top: 8, right: 6, left: 0, bottom: 0 } },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        border: { display: false },
        ticks: { color: TICK_COLOR, font: { size: 11, weight: "650" } }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: GRID_COLOR, drawBorder: false },
        border: { display: false },
        ticks: {
          color: TICK_COLOR,
          font: { size: 11, weight: "650" },
          callback: (value) => formatChartNumber(value)
        }
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
    direction_key: normalizeDirectionKey(event.direction),
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

function normalizeDirectionKey(direction) {
  const normalized = normalizeTextKey(direction);
  if (normalized === "ida" || normalized.includes("sentido ida")) {
    return "ida";
  }
  if (normalized === "vuelta" || normalized.includes("sentido vuelta")) {
    return "vuelta";
  }
  return "other";
}

function normalizeTextKey(value) {
  return fallbackText(value, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

function rawVolume(event) {
  return Number.isFinite(event.volume_m3) ? event.volume_m3 : 0;
}

function signedVolume(event) {
  return isVueltaDirection(event) ? -rawVolume(event) : rawVolume(event);
}

function isIdaDirection(event) {
  return event.direction_key === "ida";
}

function isVueltaDirection(event) {
  return event.direction_key === "vuelta";
}

function isAlertEvent(event) {
  return event.alert_level !== "ok";
}

function groupTotals(events, keyGetter, valueGetter = rawVolume) {
  return events.reduce((totals, event) => {
    const key = fallbackText(keyGetter(event), "Sin dato");
    totals[key] = (totals[key] || 0) + valueGetter(event);
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

function fullDateTime(event) {
  const date = event.date ? formatDisplayDate(event.date) : "Sin fecha";
  const time = event.time ? event.time.slice(0, 5) : "Sin hora";
  return date + " " + time;
}

function formatTextLabel(value) {
  const text = fallbackText(value, "Sin dato");
  if (text === "-" || text === "Sin dato") {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatVolume(value) {
  if (!Number.isFinite(value)) {
    return "Sin dato";
  }
  return formatChartNumber(value) + " m³";
}

function formatVolumeCompact(value) {
  return formatChartNumber(value) + " m³";
}

function formatSignedVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0 m³";
  }
  if (Math.abs(number) < 0.005) {
    return "0 m³";
  }
  return (number < 0 ? "-" : "") + formatChartNumber(Math.abs(number)) + " m³";
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

function formatInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return Math.round(number).toLocaleString("es-CL");
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
