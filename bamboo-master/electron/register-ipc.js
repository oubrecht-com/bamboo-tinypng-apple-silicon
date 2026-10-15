// Lib imports
const { app, dialog, ipcMain, shell, Menu } = require('electron');
const tinify = require('tinify');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Local imports
const settings = require('./settings');

// Async
const readFile = util.promisify(fs.readFile);
const rename = util.promisify(fs.rename);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);

/**
 * Registers all ipc listeners
 * @param {Electron.BrowserWindow} mainWindow Window to show dialogs under
 */
function registerIpcListeners(mainWindow) {

  // Settings access for the renderer
  ipcMain.on('settings-get', (e, key) => {
    e.returnValue = settings.get(key);
  });

  ipcMain.on('settings-set', (e, key, value) => {
    settings.set(key, value);
    e.returnValue = true;
  });

  // Show the window once the renderer has mounted
  ipcMain.on('show-window', () => mainWindow.show());

  // Image list item context menu, reports the chosen action back to the renderer
  ipcMain.on('show-item-menu', (e, { id, path: imagePath, canRemove }) => {
    const sendAction = action => e.sender.send('item-menu-action', { id, action });
    const menu = Menu.buildFromTemplate([
      { label: 'Remove', enabled: canRemove, click: () => sendAction('remove') },
      { label: 'Show in Folder', click: () => shell.showItemInFolder(imagePath) },
      { type: 'separator' },
      { label: 'Remove All', click: () => sendAction('removeAll') }
    ]);
    menu.popup({ window: mainWindow });
  });

  // Invalid API key message from settings
  ipcMain.on('invalid-api-key', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: [
        'Dismiss'
      ],
      cancelId: 0,
      defaultId: 0,
      title: 'Invalid API key',
      message: 'You must enter a valid API key!'
    });
  });

  // Manual image adding
  ipcMain.on('loadFile', async e => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Bamboo - Add Images',
      defaultPath: app.getPath('documents'),
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }
      ],
      properties: [
        'openFile', 'multiSelections'
      ]
    });

    if (canceled || !filePaths.length) return;

    let files = [];

    // Get file sizes
    for (let fPath of filePaths) {
      let fileSize = (await stat(fPath)).size;
      files.push({
        path: fPath,
        size: fileSize
      });
    }

    // Send files
    e.sender.send('filesSelected', files);
  });

  // Show the about message with proper app version
  ipcMain.on('showAbout', async e => {
    let { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: [
        'Dismiss',
        'View Source'
      ],
      cancelId: 0,
      defaultId: 0,
      title: 'Bamboo - About',
      message: `Bamboo v${app.getVersion()}\nCreated by Chris Anselmo`,
      detail: 'Bamboo is not affiliated with nor endorsed by Tinify/TinyPNG/TinyJPG.'
    });

    if (response === 1) {
      shell.openExternal('https://github.com/christopherwk210/bamboo');
    }
  });

  // Uploading image to tinify API
  ipcMain.on('uploadImage', async (e, args) => {
    // Get API key
    tinify.key = settings.get('api-key') || '';

    let sourceData;

    // Read image into buffer
    try {
      sourceData = await readFile(args.path);
    } catch(err) {
      e.sender.send('imageError', {
        id: args.id,
        msg: { message: 'Could not read file!' }
      });
      return;
    }

    // Tinify
    tinify.fromBuffer(sourceData).toBuffer(async (err, res) => {
      let currentCompressionCount = tinify.compressionCount;

      if (err) {
        e.sender.send('imageError', {
          id: args.id,
          msg: { message: err.message },
          currentCompressionCount
        });
      } else {
        // On success
        try {
          // Rename original file
          await rename(args.path, args.path + '.original');

          // Save buffer to original name
          await writeFile(args.path, res);

          // Get new filesize
          let newSize = (await stat(args.path)).size;

          // Move original file to trash
          let moveToTrashSuccess = true;
          try {
            await shell.trashItem(args.path + '.original');
          } catch(trashErr) {
            moveToTrashSuccess = false;
          }

          // Send finished signal
          e.sender.send('imageComplete', {
            id: args.id,
            movedToTrash: moveToTrashSuccess,
            currentCompressionCount,
            newSize
          });
        } catch(saveErr) {
          console.error(saveErr);
          e.sender.send('imageError', {
            id: args.id,
            msg: { message: saveErr.message },
            currentCompressionCount
          });
        }
      }
    });
  });

  ipcMain.on('folder-dropped', async (e, folderPath) => {
    fs.readdir(folderPath, (err, files) => {
      if (err) return;

      files.forEach(file => {
        const fullPath = path.join(folderPath, file);
        const extension = path.extname(file).toLowerCase();

        if (extension === '.png' || extension === '.jpg' || extension === '.jpeg') {
          fs.stat(fullPath, (err, stats) => {
            if (err) return;

            e.sender.send('manual-image-add', [fullPath, stats.size]);
          });
        }
      })
    });
  });
}

module.exports = registerIpcListeners;
