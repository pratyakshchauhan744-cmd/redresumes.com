export const getEmailHref = (email: string): string => `mailto:${email.trim()}`;

export const getWebsiteHref = (url: string): string => {
  const value = url.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
};
