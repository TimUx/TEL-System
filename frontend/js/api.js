const API_BASE = '/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function getInternalApiKey() {
    return localStorage.getItem('TEL_INTERNAL_API_KEY');
}

function buildHeaders(baseHeaders = {}) {
    const internalApiKey = getInternalApiKey();
    if (!internalApiKey) return baseHeaders;
    return {
        ...baseHeaders,
        'X-Internal-API-Key': internalApiKey
    };
}

function extractErrorMessage(payload, response) {
    if (payload && payload.error && payload.error.message) {
        return payload.error.message;
    }
    if (typeof payload === 'string' && payload.trim()) {
        return payload;
    }
    return `Request failed with status ${response.status}`;
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: buildHeaders(options.headers || {})
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        throw new Error(extractErrorMessage(payload, response));
    }

    return payload;
}

async function getJson(url) {
    return requestJson(url);
}

async function postJson(url, data = null) {
    const options = { method: 'POST' };
    if (data !== null) {
        options.headers = JSON_HEADERS;
        options.body = JSON.stringify(data);
    }
    return requestJson(url, options);
}

async function putJson(url, data) {
    return requestJson(url, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(data)
    });
}

async function deleteJson(url) {
    return requestJson(url, { method: 'DELETE' });
}

async function uploadForm(url, formData) {
    return requestJson(url, {
        method: 'POST',
        body: formData
    });
}

const api = {
    async getOperations() {
        return getJson(`${API_BASE}/operations/`);
    },
    async getActiveOperation() {
        return getJson(`${API_BASE}/operations/active`);
    },
    async createOperation(data) {
        return postJson(`${API_BASE}/operations/`, data);
    },
    async updateOperation(id, data) {
        return putJson(`${API_BASE}/operations/${id}`, data);
    },
    async closeOperation(id) {
        return postJson(`${API_BASE}/operations/${id}/close`);
    },
    async getAssignments(operationId = null) {
        const url = operationId
            ? `${API_BASE}/assignments/?operation_id=${operationId}`
            : `${API_BASE}/assignments/`;
        return getJson(url);
    },
    async createAssignment(data) {
        return postJson(`${API_BASE}/assignments/`, data);
    },
    async updateAssignment(id, data) {
        return putJson(`${API_BASE}/assignments/${id}`, data);
    },
    async updateAssignmentStatus(id, status) {
        return postJson(`${API_BASE}/assignments/${id}/status`, { status });
    },
    async completeAssignment(id) {
        return postJson(`${API_BASE}/assignments/${id}/complete`);
    },
    async uploadAssignmentPdf(assignmentId, file) {
        const formData = new FormData();
        formData.append('assignment_id', assignmentId);
        formData.append('file', file);
        return uploadForm(`${API_BASE}/assignments/upload`, formData);
    },
    async assignVehicle(assignmentId, vehicleId) {
        return postJson(`${API_BASE}/assignments/${assignmentId}/vehicles`, { vehicle_id: vehicleId });
    },
    async unassignVehicle(assignmentId, vehicleId) {
        return deleteJson(`${API_BASE}/assignments/${assignmentId}/vehicles/${vehicleId}`);
    },
    async getVehicles() {
        return getJson(`${API_BASE}/vehicles/`);
    },
    async getVehiclesByLocation() {
        return getJson(`${API_BASE}/vehicles/by-location`);
    },
    async createVehicle(data) {
        return postJson(`${API_BASE}/vehicles/`, data);
    },
    async updateVehicle(id, data) {
        return putJson(`${API_BASE}/vehicles/${id}`, data);
    },
    async deleteVehicle(id) {
        return deleteJson(`${API_BASE}/vehicles/${id}`);
    },
    async getLocations() {
        return getJson(`${API_BASE}/locations/`);
    },
    async createLocation(data) {
        return postJson(`${API_BASE}/locations/`, data);
    },
    async updateLocation(id, data) {
        return putJson(`${API_BASE}/locations/${id}`, data);
    },
    async deleteLocation(id) {
        return deleteJson(`${API_BASE}/locations/${id}`);
    },
    async getJournalEntries(operationId = null, assignmentId = null) {
        let url = `${API_BASE}/journal/`;
        const params = new URLSearchParams();
        if (operationId) params.append('operation_id', operationId);
        if (assignmentId) params.append('assignment_id', assignmentId);
        if (params.toString()) url += '?' + params.toString();
        return getJson(url);
    },
    async createJournalEntry(data) {
        return postJson(`${API_BASE}/journal/`, data);
    }
};
