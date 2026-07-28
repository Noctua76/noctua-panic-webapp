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

            <strong>Application Installation</strong>

            <button class="pwa-close-button">
                ✕
            </button>

        </div>

        <div class="pwa-install-subtitle">

            Install this application on your device to enable
            push notifications and the complete security workflow.

        </div>

        <div class="pwa-install-features">

            <div>One-tap access</div>

            <div>Push notifications</div>

            <div>Offline availability</div>

        </div>

        <div class="pwa-install-actions">

            <button class="pwa-install-button">

                Install Application

            </button>

            <p class="pwa-install-note">
    For the best installation experience, we recommend using Google Chrome.
</p>

        </div>

    </div>
`;

const closeButton = container.querySelector(".pwa-close-button");

closeButton?.addEventListener("click", hide);

const installButton = container.querySelector(".pwa-install-button");

installButton?.addEventListener("click", () => {

    InstallationManager.promptInstall();

});

}

function showManualInstructions() {

    if (!container) {
        return;
    }

    container.style.display = "block";

    container.innerHTML = `
        <div class="pwa-install-card">

            <div class="pwa-install-header">

                <strong>Application Installation</strong>

                <button class="pwa-close-button">
                    ✕
                </button>

            </div>

            <div class="pwa-install-subtitle">

                To install Aegis Link on this device:

            </div>

            <div class="pwa-install-features">

                <div>1. Open your browser menu</div>

                <div>2. Select "Add to Home Screen"</div>

                <div>3. Confirm the installation</div>

            </div>

        </div>
    `;

    const closeButton = container.querySelector(".pwa-close-button");

    closeButton?.addEventListener("click", hide);

}

return {

    initialize,
    hide,
    showInstallPrompt,
    showManualInstructions

};

})();