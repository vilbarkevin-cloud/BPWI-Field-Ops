import fs from 'fs';

let content = fs.readFileSync('src/views/TasksView.tsx', 'utf-8');
content = content.replace(/const \[activeTab, setActiveTab\] = useState<'active' \| 'history'>\('active'\);/, "const [localTab, setLocalTab] = useState<'active' | 'history'>('active');");
content = content.replace(/setActiveTab\(/g, 'setLocalTab(');
content = content.replace(/activeTab === 'active'/g, "localTab === 'active'");
content = content.replace(/activeTab === 'history'/g, "localTab === 'history'");
content = content.replace(/interface TasksViewProps \{/, "interface TasksViewProps {\n  setActiveTab?: any;");
content = content.replace(/export function TasksView\(\{ currentUser, currentUid \}: TasksViewProps\) \{/, "export function TasksView({ currentUser, currentUid, setActiveTab }: TasksViewProps) {");
fs.writeFileSync('src/views/TasksView.tsx', content);
