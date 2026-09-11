(function () {
    const DEPLOYED_STATUSES = new Set(['alerted', 'en_route', 'on_scene']);
    const UNAVAILABLE_STATUSES = new Set(['unavailable', 'out_of_service']);

    function getVehicleAssignments(vehicle, assignments) {
        return assignments.filter((assignment) => assignment.vehicle_ids.includes(vehicle.id));
    }

    function getActiveAssignments(assignments) {
        return assignments.filter((assignment) => assignment.status !== 'completed');
    }

    function buildVehicleAssignmentOverview(vehicles, assignments) {
        const deployedVehicles = [];
        const availableVehiclesByLocation = {};
        const unavailableVehicles = [];

        vehicles.forEach((vehicle) => {
            const vehicleAssignments = getVehicleAssignments(vehicle, assignments);
            const activeAssignments = getActiveAssignments(vehicleAssignments);
            const hasActiveAssignments = activeAssignments.length > 0;

            if (hasActiveAssignments || DEPLOYED_STATUSES.has(vehicle.status)) {
                deployedVehicles.push({ vehicle, assignments: vehicleAssignments, activeAssignments });
                return;
            }

            if (UNAVAILABLE_STATUSES.has(vehicle.status)) {
                unavailableVehicles.push(vehicle);
                return;
            }

            const locationName = vehicle.location_name || 'Ohne Standort';
            if (!availableVehiclesByLocation[locationName]) {
                availableVehiclesByLocation[locationName] = [];
            }
            availableVehiclesByLocation[locationName].push(vehicle);
        });

        return {
            deployedVehicles,
            availableVehiclesByLocation,
            unavailableVehicles
        };
    }

    window.vehicleAssignmentUtils = {
        DEPLOYED_STATUSES,
        UNAVAILABLE_STATUSES,
        getVehicleAssignments,
        getActiveAssignments,
        buildVehicleAssignmentOverview
    };
})();
