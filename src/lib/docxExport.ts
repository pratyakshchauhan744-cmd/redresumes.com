import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import type { TemplateResumeData } from '../types';

export const generateResumeDocx = async (data: TemplateResumeData) => {
  const children: Paragraph[] = [];

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
      
      const bullets = exp.bullets.split('\n').map(b => b.replace(/^-/, '').trim()).filter(Boolean);
      addBulletList(bullets);
    });
  } else if (data.bullets && data.bullets.length > 0) {
    // Fallback for simple bullets
    addHeading('Experience');
    addBulletList(data.bullets);
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
    addBulletList(data.projects);
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
    addBulletList(data.achievements);
  }

  // Volunteer
  if (data.volunteer && data.volunteer.length > 0) {
    addHeading('Volunteer');
    addBulletList(data.volunteer);
  }

  // Custom Columns
  if (data.customColumns && data.customColumns.length > 0) {
    data.customColumns.forEach((col) => {
      if (!col.title && !col.content) return;
      if (col.title) addHeading(col.title);
      if (col.content) {
        const points = col.content.split('\n').map(b => b.replace(/^-/, '').trim()).filter(Boolean);
        addBulletList(points);
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
