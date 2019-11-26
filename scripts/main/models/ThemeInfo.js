import { AppPreferences } from '@advanced-rest-client/arc-electron-preferences/lib/AppPreferences.js';
/**
 * A preferences class to store and read theme info file.
 */
export class ThemeInfo extends AppPreferences {
  constructor() {
    super({
      file: process.env.APIC_THEMES_SETTINGS
    }, {
      themes: []
    });
  }
}
