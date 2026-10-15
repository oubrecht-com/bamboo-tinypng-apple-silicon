// Minimal synchronous JSON settings store (replaces electron-settings).
// Uses the same file electron-settings v3 used, so existing API keys carry over.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(app.getPath('userData'), 'Settings');

function read() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function get(key) {
  return read()[key];
}

function set(key, value) {
  const data = read();
  data[key] = value;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(data));
}

module.exports = { get, set };
