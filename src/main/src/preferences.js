import { app } from 'electron';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';

export default class Preferences {
  constructor(filePath = join(app.getPath('userData'), 'desktop-preferences.json')) {
    this.filePath = filePath;
    this.values = {};
  }
  async load() {
    try {
      this.values = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Failed to load desktop preferences:', error);
      this.values = {};
    }
    return this.values;
  }
  get(key) {
    return this.values[key];
  }
  async set(key, value) {
    this.values[key] = value;
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.values, null, 2));
  }
}
