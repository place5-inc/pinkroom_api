const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'resources', 'fonts');
const dest = path.join(__dirname, '..', 'dist', 'resources', 'fonts');

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
