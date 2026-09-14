(function configureAegisGuard(global) {
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(
    global.location.hostname
  );

  global.AEGIS_CONFIG = Object.freeze({
    backendBase: isLocal
      ? "http://localhost:5000"
      : "https://noctua-panic-backend-production.up.railway.app",
  });
})(window);
