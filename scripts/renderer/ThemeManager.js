const { ipcRenderer: ipc } = require('electron');
/**
 * Theme manager class for renderer process.
 *
 * It listens for web and ipc events to manage themes.
 */
class ThemeManager {
  constructor() {
    this._listThemesHandler = this._listThemesHandler.bind(this);
    this._activeThemeHandler = this._activeThemeHandler.bind(this);
    this._activateHandler = this._activateHandler.bind(this);
    this._installHandler = this._installHandler.bind(this);
    this._uninstallHandler = this._uninstallHandler.bind(this);
    this._promises = {};
    this._lastId = 0;
  }
  /**
   * Listens for the ipc events to suppot theme changes
   */
  listen() {
    window.addEventListener('themes-list', this._listThemesHandler);
    window.addEventListener('theme-active-info', this._activeThemeHandler);
    window.addEventListener('theme-activate', this._activateHandler);
    window.addEventListener('theme-install', this._installHandler);
    window.addEventListener('theme-uninstall', this._uninstallHandler);
  }
  /**
   * Removes event listeners
   */
  unlisten() {
    window.removeEventListener('themes-list', this._listThemesHandler);
    window.removeEventListener('theme-active-info', this._activeThemeHandler);
    window.removeEventListener('theme-activate', this._activateHandler);
    window.removeEventListener('theme-install', this._installHandler);
    window.removeEventListener('theme-uninstall', this._uninstallHandler);
  }
  /**
   * Handler for the `themes-list` custom event from theme panel.
   *
   * @param {CustomEvent} e
   */
  _listThemesHandler(e) {
    e.preventDefault();
    e.detail.result = this.listThemes();
  }
  /**
   * Lists installed themes in the application.
   * @return {Promise<Array>} A promise resolved to the theme info array
   */
  async listThemes() {
    return await ipc.invoke('theme-manager-list-themes');
  }
  /**
   * Handler for the `theme-active-info` custom event from theme panel.
   *
   * @param {CustomEvent} e
   */
  _activeThemeHandler(e) {
    e.preventDefault();
    e.detail.result = this.readActiveThemeInfo();
  }
  /**
   * Reads information about current theme.
   * @return {Promise<Object>} A promise resolved to the theme info
   */
  async readActiveThemeInfo() {
    return await ipc.invoke('theme-manager-active-theme-info');
  }

  /**
   * Activates the theme selected by the user.
   *
   * @param {CustomEvent} e
   */
  _activateHandler(e) {
    e.preventDefault();
    const { theme } = e.detail;
    e.detail.result = this.activate(theme);
  }
  /**
   * Activates the theme. It stores theme id in user preferences and loads the
   * theme.
   * @param {String} themeId Theme ID to activate
   * @return {Promise} Promise resolved when theme is avtivated
   */
  async activate(themeId) {
    return await ipc.invoke('theme-manager-activate-theme', themeId);
  }

  _installHandler(e) {
    e.preventDefault();
    const name = e.detail.name;
    e.detail.result = this.installTheme(name);
  }

  async installTheme(name) {
    if (!name) {
      throw new Error('Name is required');
    }
    return await ipc.invoke('theme-manager-install-theme', name);
  }

  _uninstallHandler(e) {
    e.preventDefault();
    const name = e.detail.name;
    e.detail.result = this.uninstallTheme(name);
  }

  async uninstallTheme(name) {
    if (!name) {
      throw new Error('Name is required');
    }
    return await ipc.invoke('theme-manager-uninstall-theme', name);
  }

  /**
   * Loads theme file and activates it.
   * @param {String} themeId ID of installed theme of location of theme file.
   *
   * @param {Boolean} noFallback By default the manager will try to revert to default
   * theme when passed theme cannot be loaded. When this opttion is set then
   * it will throw error instead of loading default theme.
   * @return {Promise}
   */
  async loadTheme(themeId, noFallback) {
    const defaultTheme = 'advanced-rest-client/apic-electron-default-theme';
    try {
      return await this._loadTheme(themeId);
    } catch (cause) {
      if (!noFallback && themeId !== defaultTheme) {
        return await this._loadTheme(defaultTheme);
      }
      throw cause;
    }
  }

  async _loadTheme(themeId) {
    const nodes = document.head.querySelectorAll('link[rel="stylesheet"]');
    for (let i = nodes.length - 1; i >= 0; i--) {
      const href = nodes[i].href;
      if (href && href.indexOf('themes:') === 0) {
        nodes[i].parentNode.removeChild(nodes[i]);
      }
    }
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    link.setAttribute('href', 'themes://' + themeId);
    document.head.appendChild(link);
  }
}
module.exports.ThemeManager = ThemeManager;
