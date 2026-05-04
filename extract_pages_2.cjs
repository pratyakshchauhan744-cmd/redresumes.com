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

extractComponent(4762, 4890, 'src/pages/TemplatesPage.tsx', 
  "import { useState } from 'react';\n" +
  "import { Search } from 'lucide-react';\n" +
  "import { Section } from '../components/Section';\n" +
  "import { TemplateCard } from '../components/TemplateCard';\n" +
  "import { templates } from '../data/templates';\n" +
  "import type { TemplateItem } from '../types';",
  'TemplatesPage'
);

extractComponent(4953, 4985, 'src/pages/ExamplesPage.tsx', 
  "import { Section } from '../components/Section';\n" +
  "import { resumeExamplePresets } from '../data/resumeExamples';",
  'ExamplesPage'
);

extractComponent(4986, 5001, 'src/pages/BlogPage.tsx', 
  "import { Section } from '../components/Section';\n" +
  "import { blogArticles } from '../data/blogArticles';\n" +
  "import type { BlogArticle } from '../types';",
  'BlogPage'
);

extractComponent(5002, 5035, 'src/pages/BlogPostPage.tsx', 
  "import { ArrowLeft } from 'lucide-react';\n" +
  "import { Section } from '../components/Section';\n" +
  "import type { BlogArticle } from '../types';",
  'BlogPostPage'
);

console.log("Extraction 2 complete!");
