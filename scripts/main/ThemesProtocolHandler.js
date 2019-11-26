import { session } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import log from './logger.js';
/**
 * A class responsible for handling `themes:` protocol.
 *
 * Theme protocol is used to load theme file from themes installation location
 * by using only theme id.
 *
 * Example usage in the renderer process:
 *
 * ```
 * <script type="module" src="themes://dd1b715f-af00-4ee8-8b0c-2a262b3cf0c8"></script>
 * ```
 *
 * This will load app's default theme.
 *
 * If the location represents a path then then file will be loaded from this
 * location.
 *
 * ```
 * <script type="module" src="themes:///path/to/a/theme.js"></script>
 * ```
 */
export class ThemesProtocolHandler {
  constructor() {
    this._requestHandler = this._requestHandler.bind(this);
  }
  /**
   * Registers the protocol handler.
   * This must be called after the `ready` event.
   */
  register() {
    log.debug('Registering themes protocol');
    session.fromPartition('persist:apic-window')
    .protocol
    .registerStringProtocol('themes', this._requestHandler);
  }

  _requestHandler(request, callback) {
    const url = request.url.substr(9);
    log.silly('ThemesProtocolHandler::_requestHandler::' + url);
    try {
      fs.accessSync(url, fs.constants.R_OK | fs.constants.X_OK);
      return this._loadFileTheme(url, callback);
    } catch (_) {
      // ..
    }
    return this._loadInstalledTheme(url, callback);
  }

  async _loadInstalledTheme(location, callback) {
    log.info(`loading theme ${location}`);
    try {
      const config = await this._loadThemeInfo();
      const { themes } = config;
      log.debug('Got themes list');
      if (location.indexOf('advanced-rest-client/') === 0) {
        location = '@' + location;
      }
      const theme = this._findThemeInfo(location, themes);
      if (!theme) {
        log.error('Theme info not found');
        callback(-6);
        return;
      }
      const file = path.join(process.env.APIC_THEMES, theme.mainFile);
      log.silly('Theme found. Reading theme file: ' + file);
      const data = await fs.readFile(file, 'utf8');
      if (data) {
        log.silly('Sending theme file to renderer.');
        callback({
          data,
          mimeType: 'text/css',
          charset: 'utf8'
        });
      } else {
        log.error('Theme file is empty');
        callback(-6);
      }
    } catch (e) {
      log.error('Unable to load theme');
      log.error(e.message);
      callback(-6);
    }
  }

  _loadFileTheme(location, callback) {
    log.silly('ThemesProtocolHandler::loading theme from ' + location);
    return fs.readFile(location, 'utf8')
    .then((data) => {
      callback({
        data,
        mimeType: 'text/css',
        charset: 'utf8'
      });
    })
    .catch((cause) => {
      log.error('Unable to load theme');
      log.error(cause);
      callback(-6);
      return;
    });
  }

  async _loadThemeInfo() {
    try {
      return await fs.readJson(process.env.APIC_THEMES_SETTINGS);
    } catch (_) {
      log.warn('Theme file not found', process.env.APIC_THEMES_SETTINGS);
      return {};
    }
  }

  _findThemeInfo(id, themes) {
    if (!themes || !themes.length) {
      return;
    }
    return themes.find((item) => item.name === id);
  }
}
