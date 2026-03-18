/**
 * Patches react-native-screens Fabric components so Codegen accepts prop types.
 * - SearchBar: removes "| null" from DirectEventHandler (issue #3496).
 * - ScreenStackHeaderSubview: WithDefault<custom_union_type_alias, 'x'> fails Codegen.
 *   Fix: inline the union so Codegen can parse it directly.
 * - ScreenStack: WithDefault<boolean, true> may cause "undefined" in some versions.
 */
const fs = require('fs');
const path = require('path');

const patches = [
  {
    file: '../node_modules/react-native-screens/src/fabric/SearchBarNativeComponent.ts',
    replace: [
      [/(\?\s*CT\.DirectEventHandler<[^>]+>)\s*\|\s*null/g, '$1'],
    ],
  },
  {
    // Codegen cannot resolve WithDefault<HeaderSubviewTypes, 'left'> when HeaderSubviewTypes
    // is a type alias. Inline the union literals so Codegen can parse them.
    file: '../node_modules/react-native-screens/src/fabric/ScreenStackHeaderSubviewNativeComponent.ts',
    replace: [
      [
        /type\?\:\s*WithDefault<HeaderSubviewTypes,\s*'left'>/g,
        "type?: WithDefault<'back' | 'right' | 'left' | 'title' | 'center' | 'searchBar', 'left'>"
      ],
    ],
  },
  {
    // In case ScreenStack still has the iosPreventReattachmentOfDismissedScreens issue
    file: '../node_modules/react-native-screens/src/fabric/ScreenStackNativeComponent.ts',
    replace: [
      [/iosPreventReattachmentOfDismissedScreens\?\:\s*CT\.WithDefault<boolean,\s*true>/g, 'iosPreventReattachmentOfDismissedScreens?: boolean'],
    ],
  },
];

let patched = false;
for (const { file: relPath, replace } of patches) {
  const filePath = path.join(__dirname, relPath);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  for (const [regex, replacement] of replace) {
    content = content.replace(regex, replacement);
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    patched = true;
  }
}
if (patched) {
  console.log('Patched react-native-screens for Codegen');
}
