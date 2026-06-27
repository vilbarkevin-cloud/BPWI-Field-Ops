import fs from 'fs';

const files = [
  'src/views/PmsView.tsx',
  'src/views/IncidentsView.tsx',
  'src/views/AttendanceView.tsx',
  'src/views/KpiView.tsx',
  'src/views/StaffView.tsx',
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  
  if(file.includes('IncidentsView')) {
    content = content.replace(/const \[activeTab, setActiveTab\] = useState<\'active\' \| \'history\'>\(\'active\'\);/, "const [localTab, setLocalTab] = useState<'active' | 'history'>('active');");
    content = content.replace(/setActiveTab\(/g, "setLocalTab(");
    content = content.replace(/activeTab/g, "localTab");
    content = content.replace(/interface IncidentsViewProps \{/, "interface IncidentsViewProps {\n  setActiveTab?: any;");
    content = content.replace(/export function IncidentsView\(\{ currentUser, currentUid \}: IncidentsViewProps\) \{/, "export function IncidentsView({ currentUser, currentUid, setActiveTab }: IncidentsViewProps) {");
  } else if(file.includes('StaffView')) {
    content = content.replace(/interface StaffViewProps \{/, "interface StaffViewProps {\n  setActiveTab?: any;");
    content = content.replace(/export function StaffView\(\{ currentUser, currentUid \}: StaffViewProps\) \{/, "export function StaffView({ currentUser, currentUid, setActiveTab }: StaffViewProps) {");
  } else if(file.includes('PmsView')) {
    content = content.replace(/const \[activeTab, setActiveTab\] = useState<'active' \| 'history'>\('active'\);/, "const [localTab, setLocalTab] = useState<'active' | 'history'>('active');");
    content = content.replace(/setActiveTab\(/g, "setLocalTab(");
    content = content.replace(/activeTab/g, "localTab");
    content = content.replace(/interface PmsViewProps \{/, "interface PmsViewProps {\n  setActiveTab?: any;");
    content = content.replace(/export function PmsView\(\{ currentUid \}: PmsViewProps\) \{/, "export function PmsView({ currentUid, setLocalTab: _unused, setActiveTab }: PmsViewProps) {");
  } else if(file.includes('AttendanceView')) {
    content = content.replace(/interface AttendanceViewProps \{/, "interface AttendanceViewProps {\n  setActiveTab?: any;");
    content = content.replace(/export function AttendanceView\(\{ currentUser, currentUid \}: AttendanceViewProps\) \{/, "export function AttendanceView({ currentUser, currentUid, setActiveTab }: AttendanceViewProps) {");
  } else if(file.includes('KpiView')) {
    content = content.replace(/interface KpiViewProps \{/, "interface KpiViewProps {\n  setActiveTab?: any;");
    content = content.replace(/export function KpiView\(\{ currentUid \}: KpiViewProps\) \{/, "export function KpiView({ currentUid, setActiveTab }: KpiViewProps) {");
  }

  fs.writeFileSync(file, content);
}
