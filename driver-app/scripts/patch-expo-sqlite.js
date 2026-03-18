/**
 * Patches expo-sqlite build/*.js to use .js extensions in relative imports
 * so Node ESM can resolve them (fixes ERR_MODULE_NOT_FOUND for SQLiteDatabase).
 */
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '../node_modules/expo-sqlite/build');
if (!fs.existsSync(buildDir)) {
  process.exit(0);
  return;
}

const files = ['index.js', 'SQLiteDatabase.js', 'hooks.js', 'SQLiteStatement.js'];
for (const file of files) {
  const filePath = path.join(buildDir, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  // Add .js to relative imports that don't have it: from './X' -> from './X.js'
  content = content.replace(/from '\.\/([^']+)'/g, (m, name) =>
    name.endsWith('.js') ? m : `from './${name}.js'`
  );
  content = content.replace(/export \* from '\.\/([^']+)'/g, (m, name) =>
    name.endsWith('.js') ? m : `export * from './${name}.js'`
  );
  fs.writeFileSync(filePath, content);
}
console.log('Patched expo-sqlite for Node ESM resolution');
