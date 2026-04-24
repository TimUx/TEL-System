// Dashboard functionality
let dashboardData = {
    assignments: [],
    vehicles: [],
    operation: null
};
const { buildVehicleAssignmentOverview } = window.vehicleAssignmentUtils;
const e = escapeHtml;
let dashboardUpdateInFlight = false;
let lastDashboardSignature = '';

function byId(id) {
    return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', async () => {
    await updateDashboard();
    setInterval(updateDashboard, 3000); // Update every 3 seconds
});

async function updateDashboard() {
    if (dashboardUpdateInFlight) return;
    dashboardUpdateInFlight = true;
    try {
        // Get active operation
        dashboardData.operation = await api.getActiveOperation();
        
        if (!dashboardData.operation) {
            showNoOperation();
            return;
        }
        
        // Load data
        dashboardData.assignments = await api.getAssignments();
        dashboardData.vehicles = await api.getVehicles();

        const signature = JSON.stringify({
            operation: dashboardData.operation?.id || null,
            assignments: dashboardData.assignments.map((a) => [a.id, a.status, a.vehicles.length]),
            vehicles: dashboardData.vehicles.map((v) => [v.id, v.location_id, v.crew_count])
        });
        if (signature === lastDashboardSignature) {
            return;
        }
        lastDashboardSignature = signature;

        // Update displays
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
    document.querySelector('.dashboard-content').innerHTML = `
        <div style="text-align: center; padding: 50px; color: #95a5a6;">
            <h2>Keine aktive Einsatzlage</h2>
        </div>
    `;
}

function updateStatistics() {
    // Count statistics
    const totalAssignments = dashboardData.assignments.length;
    const assignedVehicles = new Set();
    let totalPersonnel = 0;
    
    dashboardData.assignments.forEach(assignment => {
        if (assignment.status !== 'completed') {
            assignment.vehicles.forEach(vehicleCallsign => {
                assignedVehicles.add(vehicleCallsign);
                const vehicle = dashboardData.vehicles.find(v => v.callsign === vehicleCallsign);
                if (vehicle) {
                    totalPersonnel += vehicle.crew_count;
                }
            });
        }
    });
    
    // Update display
    byId('statsAssignments').textContent = totalAssignments;
    byId('statsVehicles').textContent = assignedVehicles.size;
    byId('statsPersonnel').textContent = totalPersonnel;
}

function updateAssignmentsDisplay() {
    // Group by status
    const open = dashboardData.assignments.filter(a => a.status === 'open');
    const assigned = dashboardData.assignments.filter(a => a.status === 'assigned');
    const completed = dashboardData.assignments.filter(a => a.status === 'completed');
    
    // Render each group
    renderAssignmentGroup('openAssignments', open);
    renderAssignmentGroup('assignedAssignments', assigned);
    renderAssignmentGroup('completedAssignments', completed);
}

function renderAssignmentGroup(containerId, assignments) {
    const container = byId(containerId);
    
    if (assignments.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; padding: 10px;">Keine Aufträge</p>';
        return;
    }
    
    container.innerHTML = '';
    assignments.forEach(assignment => {
        const card = document.createElement('div');
        card.className = `assignment-card status-${assignment.status}`;
        
        card.innerHTML = `
            <div class="assignment-number">${e(getSequentialNumber(assignment.number))}</div>
            <div class="assignment-title">${e(assignment.title)}</div>
            ${assignment.location_address ? 
                `<div class="assignment-location">${e(assignment.location_address)}</div>` : ''}
            ${assignment.vehicles.length > 0 ? 
                `<div class="assignment-vehicles">Fahrzeuge: ${assignment.vehicles.map((v) => e(v)).join(', ')}</div>` : ''}
        `;
        
        container.appendChild(card);
    });
}

function updateVehiclesDisplay() {
    const { activeVehicles, inactiveVehiclesByLocation } = buildVehicleAssignmentOverview(
        dashboardData.vehicles,
        dashboardData.assignments
    );
    
    // Render active vehicles
    renderActiveVehicles(activeVehicles);
    
    // Render vehicles by location
    renderVehiclesByLocation(inactiveVehiclesByLocation);
}

function renderActiveVehicles(vehicleData) {
    const container = byId('activeVehicles');
    
    if (vehicleData.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; padding: 10px;">Keine Fahrzeuge im Einsatz</p>';
        return;
    }
    
    // Create grid container for active vehicles
    const gridContainer = document.createElement('div');
    gridContainer.className = 'vehicle-list-active';
    
    vehicleData.forEach(({ vehicle, assignments, activeAssignments }) => {
        const card = document.createElement('div');
        card.className = 'vehicle-card active';
        
        // Separate active and completed assignments
        const completedAssignments = assignments.filter(a => a.status === 'completed');
        
        // Build assignment numbers display
        let assignmentsHtml = '';
        if (assignments.length > 0) {
            assignmentsHtml = '<div class="vehicle-assignments">';
            
            // Show active assignments first
            activeAssignments.forEach((a, index) => {
                const isFirst = index === 0;
                assignmentsHtml += `<span class="assignment-badge ${isFirst ? 'active' : 'queued'}">${e(getSequentialNumber(a.number))}</span>`;
            });
            
            // Show completed assignments
            completedAssignments.forEach(a => {
                assignmentsHtml += `<span class="assignment-badge completed">${e(getSequentialNumber(a.number))}</span>`;
            });
            
            assignmentsHtml += '</div>';
        }
        
        card.innerHTML = `
            <div class="vehicle-info">
                <div class="vehicle-callsign">${e(vehicle.callsign)}</div>
                <div class="vehicle-type">${e(vehicle.vehicle_type || '')}</div>
                <div class="vehicle-crew">👥 ${vehicle.crew_count}</div>
            </div>
            ${assignmentsHtml}
        `;
        
        gridContainer.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(gridContainer);
}

function renderVehiclesByLocation(vehiclesByLocation) {
    const container = byId('vehiclesByLocation');
    container.innerHTML = '';
    
    Object.entries(vehiclesByLocation).forEach(([locationName, vehicles]) => {
        const group = document.createElement('div');
        group.className = 'vehicle-group';
        
        const header = document.createElement('h3');
        header.textContent = locationName;
        group.appendChild(header);
        
        const list = document.createElement('div');
        list.className = 'vehicle-list-grid';
        
        vehicles.forEach(vehicle => {
            const card = document.createElement('div');
            card.className = 'vehicle-card inactive';
            
            card.innerHTML = `
                <div class="vehicle-callsign-small">${e(vehicle.callsign)}</div>
                <div class="vehicle-type-small">${e(vehicle.vehicle_type || '')}</div>
                <div class="vehicle-crew-small">👥 ${vehicle.crew_count}</div>
            `;
            
            list.appendChild(card);
        });
        
        group.appendChild(list);
        container.appendChild(group);
    });
}
