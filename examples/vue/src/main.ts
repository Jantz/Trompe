import { createApp } from 'vue';
import 'trompe'; // defines every tr-* element
// Typed templates for every tr-* element (Volar / vue-tsc), generated from custom-elements.json.
import type {} from 'trompe/frameworks/vue';
import '../../shared/example.css';
import App from './App.vue';

createApp(App).mount('#app');
