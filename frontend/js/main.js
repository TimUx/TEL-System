// Main Application Logic
let currentOperation = null;
let assignments = [];
let vehicles = [];
let locations = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadActiveOperation();
    await loadData();
    setupEventListeners();
    setupTabs();
});

async function loadActiveOperation() {
    currentOperation = await api.getActiveOperation();
    updateOperationDisplay();
}

function updateOperationDisplay() {
    const operationInfo = document.getElementById('operationInfo');
    const operationDetails = document.getElementById('operationDetails');
    const closeBtn = document.getElementById('closeOperationBtn');
    
    if (currentOperation) {
        operationInfo.style.display = 'block';
        operationDetails.innerHTML = `
            <p><strong>Nummer:</strong> ${currentOperation.number}</p>
            <p><strong>Titel:</strong> ${currentOperation.title}</p>
            <p><strong>Erstellt:</strong> ${formatDate(currentOperation.created_at)}</p>
            ${currentOperation.description ? `<p><strong>Beschreibung:</strong> ${currentOperation.description}</p>` : ''}
        `;
        closeBtn.disabled = false;
    } else {
        operationInfo.style.display = 'none';
        closeBtn.disabled = true;
    }
}

async function loadData() {
    assignments = await api.getAssignments();
    vehicles = await api.getVehicles();
    locations = await api.getLocations();
    
    renderAssignments();
    renderVehicles();
    renderLocations();
    renderJournal();
}

// Tab Functionality
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Remove active class from all
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            // Add active class to current
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

// Event Listeners
function setupEventListeners() {
    // Operation Modal
    document.getElementById('newOperationBtn').addEventListener('click', openOperationModal);
    document.getElementById('operationForm').addEventListener('submit', handleOperationSubmit);
    
    // Assignment Modal
    document.getElementById('newAssignmentBtn').addEventListener('click', () => openAssignmentModal());
    document.getElementById('assignmentForm').addEventListener('submit', handleAssignmentSubmit);
    
    // Vehicle Modal
    document.getElementById('newVehicleBtn').addEventListener('click', () => openVehicleModal());
    document.getElementById('vehicleForm').addEventListener('submit', handleVehicleSubmit);
    
    // Location Modal
    document.getElementById('newLocationBtn').addEventListener('click', () => openLocationModal());
    document.getElementById('locationForm').addEventListener('submit', handleLocationSubmit);
    
    // Journal Modal
    document.getElementById('newJournalEntryBtn').addEventListener('click', openJournalModal);
    document.getElementById('journalForm').addEventListener('submit', handleJournalSubmit);
    
    // Close Operation
    document.getElementById('closeOperationBtn').addEventListener('click', handleCloseOperation);
    
    // Configuration Modals
    document.getElementById('vehiclesConfigBtn').addEventListener('click', openVehiclesConfig);
    document.getElementById('locationsConfigBtn').addEventListener('click', openLocationsConfig);
    
    // Open Windows
    document.getElementById('openMapBtn').addEventListener('click', () => window.open('map.html', 'map', 'width=1200,height=800'));
    document.getElementById('openDashboardBtn').addEventListener('click', () => window.open('dashboard.html', 'dashboard', 'width=1600,height=900'));
    document.getElementById('historyBtn').addEventListener('click', () => window.open('history.html', 'history', 'width=1200,height=800'));
    
    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').classList.remove('active');
        });
    });
}

// Modal Functions
function openOperationModal() {
    document.getElementById('operationForm').reset();
    document.getElementById('operationModal').classList.add('active');
}

function openAssignmentModal(assignment = null) {
    if (!currentOperation) {
        alert('Bitte zuerst eine Einsatzlage erstellen!');
        return;
    }
    
    const form = document.getElementById('assignmentForm');
    form.reset();
    
    if (assignment) {
        document.getElementById('assignmentModalTitle').textContent = 'Auftrag bearbeiten';
        document.getElementById('assignmentId').value = assignment.id;
        document.getElementById('assignmentTitle').value = assignment.title;
        document.getElementById('assignmentLocation').value = assignment.location_address || '';
        document.getElementById('assignmentDescription').value = assignment.description || '';
        document.getElementById('assignmentLat').value = assignment.latitude || '';
        document.getElementById('assignmentLon').value = assignment.longitude || '';
    } else {
        document.getElementById('assignmentModalTitle').textContent = 'Neuer Auftrag';
    }
    
    document.getElementById('assignmentModal').classList.add('active');
}

function openVehicleModal(vehicle = null) {
    const form = document.getElementById('vehicleForm');
    form.reset();
    
    // Load locations into select
    const locationSelect = document.getElementById('vehicleLocation');
    locationSelect.innerHTML = '<option value="">Kein Standort</option>';
    locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.id;
        option.textContent = loc.name;
        locationSelect.appendChild(option);
    });
    
    if (vehicle) {
        document.getElementById('vehicleModalTitle').textContent = 'Fahrzeug bearbeiten';
        document.getElementById('vehicleId').value = vehicle.id;
        document.getElementById('vehicleCallsign').value = vehicle.callsign;
        document.getElementById('vehicleType').value = vehicle.vehicle_type || '';
        document.getElementById('vehicleCrew').value = vehicle.crew_count || 0;
        document.getElementById('vehicleLocation').value = vehicle.location_id || '';
        document.getElementById('vehicleNotes').value = vehicle.notes || '';
    } else {
        document.getElementById('vehicleModalTitle').textContent = 'Neues Fahrzeug';
    }
    
    document.getElementById('vehicleModal').classList.add('active');
}

function openLocationModal(location = null) {
    const form = document.getElementById('locationForm');
    form.reset();
    
    if (location) {
        document.getElementById('locationModalTitle').textContent = 'Standort bearbeiten';
        document.getElementById('locationId').value = location.id;
        document.getElementById('locationName').value = location.name;
        document.getElementById('locationAddress').value = location.address;
    } else {
        document.getElementById('locationModalTitle').textContent = 'Neuer Standort';
    }
    
    document.getElementById('locationModal').classList.add('active');
}

function openJournalModal() {
    if (!currentOperation) {
        alert('Bitte zuerst eine Einsatzlage erstellen!');
        return;
    }
    
    const form = document.getElementById('journalForm');
    form.reset();
    
    // Load assignments into select
    const assignmentSelect = document.getElementById('journalAssignment');
    assignmentSelect.innerHTML = '<option value="">Allgemein</option>';
    assignments.forEach(assignment => {
        const option = document.createElement('option');
        option.value = assignment.id;
        option.textContent = `${assignment.number} - ${assignment.title}`;
        assignmentSelect.appendChild(option);
    });
    
    document.getElementById('journalModal').classList.add('active');
}

// Form Handlers
async function handleOperationSubmit(e) {
    e.preventDefault();
    
    const data = {
        title: document.getElementById('operationTitle').value,
        description: document.getElementById('operationDescription').value
    };
    
    currentOperation = await api.createOperation(data);
    document.getElementById('operationModal').classList.remove('active');
    updateOperationDisplay();
    await loadData();
}

async function handleAssignmentSubmit(e) {
    e.preventDefault();
    
    const assignmentId = document.getElementById('assignmentId').value;
    const data = {
        title: document.getElementById('assignmentTitle').value,
        location_address: document.getElementById('assignmentLocation').value,
        description: document.getElementById('assignmentDescription').value,
        latitude: document.getElementById('assignmentLat').value || null,
        longitude: document.getElementById('assignmentLon').value || null
    };
    
    if (assignmentId) {
        await api.updateAssignment(assignmentId, data);
    } else {
        await api.createAssignment(data);
    }
    
    document.getElementById('assignmentModal').classList.remove('active');
    await loadData();
}

async function handleVehicleSubmit(e) {
    e.preventDefault();
    
    const vehicleId = document.getElementById('vehicleId').value;
    const data = {
        callsign: document.getElementById('vehicleCallsign').value,
        vehicle_type: document.getElementById('vehicleType').value,
        crew_count: parseInt(document.getElementById('vehicleCrew').value) || 0,
        location_id: document.getElementById('vehicleLocation').value || null,
        notes: document.getElementById('vehicleNotes').value
    };
    
    if (vehicleId) {
        await api.updateVehicle(vehicleId, data);
    } else {
        await api.createVehicle(data);
    }
    
    document.getElementById('vehicleModal').classList.remove('active');
    await loadData();
}

async function handleLocationSubmit(e) {
    e.preventDefault();
    
    const locationId = document.getElementById('locationId').value;
    const data = {
        name: document.getElementById('locationName').value,
        address: document.getElementById('locationAddress').value
    };
    
    if (locationId) {
        await api.updateLocation(locationId, data);
    } else {
        await api.createLocation(data);
    }
    
    document.getElementById('locationModal').classList.remove('active');
    await loadData();
}

async function handleJournalSubmit(e) {
    e.preventDefault();
    
    const data = {
        entry_type: document.getElementById('journalType').value,
        assignment_id: document.getElementById('journalAssignment').value || null,
        content: document.getElementById('journalContent').value
    };
    
    await api.createJournalEntry(data);
    document.getElementById('journalModal').classList.remove('active');
    await renderJournal();
}

async function handleCloseOperation() {
    if (!currentOperation) return;
    
    if (confirm('Möchten Sie die Einsatzlage wirklich schließen? Danach sind keine Änderungen mehr möglich.')) {
        await api.closeOperation(currentOperation.id);
        currentOperation = null;
        assignments = [];
        updateOperationDisplay();
        await loadData();
    }
}

// Render Functions
function renderAssignments() {
    const container = document.getElementById('assignmentsList');
    
    if (assignments.length === 0) {
        container.innerHTML = '<p>Keine Aufträge vorhanden.</p>';
        return;
    }
    
    container.innerHTML = '';
    assignments.forEach(assignment => {
        const item = document.createElement('div');
        item.className = `list-item status-${assignment.status}`;
        
        const vehiclesHtml = assignment.vehicles.length > 0 
            ? `<div class="assignment-vehicles">Fahrzeuge: ${assignment.vehicles.join(', ')}</div>`
            : '';
        
        item.innerHTML = `
            <div class="list-item-header">
                <div>
                    <div class="list-item-number">${assignment.number}</div>
                    <div class="list-item-title">${assignment.title}</div>
                </div>
                <div class="list-item-actions">
                    ${assignment.status !== 'completed' ? 
                        `<button class="btn btn-small btn-success" onclick="completeAssignment(${assignment.id})">Abschließen</button>` : ''}
                    <button class="btn btn-small btn-secondary" onclick="editAssignment(${assignment.id})">Bearbeiten</button>
                    <button class="btn btn-small btn-secondary" onclick="manageVehicles(${assignment.id})">Fahrzeuge</button>
                </div>
            </div>
            ${assignment.location_address ? `<div>${assignment.location_address}</div>` : ''}
            ${assignment.description ? `<div>${assignment.description}</div>` : ''}
            ${vehiclesHtml}
        `;
        
        container.appendChild(item);
    });
}

function renderVehicles() {
    const container = document.getElementById('vehiclesList');
    
    if (vehicles.length === 0) {
        container.innerHTML = '<p>Keine Fahrzeuge vorhanden.</p>';
        return;
    }
    
    container.innerHTML = '';
    vehicles.forEach(vehicle => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        item.innerHTML = `
            <div class="list-item-header">
                <div>
                    <div class="list-item-title">${vehicle.callsign}</div>
                    <div>${vehicle.vehicle_type || ''} - Besatzung: ${vehicle.crew_count}</div>
                    ${vehicle.location_name ? `<div>Standort: ${vehicle.location_name}</div>` : ''}
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-small btn-secondary" onclick="editVehicle(${vehicle.id})">Bearbeiten</button>
                    <button class="btn btn-small btn-danger" onclick="deleteVehicle(${vehicle.id})">Löschen</button>
                </div>
            </div>
            ${vehicle.notes ? `<div>${vehicle.notes}</div>` : ''}
        `;
        
        container.appendChild(item);
    });
}

function renderLocations() {
    const container = document.getElementById('locationsList');
    
    if (locations.length === 0) {
        container.innerHTML = '<p>Keine Standorte vorhanden.</p>';
        return;
    }
    
    container.innerHTML = '';
    locations.forEach(location => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        item.innerHTML = `
            <div class="list-item-header">
                <div>
                    <div class="list-item-title">${location.name}</div>
                    <div>${location.address}</div>
                    ${location.latitude && location.longitude ? 
                        `<div>GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</div>` : ''}
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-small btn-secondary" onclick="editLocation(${location.id})">Bearbeiten</button>
                    <button class="btn btn-small btn-danger" onclick="deleteLocation(${location.id})">Löschen</button>
                </div>
            </div>
        `;
        
        container.appendChild(item);
    });
}

async function renderJournal() {
    if (!currentOperation) {
        document.getElementById('journalList').innerHTML = '<p>Keine aktive Einsatzlage.</p>';
        return;
    }
    
    const entries = await api.getJournalEntries(currentOperation.id);
    const container = document.getElementById('journalList');
    
    if (entries.length === 0) {
        container.innerHTML = '<p>Keine Einträge vorhanden.</p>';
        return;
    }
    
    container.innerHTML = '';
    entries.forEach(entry => {
        const item = document.createElement('div');
        item.className = `journal-entry ${entry.entry_type}`;
        
        item.innerHTML = `
            <div class="journal-entry-header">
                <div class="journal-entry-time">${formatDate(entry.timestamp)}</div>
                <div class="journal-entry-type">${entry.entry_type}</div>
            </div>
            ${entry.assignment_number ? `<div><strong>Auftrag:</strong> ${entry.assignment_number}</div>` : ''}
            <div class="journal-entry-content">${entry.content}</div>
        `;
        
        container.appendChild(item);
    });
}

// Helper Functions
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('de-DE');
}

async function editAssignment(id) {
    const assignment = assignments.find(a => a.id === id);
    if (assignment) openAssignmentModal(assignment);
}

async function completeAssignment(id) {
    if (confirm('Auftrag als abgeschlossen markieren?')) {
        await api.completeAssignment(id);
        await loadData();
    }
}

async function manageVehicles(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    
    const availableVehicles = vehicles.filter(v => 
        !assignment.vehicles.includes(v.callsign)
    );
    
    let message = `Auftrag: ${assignment.number} - ${assignment.title}\n\n`;
    message += `Zugewiesene Fahrzeuge:\n`;
    assignment.vehicles.forEach(v => message += `- ${v}\n`);
    message += `\nVerfügbare Fahrzeuge:\n`;
    availableVehicles.forEach((v, i) => message += `${i+1}. ${v.callsign}\n`);
    
    const choice = prompt(message + '\nGeben Sie die Nummer des zuzuweisenden Fahrzeugs ein (oder "remove X" zum Entfernen):');
    
    if (choice) {
        if (choice.toLowerCase().startsWith('remove')) {
            // Handle remove
            const callsign = choice.substring(7).trim();
            const vehicle = vehicles.find(v => v.callsign === callsign);
            if (vehicle) {
                await api.unassignVehicle(assignmentId, vehicle.id);
                await loadData();
            }
        } else {
            // Handle assign
            const index = parseInt(choice) - 1;
            if (index >= 0 && index < availableVehicles.length) {
                await api.assignVehicle(assignmentId, availableVehicles[index].id);
                await loadData();
            }
        }
    }
}

async function editVehicle(id) {
    const vehicle = vehicles.find(v => v.id === id);
    if (vehicle) openVehicleModal(vehicle);
}

async function deleteVehicle(id) {
    if (confirm('Fahrzeug wirklich löschen?')) {
        await api.deleteVehicle(id);
        await loadData();
    }
}

async function editLocation(id) {
    const location = locations.find(l => l.id === id);
    if (location) openLocationModal(location);
}

async function deleteLocation(id) {
    if (confirm('Standort wirklich löschen?')) {
        await api.deleteLocation(id);
        await loadData();
    }
}

// Configuration Modal Functions
async function openVehiclesConfig() {
    document.getElementById('vehiclesConfigModal').classList.add('active');
    await loadVehiclesConfig();
}

async function openLocationsConfig() {
    document.getElementById('locationsConfigModal').classList.add('active');
    await loadLocationsConfig();
}

async function loadVehiclesConfig() {
    try {
        const vehicles = await api.getVehicles();
        const vehiclesList = document.querySelector('#vehiclesConfigModal #vehiclesList');
        
        if (vehicles.length === 0) {
            vehiclesList.innerHTML = '<p class="no-data">Keine Fahrzeuge vorhanden</p>';
            return;
        }
        
        vehiclesList.innerHTML = vehicles.map(vehicle => `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${vehicle.callsign}</div>
                    <div class="item-details">${vehicle.vehicle_type} - Besatzung: ${vehicle.crew_count}</div>
                    <div class="item-details">Standort: ${vehicle.location_name || 'Kein Standort'}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editVehicle(${vehicle.id})">Bearbeiten</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteVehicle(${vehicle.id})">Löschen</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading vehicles:', error);
        alert('Fehler beim Laden der Fahrzeuge');
    }
}

async function loadLocationsConfig() {
    try {
        const locations = await api.getLocations();
        const locationsList = document.querySelector('#locationsConfigModal #locationsList');
        
        if (locations.length === 0) {
            locationsList.innerHTML = '<p class="no-data">Keine Standorte vorhanden</p>';
            return;
        }
        
        locationsList.innerHTML = locations.map(location => `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${location.name}</div>
                    <div class="item-details">${location.address}</div>
                    <div class="item-details">GPS: ${location.latitude}, ${location.longitude}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editLocation(${location.id})">Bearbeiten</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteLocation(${location.id})">Löschen</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading locations:', error);
        alert('Fehler beim Laden der Standorte');
    }
}
