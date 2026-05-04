const fs = require('fs');
const path = require('path');

const srcCode = fs.readFileSync(path.join(__dirname, 'src/App.tsx'), 'utf8');
const lines = srcCode.split('\n');

function extractComponent(startLine, endLine, outputPath, imports, name, propsToRemove = []) {
  let content = lines.slice(startLine - 1, endLine).join('\n');
  
  // Basic modifications for routing
  content = content.replace(/onNavigate\('([^']+)'\)/g, "navigate('/$1')");
  content = content.replace(/onNavigate\(([^)]+)\)/g, "navigate(`/${$1}`)");
  
  // Specific replacements
  content = content.replace(/navigate\('\/home'\)/g, "navigate('/')");
  content = content.replace(/navigate\('\/builder'\)/g, "navigate('/builder')");
  
  if (content.includes('navigate(')) {
    imports += `\nimport { useNavigate } from 'react-router-dom';`;
    // Add useNavigate hook if it's a component block
    if (content.includes(`const ${name} = ({`)) {
      content = content.replace(`const ${name} = ({`, `export const ${name} = ({`);
      content = content.replace(/=> \{\n/, "=> {\n  const navigate = useNavigate();\n");
    } else if (content.includes(`const ${name} = () => {`)) {
      content = content.replace(`const ${name} = () => {`, `export const ${name} = () => {\n  const navigate = useNavigate();`);
    } else if (content.includes(`const ${name} = () => (`)) {
      content = content.replace(`const ${name} = () => (`, `export const ${name} = () => {\n  const navigate = useNavigate();\n  return (`);
      content = content.replace(/\);?\s*$/, ');\n};');
    } else if (content.includes(`const ${name} = ({`)) {
       // if it's a shorthand arrow function with props
       content = content.replace(`const ${name} = ({`, `export const ${name} = ({`);
       content = content.replace(/\) => \(/, ") => {\n  const navigate = useNavigate();\n  return (");
       content = content.replace(/\);?\s*$/, ');\n};');
    }
  } else {
     content = content.replace(`const ${name} =`, `export const ${name} =`);
  }

  // Strip removed props from signature
  propsToRemove.forEach(prop => {
    const propRegex = new RegExp(`${prop},?\\s*`, 'g');
    content = content.replace(propRegex, '');
    const typeRegex = new RegExp(`${prop}:\\s*[^;]+;\\s*`, 'g');
    content = content.replace(typeRegex, '');
  });

  fs.writeFileSync(path.join(__dirname, outputPath), imports + '\n\n' + content + '\n');
}

extractComponent(1830, 2193, 'src/pages/HomePage.tsx', 
  "import { CheckCircle, FileText, Sparkles, Layout, Download, Star } from 'lucide-react';\n" +
  "import { Section } from '../components/Section';\n" +
  "import { PrimaryButton, SecondaryButton } from '../components/Buttons';\n" +
  "import { TemplateCard } from '../components/TemplateCard';\n" +
  "import { TemplateResumePage } from '../components/TemplateResumePage';\n" +
  "import { templates } from '../data/templates';\n" +
  "import { premiumFeatures } from '../data/premiumFeatures';\n" +
  "import type { TemplateItem, Page } from '../types';",
  'HomePage',
  ['onNavigate']
);

extractComponent(4891, 4923, 'src/pages/CoverLetterPage.tsx', 
  "import { FileText, Wand2, Download } from 'lucide-react';\n" +
  "import { Section } from '../components/Section';\n" +
  "import { PrimaryButton } from '../components/Buttons';",
  'CoverLetterPage'
);

extractComponent(4924, 4952, 'src/pages/PricingPage.tsx', 
  "import { CheckCircle } from 'lucide-react';\n" +
  "import { Section } from '../components/Section';\n" +
  "import { PrimaryButton } from '../components/Buttons';",
  'PricingPage'
);

extractComponent(6516, 6539, 'src/pages/ContactPage.tsx', 
  "import { LifeBuoy, FileText, Sparkles } from 'lucide-react';\n" +
  "import { Section } from '../components/Section';\n" +
  "import { PrimaryButton } from '../components/Buttons';",
  'ContactPage'
);

extractComponent(6540, 6556, 'src/pages/LegalPage.tsx', 
  "import { Section } from '../components/Section';",
  'LegalPage'
);

extractComponent(6557, 6582, 'src/pages/AdminPage.tsx', 
  "import { Users, Layout, CreditCard, BookOpen, FileText, TrendingUp, LifeBuoy, Mail } from 'lucide-react';\n" +
  "import { Section } from '../components/Section';\n" +
  "import { TicketIcon } from '../components/TicketIcon';",
  'AdminPage'
);

console.log("Extraction complete!");
