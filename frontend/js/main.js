// Main Application Logic
const { state } = window.appState;
const {
    byId,
    setVisibility,
    setModalActive,
    openModalWithReset,
    renderEmptyState,
    fillSelectFromItems
} = window.uiHelpers;
const e = escapeHtml;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadActiveOperation();
    await loadData();
    setupEventListeners();
    setupTabs();
});

async function loadActiveOperation() {
    appState.setCurrentOperation(await api.getActiveOperation());
    updateOperationDisplay();
}

function updateOperationDisplay() {
    const operationInfo = byId('operationInfo');
    const operationDetails = byId('operationDetails');

    if (state.currentOperation) {
        operationInfo.style.display = 'block';
        operationDetails.innerHTML = `
            <p><strong>Nummer:</strong> ${e(state.currentOperation.number)}</p>
            <p><strong>Titel:</strong> ${e(state.currentOperation.title)}</p>
            <p><strong>Erstellt:</strong> ${formatDate(state.currentOperation.created_at)}</p>
            ${state.currentOperation.description ? `<p><strong>Beschreibung:</strong> ${e(state.currentOperation.description)}</p>` : ''}
        `;
        setVisibility('closeOperationBtn', true);
        setVisibility('newOperationBtn', false);
        setVisibility('openMapBtn', true);
        setVisibility('openDashboardBtn', true);
    } else {
        operationInfo.style.display = 'none';
        setVisibility('closeOperationBtn', false);
        setVisibility('newOperationBtn', true);
        setVisibility('openMapBtn', false);
        setVisibility('openDashboardBtn', false);
    }
}

async function loadData() {
    appState.setAssignments(await api.getAssignments());
    appState.setVehicles(await api.getVehicles());
    appState.setLocations(await api.getLocations());
    
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
    byId('newOperationBtn').addEventListener('click', openOperationModal);
    byId('operationForm').addEventListener('submit', handleOperationSubmit);
    
    // Assignment Modal
    byId('newAssignmentBtn').addEventListener('click', () => openAssignmentModal());
    byId('assignmentForm').addEventListener('submit', handleAssignmentSubmit);
    
    // Vehicle Modal
    byId('newVehicleBtn').addEventListener('click', () => openVehicleModal());
    byId('vehicleForm').addEventListener('submit', handleVehicleSubmit);
    
    // Location Modal
    byId('newLocationBtn').addEventListener('click', () => openLocationModal());
    byId('locationForm').addEventListener('submit', handleLocationSubmit);
    
    // Journal Modal
    byId('newJournalEntryBtn').addEventListener('click', openJournalModal);
    byId('journalForm').addEventListener('submit', handleJournalSubmit);
    
    // Close Operation
    byId('closeOperationBtn').addEventListener('click', handleCloseOperation);
    
    // Settings Dropdown Menu
    const settingsMenuBtn = byId('settingsMenuBtn');
    const settingsDropdown = byId('settingsDropdown');
    
    settingsMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsMenuBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
            settingsDropdown.classList.remove('active');
        }
    });
    
    // Configuration Modals
    byId('vehiclesConfigBtn').addEventListener('click', () => {
        settingsDropdown.classList.remove('active');
        openVehiclesConfig();
    });
    byId('locationsConfigBtn').addEventListener('click', () => {
        settingsDropdown.classList.remove('active');
        openLocationsConfig();
    });
    byId('historyBtn').addEventListener('click', () => {
        settingsDropdown.classList.remove('active');
        window.open('history.html', 'history', 'width=1200,height=800');
    });
    
    // Open Windows
    byId('openMapBtn').addEventListener('click', () => window.open('map.html', 'map', 'width=1200,height=800'));
    byId('openDashboardBtn').addEventListener('click', () => window.open('dashboard.html', 'dashboard', 'width=1600,height=900'));
    
    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').classList.remove('active');
        });
    });
}

// Modal Functions
function openOperationModal() {
    openModalWithReset('operationForm', 'operationModal');
}

function openAssignmentModal(assignment = null) {
    if (!state.currentOperation) {
        alert('Bitte zuerst eine Einsatzlage erstellen!');
        return;
    }
    
    const form = byId('assignmentForm');
    form.reset();
    
    if (assignment) {
        byId('assignmentModalTitle').textContent = 'Auftrag bearbeiten';
        byId('assignmentId').value = assignment.id;
        byId('assignmentTitle').value = assignment.title;
        byId('assignmentLocation').value = assignment.location_address || '';
        byId('assignmentDescription').value = assignment.description || '';
        byId('assignmentLat').value = assignment.latitude || '';
        byId('assignmentLon').value = assignment.longitude || '';
    } else {
        byId('assignmentModalTitle').textContent = 'Neuer Auftrag';
    }
    
    setModalActive('assignmentModal', true);
}

function openVehicleModal(vehicle = null) {
    const form = byId('vehicleForm');
    form.reset();
    
    fillSelectFromItems(
        'vehicleLocation',
        state.locations,
        (loc) => ({ value: loc.id, text: loc.name }),
        '<option value="">Kein Standort</option>'
    );
    
    if (vehicle) {
        byId('vehicleModalTitle').textContent = 'Fahrzeug bearbeiten';
        byId('vehicleId').value = vehicle.id;
        byId('vehicleCallsign').value = vehicle.callsign;
        byId('vehicleType').value = vehicle.vehicle_type || '';
        byId('vehicleCrew').value = vehicle.crew_count || 0;
        byId('vehicleLocation').value = vehicle.location_id || '';
        byId('vehicleNotes').value = vehicle.notes || '';
    } else {
        byId('vehicleModalTitle').textContent = 'Neues Fahrzeug';
    }
    
    setModalActive('vehicleModal', true);
}

function openLocationModal(location = null) {
    const form = byId('locationForm');
    form.reset();
    
    if (location) {
        byId('locationModalTitle').textContent = 'Standort bearbeiten';
        byId('locationId').value = location.id;
        byId('locationName').value = location.name;
        byId('locationAddress').value = location.address;
    } else {
        byId('locationModalTitle').textContent = 'Neuer Standort';
    }
    
    setModalActive('locationModal', true);
}

function openJournalModal() {
    if (!state.currentOperation) {
        alert('Bitte zuerst eine Einsatzlage erstellen!');
        return;
    }
    
    const form = byId('journalForm');
    form.reset();
    
    fillSelectFromItems(
        'journalAssignment',
        state.assignments,
        (assignment) => ({
            value: assignment.id,
            text: `${getSequentialNumber(assignment.number)} - ${assignment.title}`
        }),
        '<option value="">Allgemein</option>'
    );
    
    setModalActive('journalModal', true);
}

// Form Handlers
async function handleOperationSubmit(e) {
    e.preventDefault();
    
    const data = {
        title: byId('operationTitle').value,
        description: byId('operationDescription').value
    };
    
    appState.setCurrentOperation(await api.createOperation(data));
    setModalActive('operationModal', false);
    updateOperationDisplay();
    await loadData();
}

async function handleAssignmentSubmit(e) {
    e.preventDefault();
    
    const assignmentId = byId('assignmentId').value;
    const data = {
        title: byId('assignmentTitle').value,
        location_address: byId('assignmentLocation').value,
        description: byId('assignmentDescription').value,
        latitude: byId('assignmentLat').value || null,
        longitude: byId('assignmentLon').value || null
    };
    
    if (assignmentId) {
        await api.updateAssignment(assignmentId, data);
    } else {
        await api.createAssignment(data);
    }
    
    setModalActive('assignmentModal', false);
    await loadData();
}

async function handleVehicleSubmit(e) {
    e.preventDefault();
    
    const vehicleId = byId('vehicleId').value;
    const data = {
        callsign: byId('vehicleCallsign').value,
        vehicle_type: byId('vehicleType').value,
        crew_count: parseInt(byId('vehicleCrew').value) || 0,
        location_id: byId('vehicleLocation').value || null,
        notes: byId('vehicleNotes').value
    };
    
    if (vehicleId) {
        await api.updateVehicle(vehicleId, data);
    } else {
        await api.createVehicle(data);
    }
    
    setModalActive('vehicleModal', false);
    await loadData();
}

async function handleLocationSubmit(e) {
    e.preventDefault();
    
    const locationId = byId('locationId').value;
    const data = {
        name: byId('locationName').value,
        address: byId('locationAddress').value
    };
    
    if (locationId) {
        await api.updateLocation(locationId, data);
    } else {
        await api.createLocation(data);
    }
    
    setModalActive('locationModal', false);
    await loadData();
}

async function handleJournalSubmit(e) {
    e.preventDefault();
    
    const data = {
        entry_type: document.getElementById('journalType').value,
        assignment_id: byId('journalAssignment').value || null,
        content: byId('journalContent').value
    };
    
    await api.createJournalEntry(data);
    setModalActive('journalModal', false);
    await renderJournal();
}

async function handleCloseOperation() {
    if (!state.currentOperation) return;
    
    if (confirm('Möchten Sie die Einsatzlage wirklich schließen? Danach sind keine Änderungen mehr möglich.')) {
        await api.closeOperation(state.currentOperation.id);
        appState.clearOperationData();
        updateOperationDisplay();
        await loadData();
    }
}

// Render Functions
function renderAssignments() {
    const container = byId('assignmentsList');
    
    if (state.assignments.length === 0) {
        renderEmptyState('assignmentsList', 'Keine Aufträge vorhanden.');
        return;
    }
    
    container.innerHTML = '';
    state.assignments.forEach(assignment => {
        const item = document.createElement('div');
        item.className = `list-item status-${assignment.status}`;
        
        const vehiclesHtml = assignment.vehicles.length > 0 
            ? `<div class="assignment-vehicles">Fahrzeuge: ${assignment.vehicles.map((v) => e(v)).join(', ')}</div>`
            : '';
        
        item.innerHTML = `
            <div class="list-item-header">
                <div>
                    <div class="list-item-number">${e(getSequentialNumber(assignment.number))}</div>
                    <div class="list-item-title">${e(assignment.title)}</div>
                </div>
                <div class="list-item-actions">
                    ${assignment.status !== 'completed' ? 
                        `<button class="btn btn-small btn-success" onclick="completeAssignment(${assignment.id})">Abschließen</button>` : ''}
                    <button class="btn btn-small btn-secondary" onclick="editAssignment(${assignment.id})">Bearbeiten</button>
                    <button class="btn btn-small btn-secondary" onclick="manageVehicles(${assignment.id})">Fahrzeuge</button>
                </div>
            </div>
            ${assignment.location_address ? `<div>${e(assignment.location_address)}</div>` : ''}
            ${assignment.description ? `<div>${e(assignment.description)}</div>` : ''}
            ${vehiclesHtml}
        `;
        
        container.appendChild(item);
    });
}

function renderVehicles() {
    const container = byId('vehiclesList');
    
    if (state.vehicles.length === 0) {
        renderEmptyState('vehiclesList', 'Keine Fahrzeuge vorhanden.');
        return;
    }
    
    container.innerHTML = '';
    state.vehicles.forEach(vehicle => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        item.innerHTML = `
            <div class="list-item-header">
                <div>
                    <div class="list-item-title">${e(vehicle.callsign)}</div>
                    <div>${e(vehicle.vehicle_type || '')} - Besatzung: ${e(vehicle.crew_count)}</div>
                    ${vehicle.location_name ? `<div>Standort: ${e(vehicle.location_name)}</div>` : ''}
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-small btn-secondary" onclick="editVehicle(${vehicle.id})">Bearbeiten</button>
                    <button class="btn btn-small btn-danger" onclick="deleteVehicle(${vehicle.id})">Löschen</button>
                </div>
            </div>
            ${vehicle.notes ? `<div>${e(vehicle.notes)}</div>` : ''}
        `;
        
        container.appendChild(item);
    });
}

function renderLocations() {
    const container = byId('locationsList');
    
    if (state.locations.length === 0) {
        renderEmptyState('locationsList', 'Keine Standorte vorhanden.');
        return;
    }
    
    container.innerHTML = '';
    state.locations.forEach(location => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        item.innerHTML = `
            <div class="list-item-header">
                <div>
                    <div class="list-item-title">${e(location.name)}</div>
                    <div>${e(location.address)}</div>
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
    if (!state.currentOperation) {
        renderEmptyState('journalList', 'Keine aktive Einsatzlage.');
        return;
    }
    
    const entries = await api.getJournalEntries(state.currentOperation.id);
    const container = byId('journalList');
    
    if (entries.length === 0) {
        renderEmptyState('journalList', 'Keine Einträge vorhanden.');
        return;
    }
    
    container.innerHTML = '';
    entries.forEach(entry => {
        const item = document.createElement('div');
        item.className = `journal-entry ${entry.entry_type}`;
        
        item.innerHTML = `
            <div class="journal-entry-header">
                <div class="journal-entry-time">${formatDate(entry.timestamp)}</div>
                <div class="journal-entry-type">${e(entry.entry_type)}</div>
            </div>
            ${entry.assignment_number ? `<div><strong>Auftrag:</strong> ${getSequentialNumber(entry.assignment_number)}</div>` : ''}
            <div class="journal-entry-content">${e(entry.content)}</div>
        `;
        
        container.appendChild(item);
    });
}

// Helper Functions
async function editAssignment(id) {
    const assignment = state.assignments.find(a => a.id === id);
    if (assignment) openAssignmentModal(assignment);
}

async function completeAssignment(id) {
    if (confirm('Auftrag als abgeschlossen markieren?')) {
        await api.completeAssignment(id);
        await loadData();
    }
}

async function manageVehicles(assignmentId) {
    const assignment = state.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    
    const availableVehicles = state.vehicles.filter(v =>
        !assignment.vehicles.includes(v.callsign)
    );
    
    let message = `Auftrag: ${getSequentialNumber(assignment.number)} - ${assignment.title}\n\n`;
    message += `Zugewiesene Fahrzeuge:\n`;
    assignment.vehicles.forEach(v => message += `- ${v}\n`);
    message += `\nVerfügbare Fahrzeuge:\n`;
    availableVehicles.forEach((v, i) => message += `${i+1}. ${v.callsign}\n`);
    
    const choice = prompt(message + '\nGeben Sie die Nummer des zuzuweisenden Fahrzeugs ein (oder "remove X" zum Entfernen):');
    
    if (choice) {
        if (choice.toLowerCase().startsWith('remove')) {
            // Handle remove
            const callsign = choice.substring(7).trim();
            const vehicle = state.vehicles.find(v => v.callsign === callsign);
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
    const vehicle = state.vehicles.find(v => v.id === id);
    if (vehicle) openVehicleModal(vehicle);
}

async function deleteVehicle(id) {
    if (confirm('Fahrzeug wirklich löschen?')) {
        await api.deleteVehicle(id);
        await loadData();
    }
}

async function editLocation(id) {
    const location = state.locations.find(l => l.id === id);
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
    setModalActive('vehiclesConfigModal', true);
    await loadVehiclesConfig();
}

async function openLocationsConfig() {
    setModalActive('locationsConfigModal', true);
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
