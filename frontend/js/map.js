// Map functionality with Leaflet
let map;
let markers = {};

// Initialize map
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Leaflet map centered on Germany
    map = L.map('map').setView([51.1657, 10.4515], 6);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Start updating
    updateMap();
    setInterval(updateMap, 5000); // Update every 5 seconds
});

async function updateMap() {
    try {
        // Get active operation
        const operation = await api.getActiveOperation();
        if (!operation) {
            clearMarkers();
            return;
        }
        
        // Get assignments and vehicles
        const assignments = await api.getAssignments();
        const vehicles = await api.getVehicles();
        
        // Clear existing markers
        clearMarkers();
        
        // Add assignment markers
        assignments.forEach(assignment => {
            if (assignment.latitude && assignment.longitude) {
                addAssignmentMarker(assignment);
            }
        });
        
        // Add vehicle markers (only those with active assignments)
        const vehiclesWithAssignments = await getVehiclesWithAssignments(vehicles, assignments);
        vehiclesWithAssignments.forEach(({ vehicle, assignment }) => {
            if (assignment.latitude && assignment.longitude) {
                addVehicleMarker(vehicle, assignment);
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
    const markerKey = `assignment_${assignment.id}`;
    
    // Create custom icon
    const iconHtml = `
        <div class="assignment-marker ${assignment.status === 'completed' ? 'completed' : ''}">
            ${assignment.number.split('-').pop()}
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
    
    // Popup content
    const popupContent = `
        <strong>${assignment.number}</strong><br>
        ${assignment.title}<br>
        ${assignment.location_address || ''}<br>
        Status: ${assignment.status}<br>
        ${assignment.vehicles.length > 0 ? `Fahrzeuge: ${assignment.vehicles.join(', ')}` : ''}
    `;
    
    marker.bindPopup(popupContent);
    markers[markerKey] = marker;
}

function addVehicleMarker(vehicle, assignment) {
    const markerKey = `vehicle_${vehicle.id}`;
    
    // Get tactical symbol path
    const symbolPath = getTacticalSymbolPath(vehicle.vehicle_type);
    
    // Create custom icon with tactical symbol or text fallback
    let iconHtml;
    if (symbolPath) {
        iconHtml = `
            <div class="vehicle-marker-tactical">
                <img src="${symbolPath}" alt="${vehicle.vehicle_type}" class="tactical-symbol">
                <div class="vehicle-marker-label">${vehicle.callsign}<br><small>${assignment.number}</small></div>
            </div>
        `;
    } else {
        iconHtml = `
            <div class="vehicle-marker">
                ${vehicle.callsign}<br>
                <small>${assignment.number}</small>
            </div>
        `;
    }
    
    const icon = L.divIcon({
        className: 'custom-marker',
        html: iconHtml,
        iconSize: symbolPath ? [60, 80] : [80, 40],
        iconAnchor: symbolPath ? [30, 70] : [40, 20]
    });
    
    const marker = L.marker([assignment.latitude, assignment.longitude], { 
        icon: icon,
        draggable: true
    }).addTo(map);
    
    // Handle drag end
    marker.on('dragend', async (e) => {
        const newPos = e.target.getLatLng();
        console.log(`Vehicle ${vehicle.callsign} moved to ${newPos.lat}, ${newPos.lng}`);
        // Could save custom position here if needed
    });
    
    // Popup content
    const popupContent = `
        <strong>${vehicle.callsign}</strong><br>
        Typ: ${vehicle.vehicle_type || 'N/A'}<br>
        Besatzung: ${vehicle.crew_count}<br>
        Auftrag: ${assignment.number} - ${assignment.title}
    `;
    
    marker.bindPopup(popupContent);
    markers[markerKey] = marker;
}

function clearMarkers() {
    Object.values(markers).forEach(marker => {
        map.removeLayer(marker);
    });
    markers = {};
}
