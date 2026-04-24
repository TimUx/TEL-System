// Single state holder for main app data.
(function () {
    const state = {
        currentOperation: null,
        assignments: [],
        vehicles: [],
        locations: []
    };

    function setCurrentOperation(operation) {
        state.currentOperation = operation;
    }

    function setAssignments(assignments) {
        state.assignments = assignments;
    }

    function setVehicles(vehicles) {
        state.vehicles = vehicles;
    }

    function setLocations(locations) {
        state.locations = locations;
    }

    function clearOperationData() {
        state.currentOperation = null;
        state.assignments = [];
    }

    window.appState = {
        state,
        setCurrentOperation,
        setAssignments,
        setVehicles,
        setLocations,
        clearOperationData
    };
})();
