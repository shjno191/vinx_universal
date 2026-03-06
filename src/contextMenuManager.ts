// Shared singleton to ensure only one context menu is visible at a time
let _closeCurrentMenu: (() => void) | null = null;

export function registerContextMenu(closeFn: () => void) {
    // Close any previously registered menu
    if (_closeCurrentMenu) {
        _closeCurrentMenu();
    }
    _closeCurrentMenu = closeFn;
}

export function clearContextMenu() {
    _closeCurrentMenu = null;
}
