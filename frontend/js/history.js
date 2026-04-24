// History page functionality
const HISTORY_TABLE_BODY_ID = 'historyTableBody';
const EMPTY_HISTORY_ROW_HTML = '<tr><td colspan="6" style="text-align: center;">Keine Einsatzlagen vorhanden</td></tr>';
const STATUS_HTML_BY_KEY = {
    active: '<span class="status-badge active">Aktiv</span>',
    default: '<span class="status-badge closed">Geschlossen</span>'
};
const e = escapeHtml;

document.addEventListener('DOMContentLoaded', async () => {
    await loadHistory();
});

function getHistoryTableBody() {
    return document.getElementById(HISTORY_TABLE_BODY_ID);
}

function createOperationRowHtml(operation) {
    const statusBadge = operation.status === 'active'
        ? STATUS_HTML_BY_KEY.active
        : STATUS_HTML_BY_KEY.default;

    return `
        <td>${e(operation.number)}</td>
        <td>${e(operation.title)}</td>
        <td>${formatDate(operation.created_at)}</td>
        <td>${operation.closed_at ? formatDate(operation.closed_at) : '-'}</td>
        <td>${statusBadge}</td>
        <td>
            <button class="btn btn-small btn-secondary" onclick="exportOperation(${operation.id})">Export</button>
            <button class="btn btn-small btn-secondary" onclick="viewOperation(${operation.id})">Anzeigen</button>
        </td>
    `;
}

function renderEmptyHistory(tbody) {
    tbody.innerHTML = EMPTY_HISTORY_ROW_HTML;
}

async function loadHistory() {
    try {
        const operations = await api.getOperations();
        renderHistory(operations);
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function renderHistory(operations) {
    const tbody = getHistoryTableBody();

    if (operations.length === 0) {
        renderEmptyHistory(tbody);
        return;
    }

    tbody.innerHTML = '';
    operations.forEach((operation) => {
        const row = document.createElement('tr');
        row.innerHTML = createOperationRowHtml(operation);
        tbody.appendChild(row);
    });
}

async function exportOperation(id) {
    alert('PDF Export Funktion wird implementiert.\nDiese Funktion erstellt ein PDF mit dem kompletten Einsatztagebuch und einer Lagekarte.');
    // TODO: Implement PDF export
    // This would call a backend endpoint that generates a PDF using reportlab
}

async function viewOperation(id) {
    alert('Ansicht Funktion wird implementiert.\nDiese Funktion öffnet eine Read-Only Ansicht der Einsatzlage.');
    // TODO: Implement read-only view
    // This would open the main application with all data but in read-only mode
}
