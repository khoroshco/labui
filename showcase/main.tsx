/* Стили подключаются импортом, а не тегами: так их собирает Vite и вместе с ними
 * забирает шрифты, на которые ссылается ds.css. tokens.css — артефакт, он собирается
 * из DTCG-источника прямо в конфиге витрины. */
import '../src/tokens.css';
import '../src/ds.css';
import '../src/sb.css';

import { createRoot } from 'react-dom/client';
import { installFocusModality } from '../packages/ds-react/src/index';
import { App } from './App';

installFocusModality();
document.documentElement.setAttribute('data-theme', 'dark');
createRoot(document.getElementById('root')!).render(<App />);
