import { PreferencesManager } from '@advanced-rest-client/arc-electron-preferences';
import { nativeTheme, ipcMain, shell, app } from 'electron';
import { ThemesProtocolHandler } from './ThemesProtocolHandler.js';
import { ThemeManager } from './ThemeManager.js';
import { EsmProtocolHandler } from './EsmProtocolHandler.js';
import { WindowsManager } from './WindowsManager.js';
import { UpdateStatus } from './UpdateStatus.js';
import log from './logger.js';

export class AppEnvironment {
  constructor(params = {}) {
    this.initParams = params;
    this.isDebug = params.isDebug || false;
    this.withDevtools = params.withDevtools || false;

    this._initializeConfiguration(params);
    this._initializeWindowsManager(params);
    this._initializeUpdateStatus();
    this._initializeThemes();

    ipcMain.on('open-external-url', this._externalUrlHandler.bind(this));
  }

  _getDefaultConfig(params) {
    return {
      theme: params.theme ? params.theme : 'advanced-rest-client/apic-electron-default-theme'
    };
  }

  _initializeConfiguration(params) {
    this.config = new PreferencesManager(params, this._getDefaultConfig(params));
    this.config.on('settings-changed', (name, value) => {
      this.wm.notifyAll('app-preference-updated', [name, value]);
      this._settingsChanged(name, value);
    });
    this.config.observe();
  }

  _initializeThemes() {
    this.themes = new ThemeManager(this, this.initParams.skipThemesUpdate);
    this.themes.listen();
    nativeTheme.on('updated', this._osThemeUpdated.bind(this));
  }

  _osThemeUpdated() {
    this.wm.notifyAll('system-theme-changed', nativeTheme.shouldUseDarkColors);
  }

  async loadEnvironment() {
    log.debug('Loading user configuration.');
    const settings = await this.config.load();
    log.debug('User configuration ready.');
    this._postConfig(settings);
  }

  registerHandlers() {
    log.debug('Initializing themes protocol');
    const tp = new ThemesProtocolHandler();
    tp.register();
    this.themesProtocol = tp;
    const mp = new EsmProtocolHandler();
    mp.register();
    this.modulesProtocol = mp;
  }

  _postConfig(config) {
    if (!this.isDebug) {
      this.us.start(config, this.initParams.skipAppUpdate);
    }
  }

  _initializeWindowsManager(params) {
    log.debug('Initializing windows manager.');
    this.wm = new WindowsManager(params);
    this.wm.listen();
  }

  _initializeUpdateStatus() {
    log.info('Initializing update manager.');
    this.us = new UpdateStatus();
    this.us.listen();
    this.us.on('notify-windows', (type, arg) => {
      this.wm.notifyAll(type, arg);
    });
  }

  /**
   * Handler for settings change.
   * @param {String} name Changed property name
   * @param {any} value Changed value
   */
  _settingsChanged(name, value) {
    switch (name) {
      case 'releaseChannel':
        this.us.updateReleaseChannel(value);
        break;
    }
  }

  /**
   * Handles opening an URL in a browser action.
   * @param {Event} e
   * @param {String} url The URL to open.
   */
  _externalUrlHandler(e, url) {
    if (!url) {
      return;
    }
    log.debug('Opening external URL: ' + url);
    shell.openExternal(url);
  }

  allClosedHandler() {
    log.debug('All windows are now closed.');
    if (process.platform !== 'darwin') {
      log.debug('Quiting main thread.');
      app.quit();
    } else {
      log.debug('Keeping main thread running.');
    }
  }

  /**
   * On OS X it's common to re-create a window in the app when the
   * dock icon is clicked and there are no other windows open.
   */
  async activateHandler() {
    log.debug('Activating window.');
    if (!this.wm.hasWindow) {
      await this.wm.open();
    } else {
      this.wm.restoreLast();
    }
  }

  open(params) {
    this.wm.open(params);
  }
}
