/**
 * ==========================================================
 * Aegis Link PWA Runtime
 * Installation UI
 * ----------------------------------------------------------
 * Version : 1.0.0
 * Purpose :
 *  - Render installation interface
 *  - Display installation instructions
 *  - Handle user interaction
 *
 * This module DOES NOT:
 *  - Detect browsers
 *  - Decide installation state
 * ==========================================================
 */

const InstallUI = (() => {

    let container = null;
    function initialize() {

    container = document.getElementById("pwa-install-container");

}

function hide() {

    if (!container) {
        return;
    }

    container.style.display = "none";
    container.innerHTML = "";

}

function showMessage(title, message) {

    if (!container) {
        return;
    }

    container.style.display = "block";

    container.innerHTML = `
        <div class="pwa-install-card">

            <h2>${title}</h2>

            <p>${message}</p>

        </div>
    `;

}

return {

    initialize,
    hide,
    showMessage

};

})();