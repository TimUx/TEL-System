// Map functionality with Leaflet
let map;
let markers = {};
let dashboardData = {
    assignments: [],
    vehicles: [],
    operation: null
};

// Constants for vehicle marker positioning
const VEHICLE_OFFSET_DISTANCE = 0.002; // Approximately 200 meters in degrees
const VEHICLE_OFFSET_ANGLE_STEP = 60; // Degrees between vehicles in circular pattern

// Helper function to extract sequential number from assignment number
function getSequentialNumber(assignmentNumber) {
    if (!assignmentNumber) return '';
    const parts = assignmentNumber.split('-');
    return parts.length > 0 ? parts[parts.length - 1] : assignmentNumber;
}

// Initialize map
document.addEventListener('DOMContentLoaded', async () => {
    // Check if Leaflet is available
    if (typeof L !== 'undefined') {
        // Initialize Leaflet map centered on Germany
        map = L.map('map').setView([51.1657, 10.4515], 6);
        
        // Use screenshot as fallback instead of live OpenStreetMap tiles (firewall issue)
        // Define the bounds for the screenshot (approximate Germany bounds)
        const imageBounds = [[47.27, 5.87], [55.06, 15.04]];
        L.imageOverlay('../screenshots/Screenshot_Openstreetmap.png', imageBounds).addTo(map);
    } else {
        console.warn('Leaflet library not loaded. Map display will be limited.');
        // Display message in map area
        const mapDiv = document.getElementById('map');
        if (mapDiv) {
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 100%; background: #ecf0f1; color: #7f8c8d; font-size: 18px;';
            messageDiv.innerHTML = '<div style="text-align: center;"><p>Kartendarstellung nicht verfügbar</p><p style="font-size: 14px;">Fahrzeuge und Aufträge werden in den Seitenleisten angezeigt.</p></div>';
            mapDiv.appendChild(messageDiv);
        }
    }
    
    // Start updating (sidebars will still work)
    updateMap();
    setInterval(updateMap, 5000); // Update every 5 seconds
});

async function updateMap() {
    try {
        // Get active operation
        const operation = await api.getActiveOperation();
        dashboardData.operation = operation;
        
        if (!operation) {
            clearMarkers();
            updateSidebars();
            return;
        }
        
        // Get assignments and vehicles
        const assignments = await api.getAssignments();
        const vehicles = await api.getVehicles();
        
        dashboardData.assignments = assignments;
        dashboardData.vehicles = vehicles;
        
        // Only update map markers if Leaflet is available
        if (typeof L !== 'undefined' && map) {
            // Clear existing markers
            clearMarkers();
            
            // Add assignment markers first (so vehicles are on top)
            assignments.forEach(assignment => {
                if (assignment.latitude && assignment.longitude) {
                    addAssignmentMarker(assignment);
                }
            });
            
            // Add vehicle markers with offset positioning
            const vehiclesWithAssignments = await getVehiclesWithAssignments(vehicles, assignments);
            vehiclesWithAssignments.forEach(({ vehicle, assignment }, index) => {
                if (assignment.latitude && assignment.longitude) {
                    addVehicleMarker(vehicle, assignment, index);
                }
            });
            
            // Adjust map bounds if markers exist
            if (Object.keys(markers).length > 0) {
                const bounds = [];
                Object.values(markers).forEach(marker => {
                    bounds.push(marker.getLatLng());
                });
                if (bounds.length > 0) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                }
            }
        }
        
        // Always update sidebars with vehicle lists
        updateSidebars();
    } catch (error) {
        console.error('Error updating map:', error);
    }
}

async function getVehiclesWithAssignments(vehicles, assignments) {
    const result = [];
    
    // For each vehicle, find its first active assignment
    for (const vehicle of vehicles) {
        const vehicleAssignments = assignments.filter(a => 
            a.vehicles.includes(vehicle.callsign) && 
            a.status !== 'completed'
        );
        
        if (vehicleAssignments.length > 0) {
            // Use first assignment (could be enhanced to use order)
            result.push({
                vehicle: vehicle,
                assignment: vehicleAssignments[0]
            });
        }
    }
    
    return result;
}

function addAssignmentMarker(assignment) {
    if (typeof L === 'undefined' || !map) return;
    
    const markerKey = `assignment_${assignment.id}`;
    
    // Create custom icon
    const iconHtml = `
        <div class="assignment-marker ${assignment.status === 'completed' ? 'completed' : ''}">
            ${getSequentialNumber(assignment.number)}
        </div>
    `;
    
    const icon = L.divIcon({
        className: 'custom-marker',
        html: iconHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    
    const marker = L.marker([assignment.latitude, assignment.longitude], { icon: icon })
        .addTo(map);
    
    // Tooltip content for hover (instead of popup)
    const tooltipContent = `
        <strong>Auftrag ${getSequentialNumber(assignment.number)}</strong><br>
        ${assignment.title}<br>
        ${assignment.location_address || ''}<br>
        Status: ${assignment.status === 'open' ? 'Offen' : assignment.status === 'assigned' ? 'Zugewiesen' : 'Abgeschlossen'}<br>
        ${assignment.vehicles.length > 0 ? `Fahrzeuge: ${assignment.vehicles.join(', ')}` : 'Keine Fahrzeuge zugewiesen'}
    `;
    
    // Bind permanent tooltip that shows on hover
    marker.bindTooltip(tooltipContent, {
        permanent: false,
        direction: 'top',
        offset: [0, -10]
    });
    
    markers[markerKey] = marker;
}

function addVehicleMarker(vehicle, assignment, offsetIndex) {
    if (typeof L === 'undefined' || !map) return;
    
    const markerKey = `vehicle_${vehicle.id}`;
    
    // Calculate offset to avoid overlapping with assignment marker
    // Use a circular pattern around the assignment location
    const angle = (offsetIndex * VEHICLE_OFFSET_ANGLE_STEP) * (Math.PI / 180);
    const latOffset = VEHICLE_OFFSET_DISTANCE * Math.cos(angle);
    const lngOffset = VEHICLE_OFFSET_DISTANCE * Math.sin(angle);
    
    const offsetLat = assignment.latitude + latOffset;
    const offsetLng = assignment.longitude + lngOffset;
    
    // Get tactical symbol path
    const symbolPath = getTacticalSymbolPath(vehicle.vehicle_type);
    
    // Create custom icon with tactical symbol or text fallback
    let iconHtml;
    if (symbolPath) {
        iconHtml = `
            <div class="vehicle-marker-tactical">
                <img src="${symbolPath}" alt="${vehicle.vehicle_type}" class="tactical-symbol">
                <div class="vehicle-marker-label">${vehicle.callsign}</div>
            </div>
        `;
    } else {
        iconHtml = `
            <div class="vehicle-marker">
                ${vehicle.callsign}
            </div>
        `;
    }
    
    const icon = L.divIcon({
        className: 'custom-marker',
        html: iconHtml,
        iconSize: symbolPath ? [60, 80] : [80, 40],
        iconAnchor: symbolPath ? [30, 70] : [40, 20]
    });
    
    const marker = L.marker([offsetLat, offsetLng], { 
        icon: icon
    }).addTo(map);
    
    // Get all assignments for this vehicle
    const vehicleAssignments = dashboardData.assignments.filter(a => 
        a.vehicles.includes(vehicle.callsign)
    );
    const assignmentNumbers = vehicleAssignments.map(a => getSequentialNumber(a.number)).join(', ');
    
    // Tooltip content for hover
    const tooltipContent = `
        <strong>${vehicle.callsign}</strong><br>
        Typ: ${vehicle.vehicle_type || 'N/A'}<br>
        Besatzung: ${vehicle.crew_count}<br>
        ${vehicleAssignments.length > 0 ? `Aufträge: ${assignmentNumbers}` : 'Kein Auftrag'}
    `;
    
    // Bind permanent tooltip that shows on hover
    marker.bindTooltip(tooltipContent, {
        permanent: false,
        direction: 'top',
        offset: [0, -20]
    });
    
    markers[markerKey] = marker;
}

function clearMarkers() {
    if (typeof L !== 'undefined' && map) {
        Object.values(markers).forEach(marker => {
            map.removeLayer(marker);
        });
    }
    markers = {};
}

// Update sidebars with vehicle information
function updateSidebars() {
    updateDeployedVehicles();
    updateAvailableVehicles();
}

function updateDeployedVehicles() {
    const container = document.getElementById('deployedVehicles');
    
    if (!dashboardData.operation) {
        container.innerHTML = '<p style="color: #95a5a6; padding: 10px; font-size: 12px;">Keine aktive Einsatzlage</p>';
        return;
    }
    
    // Get vehicles with active assignments
    const activeVehicles = [];
    
    dashboardData.vehicles.forEach(vehicle => {
        const vehicleAssignments = dashboardData.assignments.filter(a => 
            a.vehicles.includes(vehicle.callsign)
        );
        
        const activeAssignments = vehicleAssignments.filter(a => a.status !== 'completed');
        
        if (activeAssignments.length > 0) {
            activeVehicles.push({
                vehicle: vehicle,
                assignments: vehicleAssignments
            });
        }
    });
    
    if (activeVehicles.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; padding: 10px; font-size: 12px;">Keine Fahrzeuge im Einsatz</p>';
        return;
    }
    
    container.innerHTML = '';
    activeVehicles.forEach(({ vehicle, assignments }) => {
        const card = document.createElement('div');
        card.className = 'sidebar-vehicle-card';
        
        // Build assignment numbers display
        let assignmentsHtml = '';
        if (assignments.length > 0) {
            assignmentsHtml = '<div class="sidebar-vehicle-assignments">';
            assignments.forEach(a => {
                assignmentsHtml += `<span class="sidebar-assignment-badge">${getSequentialNumber(a.number)}</span>`;
            });
            assignmentsHtml += '</div>';
        }
        
        card.innerHTML = `
            <div class="sidebar-vehicle-callsign">${vehicle.callsign}</div>
            <div class="sidebar-vehicle-type">${vehicle.vehicle_type || ''}</div>
            <div class="sidebar-vehicle-crew">👥 ${vehicle.crew_count}</div>
            ${assignmentsHtml}
        `;
        
        container.appendChild(card);
    });
}

function updateAvailableVehicles() {
    const container = document.getElementById('availableVehicles');
    
    if (!dashboardData.operation) {
        container.innerHTML = '<p style="color: #95a5a6; padding: 10px; font-size: 12px;">Keine aktive Einsatzlage</p>';
        return;
    }
    
    // Group inactive vehicles by location
    const vehiclesByLocation = {};
    
    dashboardData.vehicles.forEach(vehicle => {
        const vehicleAssignments = dashboardData.assignments.filter(a => 
            a.vehicles.includes(vehicle.callsign)
        );
        
        const activeAssignments = vehicleAssignments.filter(a => a.status !== 'completed');
        
        if (activeAssignments.length === 0) {
            const locationName = vehicle.location_name || 'Ohne Standort';
            if (!vehiclesByLocation[locationName]) {
                vehiclesByLocation[locationName] = [];
            }
            vehiclesByLocation[locationName].push(vehicle);
        }
    });
    
    if (Object.keys(vehiclesByLocation).length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; padding: 10px; font-size: 12px;">Alle Fahrzeuge im Einsatz</p>';
        return;
    }
    
    container.innerHTML = '';
    Object.entries(vehiclesByLocation).forEach(([locationName, vehicles]) => {
        const group = document.createElement('div');
        group.className = 'sidebar-location-group';
        
        const header = document.createElement('div');
        header.className = 'sidebar-location-header';
        header.textContent = locationName;
        group.appendChild(header);
        
        vehicles.forEach(vehicle => {
            const card = document.createElement('div');
            card.className = 'sidebar-vehicle-card inactive';
            
            card.innerHTML = `
                <div class="sidebar-vehicle-callsign">${vehicle.callsign}</div>
                <div class="sidebar-vehicle-type inactive-text">${vehicle.vehicle_type || ''}</div>
                <div class="sidebar-vehicle-crew inactive-text">👥 ${vehicle.crew_count}</div>
            `;
            
            group.appendChild(card);
        });
        
        container.appendChild(group);
    });
}
