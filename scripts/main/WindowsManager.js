import { BrowserWindow, shell, ipcMain, nativeTheme } from 'electron';
import path from 'path';
import url from 'url';
import { SessionControl } from '@advanced-rest-client/arc-electron-preferences';
import log from './logger.js';
/**
 * A class that manages opened app windows.
 */
export class WindowsManager {
  /**
   * @param {Object} startupOptions Application startup object. See
   * `AppOptions` for more details.
   */
  constructor(startupOptions) {
    this.startupOptions = startupOptions || {};
    this.windows = [];
    // Task manager window reference.
    this._tmWin = undefined;
    this.__windowClosed = this.__windowClosed.bind(this);
    this.__windowFocused = this.__windowFocused.bind(this);
    this.__windowOpenedPopup = this.__windowOpenedPopup.bind(this);
    this._settingChangedHandler = this._settingChangedHandler.bind(this);
    /**
     * Pointer to last focused window.
     * @type {BrowserWindow}
     */
    this._lastFocused = undefined;
  }
  /**
   * @return {Boolean} True if has at leas one window.
   */
  get hasWindow() {
    return this.windows.length > 0;
  }
  /**
   * @return {BrowserWindow|undefined} Reference to last focused browser window
   * or undefined if the window is destroyed or undefined.
   */
  get lastFocused() {
    if (!this._lastFocused) {
      return null;
    }
    if (this._lastFocused.isDestroyed()) {
      this._lastFocused = undefined;
      return null;
    }
    return this._lastFocused;
  }
  /**
   * @return {BrowserWindow} Returns reference to last created and still active
   * window object.
   */
  get lastActive() {
    const ws = this.windows;
    if (!ws || !ws.length) {
      return null;
    }
    for (let i = ws.length - 1; i >= 0; i--) {
      if (!ws[i].isDestroyed()) {
        return ws[i];
      }
    }
    return null;
  }
  /**
   * Restores latest window is any present.
   */
  restoreLast() {
    const win = this.lastActive;
    if (win) {
      win.show();
    } else {
      this.open();
    }
  }
  /**
   * Listens for relevant for this class events from the renderer.
   */
  listen() {
    ipcMain.on('window-reloading', this.__windowReloading.bind(this));
    ipcMain.on('new-window', this._windowOpenHandler.bind(this));
    ipcMain.on('toggle-devtools', this._toggleDevToolsHandler.bind(this));
    ipcMain.on('settings-changed', this._settingChangedHandler);
    ipcMain.handle('window-state-request', this._winStateRequestHandler.bind(this));
  }
  /**
   * A handler for new window open event. Calls `open()` function.
   */
  _windowOpenHandler() {
    this.open();
  }
  /**
   * Handler for `toggle-devtools` event. Opens devtools on sender.
   *
   * @param {Event} e Event emmited by renderer process.
   */
  _toggleDevToolsHandler(e) {
    e.sender.webContents.toggleDevTools();
  }
  /**
   * Notifies all opened windows with event data.
   *
   * @param {String} type Event type (channel name)
   * @param {?Array|any} args List of arguments or a single argument
   */
  notifyAll(type, args) {
    log.debug('[WM] Notyfying all windows with type: ' + type);
    if (!args) {
      args = [];
    }
    this.windows.forEach((win, index) => {
      if (win.isDestroyed()) {
        this.windows.splice(index, 1);
        return;
      }
      if (args instanceof Array) {
        win.webContents.send(type, ...args);
      } else {
        win.webContents.send(type, args);
      }
    });
  }
  /**
   * Notifies all opened windows with event data
   * except for a window represented by a WebContents.
   *
   * @param {String} type Event type (channel name)
   * @param {Array=} args List of arguments.
   * @param {WebContents} wc Window that should not receive
   * notification.
   */
  notifyAllBut(type, args, wc) {
    this.windows.forEach((win, index) => {
      if (win.isDestroyed()) {
        this.windows.splice(index, 1);
        return;
      }
      if (win.webContents.id === wc.id) {
        return;
      }
      win.webContents.send(type, args);
    });
  }

  _windowsSortIndex(a, b) {
    if (a.__appIndex > b.__appIndex ) {
      return 1;
    }
    if (a.__appIndex  < b.__appIndex ) {
      return -1;
    }
    return 0;
  }

  _getWindowIndex() {
    const wins = this.windows;
    if (!wins.length) {
      return 0;
    }
    wins.sort(this._windowsSortIndex);
    const len = wins.length;
    for (let i = 0; i < len; i++) {
      if (wins[i].__appIndex  !== i) {
        return i;
      }
    }
    return len;
  }
  /**
   * Opens a new application window.
   *
   * @param {?String} path Application path to open.
   * @return {Promise} Resolved promise when the window is ready.
   */
  async open(path) {
    log.debug('[WM] Opening new window' + (path ? ': ' + path : ''));
    const index = this._getWindowIndex();
    log.debug('Generated index for the widnow: ' + index);
    const session = new SessionControl(index);
    const data = await session.load();
    const win = this.__getNewWindow(index, data);
    win.__appSession = session;
    this.__attachListeners(win);
    this.windows.push(win);
    this.__loadPage(win, path);
    if (this.startupOptions.withDevtools) {
      win.webContents.openDevTools();
    }
    return win;
  }
  /**
   * Creates new Application window.
   *
   * @param {Number} index Index of the window.
   * @param {Object} session Session control data object.
   * @return {BrowserWindow} Created window.
   */
  __getNewWindow(index, session) {
    const mainWindow = new BrowserWindow({
      width: session.size.width,
      height: session.size.height,
      x: session.position.x,
      y: session.position.y,
      backgroundColor: '#00A2DF',
      show: false,
      webPreferences: {
        partition: 'persist:apic-window',
        nativeWindowOpen: true,
        nodeIntegration: false,
        contextIsolation: false,
        preload: path.join(__dirname, '..', 'renderer', 'preload.js')
      }
    });
    mainWindow.__appIndex  = index;
    return mainWindow;
  }
  /**
   * Loads application for a path.
   *
   * @param {BrowserWindow} win Window to load the app to.
   * @param {String} appPath App's internal routing path.
   */
  __loadPage(win, appPath) {
    win._startPath = appPath;
    const dest = path.join(__dirname, '..', '..', 'index.html');
    const full = url.format({
      pathname: dest,
      protocol: 'file:',
      slashes: true
    });
    log.debug('Loading page: ' + full);
    win.loadURL(full);
  }
  /**
   * Creates a startup options info object to be passed to
   * starting application window.
   *
   * @param {Event} ev
   */
  async _winStateRequestHandler(ev) {
    const contents = ev.sender;
    const win = this.windows.find((item) => {
      if (item.isDestroyed()) {
        return false;
      }
      return item.webContents.id === contents.id;
    });
    const workspaceOptions = {};
    if (win) {
      workspaceOptions.index = win.__appIndex ;
      if (win.startupOptions && win.startupOptions.workspaceFile) {
        workspaceOptions.workspaceFile = win.startupOptions.workspaceFile;
      }
    }
    const cnf = {
      darkMode: nativeTheme.shouldUseDarkColors
    };
    if (win) {
      cnf.startPath = win._startPath;
    }
    log.debug('Sending window state info');
    // log.debug(JSON.stringify(cnf, null, 2));
    return cnf;
  }
  /**
   * Attaches listeners to the window object.
   *
   * @param {BrowserWindow} win Window to attach listeners to.
   */
  __attachListeners(win) {
    win.addListener('closed', this.__windowClosed);
    win.addListener('focus', this.__windowFocused);
    win.once('ready-to-show', this.__readyShowHandler.bind(this));
    win.webContents.on('new-window', this.__windowOpenedPopup);
  }
  /**
   * Finds window index position in windows array.
   *
   * @param {BrowserWindow} win Window to search
   * @return {Number} Window position or `-1` if not found.
   */
  _findWindowImdex(win) {
    const noId = win.isDestroyed();
    return this.windows.findIndex((item) => {
      if (item.isDestroyed()) {
        return win === item;
      }
      if (noId) {
        return false;
      }
      return item.id === win.id;
    });
  }
  /**
   * Handler for the BrowserWindow `closed` event.
   * Removes the window from the windows array.
   *
   * @param {Event} e Event emitted by the window.
   */
  __windowClosed(e) {
    if (this._lastFocused === e.sender) {
      this._lastFocused = undefined;
    }
    const index = this._findWindowImdex(e.sender);
    if (index === -1) {
      return;
    }
    this.windows.splice(index, 1);
  }
  /**
   * Handler for the focus event on the BrowserWindow object.
   * Sets `_lastFocused` property.
   * @param {Event} e
   */
  __windowFocused(e) {
    this._lastFocused = e.sender;
  }
  /**
   * Handler for BrowserWindow `ready-to-show` event.
   * Passes startup options to the window and shows it.
   *
   * @param {Event} e Event emitted by the window.
   */
  __readyShowHandler(e) {
    log.debug('[WM] Window is ready to show');
    e.sender.show();
  }
  /**
   * Adds the `did-finish-load` event to reset the window when it's reloaded.
   *
   * @param {Event} e Event emitted by the window.
   */
  __windowReloading(e) {
    log.debug('[WM] Window is reloading');
    const contents = e.sender;
    const win = this.windows.find((item) => {
      if (item.isDestroyed()) {
        return false;
      }
      return item.id === contents.id;
    });
    if (win) {
      delete win._startPath;
    }
  }
  /**
   * Handler for the `new-window` event emitted by the window object.
   * Opens new chrome tab with requested content.
   *
   * @param {Event} event Emitted event.
   * @param {String} url Requested URL
   * @param {String} frameName
   */
  __windowOpenedPopup(event, url, frameName/* , disposition, options*/) {
    if (frameName !== 'modal') {
      return;
    }
    event.preventDefault();
    // Object.assign(options, {
    //   modal: true,
    //   parent: event.sender,
    //   width: 100,
    //   height: 100
    // });
    // event.newGuest = new BrowserWindow(options);
    shell.openExternal(url);
  }
  /**
   * Reloads all not destroyed wondows.
   */
  reloadWindows() {
    log.debug('[WM] Reloading all windows.');
    this.windows.forEach((win, index) => {
      if (win.isDestroyed()) {
        this.windows.splice(index, 1);
        return;
      }
      win.reload();
    });
  }
  /**
   * A handler for a `settigs-changed` from a renderer process.
   * It informs other windows about the change so all
   * windows can consume the same change.
   *
   * @param {Event} event
   * @param {String} key
   * @param {String|Number|Boolean|Object} value
   * @param {String} area
   */
  _settingChangedHandler(event, key, value, area) {
    this.notifyAllBut('settings-changed', {
      key: key,
      value: value,
      area: area
    }, event.sender);
  }
}
