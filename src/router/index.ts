import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import { IRoute } from './IRoute';
import Picker from './Picker';
import Help from './Help';

export const views: IRoute[] = [Picker, Help];

export const routes: RouteRecordRaw[] = [{ path: '/', component: Picker.view }, ...views.map(view => ({ path: '/' + view.key, component: view.view }))];

export const router = createRouter({
    history: createWebHashHistory(),
    routes,
});
