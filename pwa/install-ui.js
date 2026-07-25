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

return {

    initialize,

    hide

};

})();