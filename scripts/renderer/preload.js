const { ipcRenderer: ipc, clipboard } = require('electron');
const { app } = require('electron').remote;
const log = require('electron-log');
const Jexl = require('jexl');
const { PreferencesProxy } = require('@advanced-rest-client/arc-electron-preferences/renderer/index.js');
const { ElectronAmfService } = require('@advanced-rest-client/electron-amf-service');
const { ThemeManager } = require('./ThemeManager.js');

const setImmediateFn = setImmediate;
const versions = process.versions;

process.once('loaded', () => {
  if (process.env.NODE_ENV === 'test') {
    global.electronRequire = require;
  }
  global.ipc = ipc;
  global.PreferencesProxy = PreferencesProxy;
  global.ThemeManager = ThemeManager;
  global.log = log;
  global.setImmediate = setImmediateFn;
  global.ElectronAmfService = ElectronAmfService;
  global.Jexl = Jexl;
  global.versionInfo = {
    chrome: versions.chrome,
    appVersion: app.getVersion()
  };
  global.clipboard = clipboard;
});
