const fs = require('fs');
const path = require('path');

const srcCode = fs.readFileSync(path.join(__dirname, 'src/App.tsx'), 'utf8');
const lines = srcCode.split('\n');

function extractComponent(startLine, endLine, outputPath, imports, name, propsToRemove = []) {
  let content = lines.slice(startLine - 1, endLine).join('\n');
  
  content = content.replace(/onNavigate\('([^']+)'\)/g, "navigate('/$1')");
  content = content.replace(/onNavigate\(([^)]+)\)/g, "navigate(`/${$1}`)");
  content = content.replace(/navigate\('\/home'\)/g, "navigate('/')");
  content = content.replace(/navigate\('\/builder'\)/g, "navigate('/builder')");
  
  if (content.includes('navigate(')) {
    imports += `\nimport { useNavigate } from 'react-router-dom';`;
    if (content.includes(`const ${name} = ({`)) {
      content = content.replace(`const ${name} = ({`, `export const ${name} = ({`);
      content = content.replace(/=> \{\n/, "=> {\n  const navigate = useNavigate();\n");
    } else if (content.includes(`const ${name} = () => {`)) {
      content = content.replace(`const ${name} = () => {`, `export const ${name} = () => {\n  const navigate = useNavigate();`);
    } else if (content.includes(`const ${name} = () => (`)) {
      content = content.replace(`const ${name} = () => (`, `export const ${name} = () => {\n  const navigate = useNavigate();\n  return (`);
      content = content.replace(/\);?\s*$/, ');\n};');
    } else if (content.includes(`const ${name} = ({`)) {
       content = content.replace(`const ${name} = ({`, `export const ${name} = ({`);
       content = content.replace(/\) => \(/, ") => {\n  const navigate = useNavigate();\n  return (");
       content = content.replace(/\);?\s*$/, ');\n};');
    }
  } else {
     content = content.replace(`const ${name} =`, `export const ${name} =`);
  }

  propsToRemove.forEach(prop => {
    const propRegex = new RegExp(`${prop},?\\s*`, 'g');
    content = content.replace(propRegex, '');
    const typeRegex = new RegExp(`${prop}:\\s*[^;]+;\\s*`, 'g');
    content = content.replace(typeRegex, '');
  });

  fs.writeFileSync(path.join(__dirname, outputPath), imports + '\n\n' + content + '\n');
}

extractComponent(5036, 5698, 'src/pages/LoginPage.tsx', 
  "import { useState, useRef, useEffect } from 'react';\n" +
  "import { CheckCircle, AlertCircle, ArrowLeft, Shield, Mail } from 'lucide-react';\n" +
  "import { backendApi, type AuthUser } from '../lib/backendApi';\n" +
  "import { persistSignedInUser } from '../lib/auth';\n" +
  "import { PrimaryButton } from '../components/Buttons';",
  'LoginPage'
);

extractComponent(5699, 6250, 'src/pages/JobFinderPage.tsx', 
  "import { useState, useEffect } from 'react';\n" +
  "import { Search, MapPin, Briefcase, Filter, ExternalLink, Bookmark, Clock, DollarSign, Building, AlertCircle, BookmarkCheck } from 'lucide-react';\n" +
  "import { backendApi, type BackendJob, type AuthUser } from '../lib/backendApi';\n" +
  "import { Section } from '../components/Section';\n" +
  "import { PrimaryButton } from '../components/Buttons';\n" +
  "import type { JobItem, Page } from '../types';",
  'JobFinderPage',
  ['onNavigate']
);

extractComponent(6251, 6515, 'src/pages/DashboardPage.tsx', 
  "import { useState, useEffect } from 'react';\n" +
  "import { FileText, Clock, Settings, User, Trash2, Edit3, Save, ExternalLink, QrCode } from 'lucide-react';\n" +
  "import { Section } from '../components/Section';\n" +
  "import { PrimaryButton, SecondaryButton } from '../components/Buttons';\n" +
  "import { RESUME_HISTORY_STORAGE_KEY, USER_STORAGE_KEY } from '../lib/auth';\n" +
  "import type { AuthUser } from '../lib/backendApi';\n" +
  "import type { Page } from '../types';",
  'DashboardPage',
  ['onNavigate']
);

console.log("Extraction 3 complete!");
