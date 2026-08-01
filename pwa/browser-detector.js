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
    version: window.AEGIS_RUNTIME_VERSION || "development"
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

function normalizeVersion(value) {

    if (!value) {
        return "Unknown";
    }

    return String(value).replace(/_/g, ".");

}

function getFallbackDeviceName() {

    const ua = getUserAgent();

    if (/iPad/i.test(ua)) return "iPad";
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPod/i.test(ua)) return "iPod";
    if (/Windows/i.test(ua)) return "Windows PC";
    if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
    if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
        return "Linux Device";
    }

    if (/Android/i.test(ua)) {

        const match = ua.match(
            /Android[^;)]*;\s*(?:[a-z]{2}(?:-[A-Z]{2})?;\s*)?([^;)]+?)(?:\s+Build\/[^;)]+)?(?:;|\))/i
        );

        const model = match?.[1]?.trim();

        if (
            model &&
            !["K", "wv", "Mobile"].includes(model)
        ) {
            return model;
        }

        return "Android Device";

    }

    return "Unknown";

}

function getFallbackOsVersion() {

    const ua = getUserAgent();

    const androidMatch = ua.match(/Android\s+([\d.]+)/i);

    if (androidMatch) {
        return normalizeVersion(androidMatch[1]);
    }

    const iosMatch = ua.match(
        /(?:iPhone OS|CPU OS)\s+([\d_]+)/i
    );

    if (iosMatch) {
        return normalizeVersion(iosMatch[1]);
    }

    const windowsMatch = ua.match(/Windows NT\s+([\d.]+)/i);

    if (windowsMatch) {
        return normalizeVersion(windowsMatch[1]);
    }

    const macMatch = ua.match(/Mac OS X\s+([\d_]+)/i);

    if (macMatch) {
        return normalizeVersion(macMatch[1]);
    }

    return "Unknown";

}

async function getDeviceMetadata() {

    let deviceName = getFallbackDeviceName();
    let osVersion = getFallbackOsVersion();

    const userAgentData = navigator.userAgentData;

    if (
        userAgentData &&
        typeof userAgentData.getHighEntropyValues === "function"
    ) {

        try {

            const metadata =
                await userAgentData.getHighEntropyValues([
                    "model",
                    "platformVersion"
                ]);

            if (metadata.model?.trim()) {
                deviceName = metadata.model.trim();
            }

            if (metadata.platformVersion?.trim()) {
                osVersion = normalizeVersion(
                    metadata.platformVersion.trim()
                );
            }

        } catch (error) {

            console.warn(
                "[Aegis Runtime] Detailed device information unavailable:",
                error
            );

        }

    }

    return {
        deviceName,
        osVersion
    };

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

getDeviceMetadata,

getRuntimeVersion() {
    return RUNTIME_INFO.version;
},

getDeferredInstallPrompt() {
            return deferredInstallPrompt;
        }

    };

})();