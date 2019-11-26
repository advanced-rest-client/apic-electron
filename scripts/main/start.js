import { app, protocol } from 'electron';
import { PreferencesManager } from '@advanced-rest-client/arc-electron-preferences';
import log from './logger.js';
import { AppOptions } from './AppOptions.js';
import { AppDefaults } from './AppDefaults.js';
import { AppEnvironment } from './AppEnvironment.js';
import appPaths from './AppPaths.js';

/* eslint-disable require-atomic-updates */

async function getConfig(settingsFile) {
  const mgr = new PreferencesManager({
    file: settingsFile
  });
  return await mgr.load();
}

async function electronReadyHandler(initOptions) {
  global.appReadyTime = Date.now();
  log.debug('Electron ready time: ' + (global.appReadyTime - global.shellStartTime) + 'ms');
  const defaults = new AppDefaults();
  await defaults.prepareEnvironment();
  global.apic = new AppEnvironment(initOptions);
  global.apic.registerHandlers();
  await global.apic.loadEnvironment();
  global.appLoadingTime = Date.now();
  log.debug('App init time: ' + (global.appLoadingTime - global.appReadyTime));
  global.apic.open(initOptions.openProtocolFile);
}

/**
 * Main application lounch function.
 * @param {Number} startTime A timestamp when the application was lounched.
 */
export default async (startTime) => {
  global.shellStartTime = startTime;

  process.on('uncaughtException', function(error = {}) {
    if (error.message) {
      log.error(error.message);
    }
    if (error.stack) {
      log.error(error.stack);
    }
  });

  process.on('unhandledRejection', function(error = {}) {
    if (error.message) {
      log.error(error.message);
    }

    if (error.stack) {
      log.error(error.stack);
    }
  });

  app.commandLine.appendSwitch('enable-experimental-web-platform-features');

  const startupOptions = new AppOptions();
  startupOptions.parse();
  if (startupOptions.debug) {
    log.level = startupOptions.debugLevel || 'warn';
  }
  const initOptions = startupOptions.getOptions();
  if (!initOptions.open) {
    initOptions.open = [];
  }

  if (initOptions.userDataDir) {
    app.setPath('userData', initOptions.userDataDir);
  }

  // Standard scheme must be registered before the app is ready
  protocol.registerSchemesAsPrivileged([
    { scheme: 'web-module', privileges: { standard: true, secure: true } },
    { scheme: 'themes', privileges: { standard: true, secure: true } }
  ]);

  log.debug('Setting up the environment');
  appPaths.setHome();
  appPaths.setSettingsFile(initOptions.settingsFile);
  appPaths.setThemesPath(initOptions.themesPath);

  // Overrides initial user path to be processed by appPaths
  initOptions.settingsFile = appPaths.settingsFile;
  initOptions.themesPath = appPaths.themesBasePath;

  const currentConfig = await getConfig(appPaths.settingsFile);
  const colorProfile = currentConfig.colorProfile;
  if (colorProfile && colorProfile !== 'default') {
    app.commandLine.appendSwitch('force-color-profile', colorProfile);
  }

  // This prevents Win10 from showing dupe items in the taskbar
  app.setAppUserModelId('com.squirrel.apic.' + process.arch);

  app.on('window-all-closed', () => {
    if (!global.apic) {
      return;
    }
    global.apic.allClosedHandler();
  });

  app.on('activate', () => {
    if (!global.apic) {
      return;
    }
    global.apic.activateHandler();
  });

  if (app.isReady()) {
    electronReadyHandler(initOptions);
  } else {
    app.once('ready', () => electronReadyHandler(initOptions));
  }
};
