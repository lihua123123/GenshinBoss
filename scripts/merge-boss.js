import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const contentDir = path.join(__dirname, '..', 'src', 'content');
const versions = ['5.7', '5.8', '6.0', '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '7.0', '7.1'];

const parts = [];

for (const v of versions) {
  const filePath = path.join(contentDir, `${v}.md`);
  let text = fs.readFileSync(filePath, 'utf8');

  // 将每个文件的 `## 幽境危战 X.Y` 替换为 `## X.Y`
  const headingRe = /^##\s+幽境危战\s+([\d.]+)\s*$/m;
  text = text.replace(headingRe, `## $1`);

  parts.push(text.trim());
}

const merged = parts.join('\n\n---\n\n') + '\n';
const outPath = path.join(contentDir, '幽境boss.md');
fs.writeFileSync(outPath, merged, 'utf8');

console.log(`Merged ${versions.length} files into ${outPath}`);
console.log(`Total length: ${merged.length} chars`);
