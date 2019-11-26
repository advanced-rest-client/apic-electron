import { session, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import log from './logger.js';
/**
 * A class responsible for handling `web-module:` protocol.
 *
 * Components protocol is used to load ES modules with correct mime types.
 *
 * Example usage in the renderer process:
 *
 * ```
 * <script type="module" href="web-module://polymer/polymer.js"></script>
 * ```
 *
 * This checks for existing component in following order:
 * - ./bower_components/{url} (application main components)
 * - {applicationUserDataDir}/{url} (application modules installation root)
 * - {url} (filesyste)
 *
 * If the component does not exists then it throws an error.
 */
export class EsmProtocolHandler {
  constructor() {
    this._requestHandler = this._requestHandler.bind(this);
    /**
     * Base path to the themes folder.
     * @type {String}
     */
    this.basePath = path.join(__dirname, '..', '..');
  }

  /**
   * Registers the protocol handler.
   * This must be called after the `ready` event.
   */
  register() {
    log.debug('Registering components protocol');
    session.fromPartition('persist:apic-window')
    .protocol
    .registerBufferProtocol('web-module', this._requestHandler);
    protocol
    .registerBufferProtocol('web-module', this._requestHandler);
  }

  _requestHandler(request, respond) {
    const url = new URL(request.url);
    let location = this._findFile(url.pathname);
    location = decodeURI(location);
    log.debug(`Loading: ${location}`);
    fs.readFile(location, (error, data) => {
      if (error) {
        log.error(error);
        // The file or directory cannot be found.
        // NET_ERROR(FILE_NOT_FOUND, -6)
        respond(-6);
      } else {
        const mimeType = mime.lookup(location) || 'application/octet-stream';
        respond({
          mimeType,
          data
        });
      }
    });
  }

  _findFile(filepath) {
    const prefixes = ['src', 'web_modules', 'node_modules'];
    for (let i = 0, len = prefixes.length; i <len; i++) {
      const prefix = prefixes[i];
      const loc = path.join(__dirname, '..', '..', prefix, filepath);
      if (fs.existsSync(loc)) {
        return loc;
      }
    }
    return path.join(__dirname, '..', '..', filepath);
  }
}
