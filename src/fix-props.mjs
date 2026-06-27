import fs from 'fs';

const files = [
  'src/views/TasksView.tsx',
  'src/views/PmsView.tsx',
  'src/views/IncidentsView.tsx',
  'src/views/AttendanceView.tsx',
  'src/views/InventoryView.tsx',
  'src/views/KpiView.tsx',
  'src/views/StaffView.tsx',
  'src/views/MapView.tsx',
  'src/views/ChlorinationView.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let interfaceName = file.match(/([a-zA-Z]+)View\.tsx/)[1] + 'ViewProps';
  let hasProps = content.includes(`interface ${interfaceName}`);
  if (!hasProps) {
    if (file.includes('InventoryView')) {
      interfaceName = 'InventoryViewProps';
      content = content.replace(/export function InventoryView\(\{.*?\}\s*:\s*\{.*?\}\)/, `interface InventoryViewProps { isOnline?: boolean; currentUid?: string; setActiveTab?: any; }\nexport function InventoryView({ isOnline, currentUid, setActiveTab }: InventoryViewProps)`);
    } else if (file.includes('MapView')) {
      interfaceName = 'MapViewProps';
      content = content.replace(/export function MapView\(\{.*?\}\s*:\s*\{.*?\}\)/, `interface MapViewProps { currentUser?: string; currentUid?: string; setActiveTab?: any; }\nexport function MapView({ currentUser, currentUid, setActiveTab }: MapViewProps)`);
    } else if (file.includes('ChlorinationView')) {
        interfaceName = 'ChlorinationViewProps';
        content = content.replace(/export function ChlorinationView\(\{.*?\}\s*:\s*\{.*?\}\)/, `interface ChlorinationViewProps { currentUid?: string; setActiveTab?: any; }\nexport function ChlorinationView({ currentUid, setActiveTab }: ChlorinationViewProps)`);
    } else {
        console.log("Not found props interface in", file);
    }
  } else {
    content = content.replace(new RegExp(`interface ${interfaceName} \\{([\\s\\S]*?)\\}`), `interface ${interfaceName} {$1  setActiveTab?: any;\n}`);
    const rx = new RegExp(`export function [a-zA-Z]+View\\(\\{([\\s\\S]*?)\\}\\s*:\\s*${interfaceName}\\)`);
    content = content.replace(rx, `export function ${file.match(/([a-zA-Z]+)View\.tsx/)[1]}View({$1, setActiveTab}: ${interfaceName})`);
  }
  
  if (content.includes('setActiveTab: any')) { // Quick check
     fs.writeFileSync(file, content);
  } else if (!content.includes('setActiveTab')) {
       console.log('setActiveTab still not present in', file);
  }
}
