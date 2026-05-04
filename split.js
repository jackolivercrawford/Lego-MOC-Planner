import fs from 'fs';

if (!process.argv.includes('--force')) {
  console.error('split.js rewrites index.html, src/main.js, and src/style.css from lego_drawer_plan.html.');
  console.error('That source is a legacy snapshot and may not include current app changes.');
  console.error('Run `node split.js --force` only when you intentionally want to regenerate from that file.');
  process.exit(1);
}

const html = fs.readFileSync('lego_drawer_plan.html', 'utf-8');

// Extract CSS
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (styleMatch) {
  fs.mkdirSync('src', { recursive: true });
  fs.writeFileSync('src/style.css', styleMatch[1].trim());
}

// Extract JS
let scriptContent = '';
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  fs.mkdirSync('src', { recursive: true });
  scriptContent = scriptMatch[1].trim();
  fs.writeFileSync('src/main.js', `import './style.css';\n\n` + scriptContent);
}

// Write index.html
const newHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LEGO Drawer Plan</title>
</head>
<body>
${html.match(/<body>([\s\S]*?)<script>/)[1].trim()}
  <script type="module" src="/src/main.js"></script>
</body>
</html>`;

fs.writeFileSync('index.html', newHtml);
console.log('Split successful');
