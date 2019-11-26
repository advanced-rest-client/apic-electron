import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import log from './logger.js';

class AppPaths {
  /**
   * Resolves file path to correct path if it's starts with `~`.
   *
   * @param {String} file Settings file path
   * @return {String} Path to the file.
   */
  _resolvePath(file) {
    if (file[0] === '~') {
      file = app.getPath('home') + file.substr(1);
    }
    return file;
  }

  get settingsFile() {
    return this._settingsFile;
  }

  setSettingsFile(file) {
    if (file) {
      file = this._resolvePath(file);
      const dir = path.dirname(file);
      try {
        fs.ensureDirSync(dir);
        this._settingsFile = file;
      } catch (_) {
        log.error(`Insufficient permission to settings file folder "${dir}".`);
      }
    }
    if (!this._settingsFile) {
      this._settingsFile = path.join(process.env.APIC_HOME, 'settings.json');
    }
    process.env.APIC_SETTINGS_FILE = this._settingsFile;
    log.debug('The settings is set to: ' + process.env.APIC_SETTINGS_FILE);
  }

  getAppDirectory() {
    switch (process.platform) {
      case 'darwin':
        return process.execPath.substring(0, process.execPath.indexOf('.app') + 4);
      case 'linux':
      case 'win32':
        return path.join(process.execPath, '..');
    }
  }

  hasWriteAccess(dir) {
    const testFilePath = path.join(dir, 'write.test');
    try {
      fs.writeFileSync(testFilePath, new Date().toISOString(), { flag: 'w+' });
      fs.unlinkSync(testFilePath);
      return true;
    } catch (err) {
      return false;
    }
  }

  setHome() {
    const portableHomePath = path.join(this.getAppDirectory(), '..', '.apic');
    if (fs.pathExistsSync(portableHomePath)) {
      if (this.hasWriteAccess(portableHomePath)) {
        process.env.APIC_HOME = portableHomePath;
      } else {
        log.error(`Insufficient permission to portable home "${portableHomePath}".`);
      }
    }
    if (!process.env.APIC_HOME) {
      process.env.APIC_HOME = app.getPath('userData');
    }
    log.debug('The home path is set to: ' + process.env.APIC_HOME);
  }

  get themesBasePath() {
    return this._themesBasePath;
  }

  get themesSettings() {
    return this._themesSettings;
  }

  setThemesPath(themesPath, themesSettingsFile) {
    if (themesPath) {
      themesPath = this._resolvePath(themesPath);
      try {
        fs.ensureDirSync(themesPath);
        this._themesBasePath = themesPath;
      } catch (_) {
        log.error(`Insufficient permission to themes installation location "${themesPath}".`);
      }
    }
    if (!this._themesBasePath) {
      this._themesBasePath = path.join(process.env.APIC_HOME, 'themes-esm');
    }
    if (!themesSettingsFile) {
      themesSettingsFile = 'themes-info.json';
    }
    this._themesSettings = path.join(this._themesBasePath, themesSettingsFile);
    process.env.APIC_THEMES = this._themesBasePath;
    process.env.APIC_THEMES_SETTINGS = this._themesSettings;
    log.debug('ARC themes path is set to: ' + process.env.APIC_THEMES);
    log.debug('ARC themes DB is set to: ' + process.env.APIC_THEMES_SETTINGS);
  }
}

const paths = new AppPaths();

export default {
  setSettingsFile: (file) => paths.setSettingsFile(file),
  setThemesPath: (themesPath, themesSettingsFil) => paths.setThemesPath(themesPath, themesSettingsFil),
  setHome: () => paths.setHome(),
  get themesSettings() {
    return paths.themesSettings;
  },
  get themesBasePath() {
    return paths.themesBasePath;
  },
  get settingsFile() {
    return paths.settingsFile;
  }
};
