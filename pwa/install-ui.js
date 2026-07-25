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

function showInstallPrompt() {

    if (!container) {
        return;
    }

    container.style.display = "block";

    container.innerHTML = `
        <div class="pwa-install-card">

            <div class="pwa-install-header">

                <div>

                    <strong>Install Aegis Link</strong>

                    <div class="pwa-install-subtitle">
                        Install the app for faster access.
                    </div>

                </div>

                <button class="pwa-close-button">
                    ✕
                </button>

            </div>

            <div class="pwa-install-features">

                <div>⚡ One-tap access</div>

                <div>🔔 Instant notifications</div>

                <div>📶 Works offline</div>

            </div>

            <div class="pwa-install-actions">

                <button class="pwa-install-button">
                    Install
                </button>

                <button class="pwa-later-button">
                    Not now
                </button>

            </div>

        </div>
    `;

}

return {

    initialize,
    hide,
    showInstallPrompt

};

})();