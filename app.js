/* eslint-disable no-console */

class ApicInit {
  constructor() {
    /* global ipc, ThemeManager, PreferencesProxy,
    ElectronAmfService, versionInfo */
    this.created = false;
    this.themeManager = new ThemeManager();
    this.prefProxy = new PreferencesProxy();
    this.amfService = new ElectronAmfService();
  }

  /**
   * Reference to the main application window.
   *
   * @return {HtmlElement}
   */
  get app() {
    return document.getElementById('app');
  }

  /**
   * Listens for application events to create a communication
   * bridge between main process and the app.
   */
  listen() {
    window.onbeforeunload = this.beforeUnloadWindow.bind(this);
    this.themeManager.listen();
    this.prefProxy.observe();
    this.amfService.listen();

    ipc.on('checking-for-update', () => {
      this.updateEventHandler('checking-for-update');
    });
    ipc.on('update-available', (info) => {
      this.updateEventHandler('update-available', info);
    });
    ipc.on('update-not-available', () => {
      this.updateEventHandler('update-not-available');
    });
    ipc.on('autoupdate-error', (error) => {
      this.updateEventHandler('autoupdate-error', error);
    });
    ipc.on('download-progress', (progressObj) => {
      this.updateEventHandler('download-progress', progressObj);
    });
    ipc.on('update-downloaded', (info) => {
      this.updateEventHandler('update-downloaded', info);
    });
    ipc.on('system-theme-changed', this._systemThemeChangeHandler.bind(this));
  }

  /**
   * Because window has to be setup from the main process
   * (setting app init values) the window sends reload
   * information to the main process so it can re-set the
   * window after it's reloaded.
   */
  beforeUnloadWindow() {
    ipc.send('window-reloading');
  }

  /**
   * Requests initial state information from the main process for current
   * window.
   */
  async requestState() {
    const info = await ipc.invoke('window-state-request');
    if (!window.AppConfig) {
      window.AppConfig = {};
    }
    this.initConfig = info;
    window.AppConfig.initConfig = info;
    await this.initApp();
    await this.processInitialPath();
    await this.removeLoader();
    console.log('Application window is now ready.');
  }

  /**
   * Initialized the application when window is ready.
   *
   * @return {Promise}
   */
  async initApp() {
    let cnf;
    try {
      cnf = await this.prefProxy.load();
      await this._createApp(cnf);
    } catch (e) {
      this.reportFatalError(e);
      throw e;
    }
    if (this.initConfig.darkMode) {
      cnf.theme = '@advanced-rest-client/apic-electron-dark-theme';
    }
    if (cnf.theme === '@advanced-rest-client/apic-electron-anypoint-theme') {
      const app = this.app;
      app.compatibility = true;
    }
    try {
      await this.themeManager.loadTheme(cnf.theme);
    } catch (e) {
      console.error(e);
    }
  }
  /**
   * Reports fatal application error.
   *
   * @param {Error} err Error object
   */
  reportFatalError(err) {
    console.error(err);
    ipc.send('fatal-error', err.message);
  }

  /**
   * Creates application main element.
   *
   * @param {Object} config Current configuration.
   * @return {Promise} Promise resolved when element is loaded and ready
   * rendered.
   */
  async _createApp(config) {
    if (this.created) {
      return;
    }
    /* eslint-disable-next-line import/no-unresolved */
    // await import('web-module://src/apic-electron.js');
    const app = document.createElement('apic-electron');
    app.id = 'app';
    app.config = config;
    app.componentsDir = 'web_modules';
    this._setupApp(app);
    document.body.appendChild(app);
    this.created = true;
  }
  /**
   * Sets up the application properties.
   *
   * @param {ApicElectron} app App electron element.
   */
  _setupApp(app) {
    // console.info('Initializing the app');
    // app.componentsDir = this.initConfig.appComponents;
    app.appVersion = versionInfo.appVersion;
    app.browserVersion = versionInfo.chrome;
    // app.initApplication();
    // app.initTutorial();
  }

  removeLoader() {
    const loader = document.querySelector('.loader');
    if (!loader) {
      return;
    }
    loader.classList.add('end');
    setTimeout(() => {
      loader.parentNode.removeChild(loader);
    }, 150);
  }

  async processInitialPath() {
    const startPath = this.initConfig.startPath;
    if (!startPath) {
      return;
    }
    history.pushState('', null, '#' + startPath);
  }

  /**
   * Handles events related to the application auto-update action.
   *
   * @param {String} type
   * @param {Object|undefined} args
   */
  updateEventHandler(type, args) {
    const app = this.app;
    if (!app) {
      return;
    }
    // console.log('updateEventHandler', message);
    app.updateState = type;
    if (args) {
      console.log(type, args);
    }
    if (type === 'update-downloaded') {
      app.hasAppUpdate = true;
    }
  }

  /**
   * Handler for system theme change event dispatche in the IO thread.
   * Updates theme depending on current setting.
   *
   * @param {Event} e
   * @param {Boolean} isDarkMode true when Electron detected dark mode
   * @return {Promise}
   */
  async _systemThemeChangeHandler(e, isDarkMode) {
    const theme = isDarkMode ?
      '@advanced-rest-client/apic-electron-dark-theme' :
      '@advanced-rest-client/apic-electron-default-theme';
    const app = this.app;
    app.compatibility = false;
    try {
      await this.themeManager.loadTheme(theme);
    } catch (e) {
      console.error(e);
    }
  }
}

const initScript = new ApicInit();
initScript.listen();
initScript.requestState();
