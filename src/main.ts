import { createApp } from 'vue';
import App from './App.vue';
import WebAudioPeakMeter from './components/WebAudioPeakMeter.vue';

const app = createApp(App);

app.component('WebAudioPeakMeter', WebAudioPeakMeter);

app.mount('#app');
