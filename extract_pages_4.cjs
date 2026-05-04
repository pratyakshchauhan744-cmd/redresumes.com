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

extractComponent(2194, 4761, 'src/pages/BuilderPage.tsx', 
  "import React, { useState, useEffect, useRef } from 'react';\n" +
  "import { Download, Layout, Sparkles, User, FileText, CheckCircle, Save, HelpCircle, Briefcase, ChevronRight, PenTool, Type, Move, Plus, X, ArrowUp, ArrowDown, GripVertical, Check, MessageSquare, AlertCircle, Copy, Code, ArrowLeft } from 'lucide-react';\n" +
  "import html2canvas from 'html2canvas';\n" +
  "import { jsPDF } from 'jspdf';\n" +
  "import { Section } from '../components/Section';\n" +
  "import { PrimaryButton, SecondaryButton } from '../components/Buttons';\n" +
  "import { TemplateResumePage } from '../components/TemplateResumePage';\n" +
  "import { backendApi, type AuthUser } from '../lib/backendApi';\n" +
  "import { RESUME_HISTORY_STORAGE_KEY, buildUserScopedStorageKey } from '../lib/auth';\n" +
  "import { templates } from '../data/templates';\n" +
  "import { resumeExamplePresets } from '../data/resumeExamples';\n" +
  "import type { TemplateItem, TemplateResumeData, ExperienceItem, CustomColumnItem } from '../types';",
  'ResumeBuilderPage'
);

console.log("Extraction 4 complete!");
