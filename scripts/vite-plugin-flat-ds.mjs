/* Плоское пространство имён для DC-рантайма.
 *
 * support.js монтирует вложенный компонент как «./Имя.dc.html» ОТНОСИТЕЛЬНО открытого
 * документа (COMPONENT_DIR = "."), а теги из <helmet> копируются в head того же документа —
 * значит и «tokens.css», и «svgs/plus.svg» разрешаются из одной точки. Раскладка по уровням
 * (src/atoms, src/molecules, …) существует для читателя; рантайму нужен один плоский корень.
 * Этот плагин и есть перевод одного в другое: /Button.dc.html → src/atoms/Button.dc.html.
 *
 * Файлы отдаются БАЙТ В БАЙТ, до внутренних middleware Vite: HTML не проходит через
 * transformIndexHtml (иначе Vite переписал бы href в хелметах и подмешал свой клиент),
 * и то, что видит браузер в dev, совпадает с тем, что уезжает в статику.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Папки-исходники. Порядок важен только для сообщения о коллизии. */
const ROOTS = ['src', 'storybook'];
/** Папки, которые отдаются с сохранением своего имени: их путь зашит в код и CSS. */
const KEEP_DIR = new Set(['svgs', 'fonts']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

/** @returns {Map<string, string>} URL «/Button.dc.html» → путь «src/atoms/Button.dc.html» */
export function buildFlatMap(root = process.cwd()) {
  const map = new Map();
  const claim = (url, file) => {
    const prev = map.get(url);
    if (prev && prev !== file) {
      // Имя компонента обязано быть уникальным во всём src: иначе «Button» из atoms и из
      // molecules — это одна ссылка, и рантайм молча смонтирует не тот файл.
      throw new Error(
        `[flat-ds] коллизия имён: ${url} ← ${prev} и ${file}. ` +
          `Имя файла уникально во всём дереве — рантайм различает компоненты только по имени.`
      );
    }
    map.set(url, file);
  };

  const walk = (dir, urlPrefix) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(rel, KEEP_DIR.has(entry.name) ? `/${entry.name}` : urlPrefix);
      } else {
        claim(path.posix.join(urlPrefix, entry.name), rel);
      }
    }
  };

  for (const r of ROOTS) if (fs.existsSync(path.join(root, r))) walk(r, '/');
  return map;
}

export default function flatDs({ root = process.cwd(), index = '/Storybook.dc.html' } = {}) {
  let map = buildFlatMap(root);
  return {
    name: 'flat-ds',
    configureServer(server) {
      // до внутренних middleware Vite — файл уходит как есть
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        let url;
        try {
          url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        } catch {
          return next();
        }
        if (url === '/') {
          res.statusCode = 302;
          res.setHeader('Location', index);
          return res.end();
        }
        // Карта живая: файл мог появиться или переехать на другой уровень после старта —
        // пересобираем и повторяем, а не просим рестарт и не отдаём 404 на живой файл.
        let file = map.get(url);
        let abs = file && path.join(root, file);
        if (!file || !fs.existsSync(abs)) {
          map = buildFlatMap(root);
          file = map.get(url);
          abs = file && path.join(root, file);
        }
        if (!file || !fs.existsSync(abs)) return next();
        res.setHeader('Content-Type', MIME[path.extname(abs)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(abs).pipe(res);
      });
      // Живой перезагрузки нет и не будет: клиент Vite в документ не подмешивается,
      // иначе dev и статика отдавали бы разный HTML. Правка → обновить страницу.
    },
  };
}
