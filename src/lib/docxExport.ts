import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import type { TemplateResumeData } from '../types';

const getEffectiveListStyle = (text: string, globalStyle: string): 'bullet' | 'number' | 'paragraph' => {
  if (!text) return 'paragraph';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'paragraph';

  const listMarkerRegex = /^\s*(?:[-*•]|\d+[.)])/;
  const hasAnyListMarker = lines.some(line => listMarkerRegex.test(line));
  
  if (!hasAnyListMarker) {
    return 'paragraph';
  }

  const numberMarkerRegex = /^\s*\d+[.)]/;
  const hasNumberMarker = lines.some(line => numberMarkerRegex.test(line));
  if (hasNumberMarker) {
    return 'number';
  }

  return (globalStyle === 'number' || globalStyle === 'bullet') ? (globalStyle as 'number' | 'bullet') : 'bullet';
};

export const generateResumeDocx = async (data: TemplateResumeData) => {
  const children: Paragraph[] = [];
  const listStyle = data.listStyle === 'number' ? 'number' : data.listStyle === 'paragraph' ? 'paragraph' : 'bullet';
  const cleanListLine = (line: string) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();

  const addHeading = (text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_3) => {
    children.push(
      new Paragraph({
        text,
        heading: level,
        spacing: { before: 200, after: 100 },
      })
    );
  };

  const addBulletList = (items: string[]) => {
    items.filter(Boolean).forEach((item) => {
      children.push(
        new Paragraph({
          text: item,
          bullet: { level: 0 },
        })
      );
    });
  };

  const addList = (items: string[], styleOverride?: 'bullet' | 'number') => {
    const cleanedItems = items.map(cleanListLine).filter(Boolean);
    const activeStyle = styleOverride ?? listStyle;
    if (activeStyle === 'number') {
      cleanedItems.forEach((item, index) => {
        children.push(new Paragraph({ text: `${index + 1}. ${item}` }));
      });
      return;
    }

    addBulletList(cleanedItems);
  };

  // Header (Name and Contact Info)
  if (data.fullName) {
    children.push(
      new Paragraph({
        text: data.fullName,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 100 },
      })
    );
  }

  if (data.jobTitle) {
    children.push(
      new Paragraph({
        text: data.jobTitle,
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 100 },
      })
    );
  }

  const contactInfo = [data.email, data.phone, data.location, data.profileLink].filter(Boolean).join(' | ');
  if (contactInfo) {
    children.push(
      new Paragraph({
        text: contactInfo,
        spacing: { after: 300 },
      })
    );
  }

  // Summary
  if (data.summary) {
    addHeading('Summary');
    children.push(
      new Paragraph({
        text: data.summary,
        spacing: { after: 200 },
      })
    );
  }

  // Experience
  if (data.experiences && data.experiences.length > 0) {
    addHeading('Experience');
    data.experiences.forEach((exp) => {
      if (!exp.title && !exp.dates && !exp.bullets) return;
      
      const titleDates = [exp.title, exp.dates].filter(Boolean).join(' | ');
      if (titleDates) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: titleDates, bold: true })
            ],
            spacing: { before: 100, after: 50 },
          })
        );
      }
      
      const itemStyle = getEffectiveListStyle(exp.bullets, listStyle);
      if (itemStyle === 'paragraph') {
        if (exp.bullets) {
          children.push(
            new Paragraph({
              text: exp.bullets,
              spacing: { after: 150 },
            })
          );
        }
      } else {
        const bullets = exp.bullets.split('\n').map(cleanListLine).filter(Boolean);
        addList(bullets, itemStyle === 'number' ? 'number' : 'bullet');
      }
    });
  } else if (data.bullets && data.bullets.length > 0) {
    // Fallback for simple bullets
    addHeading('Experience');
    addList(data.bullets);
  }

  // Education
  const educationItems = (data.educationItems?.length ? data.educationItems : [{
    degree: data.educationDegree,
    school: data.educationSchool,
    year: data.educationYear,
  }]).filter((item) => item.degree || item.school || item.year);

  if (educationItems.length > 0) {
    addHeading('Education');
    educationItems.forEach((item) => {
      const eduText = [item.degree, item.school, item.year].filter(Boolean).join(', ');
      children.push(new Paragraph({ text: eduText }));
    });
  }

  // Skills
  if (data.skills && data.skills.length > 0) {
    addHeading('Skills');
    children.push(new Paragraph({ text: data.skills.join(', ') }));
  }

  // Projects
  if (data.projects && data.projects.length > 0) {
    addHeading('Projects');
    if (data.projectsDisplay === 'paragraph') {
      children.push(new Paragraph({ text: data.projects.join('\n\n') }));
    } else {
      addList(data.projects);
    }
  }
  
  // Certifications
  if (data.certifications && data.certifications.length > 0) {
    addHeading('Certifications');
    children.push(new Paragraph({ text: data.certifications.join(', ') }));
  }

  // Languages
  if (data.languages && data.languages.length > 0) {
    addHeading('Languages');
    children.push(new Paragraph({ text: data.languages.join(', ') }));
  }

  // Hobbies
  if (data.hobbies && data.hobbies.length > 0) {
    addHeading('Hobbies');
    children.push(new Paragraph({ text: data.hobbies.join(', ') }));
  }

  // Achievements
  if (data.achievements && data.achievements.length > 0) {
    addHeading('Achievements');
    addList(data.achievements);
  }

  // Volunteer
  if (data.volunteer && data.volunteer.length > 0) {
    addHeading('Volunteer');
    addList(data.volunteer);
  }

  // Custom Columns
  if (data.customColumns && data.customColumns.length > 0) {
    data.customColumns.forEach((col) => {
      if (!col.title && !col.content) return;
      if (col.title) addHeading(col.title);
      if (col.content) {
        const points = col.content.split('\n').map(cleanListLine).filter(Boolean);
        addList(points);
      }
    });
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${data.fullName?.replace(/\s+/g, '_') || 'Resume'}.docx`);
};
