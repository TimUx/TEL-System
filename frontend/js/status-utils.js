(function () {
    const assignmentStatusLabels = {
        open: 'Offen',
        assigned: 'Zugewiesen',
        in_progress: 'In Bearbeitung',
        completed: 'Abgeschlossen'
    };

    const vehicleStatusLabels = {
        available: 'Verfügbar',
        alerted: 'Alarmiert',
        en_route: 'Auf Anfahrt',
        on_scene: 'An Einsatzstelle',
        unavailable: 'Nicht verfügbar',
        out_of_service: 'Außer Dienst'
    };

    function getAssignmentStatusLabel(status) {
        return assignmentStatusLabels[status] || status;
    }

    function getVehicleStatusLabel(status) {
        return vehicleStatusLabels[status] || status;
    }

    function getAssignmentStatusClass(status) {
        return `status-${status}`;
    }

    function getVehicleStatusClass(status) {
        return `vehicle-status-${status}`;
    }

    window.statusUtils = {
        getAssignmentStatusLabel,
        getVehicleStatusLabel,
        getAssignmentStatusClass,
        getVehicleStatusClass
    };
})();
