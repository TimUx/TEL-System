// Dashboard functionality
let dashboardData = {
    assignments: [],
    vehicles: [],
    operation: null
};

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
            <div class="assignment-number">${assignment.number}</div>
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
    // Get vehicles with active assignments
    const activeVehicles = [];
    const inactiveVehiclesByLocation = {};
    
    dashboardData.vehicles.forEach(vehicle => {
        const hasActiveAssignment = dashboardData.assignments.some(a => 
            a.vehicles.includes(vehicle.callsign) && a.status !== 'completed'
        );
        
        if (hasActiveAssignment) {
            activeVehicles.push(vehicle);
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

function renderActiveVehicles(vehicles) {
    const container = document.getElementById('activeVehicles');
    
    if (vehicles.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; padding: 10px;">Keine Fahrzeuge im Einsatz</p>';
        return;
    }
    
    container.innerHTML = '';
    vehicles.forEach(vehicle => {
        const assignment = dashboardData.assignments.find(a => 
            a.vehicles.includes(vehicle.callsign) && a.status !== 'completed'
        );
        
        const card = document.createElement('div');
        card.className = 'vehicle-card active';
        
        card.innerHTML = `
            <div>
                <div class="vehicle-callsign">${vehicle.callsign}</div>
                <div class="vehicle-type">${vehicle.vehicle_type || ''}</div>
                <div class="vehicle-crew">👥 ${vehicle.crew_count}</div>
            </div>
            ${assignment ? 
                `<div class="vehicle-assignment">📋 ${assignment.number}</div>` : ''}
        `;
        
        container.appendChild(card);
    });
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
        list.className = 'vehicle-list';
        
        vehicles.forEach(vehicle => {
            const card = document.createElement('div');
            card.className = 'vehicle-card';
            
            card.innerHTML = `
                <div>
                    <div class="vehicle-callsign">${vehicle.callsign}</div>
                    <div class="vehicle-type">${vehicle.vehicle_type || ''}</div>
                    <div class="vehicle-crew">👥 ${vehicle.crew_count}</div>
                </div>
            `;
            
            list.appendChild(card);
        });
        
        group.appendChild(list);
        container.appendChild(group);
    });
}
