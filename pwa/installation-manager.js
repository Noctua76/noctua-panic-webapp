/**
 * ==========================================================
 * Aegis Link PWA Runtime
 * Installation Manager
 * ----------------------------------------------------------
 * Version : 1.0.0
 * Purpose :
 *  - Evaluate installation state
 *  - Control installation flow
 *  - Decide next application step
 *
 * This module DOES NOT:
 *  - Render UI
 *  - Modify the DOM
 *  - Perform the installation itself
 * ==========================================================
 */

const InstallationManager = (() => {

    const INSTALL_STATES = Object.freeze({

    BOOT: "BOOT",

    INSTALLED: "INSTALLED",

    CAN_INSTALL: "CAN_INSTALL",

    MANUAL_INSTALL: "MANUAL_INSTALL",

    UNSUPPORTED: "UNSUPPORTED"

});

let currentState = INSTALL_STATES.BOOT;

function setState(state) {

    if (!Object.values(INSTALL_STATES).includes(state)) {
        throw new Error(`Invalid installation state: ${state}`);
    }

    currentState = state;

}
function getState() {

    return currentState;

}
function determineState() {

    if (!BrowserDetector.supportsPWA()) {
        setState(INSTALL_STATES.UNSUPPORTED);
        return;
    }

    if (BrowserDetector.isStandalone()) {
        setState(INSTALL_STATES.INSTALLED);
        return;
    }

    if (BrowserDetector.supportsInstallPrompt()) {
        setState(INSTALL_STATES.CAN_INSTALL);
        return;
    }

    setState(INSTALL_STATES.MANUAL_INSTALL);

}
function initialize() {

    determineState();

    console.log("PWA State:", getState());

    switch (getState()) {

        case INSTALL_STATES.INSTALLED:
            InstallUI.hide();
            break;

        case INSTALL_STATES.CAN_INSTALL:
    InstallUI.showInstallPrompt();
    break;

case INSTALL_STATES.MANUAL_INSTALL:
    InstallUI.showInstallPrompt();
    break;

        case INSTALL_STATES.UNSUPPORTED:
    InstallUI.hide();
    break;

        default:
            InstallUI.hide();

    }

}
function canStartApplication() {

    return currentState === INSTALL_STATES.INSTALLED;

}

return {

    initialize,

    getState,

    canStartApplication,

    getStates() {
        return INSTALL_STATES;
    }

};

})();