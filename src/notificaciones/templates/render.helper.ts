import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

const cache = new Map<string, HandlebarsTemplateDelegate>();

export function registerHelpers(): void {
  Handlebars.registerHelper('formatDate', (date: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-CO');
  });

  Handlebars.registerHelper('formatCurrency', (amount: number) => {
    if (!amount) return '$0';
    return `$${amount.toLocaleString('es-CO')}`;
  });

  Handlebars.registerHelper('currentYear', () => {
    return new Date().getFullYear().toString();
  });
}

export function renderTemplate(templateName: string, context: object): string {
  if (!cache.has(templateName)) {
    const templatePath = path.join(__dirname, `${templateName}.hbs`);
    const content = fs.readFileSync(templatePath, 'utf-8');
    cache.set(templateName, Handlebars.compile(content));
  }

  const compiled = cache.get(templateName);
  if (!compiled) {
    throw new Error(`Template ${templateName} not found in cache`);
  }

  return compiled(context);
}
