import { PreferencesManager } from '@advanced-rest-client/arc-electron-preferences';
import { nativeTheme } from 'electron';
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
  }

  _initializeConfiguration(params) {
    this.config = new PreferencesManager(params);
    this.config.on('settings-changed', (name, value) => {
      this.wm.notifyAll('app-preference-updated', [name, value]);
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
}
