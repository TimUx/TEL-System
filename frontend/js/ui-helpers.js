// UI helper functions shared across the main app.
(function () {
    function byId(id) {
        return document.getElementById(id);
    }

    function setVisibility(id, isVisible, visibleDisplay = 'inline-block') {
        byId(id).style.display = isVisible ? visibleDisplay : 'none';
    }

    function setModalActive(modalId, isActive) {
        byId(modalId).classList.toggle('active', isActive);
    }

    function openModalWithReset(formId, modalId) {
        byId(formId).reset();
        setModalActive(modalId, true);
    }

    function renderEmptyState(containerId, text) {
        byId(containerId).innerHTML = `<p>${text}</p>`;
    }

    function fillSelectFromItems(selectId, items, buildOption, defaultOptionHtml) {
        const select = byId(selectId);
        select.innerHTML = defaultOptionHtml;

        items.forEach((item) => {
            const option = document.createElement('option');
            const mapped = buildOption(item);
            option.value = mapped.value;
            option.textContent = mapped.text;
            select.appendChild(option);
        });
    }

    window.uiHelpers = {
        byId,
        setVisibility,
        setModalActive,
        openModalWithReset,
        renderEmptyState,
        fillSelectFromItems
    };
})();
