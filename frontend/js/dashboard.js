// Dashboard functionality
let dashboardData = {
    assignments: [],
    vehicles: [],
    operation: null
};

// Helper function to extract sequential number from assignment number
function getSequentialNumber(assignmentNumber) {
    if (!assignmentNumber) return '';
    const parts = assignmentNumber.split('-');
    return parts.length > 0 ? parts[parts.length - 1] : assignmentNumber;
}

document.addEventListener('DOMContentLoaded', async () => {
    await updateDashboard();
    setInterval(updateDashboard, 3000); // Update every 3 seconds
});

async function updateDashboard() {
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
        
        // Update displays
        updateStatistics();
        updateAssignmentsDisplay();
        updateVehiclesDisplay();
    } catch (error) {
        console.error('Error updating dashboard:', error);
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
    document.getElementById('statsAssignments').textContent = totalAssignments;
    document.getElementById('statsVehicles').textContent = assignedVehicles.size;
    document.getElementById('statsPersonnel').textContent = totalPersonnel;
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
    const container = document.getElementById(containerId);
    
    if (assignments.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; padding: 10px;">Keine Aufträge</p>';
        return;
    }
    
    container.innerHTML = '';
    assignments.forEach(assignment => {
        const card = document.createElement('div');
        card.className = `assignment-card status-${assignment.status}`;
        
        card.innerHTML = `
            <div class="assignment-number">${getSequentialNumber(assignment.number)}</div>
            <div class="assignment-title">${assignment.title}</div>
            ${assignment.location_address ? 
                `<div class="assignment-location">${assignment.location_address}</div>` : ''}
            ${assignment.vehicles.length > 0 ? 
                `<div class="assignment-vehicles">🚒 ${assignment.vehicles.join(', ')}</div>` : ''}
        `;
        
        container.appendChild(card);
    });
}

function updateVehiclesDisplay() {
    // Get vehicles with active assignments and all their assignments
    const activeVehicles = [];
    const inactiveVehiclesByLocation = {};
    
    dashboardData.vehicles.forEach(vehicle => {
        // Find all assignments for this vehicle (not just active ones)
        const vehicleAssignments = dashboardData.assignments.filter(a => 
            a.vehicles.includes(vehicle.callsign)
        );
        
        const activeAssignments = vehicleAssignments.filter(a => a.status !== 'completed');
        
        if (activeAssignments.length > 0) {
            activeVehicles.push({
                vehicle: vehicle,
                assignments: vehicleAssignments
            });
        } else {
            const locationName = vehicle.location_name || 'Ohne Standort';
            if (!inactiveVehiclesByLocation[locationName]) {
                inactiveVehiclesByLocation[locationName] = [];
            }
            inactiveVehiclesByLocation[locationName].push(vehicle);
        }
    });
    
    // Render active vehicles
    renderActiveVehicles(activeVehicles);
    
    // Render vehicles by location
    renderVehiclesByLocation(inactiveVehiclesByLocation);
}

function renderActiveVehicles(vehicleData) {
    const container = document.getElementById('activeVehicles');
    
    if (vehicleData.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; padding: 10px;">Keine Fahrzeuge im Einsatz</p>';
        return;
    }
    
    // Create grid container for active vehicles
    const gridContainer = document.createElement('div');
    gridContainer.className = 'vehicle-list-active';
    
    vehicleData.forEach(({ vehicle, assignments }) => {
        const card = document.createElement('div');
        card.className = 'vehicle-card active';
        
        // Separate active and completed assignments
        const activeAssignments = assignments.filter(a => a.status !== 'completed');
        const completedAssignments = assignments.filter(a => a.status === 'completed');
        
        // Build assignment numbers display
        let assignmentsHtml = '';
        if (assignments.length > 0) {
            assignmentsHtml = '<div class="vehicle-assignments">';
            
            // Show active assignments first
            activeAssignments.forEach((a, index) => {
                const isFirst = index === 0;
                assignmentsHtml += `<span class="assignment-badge ${isFirst ? 'active' : 'queued'}">${getSequentialNumber(a.number)}</span>`;
            });
            
            // Show completed assignments
            completedAssignments.forEach(a => {
                assignmentsHtml += `<span class="assignment-badge completed">${getSequentialNumber(a.number)}</span>`;
            });
            
            assignmentsHtml += '</div>';
        }
        
        card.innerHTML = `
            <div class="vehicle-info">
                <div class="vehicle-callsign">${vehicle.callsign}</div>
                <div class="vehicle-type">${vehicle.vehicle_type || ''}</div>
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
    const container = document.getElementById('vehiclesByLocation');
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
                <div class="vehicle-callsign-small">${vehicle.callsign}</div>
                <div class="vehicle-type-small">${vehicle.vehicle_type || ''}</div>
                <div class="vehicle-crew-small">👥 ${vehicle.crew_count}</div>
            `;
            
            list.appendChild(card);
        });
        
        group.appendChild(list);
        container.appendChild(group);
    });
}
