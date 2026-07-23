const fs = require('fs');
const p = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\TranslateTab.vue';
let lines = fs.readFileSync(p, 'utf8').split('\n');
lines.splice(462, 5); // 462 is 0-indexed for line 463. Remove 5 lines.
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('Done');
