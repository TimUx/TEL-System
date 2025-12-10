// API Base URL
const API_BASE = '/api';

// API Helper Functions
const api = {
    // Operations
    async getOperations() {
        const response = await fetch(`${API_BASE}/operations/`);
        return response.json();
    },
    
    async getActiveOperation() {
        const response = await fetch(`${API_BASE}/operations/active`);
        return response.json();
    },
    
    async createOperation(data) {
        const response = await fetch(`${API_BASE}/operations/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async updateOperation(id, data) {
        const response = await fetch(`${API_BASE}/operations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async closeOperation(id) {
        const response = await fetch(`${API_BASE}/operations/${id}/close`, {
            method: 'POST'
        });
        return response.json();
    },
    
    // Assignments
    async getAssignments(operationId = null) {
        const url = operationId ? 
            `${API_BASE}/assignments/?operation_id=${operationId}` :
            `${API_BASE}/assignments/`;
        const response = await fetch(url);
        return response.json();
    },
    
    async createAssignment(data) {
        const response = await fetch(`${API_BASE}/assignments/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async updateAssignment(id, data) {
        const response = await fetch(`${API_BASE}/assignments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async completeAssignment(id) {
        const response = await fetch(`${API_BASE}/assignments/${id}/complete`, {
            method: 'POST'
        });
        return response.json();
    },
    
    async assignVehicle(assignmentId, vehicleId) {
        const response = await fetch(`${API_BASE}/assignments/${assignmentId}/vehicles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicle_id: vehicleId })
        });
        return response.json();
    },
    
    async unassignVehicle(assignmentId, vehicleId) {
        const response = await fetch(`${API_BASE}/assignments/${assignmentId}/vehicles/${vehicleId}`, {
            method: 'DELETE'
        });
        return response.json();
    },
    
    // Vehicles
    async getVehicles() {
        const response = await fetch(`${API_BASE}/vehicles/`);
        return response.json();
    },
    
    async getVehiclesByLocation() {
        const response = await fetch(`${API_BASE}/vehicles/by-location`);
        return response.json();
    },
    
    async createVehicle(data) {
        const response = await fetch(`${API_BASE}/vehicles/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async updateVehicle(id, data) {
        const response = await fetch(`${API_BASE}/vehicles/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async deleteVehicle(id) {
        const response = await fetch(`${API_BASE}/vehicles/${id}`, {
            method: 'DELETE'
        });
        return response.json();
    },
    
    // Locations
    async getLocations() {
        const response = await fetch(`${API_BASE}/locations/`);
        return response.json();
    },
    
    async createLocation(data) {
        const response = await fetch(`${API_BASE}/locations/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async updateLocation(id, data) {
        const response = await fetch(`${API_BASE}/locations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async deleteLocation(id) {
        const response = await fetch(`${API_BASE}/locations/${id}`, {
            method: 'DELETE'
        });
        return response.json();
    },
    
    // Journal
    async getJournalEntries(operationId = null, assignmentId = null) {
        let url = `${API_BASE}/journal/`;
        const params = new URLSearchParams();
        if (operationId) params.append('operation_id', operationId);
        if (assignmentId) params.append('assignment_id', assignmentId);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        return response.json();
    },
    
    async createJournalEntry(data) {
        const response = await fetch(`${API_BASE}/journal/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    }
};
