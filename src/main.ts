import { createApp } from 'vue';
import App from './App.vue';
import { store, key } from './store';
import { router } from './router';
import { controlCv } from './plugins/ControlCv';
import { axios } from './plugins/Axios';
import { vscode } from './plugins/Vscode';
import { disk } from './plugins/Disk';

const app = createApp(App);
app.use(store, key);
app.use(router);
app.use(controlCv);
app.use(disk);
app.use(axios);

if (import.meta.env.VITE_APP_ENV === 'vscode') {
    app.use(vscode);
}

app.mount('#app');
