/**
 * ==========================================================
 * Aegis Link PWA Runtime
 * Anonymous Installation Client
 * ----------------------------------------------------------
 * Purpose:
 *  - Report confirmed PWA installations before guard login
 *  - Keep anonymous installation reporting isolated from the
 *    authenticated RuntimeClient
 * ==========================================================
 */

const AnonymousInstallClient = (() => {

    const INSTALLATION_UUID_KEY = "pwa_installation_uuid";

    const CONFIRMATION_METHODS = Object.freeze({
        APP_INSTALLED: "appinstalled",
        STANDALONE_LAUNCH: "standalone_launch"
    });

    const UUID_PATTERN =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    let backendBase = null;
    let initialized = false;
    let volatileInstallationUuid = null;
    const pendingReports = new Set();

    function createInstallationUuid() {

        const cryptoApi = window.crypto;

        if (typeof cryptoApi?.randomUUID === "function") {
            return cryptoApi.randomUUID();
        }

        if (typeof cryptoApi?.getRandomValues === "function") {

            const bytes = new Uint8Array(16);
            cryptoApi.getRandomValues(bytes);

            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;

            const hex = Array.from(
                bytes,
                byte => byte.toString(16).padStart(2, "0")
            );

            return [
                hex.slice(0, 4).join(""),
                hex.slice(4, 6).join(""),
                hex.slice(6, 8).join(""),
                hex.slice(8, 10).join(""),
                hex.slice(10, 16).join("")
            ].join("-");

        }

        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            character => {
                const randomValue = Math.floor(Math.random() * 16);
                const value =
                    character === "x"
                        ? randomValue
                        : (randomValue & 0x3) | 0x8;

                return value.toString(16);
            }
        );

    }

    function getInstallationUuid() {

        try {

            const storedUuid = localStorage.getItem(
                INSTALLATION_UUID_KEY
            );

            if (storedUuid && UUID_PATTERN.test(storedUuid)) {
                return storedUuid;
            }

            const uuid = createInstallationUuid();

            localStorage.setItem(INSTALLATION_UUID_KEY, uuid);

            return uuid;

        } catch (error) {

            if (!volatileInstallationUuid) {
                volatileInstallationUuid = createInstallationUuid();
            }

            return volatileInstallationUuid;

        }

    }

    function getDeviceType() {

        const userAgent = navigator.userAgent || "";

        if (/iPad|Tablet/i.test(userAgent)) return "tablet";

        if (/Android|iPhone|iPod|Mobile/i.test(userAgent)) {
            return "mobile";
        }

        return "desktop";

    }

    async function createPayload(confirmationMethod) {

        const deviceMetadata =
            await BrowserDetector.getDeviceMetadata();

        return {
            installationUuid: getInstallationUuid(),
            runtimeVersion: BrowserDetector.getRuntimeVersion(),
            platform: BrowserDetector.getPlatform(),
            deviceType: getDeviceType(),
            deviceName: deviceMetadata.deviceName,
            osVersion: deviceMetadata.osVersion,
            browser: BrowserDetector.getBrowser(),
            browserVersion: BrowserDetector.getBrowserVersion(),
            standalone: BrowserDetector.isStandalone(),
            confirmationMethod
        };

    }

    async function report(confirmationMethod) {

        if (!backendBase) {
            return null;
        }

        if (navigator.onLine === false) {
            pendingReports.add(confirmationMethod);
            return null;
        }

        try {

            const payload = await createPayload(confirmationMethod);

            const response = await fetch(
                `${backendBase}/runtime/install`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload),
                    keepalive: true
                }
            );

            const data = await response.json();

            if (!response.ok || data.success !== true) {
                throw new Error(
                    data.message ||
                    "Anonymous installation registration failed"
                );
            }

            pendingReports.delete(confirmationMethod);

            console.log(
                "[Aegis Runtime] Anonymous installation registered:",
                confirmationMethod
            );

            return data;

        } catch (error) {

            pendingReports.add(confirmationMethod);

            console.warn(
                "[Aegis Runtime] Anonymous installation registration deferred:",
                error
            );

            return null;

        }

    }

    async function retryPendingReports() {

        for (const confirmationMethod of [...pendingReports]) {
            await report(confirmationMethod);
        }

    }

    function initialize(baseUrl) {

        if (initialized) {
            return;
        }

        if (typeof baseUrl !== "string" || !baseUrl.trim()) {
            console.warn(
                "[Aegis Runtime] Anonymous installation client skipped: backend URL is missing"
            );
            return;
        }

        backendBase = baseUrl.replace(/\/$/, "");
        initialized = true;

        window.addEventListener("appinstalled", () => {
            report(CONFIRMATION_METHODS.APP_INSTALLED);
        });

        window.addEventListener("online", retryPendingReports);

        if (BrowserDetector.isStandalone()) {
            report(CONFIRMATION_METHODS.STANDALONE_LAUNCH);
        }

    }

    return {
        initialize
    };

})();