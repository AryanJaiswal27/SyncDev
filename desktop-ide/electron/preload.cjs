// Preload script to bridge Electron APIs safely if contextIsolation is true.
// We disabled contextIsolation for quick rapid development, but this is here for best practices.
window.addEventListener('DOMContentLoaded', () => {
    console.log('SyncDev Electron preload script initialized');
});
