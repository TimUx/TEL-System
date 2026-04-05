// Shared utility functions

function getSequentialNumber(assignmentNumber) {
    if (!assignmentNumber) return '';
    const parts = assignmentNumber.split('-');
    return parts.length > 0 ? parts[parts.length - 1] : assignmentNumber;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('de-DE');
}
