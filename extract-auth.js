const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'src', 'main.js');
const authPath = path.join(__dirname, 'src', 'auth.js');
let mainJS = fs.readFileSync(mainPath, 'utf8');

const authFunctions = [
  'getSsoInitials',
  'applySsoUser',
  'checkLogin',
  'showSsoOverlay',
  'ssoBack',
  'sendOtp',
  'verifyOtp',
  'signOut'
];

let authJS = `import { state } from './store.js';\nimport { sb } from './supabase.js';\n\n`;

// We use regex to carefully pluck out the functions.
// Because some might be 'async function' and some 'function', we match from the declaration to the closing brace.
authFunctions.forEach(fn => {
  // A simplistic regex to capture top level functions. It assumes the function is at indentation 4 or 0 and ends with } at that indentation.
  const regex = new RegExp(`^ {0,4}(async\\s+)?function\\s+${fn}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?^ {0,4}\\}`, 'm');
  const match = mainJS.match(regex);
  if (match) {
    let funcBody = match[0];
    
    // Convert to export function
    funcBody = funcBody.replace(/^( {0,4})(async\s+)?function/, 'export $2function');
    authJS += funcBody + '\n\n';
    
    // Remove from main.js
    mainJS = mainJS.replace(regex, '');
  }
});

authJS += `// --- Global Window Exports ---\n`;
authFunctions.forEach(fn => {
  authJS += `window.${fn} = ${fn};\n`;
});

// Write to auth.js
fs.writeFileSync(authPath, authJS);

// Ensure the auth functions are removed from main.js's native Global Window Exports if they are there
authFunctions.forEach(fn => {
  mainJS = mainJS.replace(new RegExp(`^window\\.${fn}\\s*=\\s*${fn};\\s*$`, 'gm'), '');
});

// Import into main.js
if (!mainJS.includes("import './auth.js';")) {
  mainJS = mainJS.replace(`import { sb, sbQuery } from './supabase.js';\n`, `import { sb, sbQuery } from './supabase.js';\nimport './auth.js';\n`);
}

fs.writeFileSync(mainPath, mainJS);
console.log('Successfully extracted Auth logic to src/auth.js');
