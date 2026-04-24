// Shared helpers for deriving vehicle/assignment relationships.
(function () {
    function getVehicleAssignments(vehicle, assignments) {
        return assignments.filter((assignment) => assignment.vehicles.includes(vehicle.callsign));
    }

    function getActiveAssignments(assignments) {
        return assignments.filter((assignment) => assignment.status !== 'completed');
    }

    function buildActiveVehicleData(vehicles, assignments) {
        const activeVehicles = [];

        vehicles.forEach((vehicle) => {
            const vehicleAssignments = getVehicleAssignments(vehicle, assignments);
            const activeAssignments = getActiveAssignments(vehicleAssignments);

            if (activeAssignments.length > 0) {
                activeVehicles.push({
                    vehicle,
                    assignments: vehicleAssignments,
                    activeAssignments
                });
            }
        });

        return activeVehicles;
    }

    function buildInactiveVehiclesByLocation(vehicles, assignments) {
        const byLocation = {};

        vehicles.forEach((vehicle) => {
            const vehicleAssignments = getVehicleAssignments(vehicle, assignments);
            const activeAssignments = getActiveAssignments(vehicleAssignments);

            if (activeAssignments.length === 0) {
                const locationName = vehicle.location_name || 'Ohne Standort';
                if (!byLocation[locationName]) {
                    byLocation[locationName] = [];
                }
                byLocation[locationName].push(vehicle);
            }
        });

        return byLocation;
    }

    function buildVehicleAssignmentOverview(vehicles, assignments) {
        return {
            activeVehicles: buildActiveVehicleData(vehicles, assignments),
            inactiveVehiclesByLocation: buildInactiveVehiclesByLocation(vehicles, assignments)
        };
    }

    window.vehicleAssignmentUtils = {
        getVehicleAssignments,
        getActiveAssignments,
        buildActiveVehicleData,
        buildInactiveVehiclesByLocation,
        buildVehicleAssignmentOverview
    };
})();
