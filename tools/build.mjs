#!/usr/bin/env node
// Build the game for shipping:
//   dist/index.html + dist/game.js   a static site (any host)
//   dist/shardlight.html             everything in one file (script inlined), for hosts that take a single page
//
//   node tools/build.mjs
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "dist");
mkdirSync(OUT, { recursive: true });
const r = await build({ entryPoints: [join(ROOT, "src/main.js")], bundle: true, format: "esm", minifyWhitespace: !process.argv.includes("--debug"), minifySyntax: !process.argv.includes("--debug"), minifyIdentifiers: false, write: false, target: "es2020", legalComments: "none" });
const js = r.outputFiles[0].text;
const banner = "/* Shardlight. Effects: pixelfx by Patch (MIT), adapting Sprite Fusion's VFX by Hugo Duprez (MIT) and Hollow Crown's acting (MIT). */\n";
writeFileSync(join(OUT, "game.js"), banner + js);
const html = readFileSync(join(ROOT, "index.html"), "utf8");
writeFileSync(join(OUT, "index.html"), html.replace('<script type="module" src="src/main.js"></script>', '<script type="module" src="game.js"></script>'));
// one file: the script inline (escaped so "</script" can't end it early)
const inline = (banner + js).replace(/<\/script/gi, "<\\/script");
writeFileSync(join(OUT, "shardlight.html"), html.replace('<script type="module" src="src/main.js"></script>', `<script type="module">\n${inline}\n</script>`));
console.log(`dist/game.js ${(js.length / 1024).toFixed(0)} KB, dist/shardlight.html ${((js.length + html.length) / 1024).toFixed(0)} KB`);
