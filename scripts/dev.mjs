import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : 3210);
const vendorAssets = new Map([
  ['/vendor/web-llm-0.2.84-d1ecb257.js', ['web-llm-0.2.84-d1ecb257.js', 'application/javascript; charset=utf-8']],
  ['/vendor/Qwen3.5-2B-q4f16_1-webgpu-b0f951d4.wasm', ['Qwen3.5-2B-q4f16_1-webgpu-b0f951d4.wasm', 'application/wasm']],
  ['/vendor/transformers-4.0.0-next.3-web-20260827b.min.js', ['transformers-4.0.0-next.3-web-20260827b.min.js', 'application/javascript; charset=utf-8', '@huggingface/transformers/dist', 'transformers.web.min.js']],
  ['/vendor/ort.webgpu.bundle-20260827b.js', ['ort.webgpu.bundle-20260827b.js', 'application/javascript; charset=utf-8', 'onnxruntime-web/dist', 'ort.webgpu.bundle.min.mjs']],
  ['/vendor/ort-wasm-simd-threaded.asyncify-20260827b.js', ['ort-wasm-simd-threaded.asyncify-20260827b.js', 'application/javascript; charset=utf-8', 'onnxruntime-web/dist', 'ort-wasm-simd-threaded.asyncify.mjs']],
  ['/vendor/ort-wasm-simd-threaded.asyncify-20260827b.wasm', ['ort-wasm-simd-threaded.asyncify-20260827b.wasm', 'application/wasm', 'onnxruntime-web/dist', 'ort-wasm-simd-threaded.asyncify.wasm']],
]);

async function renderPage() {
  return readFile(join(process.cwd(), 'index.html'), 'utf8');
}

createServer(async (request, response) => {
  try {
    if (vendorAssets.has(request.url)) {
      const [filename, contentType, packagePath, sourceFilename = filename] = vendorAssets.get(request.url);
      const assetPath = packagePath
        ? join(process.cwd(), 'node_modules', ...packagePath.split('/'), sourceFilename)
        : join(process.cwd(), 'public', 'vendor', filename);
      let asset = await readFile(assetPath);
      if (request.url === '/vendor/transformers-4.0.0-next.3-web-20260827b.min.js') {
        asset = asset
          .toString('utf8')
          .replaceAll('from"onnxruntime-web/webgpu"', 'from"./ort.webgpu.bundle-20260827b.js"')
          .replaceAll('from"onnxruntime-common"', 'from"./ort.webgpu.bundle-20260827b.js"');
      }
      response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(asset);
      return;
    }
    if (/^\/src\/[A-Za-z0-9_./-]+\.(?:js|css)$/.test(request.url) && !request.url.includes('..')) {
      const source = await readFile(join(process.cwd(), request.url.slice(1)));
      const contentType = request.url.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8';
      response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(source);
      return;
    }
    if (request.url !== '/' && request.url !== '/index.html') {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
      return;
    }
    const page = await renderPage();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(page);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { 'content-type': 'text/plain' });
    response.end('Preview failed to render');
  }
}).listen(port, 'localhost', () => console.log(`Local: http://localhost:${port}/`));
