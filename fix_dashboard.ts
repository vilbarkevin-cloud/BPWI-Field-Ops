import fs from 'fs';
const file = 'src/views/DashboardView.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/onClick=\{\(data\) => \{/g, 'onClick={(data: any) => {');
fs.writeFileSync(file, content);
