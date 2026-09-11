let dashboardData = { assignments: [], vehicles: [], operation: null };
const { buildVehicleAssignmentOverview } = window.vehicleAssignmentUtils;
const { getAssignmentStatusLabel, getAssignmentStatusClass, getVehicleStatusLabel, getVehicleStatusClass } = window.statusUtils;
const e = escapeHtml;
let dashboardUpdateInFlight = false;
let lastDashboardSignature = '';

function byId(id) {
    return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', async () => {
    await updateDashboard();
    setInterval(updateDashboard, 3000);
});

async function updateDashboard() {
    if (dashboardUpdateInFlight) return;
    dashboardUpdateInFlight = true;
    try {
        dashboardData.operation = await api.getActiveOperation();
        if (!dashboardData.operation) {
            showNoOperation();
            return;
        }
        dashboardData.assignments = await api.getAssignments();
        dashboardData.vehicles = await api.getVehicles();
        const signature = JSON.stringify({
            operation: dashboardData.operation?.id || null,
            assignments: dashboardData.assignments.map((assignment) => [assignment.id, assignment.status, assignment.vehicle_count]),
            vehicles: dashboardData.vehicles.map((vehicle) => [vehicle.id, vehicle.status, vehicle.location_id]),
        });
        if (signature === lastDashboardSignature) return;
        lastDashboardSignature = signature;
        updateStatistics();
        updateAssignmentsDisplay();
        updateVehiclesDisplay();
    } catch (error) {
        console.error('Error updating dashboard:', error);
    } finally {
        dashboardUpdateInFlight = false;
    }
}

function showNoOperation() {
    document.querySelector('.dashboard-content').innerHTML = '<div style="text-align:center;padding:50px;color:#95a5a6;"><h2>Keine aktive Einsatzlage</h2></div>';
}

function updateStatistics() {
    const { deployedVehicles, availableVehiclesByLocation } = buildVehicleAssignmentOverview(dashboardData.vehicles, dashboardData.assignments);
    let totalPersonnel = 0;
    deployedVehicles.forEach(({ vehicle }) => { totalPersonnel += vehicle.crew_count || 0; });
    byId('statsAssignments').textContent = dashboardData.assignments.length;
    byId('statsVehicles').textContent = deployedVehicles.length;
    byId('statsAvailableVehicles').textContent = Object.values(availableVehiclesByLocation).flat().length;
    byId('statsPersonnel').textContent = totalPersonnel;
}

function updateAssignmentsDisplay() {
    renderAssignmentGroup('openAssignments', dashboardData.assignments.filter((assignment) => assignment.status === 'open'));
    renderAssignmentGroup('assignedAssignments', dashboardData.assignments.filter((assignment) => assignment.status === 'assigned'));
    renderAssignmentGroup('inProgressAssignments', dashboardData.assignments.filter((assignment) => assignment.status === 'in_progress'));
    renderAssignmentGroup('completedAssignments', dashboardData.assignments.filter((assignment) => assignment.status === 'completed'));
}

function renderAssignmentGroup(containerId, assignments) {
    const container = byId(containerId);
    if (assignments.length === 0) {
        container.innerHTML = '<p style="color:#95a5a6;padding:10px;">Keine Aufträge</p>';
        return;
    }
    container.innerHTML = assignments.map((assignment) => `
        <div class="assignment-card ${getAssignmentStatusClass(assignment.status)}">
            <div class="assignment-number">${e(getSequentialNumber(assignment.number))}</div>
            <div class="assignment-title">${e(assignment.title)}</div>
            <div class="assignment-status"><span class="status-pill ${getAssignmentStatusClass(assignment.status)}">${e(getAssignmentStatusLabel(assignment.status))}</span></div>
            ${assignment.location_address ? `<div class="assignment-location">${e(assignment.location_address)}</div>` : ''}
            ${assignment.vehicles.length > 0 ? `<div class="assignment-vehicles">Fahrzeuge: ${assignment.vehicles.map((vehicle) => e(vehicle)).join(', ')}</div>` : ''}
        </div>
    `).join('');
}

function updateVehiclesDisplay() {
    const { deployedVehicles, availableVehiclesByLocation, unavailableVehicles } = buildVehicleAssignmentOverview(dashboardData.vehicles, dashboardData.assignments);
    renderActiveVehicles(deployedVehicles);
    renderVehiclesByLocation(availableVehiclesByLocation);
    renderUnavailableVehicles(unavailableVehicles);
}

function renderActiveVehicles(vehicleData) {
    const container = byId('activeVehicles');
    if (vehicleData.length === 0) {
        container.innerHTML = '<p style="color:#95a5a6;padding:10px;">Keine Fahrzeuge im Einsatz</p>';
        return;
    }
    container.innerHTML = `<div class="vehicle-list-active">${vehicleData.map(({ vehicle, assignments, activeAssignments }) => `
        <div class="vehicle-card active">
            <div class="vehicle-info">
                <div class="vehicle-callsign">${e(vehicle.callsign)}</div>
                <div class="vehicle-type">${e(vehicle.vehicle_type || '')}</div>
                <div class="vehicle-status"><span class="vehicle-status-pill ${getVehicleStatusClass(vehicle.status)}">${e(getVehicleStatusLabel(vehicle.status))}</span></div>
                <div class="vehicle-crew">👥 ${vehicle.crew_count}</div>
            </div>
            <div class="vehicle-assignments">
                ${activeAssignments.map((assignment, index) => `<span class="assignment-badge ${index === 0 ? 'active' : 'queued'}">${e(getSequentialNumber(assignment.number))}</span>`).join('')}
                ${assignments.filter((assignment) => assignment.status === 'completed').map((assignment) => `<span class="assignment-badge completed">${e(getSequentialNumber(assignment.number))}</span>`).join('')}
            </div>
        </div>`).join('')}</div>`;
}

function renderVehiclesByLocation(vehiclesByLocation) {
    const container = byId('vehiclesByLocation');
    const groups = Object.entries(vehiclesByLocation);
    if (groups.length === 0) {
        container.innerHTML = '<p style="color:#95a5a6;padding:10px;">Keine verfügbaren Fahrzeuge</p>';
        return;
    }
    container.innerHTML = groups.map(([locationName, vehicles]) => `
        <div class="vehicle-group">
            <h3>${e(locationName)}</h3>
            <div class="vehicle-list-grid">
                ${vehicles.map((vehicle) => `
                    <div class="vehicle-card inactive">
                        <div class="vehicle-callsign-small">${e(vehicle.callsign)}</div>
                        <div class="vehicle-type-small">${e(vehicle.vehicle_type || '')}</div>
                        <div class="vehicle-status-small">${e(getVehicleStatusLabel(vehicle.status))}</div>
                        <div class="vehicle-crew-small">👥 ${vehicle.crew_count}</div>
                    </div>`).join('')}
            </div>
        </div>
    `).join('');
}

function renderUnavailableVehicles(vehicles) {
    const container = byId('unavailableVehicles');
    if (vehicles.length === 0) {
        container.innerHTML = '<p style="color:#95a5a6;padding:10px;">Keine gesperrten Fahrzeuge</p>';
        return;
    }
    container.innerHTML = `<div class="vehicle-list-grid">${vehicles.map((vehicle) => `
        <div class="vehicle-card unavailable">
            <div class="vehicle-callsign-small">${e(vehicle.callsign)}</div>
            <div class="vehicle-type-small">${e(vehicle.vehicle_type || '')}</div>
            <div class="vehicle-status-small">${e(getVehicleStatusLabel(vehicle.status))}</div>
            <div class="vehicle-crew-small">👥 ${vehicle.crew_count}</div>
        </div>`).join('')}</div>`;
}
