const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'src', 'main.js');
const storePath = path.join(__dirname, 'src', 'store.js');

let mainJS = fs.readFileSync(mainPath, 'utf8');

// The specific variables to migrate to store.js
const stateVars = [
  'S', 'items', '_filteredItems', '_itemPage', '_itemsPerPage', '_sortCol', '_sortDir', '_isDragging',
  '_sortKeyMap', 'newItems', 'pairs', 'selItems', 'openPairId', 'repairPairId', 'repReplName', 'repReplInit',
  'editWarehousePairId', 'editPairId', 'nextPair', 'curSessId', 'editSessId', 'lastCheckedRow',
  'countSessId', 'countItems', 'countPairId', 'ssoEmailPending', 'ssoUserName', 'ssoUserEmail', 'ssoUserRole',
  'SSO_ROLE_KEY', 'STATUS_DRAFT', 'STATUS_ACTIVE', 'STATUS_CLOSED', 'ROLE_ADMIN', 'ROLE_USER'
];

let storeContent = `// src/store.js
// Centralized global state.
export const state = {
  S: [],
  items: [],
  _filteredItems: [],
  _itemPage: 0,
  _itemsPerPage: 200,
  _sortCol: null,
  _sortDir: 1,
  _isDragging: false,
  _sortKeyMap: { code:'code', name:'name', grp:'grp', batch:'batch', uom:'uom', pkg:'pkg', expiry:'expiry', category:'category', sap:'sap', cnt:'cnt', dmg:'dmg', exp:'expQty', by:'assignedTo', whcode:'wh', binloc:'warehouse', pair:'assignedTo', src:'itemStatus', status:'dropped' },
  newItems: [],
  pairs: [],
  selItems: new Set(),
  openPairId: null,
  repairPairId: null,
  repReplName: null,
  repReplInit: null,
  editWarehousePairId: null,
  editPairId: null,
  nextPair: 5,
  curSessId: null,
  editSessId: null,
  lastCheckedRow: null,
  countSessId: localStorage.getItem('stp_count_sess') || null,
  countItems: [],
  countPairId: null,
  ssoEmailPending: '',
  SSO_USER_KEY: 'stp_sso_user',
  SSO_EMAIL_KEY: 'stp_sso_email',
  ssoUserName: sessionStorage.getItem('SSO_USER_KEY') || sessionStorage.getItem('stp_sso_user') || '',
  ssoUserEmail: sessionStorage.getItem('SSO_EMAIL_KEY') || sessionStorage.getItem('stp_sso_email') || '',
  ssoUserRole: sessionStorage.getItem('stp_sso_role') || 'User',
  SSO_ROLE_KEY: 'stp_sso_role',
  STATUS_DRAFT: 'Draft',
  STATUS_ACTIVE: 'Active',
  STATUS_CLOSED: 'Closed',
  ROLE_ADMIN: 'Admin',
  ROLE_USER: 'User'
};
`;

fs.writeFileSync(storePath, storeContent);

// Now we replace occurrences in main.js
stateVars.forEach(v => {
  // Negative lookbehind for dot, negative lookahead for colon to avoid object keys `curSessId:`
  // Also avoid `var countSessId = ` since we're removing the declarations.
  const regex = new RegExp(`(?<!\\.)\\b${v}\\b(?!s*:)`, 'g');
  mainJS = mainJS.replace(regex, `state.${v}`);
});

// Remove variable declarations
const declRegexes = [
  /var\s+S\s*=\s*\[\];/g,
  /var\s+items\s*=\s*\[\];/g,
  /var\s+countSessId\s*=\s*.*?\|\|\s*null;/g,
  /var\s+ssoUserName\s*=\s*sessionStorage.*?\|\|\s*'';/g,
  /var\s+ssoUserEmail\s*=\s*sessionStorage.*?\|\|\s*'';/g,
  /var\s+ssoUserRole\s*=\s*sessionStorage.*?\|\|\s*'User';/g,
  // Add as needed, or we just manually delete the top block later
];

declRegexes.forEach(r => { mainJS = mainJS.replace(r, ''); });

// Insert imports at the top
const imports = `import { state } from './store.js';\nimport { sb, sbQuery } from './supabase.js';\n\n`;
mainJS = imports + mainJS;

fs.writeFileSync(mainPath, mainJS);
console.log('Successfully extracted state logic to src/store.js and updated main.js references.');
