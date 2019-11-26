import { ipcMain as ipc } from 'electron';
import { ThemeInfo } from './models/ThemeInfo.js';
import { ThemePluginsManager } from './ThemePluginsManager.js';
import log from './logger.js';

export class ThemeManager {
  /**
   * @param {AppEnvironment} app
   * @param {Boolean=} skipUpdateChaeck
   */
  constructor(app, skipUpdateChaeck) {
    /**
     * An update check debouncer timeout
     * @type {Number}
     */
    this.updateDebounce = 10000;
    this.app = app;
    /**
     * App default theme ID
     * @type {String}
     */
    this.defaultTheme = 'advanced-rest-client/apic-electron-default-theme';
    this._listThemesHandler = this._listThemesHandler.bind(this);
    this._themeInfoHandler = this._themeInfoHandler.bind(this);
    this._activateHandler = this._activateHandler.bind(this);
    this._installHandler = this._installHandler.bind(this);
    this._uninstallHandler = this._uninstallHandler.bind(this);

    this.manager = new ThemePluginsManager();
    if (!skipUpdateChaeck) {
      this._checkUpdates();
    }
  }
  /**
   * Creates a model for theme info file.
   * @return {ThemeInfo}
   */
  get themeInfo() {
    return new ThemeInfo();
  }

  /**
   * Listens for the ipc events to suppot theme changes
   */
  listen() {
    ipc.handle('theme-manager-list-themes', this._listThemesHandler);
    ipc.handle('theme-manager-active-theme-info', this._themeInfoHandler);
    ipc.handle('theme-manager-activate-theme', this._activateHandler);
    ipc.handle('theme-manager-install-theme', this._installHandler);
    ipc.handle('theme-manager-uninstall-theme', this._uninstallHandler);
  }
  /**
   * Removes event listeners
   */
  unlisten() {
    ipc.removeHandler('theme-manager-list-themes', this._listThemesHandler);
    ipc.removeHandler('theme-manager-active-theme-info', this._themeInfoHandler);
    ipc.removeHandler('theme-manager-activate-theme', this._activateHandler);
    ipc.removeHandler('theme-manager-install-theme', this._installHandler);
    ipc.removeHandler('theme-manager-uninstall-theme', this._uninstallHandler);
  }

  /**
   * A handler for the `theme-manager-list-themes` event from the renderer
   * process.
   * @param {Object} e
   */
  async _listThemesHandler() {
    const info = await this.themeInfo.load();
    const { themes } = info;
    return themes;
  }

  /**
   * A handler for the `theme-manager-active-theme-info` event from the renderer
   * process.
   * @param {Object} e
   */
  async _themeInfoHandler() {
    const settings = await this.app.config.load();
    const themesInfo = await this.themeInfo.load();
    const { themes } = themesInfo;
    const themeId = settings.theme || this.defaultTheme;
    let theme = this._findThemeInfo(themeId, themes);
    if (!theme) {
      if (themeId === this.defaultTheme) {
        throw new Error('Selected theme do not exists.');
      }
      theme = this._findThemeInfo(this.defaultTheme, themes);
      if (!theme) {
        throw new Error('Default theme do not exists.');
      }
    }
    return theme;
  }

  _findThemeInfo(id, themes) {
    if (!themes || !themes.length) {
      return;
    }
    return themes.find((item) => item._id === id);
  }
  /**
   * A handler for the `theme-manager-activate-theme` event from the renderer
   * process.
   * @param {Object} e
   * @param {String} themeId
   */
  async _activateHandler(e, themeId) {
    const settings = await this.app.config.load();
    settings.theme = themeId;
    await this.app.config.store();
  }
  /**
   * A handler for the `theme-manager-install-theme` channel from the renderer
   * process.
   * @param {Object} e
   * @param {String} name A name of the theme to install
   */
  async _installHandler(e, name) {
    if (!name || typeof name !== 'string') {
      throw new Error('The name is not valid.');
    }
    const index = name.indexOf('#');
    let version;
    if (index !== -1) {
      version = name.substr(index + 1);
      name = name.substr(0, index);
    }
    return await this.manager.install(name, version);
  }
  /**
   * A handler for the `theme-manager-uninstall-theme` channel from the renderer
   * process.
   * @param {Object} e
   * @param {String} name A name of the theme to uninstall
   */
  async _uninstallHandler(e, name) {
    if (!name || typeof name !== 'string') {
      throw new Error('The name is not valid.');
    }
    return await this.manager.uninstall(name);
  }

  _checkUpdates() {
    setTimeout(() => {
      this.__updateCheck();
    }, this.updateDebounce);
  }

  async __updateCheck() {
    log.debug('Checking for themes updates...');
    try {
      const info = await this.manager.checkForUpdates();
      if (!info || !info.length) {
        log.debug('Themes update not available.');
        return;
      }
      log.debug('Updating themes....');
      const result = await this.manager.update(info);
      result.forEach((item) => {
        if (!result.error) {
          return;
        }
        const { name, message } = item;
        log.info(`Theme ${name} update error: ${message}`);
      });
      log.info('Themes updated. The change will be applied with next app reload.');
    } catch (e) {
      log.error(e);
    }
  }
}
