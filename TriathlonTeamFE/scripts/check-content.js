const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(process.cwd(), 'src');
const textExtensions = new Set([
  '.ts',
  '.html',
  '.scss',
  '.css',
  '.json',
  '.md',
  '.txt',
  '.yml',
  '.yaml'
]);

const issues = [];

const urlGuard = [/https?:\/\//, /mailto:/, /tel:/, /:\/\//];

function shouldCheck(filePath) {
  const ext = path.extname(filePath);
  return textExtensions.has(ext);
}

function report(file, message) {
  issues.push({ file: path.relative(process.cwd(), file), message });
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!shouldCheck(fullPath)) continue;
    const content = readFileSync(fullPath, 'utf8');

    if (content.includes('\uFFFD')) {
      report(fullPath, 'conține caracterul de înlocuire (�) – probabil problemă de codare');
    }

    const wordQuestionRegex = /\p{L}\?\p{L}/gu;
    for (const match of content.matchAll(wordQuestionRegex)) {
      const index = match.index ?? 0;
      const fragment = content.slice(Math.max(0, index - 30), index + 30);
      if (urlGuard.some((guard) => guard.test(fragment))) {
        continue;
      }
      report(fullPath, 'conține semnul "?" în interiorul unui cuvânt – posibil text corupt');
      break;
    }
  }
}

walk(projectRoot);

if (issues.length) {
  console.error('Verificarea conținutului a eșuat:');
  for (const issue of issues) {
    console.error(` - ${issue.file}: ${issue.message}`);
  }
  process.exit(1);
}

console.log('Verificarea conținutului a trecut ✔');
