import { mount } from 'svelte';
import 'trompe'; // defines every tr-* element
import '../../shared/example.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
