const { state } = window.appState;
const { byId, setVisibility, setModalActive, openModalWithReset, renderEmptyState, fillSelectFromItems } = window.uiHelpers;
const { getAssignmentStatusLabel, getAssignmentStatusClass, getVehicleStatusLabel, getVehicleStatusClass } = window.statusUtils;
const { buildVehicleAssignmentOverview } = window.vehicleAssignmentUtils;
const e = escapeHtml;

const ASSIGNMENT_STATUSES = ['open', 'assigned', 'in_progress', 'completed'];

window.addEventListener('unhandledrejection', (event) => {
    showError(event.reason?.message || 'Unbekannter Fehler');
});

document.addEventListener('DOMContentLoaded', async () => {
    await runWithError(async () => {
        setupEventListeners();
        setupTabs();
        await loadActiveOperation();
        await loadData();
    });
});

function showError(message) {
    const errorBanner = byId('globalError');
    errorBanner.textContent = message;
    errorBanner.hidden = false;
}

function clearError() {
    byId('globalError').hidden = true;
    byId('globalError').textContent = '';
}

async function runWithError(action) {
    clearError();
    try {
        await action();
    } catch (error) {
        showError(error.message || 'Unbekannter Fehler');
    }
}

async function loadActiveOperation() {
    appState.setCurrentOperation(await api.getActiveOperation());
    updateOperationDisplay();
}

function updateOperationDisplay() {
    const operationInfo = byId('operationInfo');
    const operationDetails = byId('operationDetails');

    if (!state.currentOperation) {
        operationInfo.style.display = 'none';
        setVisibility('closeOperationBtn', false);
        setVisibility('newOperationBtn', true);
        setVisibility('openMapBtn', false);
        setVisibility('openDashboardBtn', false);
        return;
    }

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
}

async function loadData() {
    appState.setAssignments(await api.getAssignments());
    appState.setVehicles(await api.getVehicles());
    appState.setLocations(await api.getLocations());
    renderResourceOverview();
    renderAssignments();
    renderVehicles();
    renderLocations();
    await renderJournal();
}

function renderResourceOverview() {
    const { deployedVehicles, availableVehiclesByLocation, unavailableVehicles } = buildVehicleAssignmentOverview(state.vehicles, state.assignments);
    renderOverviewGroup('availableVehicleOverview', Object.entries(availableVehiclesByLocation).flatMap(([location, vehicles]) => vehicles.map((vehicle) => ({
        title: vehicle.callsign,
        meta: `${location} · ${getVehicleStatusLabel(vehicle.status)}`
    }))));
    renderOverviewGroup('deployedVehicleOverview', deployedVehicles.map(({ vehicle, activeAssignments }) => ({
        title: vehicle.callsign,
        meta: `${getVehicleStatusLabel(vehicle.status)} · ${activeAssignments.map((assignment) => getSequentialNumber(assignment.number)).join(', ') || 'ohne aktiven Auftrag'}`
    })));
    renderOverviewGroup('unavailableVehicleOverview', unavailableVehicles.map((vehicle) => ({
        title: vehicle.callsign,
        meta: getVehicleStatusLabel(vehicle.status)
    })));
}

function renderOverviewGroup(containerId, items) {
    const container = byId(containerId);
    if (items.length === 0) {
        container.innerHTML = '<p class="no-data">Keine Fahrzeuge</p>';
        return;
    }
    container.innerHTML = items.map((item) => `
        <div class="overview-item">
            <strong>${e(item.title)}</strong>
            <div class="overview-meta">${e(item.meta)}</div>
        </div>
    `).join('');
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach((button) => button.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.remove('active'));
            btn.classList.add('active');
            byId(`${btn.dataset.tab}-tab`).classList.add('active');
        });
    });
}

function setupEventListeners() {
    byId('newOperationBtn').addEventListener('click', openOperationModal);
    byId('operationForm').addEventListener('submit', (event) => runWithError(() => handleOperationSubmit(event)));
    byId('newAssignmentBtn').addEventListener('click', () => openAssignmentModal());
    byId('assignmentForm').addEventListener('submit', (event) => runWithError(() => handleAssignmentSubmit(event)));
    byId('newVehicleBtn').addEventListener('click', () => openVehicleModal());
    byId('vehicleForm').addEventListener('submit', (event) => runWithError(() => handleVehicleSubmit(event)));
    byId('newLocationBtn').addEventListener('click', () => openLocationModal());
    byId('locationForm').addEventListener('submit', (event) => runWithError(() => handleLocationSubmit(event)));
    byId('newJournalEntryBtn').addEventListener('click', openJournalModal);
    byId('journalForm').addEventListener('submit', (event) => runWithError(() => handleJournalSubmit(event)));
    byId('closeOperationBtn').addEventListener('click', () => runWithError(handleCloseOperation));
    byId('historyBtn').addEventListener('click', () => window.open('history.html', 'history', 'width=1200,height=800'));
    byId('openMapBtn').addEventListener('click', () => window.open('map.html', 'map', 'width=1200,height=800'));
    byId('openDashboardBtn').addEventListener('click', () => window.open('dashboard.html', 'dashboard', 'width=1600,height=900'));

    const settingsMenuBtn = byId('settingsMenuBtn');
    const settingsDropdown = byId('settingsDropdown');
    settingsMenuBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        settingsDropdown.classList.toggle('active');
    });
    document.addEventListener('click', (event) => {
        if (!settingsMenuBtn.contains(event.target) && !settingsDropdown.contains(event.target)) {
            settingsDropdown.classList.remove('active');
        }
    });
    byId('vehiclesConfigBtn').addEventListener('click', async () => {
        settingsDropdown.classList.remove('active');
        setModalActive('vehiclesConfigModal', true);
        await loadVehiclesConfig();
    });
    byId('locationsConfigBtn').addEventListener('click', async () => {
        settingsDropdown.classList.remove('active');
        setModalActive('locationsConfigModal', true);
        await loadLocationsConfig();
    });

    document.querySelectorAll('.close').forEach((closeBtn) => {
        closeBtn.addEventListener('click', () => closeBtn.closest('.modal').classList.remove('active'));
    });
    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

function openOperationModal() {
    openModalWithReset('operationForm', 'operationModal');
}

function openAssignmentModal(assignment = null) {
    if (!state.currentOperation) {
        showError('Bitte zuerst eine Einsatzlage erstellen.');
        return;
    }
    const form = byId('assignmentForm');
    form.reset();
    byId('assignmentPDF').value = '';
    if (assignment) {
        byId('assignmentModalTitle').textContent = 'Auftrag bearbeiten';
        byId('assignmentId').value = assignment.id;
        byId('assignmentTitle').value = assignment.title;
        byId('assignmentStatus').value = assignment.status;
        byId('assignmentLocation').value = assignment.location_address || '';
        byId('assignmentDescription').value = assignment.description || '';
        byId('assignmentLat').value = assignment.latitude ?? '';
        byId('assignmentLon').value = assignment.longitude ?? '';
    } else {
        byId('assignmentModalTitle').textContent = 'Neuer Auftrag';
        byId('assignmentStatus').value = 'open';
    }
    setModalActive('assignmentModal', true);
}

function openVehicleModal(vehicle = null) {
    const form = byId('vehicleForm');
    form.reset();
    fillSelectFromItems('vehicleLocation', state.locations, (loc) => ({ value: loc.id, text: loc.name }), '<option value="">Kein Standort</option>');
    if (vehicle) {
        byId('vehicleModalTitle').textContent = 'Fahrzeug bearbeiten';
        byId('vehicleId').value = vehicle.id;
        byId('vehicleCallsign').value = vehicle.callsign;
        byId('vehicleType').value = vehicle.vehicle_type || '';
        byId('vehicleStatus').value = vehicle.status || 'available';
        byId('vehicleCrew').value = vehicle.crew_count || 0;
        byId('vehicleLocation').value = vehicle.location_id || '';
        byId('vehicleNotes').value = vehicle.notes || '';
    } else {
        byId('vehicleModalTitle').textContent = 'Neues Fahrzeug';
        byId('vehicleStatus').value = 'available';
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
        showError('Bitte zuerst eine Einsatzlage erstellen.');
        return;
    }
    const form = byId('journalForm');
    form.reset();
    fillSelectFromItems('journalAssignment', state.assignments, (assignment) => ({ value: assignment.id, text: `${getSequentialNumber(assignment.number)} - ${assignment.title}` }), '<option value="">Allgemein</option>');
    setModalActive('journalModal', true);
}

async function handleOperationSubmit(event) {
    event.preventDefault();
    const operation = await api.createOperation({
        title: byId('operationTitle').value,
        description: byId('operationDescription').value
    });
    appState.setCurrentOperation(operation);
    setModalActive('operationModal', false);
    updateOperationDisplay();
    await loadData();
}

async function handleAssignmentSubmit(event) {
    event.preventDefault();
    const assignmentId = byId('assignmentId').value;
    const status = byId('assignmentStatus').value;
    const data = {
        title: byId('assignmentTitle').value,
        status,
        location_address: byId('assignmentLocation').value,
        description: byId('assignmentDescription').value,
        latitude: byId('assignmentLat').value ? Number(byId('assignmentLat').value) : null,
        longitude: byId('assignmentLon').value ? Number(byId('assignmentLon').value) : null
    };

    let assignment;
    if (assignmentId) {
        assignment = await api.updateAssignment(assignmentId, data);
    } else {
        assignment = await api.createAssignment(data);
        if (status !== 'open') {
            assignment = await api.updateAssignmentStatus(assignment.id, status);
        }
    }

    const pdfFile = byId('assignmentPDF').files[0];
    if (pdfFile) {
        await api.uploadAssignmentPdf(assignment.id, pdfFile);
    }

    setModalActive('assignmentModal', false);
    await loadData();
}

async function handleVehicleSubmit(event) {
    event.preventDefault();
    const vehicleId = byId('vehicleId').value;
    const data = {
        callsign: byId('vehicleCallsign').value,
        vehicle_type: byId('vehicleType').value,
        status: byId('vehicleStatus').value,
        crew_count: parseInt(byId('vehicleCrew').value, 10) || 0,
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

async function handleLocationSubmit(event) {
    event.preventDefault();
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

async function handleJournalSubmit(event) {
    event.preventDefault();
    await api.createJournalEntry({
        entry_type: byId('journalType').value,
        assignment_id: byId('journalAssignment').value || null,
        content: byId('journalContent').value
    });
    setModalActive('journalModal', false);
    await renderJournal();
}

async function handleCloseOperation() {
    if (!state.currentOperation) return;
    if (!confirm('Möchten Sie die Einsatzlage wirklich schließen? Danach sind keine Änderungen mehr möglich.')) {
        return;
    }
    await api.closeOperation(state.currentOperation.id);
    appState.clearOperationData();
    updateOperationDisplay();
    await loadActiveOperation();
    await loadData();
}

function renderAssignments() {
    const container = byId('assignmentsList');
    if (state.assignments.length === 0) {
        renderEmptyState('assignmentsList', 'Keine Aufträge vorhanden.');
        return;
    }
    container.innerHTML = '';
    state.assignments.forEach((assignment) => {
        const item = document.createElement('div');
        item.className = `list-item ${getAssignmentStatusClass(assignment.status)}`;
        item.innerHTML = `
            <div class="list-item-header">
                <div>
                    <div class="list-item-number">${e(getSequentialNumber(assignment.number))}</div>
                    <div class="list-item-title">${e(assignment.title)}</div>
                    <div class="assignment-status-line"><span class="status-pill ${getAssignmentStatusClass(assignment.status)}">${e(getAssignmentStatusLabel(assignment.status))}</span></div>
                </div>
                <div class="list-item-actions">
                    ${assignment.status === 'assigned' ? `<button class="btn btn-small btn-secondary" onclick="startAssignment(${assignment.id})">Begonnen</button>` : ''}
                    ${assignment.status === 'assigned' || assignment.status === 'in_progress' ? `<button class="btn btn-small btn-success" onclick="completeAssignment(${assignment.id})">Abschließen</button>` : ''}
                    <button class="btn btn-small btn-secondary" onclick="openMapForAssignment(${assignment.id})">Karte</button>
                    <button class="btn btn-small btn-secondary" onclick="editAssignment(${assignment.id})">Bearbeiten</button>
                    <button class="btn btn-small btn-secondary" onclick="manageVehicles(${assignment.id})">Fahrzeuge</button>
                </div>
            </div>
            ${assignment.location_address ? `<div>${e(assignment.location_address)}</div>` : ''}
            ${assignment.description ? `<div>${e(assignment.description)}</div>` : ''}
            ${assignment.vehicles.length > 0 ? `<div class="assignment-vehicles">Fahrzeuge: ${assignment.vehicles.map((vehicle) => e(vehicle)).join(', ')}</div>` : ''}
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
    container.innerHTML = state.vehicles.map((vehicle) => `
        <div class="list-item">
            <div class="list-item-header">
                <div>
                    <div class="list-item-title">${e(vehicle.callsign)}</div>
                    <div class="vehicle-line">${e(vehicle.vehicle_type || '')} · Besatzung: ${e(vehicle.crew_count)}</div>
                    <div class="vehicle-line"><span class="vehicle-status-pill ${getVehicleStatusClass(vehicle.status)}">${e(getVehicleStatusLabel(vehicle.status))}</span></div>
                    ${vehicle.location_name ? `<div class="vehicle-line">Standort: ${e(vehicle.location_name)}</div>` : ''}
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-small btn-secondary" onclick="editVehicle(${vehicle.id})">Bearbeiten</button>
                    <button class="btn btn-small btn-danger" onclick="deleteVehicle(${vehicle.id})">Löschen</button>
                </div>
            </div>
            ${vehicle.notes ? `<div>${e(vehicle.notes)}</div>` : ''}
        </div>
    `).join('');
}

function renderLocations() {
    const container = byId('locationsList');
    if (state.locations.length === 0) {
        renderEmptyState('locationsList', 'Keine Standorte vorhanden.');
        return;
    }
    container.innerHTML = state.locations.map((location) => `
        <div class="list-item">
            <div class="list-item-header">
                <div>
                    <div class="list-item-title">${e(location.name)}</div>
                    <div>${e(location.address)}</div>
                    ${location.latitude && location.longitude ? `<div>GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</div>` : '<div class="list-item-subtitle">Geocoding läuft oder nicht verfügbar</div>'}
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-small btn-secondary" onclick="editLocation(${location.id})">Bearbeiten</button>
                    <button class="btn btn-small btn-danger" onclick="deleteLocation(${location.id})">Löschen</button>
                </div>
            </div>
        </div>
    `).join('');
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
    entries.forEach((entry) => {
        const item = document.createElement('div');
        item.className = `journal-entry ${entry.entry_type}`;
        item.innerHTML = `
            <div class="journal-entry-header">
                <div class="journal-entry-time">${formatDate(entry.timestamp)}</div>
                <div class="journal-entry-meta">
                    <span class="source-pill source-${e(entry.source)}">${entry.source === 'system' ? 'System' : 'Benutzer'}</span>
                    <div class="journal-entry-type">${e(entry.entry_type)}</div>
                </div>
            </div>
            ${entry.assignment_number ? `<div><strong>Auftrag:</strong> ${e(getSequentialNumber(entry.assignment_number))}</div>` : ''}
            <div class="journal-entry-content">${e(entry.content)}</div>
        `;
        container.appendChild(item);
    });
}

async function startAssignment(id) {
    await api.updateAssignmentStatus(id, 'in_progress');
    await loadData();
}

async function completeAssignment(id) {
    if (confirm('Auftrag als abgeschlossen markieren?')) {
        await api.completeAssignment(id);
        await loadData();
    }
}

async function manageVehicles(assignmentId) {
    const assignment = state.assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    const assignableVehicles = state.vehicles.filter((vehicle) => !assignment.vehicle_ids.includes(vehicle.id) && vehicle.status !== 'out_of_service');

    let message = `Auftrag: ${getSequentialNumber(assignment.number)} - ${assignment.title}\n\nZugewiesene Fahrzeuge:\n`;
    message += assignment.vehicles.length ? assignment.vehicles.map((vehicle) => `- ${vehicle}`).join('\n') : '- keine';
    message += '\n\nZuweisbare Fahrzeuge:\n';
    message += assignableVehicles.length ? assignableVehicles.map((vehicle, index) => `${index + 1}. ${vehicle.callsign} (${getVehicleStatusLabel(vehicle.status)})`).join('\n') : 'Keine';

    const choice = prompt(`${message}\n\nNummer zum Zuweisen oder \"remove Rufname\" zum Entfernen eingeben:`);
    if (!choice) return;
    if (choice.toLowerCase().startsWith('remove')) {
        const callsign = choice.substring(7).trim();
        const vehicle = state.vehicles.find((item) => item.callsign === callsign);
        if (vehicle) {
            await api.unassignVehicle(assignmentId, vehicle.id);
            await loadData();
        }
        return;
    }
    const index = Number.parseInt(choice, 10) - 1;
    if (index >= 0 && index < assignableVehicles.length) {
        await api.assignVehicle(assignmentId, assignableVehicles[index].id);
        await loadData();
    }
}

function openMapForAssignment(id) {
    window.open(`map.html?assignment=${id}`, 'map', 'width=1200,height=800');
}

function editAssignment(id) {
    const assignment = state.assignments.find((item) => item.id === id);
    if (assignment) openAssignmentModal(assignment);
}

function editVehicle(id) {
    const vehicle = state.vehicles.find((item) => item.id === id);
    if (vehicle) openVehicleModal(vehicle);
}

async function deleteVehicle(id) {
    if (confirm('Fahrzeug wirklich löschen?')) {
        await api.deleteVehicle(id);
        await loadData();
    }
}

function editLocation(id) {
    const location = state.locations.find((item) => item.id === id);
    if (location) openLocationModal(location);
}

async function deleteLocation(id) {
    if (confirm('Standort wirklich löschen?')) {
        await api.deleteLocation(id);
        await loadData();
    }
}

async function loadVehiclesConfig() {
    state.vehicles = await api.getVehicles();
    renderVehicles();
}

async function loadLocationsConfig() {
    state.locations = await api.getLocations();
    renderLocations();
}

window.editAssignment = editAssignment;
window.completeAssignment = (id) => runWithError(() => completeAssignment(id));
window.manageVehicles = (id) => runWithError(() => manageVehicles(id));
window.openMapForAssignment = openMapForAssignment;
window.editVehicle = editVehicle;
window.deleteVehicle = (id) => runWithError(() => deleteVehicle(id));
window.editLocation = editLocation;
window.deleteLocation = (id) => runWithError(() => deleteLocation(id));
window.startAssignment = (id) => runWithError(() => startAssignment(id));
