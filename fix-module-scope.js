const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'src', 'main.js');
let mainJS = fs.readFileSync(mainPath, 'utf8');

// Find all top level functions
const functionRegex = /^ {4}function\s+([a-zA-Z0-9_]+)\s*\(/gm;
let match;
let windowExports = '\n\n// --- Global Window Exports for Inline HTML Handlers ---\n';
const added = new Set();

while ((match = functionRegex.exec(mainJS)) !== null) {
  const funcName = match[1];
  if (!added.has(funcName)) {
    windowExports += `window.${funcName} = ${funcName};\n`;
    added.add(funcName);
  }
}

// Find async functions too
const asyncRegex = /^    async function\s+([a-zA-Z0-9_]+)\s*\(/gm;
while ((match = asyncRegex.exec(mainJS)) !== null) {
  const funcName = match[1];
  if (!added.has(funcName)) {
    windowExports += `window.${funcName} = ${funcName};\n`;
    added.add(funcName);
  }
}

if (!mainJS.includes('Global Window Exports')) {
  fs.writeFileSync(mainPath, mainJS + windowExports);
  console.log('Fixed inline handlers by attaching functions to window.');
} else {
  console.log('Already fixed.');
}
