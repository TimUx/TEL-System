// History page functionality
document.addEventListener('DOMContentLoaded', async () => {
    await loadHistory();
});

async function loadHistory() {
    try {
        const operations = await api.getOperations();
        renderHistory(operations);
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function renderHistory(operations) {
    const tbody = document.getElementById('historyTableBody');
    
    if (operations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Keine Einsatzlagen vorhanden</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    operations.forEach(operation => {
        const row = document.createElement('tr');
        
        const statusBadge = operation.status === 'active' ? 
            '<span class="status-badge active">Aktiv</span>' :
            '<span class="status-badge closed">Geschlossen</span>';
        
        row.innerHTML = `
            <td>${operation.number}</td>
            <td>${operation.title}</td>
            <td>${formatDate(operation.created_at)}</td>
            <td>${operation.closed_at ? formatDate(operation.closed_at) : '-'}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="exportOperation(${operation.id})">Export</button>
                <button class="btn btn-small btn-secondary" onclick="viewOperation(${operation.id})">Anzeigen</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('de-DE');
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
