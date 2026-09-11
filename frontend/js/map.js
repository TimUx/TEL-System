let map;
let markers = {};
let dashboardData = { assignments: [], vehicles: [], operation: null };
const { buildVehicleAssignmentOverview, getVehicleAssignments } = window.vehicleAssignmentUtils;
const { getAssignmentStatusLabel, getVehicleStatusLabel } = window.statusUtils;
const e = escapeHtml;
const selectedAssignmentId = Number(new URLSearchParams(window.location.search).get('assignment') || 0);
let mapUpdateInFlight = false;
let lastMapSignature = '';
const VEHICLE_OFFSET_DISTANCE = 0.002;
const VEHICLE_OFFSET_ANGLE_STEP = 60;

function byId(id) {
    return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof L !== 'undefined') {
        map = L.map('map').setView([51.1657, 10.4515], 6);
        const imageBounds = [[47.27, 5.87], [55.06, 15.04]];
        L.imageOverlay('../screenshots/Screenshot_Openstreetmap.png', imageBounds).addTo(map);
    } else {
        const mapDiv = byId('map');
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;background:#ecf0f1;color:#7f8c8d;font-size:18px;';
        messageDiv.innerHTML = '<div style="text-align:center;"><p>Kartendarstellung nicht verfügbar</p><p style="font-size:14px;">Fahrzeuge und Aufträge werden in den Seitenleisten angezeigt.</p></div>';
        mapDiv.appendChild(messageDiv);
    }
    await updateMap();
    setInterval(updateMap, 5000);
});

async function updateMap() {
    if (mapUpdateInFlight) return;
    mapUpdateInFlight = true;
    try {
        dashboardData.operation = await api.getActiveOperation();
        if (!dashboardData.operation) {
            clearMarkers();
            updateSidebars();
            byId('selectedAssignmentInfo').textContent = 'Keine aktive Einsatzlage';
            return;
        }
        dashboardData.assignments = await api.getAssignments();
        dashboardData.vehicles = await api.getVehicles();
        const signature = JSON.stringify({
            operation: dashboardData.operation?.id || null,
            assignments: dashboardData.assignments.map((assignment) => [assignment.id, assignment.status, assignment.latitude, assignment.longitude, assignment.vehicle_count]),
            vehicles: dashboardData.vehicles.map((vehicle) => [vehicle.id, vehicle.status, vehicle.location_id]),
        });
        if (signature === lastMapSignature) return;
        lastMapSignature = signature;
        clearMarkers();
        if (typeof L !== 'undefined' && map) {
            dashboardData.assignments.forEach((assignment) => {
                if (assignment.latitude && assignment.longitude) {
                    addAssignmentMarker(assignment);
                }
            });
            const { deployedVehicles } = buildVehicleAssignmentOverview(dashboardData.vehicles, dashboardData.assignments);
            deployedVehicles.forEach(({ vehicle, activeAssignments }, index) => {
                const assignment = activeAssignments[0];
                if (assignment?.latitude && assignment?.longitude) {
                    addVehicleMarker(vehicle, assignment, index);
                }
            });
            focusSelection();
        }
        updateSidebars();
    } catch (error) {
        console.error('Error updating map:', error);
    } finally {
        mapUpdateInFlight = false;
    }
}

function focusSelection() {
    const selectedAssignment = dashboardData.assignments.find((assignment) => assignment.id === selectedAssignmentId);
    if (!selectedAssignment) {
        byId('selectedAssignmentInfo').textContent = 'Alle aktiven Aufträge';
        fitAllMarkers();
        return;
    }
    byId('selectedAssignmentInfo').textContent = `${getSequentialNumber(selectedAssignment.number)} · ${selectedAssignment.title}`;
    const marker = markers[`assignment_${selectedAssignment.id}`];
    if (marker && map) {
        marker.openTooltip();
        map.setView(marker.getLatLng(), 14);
    }
}

function fitAllMarkers() {
    if (!map || Object.keys(markers).length === 0) return;
    const bounds = Object.values(markers).map((marker) => marker.getLatLng());
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function addAssignmentMarker(assignment) {
    const markerKey = `assignment_${assignment.id}`;
    const iconHtml = `<div class="assignment-marker ${assignment.status === 'completed' ? 'completed' : ''} ${assignment.id === selectedAssignmentId ? 'highlight' : ''}">${e(getSequentialNumber(assignment.number))}</div>`;
    const icon = L.divIcon({ className: 'custom-marker', html: iconHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
    const marker = L.marker([assignment.latitude, assignment.longitude], { icon }).addTo(map);
    marker.bindTooltip(`
        <strong>Auftrag ${e(getSequentialNumber(assignment.number))}</strong><br>
        ${e(assignment.title)}<br>
        ${e(assignment.location_address || '')}<br>
        Status: ${e(getAssignmentStatusLabel(assignment.status))}<br>
        ${assignment.vehicles.length > 0 ? `Fahrzeuge: ${assignment.vehicles.map((vehicle) => e(vehicle)).join(', ')}` : 'Keine Fahrzeuge zugewiesen'}
    `, { permanent: false, direction: 'top', offset: [0, -10] });
    marker.on('click', () => {
        byId('selectedAssignmentInfo').textContent = `${getSequentialNumber(assignment.number)} · ${assignment.title}`;
        marker.openTooltip();
    });
    markers[markerKey] = marker;
}

function addVehicleMarker(vehicle, assignment, offsetIndex) {
    const markerKey = `vehicle_${vehicle.id}`;
    const angle = (offsetIndex * VEHICLE_OFFSET_ANGLE_STEP) * (Math.PI / 180);
    const offsetLat = assignment.latitude + (VEHICLE_OFFSET_DISTANCE * Math.cos(angle));
    const offsetLng = assignment.longitude + (VEHICLE_OFFSET_DISTANCE * Math.sin(angle));
    const symbolPath = getTacticalSymbolPath(vehicle.vehicle_type);
    const iconHtml = symbolPath ? `
        <div class="vehicle-marker-tactical">
            <img src="${symbolPath}" alt="${e(vehicle.vehicle_type)}" class="tactical-symbol">
            <div class="vehicle-marker-label">${e(vehicle.callsign)}</div>
        </div>` : `<div class="vehicle-marker">${e(vehicle.callsign)}</div>`;
    const icon = L.divIcon({ className: 'custom-marker', html: iconHtml, iconSize: symbolPath ? [60, 80] : [80, 40], iconAnchor: symbolPath ? [30, 70] : [40, 20] });
    const marker = L.marker([offsetLat, offsetLng], { icon }).addTo(map);
    const vehicleAssignments = getVehicleAssignments(vehicle, dashboardData.assignments);
    marker.bindTooltip(`
        <strong>${e(vehicle.callsign)}</strong><br>
        Typ: ${e(vehicle.vehicle_type || 'N/A')}<br>
        Status: ${e(getVehicleStatusLabel(vehicle.status))}<br>
        Besatzung: ${vehicle.crew_count}<br>
        ${vehicleAssignments.length > 0 ? `Aufträge: ${vehicleAssignments.map((item) => e(getSequentialNumber(item.number))).join(', ')}` : 'Kein Auftrag'}
    `, { permanent: false, direction: 'top', offset: [0, -20] });
    markers[markerKey] = marker;
}

function clearMarkers() {
    if (typeof L !== 'undefined' && map) {
        Object.values(markers).forEach((marker) => map.removeLayer(marker));
    }
    markers = {};
}

function updateSidebars() {
    const { deployedVehicles, availableVehiclesByLocation, unavailableVehicles } = buildVehicleAssignmentOverview(dashboardData.vehicles, dashboardData.assignments);
    renderDeployedVehicles(deployedVehicles);
    renderAvailableVehicles(availableVehiclesByLocation);
    renderUnavailableVehicles(unavailableVehicles);
}

function renderDeployedVehicles(vehicleData) {
    const container = byId('deployedVehicles');
    if (!dashboardData.operation) {
        container.innerHTML = '<p class="no-data">Keine aktive Einsatzlage</p>';
        return;
    }
    if (vehicleData.length === 0) {
        container.innerHTML = '<p class="no-data">Keine Fahrzeuge im Einsatz</p>';
        return;
    }
    container.innerHTML = vehicleData.map(({ vehicle, assignments }) => `
        <div class="sidebar-vehicle-card">
            <div class="sidebar-vehicle-callsign">${e(vehicle.callsign)}</div>
            <div class="sidebar-vehicle-type">${e(vehicle.vehicle_type || '')}</div>
            <div class="sidebar-vehicle-status">${e(getVehicleStatusLabel(vehicle.status))}</div>
            <div class="sidebar-vehicle-crew">👥 ${vehicle.crew_count}</div>
            <div class="sidebar-vehicle-assignments">${assignments.map((assignment) => `<span class="sidebar-assignment-badge">${e(getSequentialNumber(assignment.number))}</span>`).join('')}</div>
        </div>`).join('');
}

function renderAvailableVehicles(vehiclesByLocation) {
    const container = byId('availableVehicles');
    const groups = Object.entries(vehiclesByLocation);
    if (!dashboardData.operation) {
        container.innerHTML = '<p class="no-data">Keine aktive Einsatzlage</p>';
        return;
    }
    if (groups.length === 0) {
        container.innerHTML = '<p class="no-data">Keine verfügbaren Fahrzeuge</p>';
        return;
    }
    container.innerHTML = groups.map(([locationName, vehicles]) => `
        <div class="sidebar-location-group">
            <div class="sidebar-location-header">${e(locationName)}</div>
            ${vehicles.map((vehicle) => `
                <div class="sidebar-vehicle-card inactive">
                    <div class="sidebar-vehicle-callsign">${e(vehicle.callsign)}</div>
                    <div class="sidebar-vehicle-type">${e(vehicle.vehicle_type || '')}</div>
                    <div class="sidebar-vehicle-status">${e(getVehicleStatusLabel(vehicle.status))}</div>
                    <div class="sidebar-vehicle-crew">👥 ${vehicle.crew_count}</div>
                </div>`).join('')}
        </div>`).join('');
}

function renderUnavailableVehicles(vehicles) {
    const container = byId('unavailableVehicles');
    if (!dashboardData.operation) {
        container.innerHTML = '<p class="no-data">Keine aktive Einsatzlage</p>';
        return;
    }
    if (vehicles.length === 0) {
        container.innerHTML = '<p class="no-data">Keine gesperrten Fahrzeuge</p>';
        return;
    }
    container.innerHTML = vehicles.map((vehicle) => `
        <div class="sidebar-vehicle-card inactive">
            <div class="sidebar-vehicle-callsign">${e(vehicle.callsign)}</div>
            <div class="sidebar-vehicle-type">${e(vehicle.vehicle_type || '')}</div>
            <div class="sidebar-vehicle-status">${e(getVehicleStatusLabel(vehicle.status))}</div>
        </div>`).join('');
}
