const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'src', 'main.js');
let mainJS = fs.readFileSync(mainPath, 'utf8');

// Remove broken var/const declarations for state variables
mainJS = mainJS.replace(/var\s+state\.[a-zA-Z_]+\s*=.+?;/g, '');
mainJS = mainJS.replace(/const\s+state\.[a-zA-Z_]+\s*=.+?,.+?;/g, '');
mainJS = mainJS.replace(/const\s+state\.[a-zA-Z_]+\s*=.+?;/g, '');

// Remove sbQuery since it's imported from supabase.js now
mainJS = mainJS.replace(/\/\/ ── Centralised Supabase Error Handling ──[\s\S]*?\/\/\s*──+/g, '');

// Clean up any remaining `var state.something = ...`
mainJS = mainJS.replace(/var\s+state\.[^;]+;/g, '');

fs.writeFileSync(mainPath, mainJS);
console.log('Fixed syntax errors in main.js caused by regex search/replace');
