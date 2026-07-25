/**
 * ==========================================================
 * Aegis Link PWA Runtime
 * Browser Detection Service
 * ----------------------------------------------------------
 * Version : 1.0.0
 * Purpose :
 *  - Browser detection
 *  - Platform detection
 *  - Runtime capabilities
 *  - Device information
 *
 * This module DOES NOT:
 *  - Render UI
 *  - Install the PWA
 *  - Modify the application
 * ==========================================================
 */

const RUNTIME_INFO = Object.freeze({
    name: "Aegis Link PWA Runtime",
    version: "1.0.0"
});

const BrowserDetector = (() => {

    let deferredInstallPrompt = null;

    function getUserAgent() {
        return navigator.userAgent || "";
    }

    function getBrowser() {
        const ua = getUserAgent();

        if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
        if (/Edg/i.test(ua)) return "Microsoft Edge";
        if (/OPR/i.test(ua)) return "Opera";
        if (/Firefox/i.test(ua)) return "Firefox";
        if (/MiuiBrowser/i.test(ua)) return "Xiaomi Browser";
        if (/Chrome/i.test(ua)) return "Chrome";
        if (/Safari/i.test(ua)) return "Safari";

        return "Unknown";
    }

    function getBrowserVersion() {
    const ua = getUserAgent();

    const match =
        ua.match(/SamsungBrowser\/([\d.]+)/) ||
        ua.match(/Edg\/([\d.]+)/) ||
        ua.match(/OPR\/([\d.]+)/) ||
        ua.match(/Firefox\/([\d.]+)/) ||
        ua.match(/Chrome\/([\d.]+)/) ||
        ua.match(/Version\/([\d.]+).*Safari/);

    return match ? match[1] : "Unknown";
}

    function getPlatform() {
        const ua = getUserAgent();

        if (/Android/i.test(ua)) return "Android";
        if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
        if (/Windows/i.test(ua)) return "Windows";
        if (/Mac/i.test(ua)) return "macOS";
        if (/Linux/i.test(ua)) return "Linux";

        return "Unknown";
    }

    function isStandalone() {

        return window.matchMedia("(display-mode: standalone)").matches ||
               window.navigator.standalone === true;

    }

    function supportsServiceWorker() {
        return "serviceWorker" in navigator;
    }

    function supportsNotifications() {
        return "Notification" in window;
    }

    function supportsPush() {
        return "PushManager" in window;
    }

    function supportsGeolocation() {
        return "geolocation" in navigator;
    }

    function supportsCamera() {
        return !!(
            navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia
        );
    }

    function supportsInstallPrompt() {
        return deferredInstallPrompt !== null;
    }

    function supportsPWA() {
    return supportsServiceWorker();
}

    
    function getDeviceInfo() {

        return {
            runtime: RUNTIME_INFO,

            browser: getBrowser(),

            browserVersion: getBrowserVersion(),

            platform: getPlatform(),

            standalone: isStandalone(),

            pwaSupported: supportsPWA(),

            installPromptSupported: supportsInstallPrompt(),

            serviceWorker: supportsServiceWorker(),

            notifications: supportsNotifications(),

            push: supportsPush(),

            geolocation: supportsGeolocation(),

            camera: supportsCamera(),

            online: navigator.onLine,

            language: navigator.language,

            screenWidth: window.screen.width,

            screenHeight: window.screen.height,

            viewportWidth: window.innerWidth,

            viewportHeight: window.innerHeight,

            userAgent: getUserAgent()

        };

    }

    window.addEventListener("beforeinstallprompt", (event) => {

        event.preventDefault();

        deferredInstallPrompt = event;

    });

    return {

        getBrowser,

        getBrowserVersion,

        getPlatform,

        isStandalone,

        supportsPWA,

        supportsInstallPrompt,

        getDeviceInfo,

        getDeferredInstallPrompt() {
            return deferredInstallPrompt;
        }

    };

})();