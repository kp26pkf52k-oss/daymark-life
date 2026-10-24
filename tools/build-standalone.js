/* 1ファイル版を作る：CSSとJavaScriptをindex.htmlに埋め込み dist/daymark-life.html に出力する。
 * 使い方：node tools/build-standalone.js
 * 1ファイル版はPCでダブルクリックして開いたり、ファイルとして保管したりする用途。
 * （保存データはブラウザごと・開いた場所ごとに別になる点に注意）
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(root, f), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
html = html.replace(/\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>/g, '');
html = html.replace('<body>', '<body>\n<script>window.DM_NO_SW = true;</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'daymark-life.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${Math.round(html.length / 1024)} KB)`);
