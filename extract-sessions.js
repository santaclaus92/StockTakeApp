const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'src', 'main.js');
const sessionsPath = path.join(__dirname, 'src', 'sessions.js');
let mainJS = fs.readFileSync(mainPath, 'utf8');

const targetFunctions = [
  'goSessions',
  'renderSessTable',
  'openSession',
  'renderSessHeader',
  'openEndModal',
  'doEnd',
  'toggleNSForm',
  'openEditSession',
  'closeEditSession',
  'onEditCountry',
  'saveEditSession',
  'reopenSession',
  'deleteSession',
  'confirmDeleteSession',
  'toggleSessionVisibility',
  'onCountry',
  'onRcToggle',
  'createSession',
  'resetNSForm',
  'loadSessions'
];

let outJS = `import { state } from './store.js';\nimport { sb } from './supabase.js';\n\n`;

targetFunctions.forEach(fn => {
  const regex = new RegExp(`^ {0,4}(async\\s+)?function\\s+${fn}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?^ {0,4}\\}`, 'm');
  const match = mainJS.match(regex);
  if (match) {
    let funcBody = match[0];
    funcBody = funcBody.replace(/^( {0,4})(async\s+)?function/, 'export $2function');
    outJS += funcBody + '\n\n';
    mainJS = mainJS.replace(regex, '');
  }
});

outJS += `// --- Global Window Exports ---\n`;
targetFunctions.forEach(fn => {
  outJS += `window.${fn} = ${fn};\n`;
});

fs.writeFileSync(sessionsPath, outJS);

targetFunctions.forEach(fn => {
  mainJS = mainJS.replace(new RegExp(`^window\\.${fn}\\s*=\\s*${fn};\\s*$`, 'gm'), '');
});

if (!mainJS.includes("import './sessions.js';")) {
  mainJS = mainJS.replace(`import './auth.js';\n`, `import './auth.js';\nimport './sessions.js';\n`);
}

fs.writeFileSync(mainPath, mainJS);
console.log('Successfully extracted Sessions logic to src/sessions.js');
