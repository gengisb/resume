import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const dist = join(root, 'dist');
await rm(dist, { recursive: true, force: true });
const { resumeConfig } = await import(pathToFileURL(join(root, 'src', 'resume.config.js')));
const escapeAttribute = (value) => String(value).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
let html = await readFile(join(root, 'index.html'), 'utf8');
html = html
  .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(resumeConfig.site.title)}</title>`)
  .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeAttribute(resumeConfig.site.description)}$2`)
  .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeAttribute(resumeConfig.site.title)}$2`)
  .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeAttribute(resumeConfig.site.socialDescription)}$2`)
  .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escapeAttribute(resumeConfig.site.title)}$2`)
  .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escapeAttribute(resumeConfig.site.socialDescription)}$2`);
const staticHtml = html;

async function collectSourceAssets(directory, urlPrefix = '/src') {
  const entries = await readdir(directory, { withFileTypes: true });
  const assets = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    const url = `${urlPrefix}/${entry.name}`;
    if (entry.isDirectory()) assets.push(...await collectSourceAssets(path, url));
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.css')) {
      assets.push([url, await readFile(path, 'utf8'), entry.name.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8']);
    }
  }
  return assets;
}

const sourceAssets = await collectSourceAssets(join(root, 'src'));

const worker = `const PAGE = ${JSON.stringify(html)};
const SOURCE_ASSETS = new Map(${JSON.stringify(sourceAssets)});
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    if (SOURCE_ASSETS.has(url.pathname)) {
      const [source, contentType] = SOURCE_ASSETS.get(url.pathname);
      return new Response(request.method === 'HEAD' ? null : source, { headers: { 'content-type': contentType, 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' } });
    }
    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' } });
  },
};
`;

const workerPath = join(dist, 'server', 'index.js');
await mkdir(dirname(workerPath), { recursive: true });
await writeFile(workerPath, worker);
const staticPath = join(dist, 'static');
await mkdir(staticPath, { recursive: true });
await writeFile(join(staticPath, 'index.html'), staticHtml);
await cp(join(root, 'src'), join(staticPath, 'src'), { recursive: true });
await mkdir(join(staticPath, 'vendor'), { recursive: true });
await copyFile(join(root, 'public', 'vendor', 'web-llm-0.2.84-d1ecb257.js'), join(staticPath, 'vendor', 'web-llm-0.2.84-d1ecb257.js'));
await copyFile(join(root, 'public', 'vendor', 'Qwen3.5-2B-q4f16_1-webgpu-b0f951d4.wasm'), join(staticPath, 'vendor', 'Qwen3.5-2B-q4f16_1-webgpu-b0f951d4.wasm'));
const transformersBrowserBundle = (await readFile(join(root, 'node_modules', '@huggingface', 'transformers', 'dist', 'transformers.web.min.js'), 'utf8'))
  .replaceAll('from"onnxruntime-web/webgpu"', 'from"./ort.webgpu.bundle-20260827b.js"')
  .replaceAll('from"onnxruntime-common"', 'from"./ort.webgpu.bundle-20260827b.js"');
await writeFile(join(staticPath, 'vendor', 'transformers-4.0.0-next.3-web-20260827b.min.js'), transformersBrowserBundle);
await copyFile(join(root, 'node_modules', 'onnxruntime-web', 'dist', 'ort.webgpu.bundle.min.mjs'), join(staticPath, 'vendor', 'ort.webgpu.bundle-20260827b.js'));
await copyFile(join(root, 'node_modules', 'onnxruntime-web', 'dist', 'ort-wasm-simd-threaded.asyncify.mjs'), join(staticPath, 'vendor', 'ort-wasm-simd-threaded.asyncify-20260827b.js'));
await copyFile(join(root, 'node_modules', 'onnxruntime-web', 'dist', 'ort-wasm-simd-threaded.asyncify.wasm'), join(staticPath, 'vendor', 'ort-wasm-simd-threaded.asyncify-20260827b.wasm'));
console.log('Built interactive terminal resume.');
