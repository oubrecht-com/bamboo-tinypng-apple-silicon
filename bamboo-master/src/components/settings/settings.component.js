// Lib imports
import { ipcRenderer } from 'electron';
import feather from 'feather-icons';
import settings from '../../assets/scripts/settings';

// Local imports
import template from './settings.template';

export default {
  name: 'settings',
  template,
  data: function() {
    return {
      apiKey: '',
      apiInputValue: ''
    };
  },
  methods: {
    /** Emit a close signal to hide the settings component */
    close: function() {
      this.$emit('close');
    },

    /** Save all relevant settings */
    save: function() {
      if (this.apiInputValue.length < 1) {
        ipcRenderer.send('invalid-api-key');
        return;
      }

      this.apiKey = this.apiInputValue;
      settings.set('api-key', this.apiKey);
    }
  },

  /** Initialize setting values */
  created: function() {
    this.apiKey = settings.get('api-key') || '';
    this.apiInputValue = settings.get('api-key') || '';
  },

  /** Replace icons on mount */
  mounted: () => feather.replace()
}
