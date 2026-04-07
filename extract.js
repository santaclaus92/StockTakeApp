const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const cssDir = path.join(__dirname, 'src', 'styles');
const jsDir = path.join(__dirname, 'src');

if (!fs.existsSync(cssDir)) fs.mkdirSync(cssDir, { recursive: true });
if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true });

let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract CSS
const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/g);
if (styleMatch) {
  let combinedCss = '';
  styleMatch.forEach(block => {
    combinedCss += block.replace(/<style>/, '').replace(/<\/style>/, '') + '\n';
  });
  fs.writeFileSync(path.join(cssDir, 'index.css'), combinedCss.trim());
  htmlContent = htmlContent.replace(/<style>[\s\S]*?<\/style>/g, '');
  // Insert CSS link
  htmlContent = htmlContent.replace('</head>', '  <link rel="stylesheet" href="/src/styles/index.css">\n</head>');
}

// Extract JS
// We have to be careful with script tags. There are external ones and one big inline one.
const bigScriptRegex = /<script>([\s\S]*?)<\/script>/;
const match = htmlContent.match(bigScriptRegex);
if (match) {
  const jsContent = match[1];
  fs.writeFileSync(path.join(jsDir, 'main.js'), jsContent.trim());
  htmlContent = htmlContent.replace(bigScriptRegex, '<script type="module" src="/src/main.js"></script>');
}

fs.writeFileSync(htmlPath, htmlContent);
console.log('Extraction complete! CSS moved to src/styles/index.css and JS moved to src/main.js.');
