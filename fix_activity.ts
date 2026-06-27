import fs from 'fs';
const file = 'src/views/ActivityView.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/^[ \t]*undefined\n/gm, '');
fs.writeFileSync(file, content);

const file2 = 'src/utils/ToastContext.tsx';
// let's leave this one alone if it just has `undefined` as a value.
