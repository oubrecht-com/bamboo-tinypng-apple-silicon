// Imports
import { webFrame, ipcRenderer, shell, webUtils } from 'electron';
import feather from 'feather-icons';
import Vue from 'vue/dist/vue.min.js';
import settings from './settings';

// Local imports
import { ImageItem, Status } from './image-item.class';
import SettingsComponent from '../../components/settings/settings.component';

// Prevent zooming on mac
webFrame.setVisualZoomLevelLimits(1, 1);

// Apply icons
feather.replace();

// Prevent file dropping on document
document.addEventListener('dragover', e => { e.preventDefault(); return false; }, false);
document.addEventListener('drop', e => { e.preventDefault(); return false; }, false);

// Create Vue app
let app = new Vue({
  el: '#app',
  components: {
    settings: SettingsComponent
  },
  data: {
    imageList: [],
    apiKey: settings.get('api-key') || '',
    apiInputValue: '',
    viewingSettings: false,
    draggingOver: false,
    dragCounter: 0
  },
  methods: {
    /** Trigger the load image files dialog from electron */
    loadImages: function() {
      ipcRenderer.send('loadFile');
    },

    /**
     * Add an image to the list (and begin upload)
     * @param {string} path Image file path
     * @param {number} size File size
     */
    addImage: function(path, size) {
      let skip = false;
      this.imageList.some(img => {
        if (img.path === path) {
          if (img.status !== Status.LOADING) {
            img.status = Status.LOADING;
            img.beginUpload();
          }

          skip = true;
          return true;
        }
      });

      if (skip) return;

      let img = new ImageItem(path, size);
      img.beginUpload();
      this.imageList.push(img);
    },

    /**
     * Save a new API key value
     * @param {string} newKey New API key to save
     */
    changeApiKey: function(newKey) {
      this.apiKey = newKey;
      settings.set('api-key', newKey);
    },

    /** Trigger the about dialog */
    showAbout: () => ipcRenderer.send('showAbout'),

    /** Open the tinify developer page */
    showApiPage: () => shell.openExternal('https://tinypng.com/developers'),

    /**
     * Handles clicking on an image list item
     * @param {Event} e
     * @param {ImageItem} image
     */
    handleItemClick: function(e, image) {
      e.preventDefault();

      ipcRenderer.send('show-item-menu', {
        id: image.id,
        path: image.path,
        canRemove: image.status !== Status.LOADING
      });
    },

    /**
     * Removes an image from the list with the given id
     * @param {number} id
     */
    removeImage: function(id) {
      this.imageList = this.imageList.filter(img => {
        if (img.id === id && img.status !== Status.LOADING) {
          return false;
        } else {
          return true;
        }
      });

      return true;
    },

    // Drop zone drag-drop handlers

    handleDragenter: function(e) {
      e.preventDefault();
      this.dragCounter++;
      e.dataTransfer.dropEffect = 'copy';
      this.draggingOver = true;
      return false;
    },
    handleDragleave: function(e) {
      e.preventDefault();
      this.dragCounter--;
      if (this.dragCounter <= 0) {
        this.dragCounter = 0;
        this.draggingOver = false;
      }
      return false;
    },
    handleDragend: function(e) {
      e.preventDefault();
      this.dragCounter = 0;
      this.draggingOver = false;
      return false;
    },
    handleDrop: function(e) {
      e.preventDefault();
      this.dragCounter = 0;
      this.draggingOver = false;
      Array.from(e.dataTransfer.files).forEach(file => {
        const filePath = webUtils.getPathForFile(file);

        if (~file.type.indexOf('png') || ~file.type.indexOf('jpg') || ~file.type.indexOf('jpeg')) {
          this.addImage(filePath, file.size);
        }

        if (!file.type) {
          ipcRenderer.send('folder-dropped', filePath);
        }
      });
      return false;
    }
  },

  // Only show the application window when Vue has mounted
  mounted: () => ipcRenderer.send('show-window')
});

// On image list item context menu action
ipcRenderer.on('item-menu-action', (e, { id, action }) => {
  if (action === 'remove') {
    app.removeImage(id);
  } else if (action === 'removeAll') {
    app.imageList.forEach(img => app.removeImage(img.id));
  }
});

// On image added through file selector
ipcRenderer.on('filesSelected', (e, args) => {
  if (args) args.forEach(file => app.addImage(file.path, file.size))
});

// On image compression error
ipcRenderer.on('imageError', (e, args) => {
  console.log('image error reported', args);

  app.imageList.some(imageItem => {
    if (imageItem.id === args.id) {
      imageItem.markAsError(args.msg.message);
      return true;
    }
  });
});

// On image compression complete
ipcRenderer.on('imageComplete', (e, args) => {
  app.imageList.some(imageItem => {
    if (imageItem.id === args.id) {
      imageItem.markAsComplete(args.newSize);
      return true;
    }
  });
});

// On folder parse image
ipcRenderer.on('manual-image-add', (e, args) => {
  app.addImage(args[0], args[1]);
});
