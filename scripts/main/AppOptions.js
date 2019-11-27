import log from './logger.js';
import camelCase from 'camelcase';

/**
 * A class describing and processing application initial options.
 *
 * All options are camel cased before setting it to as a property
 * of this class.
 * Use `getOptions` to create an object with configuration.
 */
export class AppOptions {
  /**
   * List of command line options with mapping to properties.
   *
   * @return {Array<Object>} List of app config options
   */
  get availableOptions() {
    return [{
      // Path to the api file location
      name: '--api',
      shortcut: '-a',
      type: String
    }, {
      // API type, optional. The app will try to determine API type.
      // It can be: RAML 0.8, RAML 1.0, OAS 2.0, OAS 3.0
      name: '--type',
      shortcut: '-t',
      type: String
    }, {
      // API mime type, optional. The app will try to determine API mime type.
      name: '--mime',
      shortcut: '-m',
      type: String
    }, {
      // Opens the app in dev mode (opened console, verbose log)
      name: '--debug',
      shortcut: '-d',
      type: Boolean
    }, {
      // Debug log level. Default to "debug". Only valid when `--debug` is set
      name: '--debug-level',
      shortcut: '-l',
      type: String
    }, {
      // Opens the app in dev mode (opened console, verbose log)
      name: '--with-devtools',
      shortcut: '-w',
      type: Boolean
    }, {
      name: '.', // from "npm start" to not to print error
      shortcut: '-dot',
      type: String
    }, {
      // Skips application update check for this run
      name: '--skip-app-update',
      shortcut: '-u',
      type: Boolean,
    }, {
      name: '--skip-themes-update',
      shortcut: '-s',
      type: Boolean,
    }];
  }
  /**
   * Produces list of startup options.
   * @return {Object} Map of configured options.
   */
  getOptions() {
    const result = {};
    for (const key in this) {
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        result[key] = this[key];
      }
    }
    return result;
  }
  /**
   * Parses startup options.
   */
  parse() {
    for (let i = 1; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg[0] !== '-') {
        log.warn('Unknown startup option ' + arg);
        continue;
      }
      let def = this.findDefinnition(arg);
      if (!def) {
        log.warn('Unknown startup option ' + arg);
        continue;
      }
      def = this.getPropertyDefinition(arg, def, process.argv[i + 1]);
      this.setProperty(def);
      if (def.skipNext) {
        i++;
      }
    }
  }
  /**
   * Finds an option definition from an argument.
   *
   * @param {String} arg Argument passed to the application.
   * @return {Object} Option definition or undefined if not found.
   */
  findDefinnition(arg) {
    const eqIndex = arg.indexOf('=');
    if (eqIndex !== -1) {
      arg = arg.substr(0, eqIndex);
    }
    if (arg.indexOf('--') === 0) {
      return this.availableOptions.find((item) => item.name === arg);
    } else if (arg.indexOf('-') === 0) {
      return this.availableOptions.find((item) => item.shortcut === arg);
    }
  }
  /**
   * Updates definition object with `value` and `skipNext` properties.
   *
   * @param {String} arg Command line argument
   * @param {Object} def Existing command definition.
   * @param {?String} nextValue Next item in the arguments array.
   * @return {Object} Updated `def` object.
   */
  getPropertyDefinition(arg, def, nextValue) {
    def.skipNext = false;
    if (def.type === Boolean) {
      def.value = true;
      return def;
    }
    let value;
    if (arg.indexOf('=') !== -1) {
      value = this.getArgValue(arg);
    } else {
      value = nextValue;
      def.skipNext = true;
    }
    if (def.type === Number) {
      def.value = Number(value);
    } else {
      def.value = value;
    }
    return def;
  }
  /**
   * Gets a value from an argument line when value is passed as
   * `arg="value"` or `arg=value`
   *
   * @param {String} arg Argument pice
   * @return {String} Value for the argument.
   */
  getArgValue(arg) {
    const index = arg.indexOf('=');
    if (index === -1) {
      return '';
    }
    let value = arg.substr(index + 1);
    if (value[0] === '"') {
      value = value.substr(1);
      value = value.substr(0, value.length - 1);
    }
    return value;
  }
  /**
   * Sets a property value on this object.
   * An option name is set as a property aftr it's camel cased.
   *
   * @param {Object} def Command definition.
   */
  setProperty(def) {
    const name = camelCase(def.name);
    if (this[name] && def.allowArray) {
      let v = this[name];
      if (!(v instanceof Array)) {
        v = [v];
      }
      v.push(def.value);
      this[name] = v;
    } else {
      this[name] = def.value;
    }
  }
}
