/**
 * ==========================================================
 * Aegis Link PWA Runtime
 * Runtime Client
 * ==========================================================
 */

const RuntimeClient = (() => {

    const RUNTIME_VERSION = "1.1.0";
    const INSTALLATION_UUID_KEY = "pwa_installation_uuid";

    function getInstallationUuid() {

        let uuid = localStorage.getItem(INSTALLATION_UUID_KEY);

        if (!uuid) {

            uuid = crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

            localStorage.setItem(INSTALLATION_UUID_KEY, uuid);

        }

        return uuid;

    }

    function getPlatform() {

        const ua = navigator.userAgent;

        if (/Android/i.test(ua)) return "Android";
        if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
        if (/Windows/i.test(ua)) return "Windows";
        if (/Macintosh|Mac OS/i.test(ua)) return "macOS";

        return navigator.platform || "Unknown";

    }

    function getDeviceType() {

        const ua = navigator.userAgent;

        if (/iPad|Tablet/i.test(ua)) return "tablet";
        if (/Android|iPhone|iPod|Mobile/i.test(ua)) return "mobile";

        return "desktop";

    }

    function getBrowser() {

        const ua = navigator.userAgent;

        const browsers = [
            ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
            ["Edge", /EdgA?\/([\d.]+)/],
            ["Opera", /OPR\/([\d.]+)/],
            ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
            ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
            ["Safari", /Version\/([\d.]+).*Safari/]
        ];

        for (const [name, pattern] of browsers) {

            const match = ua.match(pattern);

            if (match) {
                return {
                    name,
                    version: match[1] || null
                };
            }

        }

        return {
            name: "Unknown",
            version: null
        };

    }

    function isStandalone() {

        return (
            window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true
        );

    }

    async function report(backendBase, options = {}) {

        const token = localStorage.getItem("guard_session_token");

console.log("[Aegis Runtime] Report started", {
    tokenAvailable: Boolean(token),
    standalone: isStandalone(),
    state: InstallationManager.getState(),
    runtimeVersion: RUNTIME_VERSION
});

if (!token) {
    console.error(
        "[Aegis Runtime] Registration skipped: guard_session_token is missing"
    );

    return null;
}

        const browser = getBrowser();

        const state =
            options.state ||
            InstallationManager.getState();

        const payload = {

            installationUuid: getInstallationUuid(),

            runtimeVersion: RUNTIME_VERSION,

            event: options.event || "runtime_started",

            previousState: options.previousState || "BOOT",

            state,
            currentState: state,

            platform: getPlatform(),
            deviceType: getDeviceType(),
            deviceName: null,
            osVersion: null,

            browser: browser.name,
            browserVersion: browser.version,

            standalone: isStandalone(),

            installPromptSupported:
                BrowserDetector.supportsInstallPrompt(),

            manifestSupported:
                Boolean(document.querySelector('link[rel="manifest"]')),

            serviceWorkerSupported:
                "serviceWorker" in navigator,

            details: options.details || {}

        };

        const response = await fetch(
            `${backendBase.replace(/\/$/, "")}/runtime`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        if (!response.ok || data.success !== true) {
            throw new Error(
                data.message || "Runtime registration failed"
            );
        }

        console.log("PWA Runtime registered:", data);

        return data;

    }

    return {
        report
    };

})();