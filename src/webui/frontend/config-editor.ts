/**
 * WebUI Config Editor Component
 * 
 * Manages configuration sections, fields, validation, and rendering.
 */

import type { ConfigField, ConfigSection } from './types.js';

export class ConfigEditorComponent {
  public sections: ConfigSection[] = [];
  private validationErrors: Map<string, string[]> = new Map();

  // ── Section Management ─────────────────────────────────────────────────────

  addSection(section: ConfigSection): void {
    if (!this.sections.find((s) => s.name === section.name)) {
      this.sections.push(section);
    }
  }

  removeSection(name: string): boolean {
    const index = this.sections.findIndex((s) => s.name === name);
    if (index === -1) return false;
    this.sections.splice(index, 1);
    this.validationErrors.delete(name);
    return true;
  }

  // ── Field Management ───────────────────────────────────────────────────────

  addField(sectionName: string, field: ConfigField): void {
    const section = this.sections.find((s) => s.name === sectionName);
    if (!section) {
      this.addSection({ name: sectionName, fields: [] });
    }
    const existing = this.sections.find((s) => s.name === sectionName);
    if (existing) {
      existing.fields.push(field);
    }
  }

  // ── Value Management ───────────────────────────────────────────────────────

  getFieldValue(sectionName: string, fieldKey: string): string | number | boolean | null {
    const section = this.sections.find((s) => s.name === sectionName);
    if (!section) return null;
    const field = section.fields.find((f) => f.key === fieldKey);
    if (!field) return null;
    return field.value;
  }

  setFieldValue(sectionName: string, fieldKey: string, value: string | number | boolean): boolean {
    const section = this.sections.find((s) => s.name === sectionName);
    if (!section) return false;
    const field = section.fields.find((f) => f.key === fieldKey);
    if (!field) return false;
    field.value = value;
    return true;
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  validateSection(sectionName: string): boolean {
    const section = this.sections.find((s) => s.name === sectionName);
    const errors: string[] = [];

    if (!section) {
      this.validationErrors.set(sectionName, ['Section not found']);
      return false;
    }

    for (const field of section.fields) {
      if (field.required && (field.value === '' || field.value === null || field.value === undefined)) {
        errors.push(`Field "${field.label}" is required`);
      }
    }

    this.validationErrors.set(sectionName, errors);
    return errors.length === 0;
  }

  getValidationErrors(sectionName: string): string[] {
    return this.validationErrors.get(sectionName) ?? [];
  }

  // ── Export/Import ──────────────────────────────────────────────────────────

  exportConfig(): string {
    return JSON.stringify(this.sections, null, 2);
  }

  importConfig(json: string): boolean {
    try {
      const data = JSON.parse(json) as ConfigSection[];
      this.sections = data;
      this.validationErrors.clear();
      return true;
    } catch {
      return false;
    }
  }

  getConfig(): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    for (const section of this.sections) {
      config[section.name] = {};
      for (const field of section.fields) {
        (config[section.name] as Record<string, unknown>)[field.key] = field.value;
      }
    }
    return config;
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.sections = [];
    this.validationErrors.clear();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  render(): string {
    if (this.sections.length === 0) {
      return `<div class="config-editor">
        <h2>Configuration</h2>
        <div class="empty-state">No configuration</div>
      </div>`;
    }

    const sectionsHtml = this.sections
      .map((section) => {
        const errors = this.getValidationErrors(section.name);
        const fieldsHtml = section.fields
          .map((field) => {
            const hasError = errors.some((e) => e.includes(field.label));
            return this.renderField(field, hasError);
          })
          .join('\n');

        return `<section class="config-section">
          <h3>${section.name}</h3>
          ${fieldsHtml}
          ${errors.length > 0 ? `<div class="error">${errors.join(', ')}</div>` : ''}
        </section>`;
      })
      .join('\n');

    return `<div class="config-editor">
      <h2>Configuration</h2>
      ${sectionsHtml}
    </div>`;
  }

  private renderField(field: ConfigField, hasError: boolean): string {
    const errorClass = hasError ? ' error' : '';

    switch (field.type) {
      case 'text':
      case 'secret':
        return `<div class="config-field${errorClass}">
          <label for="${field.key}">${field.label}</label>
          <input type="${field.type === 'secret' ? 'password' : 'text'}" id="${field.key}" value="${field.value}" />
          ${field.description ? `<small>${field.description}</small>` : ''}
        </div>`;

      case 'number':
        return `<div class="config-field${errorClass}">
          <label for="${field.key}">${field.label}</label>
          <input type="number" id="${field.key}" value="${field.value}" />
          ${field.description ? `<small>${field.description}</small>` : ''}
        </div>`;

      case 'boolean':
        return `<div class="config-field${errorClass}">
          <label for="${field.key}">${field.label}</label>
          <input type="checkbox" id="${field.key}" ${field.value ? 'checked' : ''} />
          ${field.description ? `<small>${field.description}</small>` : ''}
        </div>`;

      case 'select':
        const optionsHtml = (field.options ?? [])
          .map((opt) => `<option value="${opt}" ${opt === field.value ? 'selected' : ''}>${opt}</option>`)
          .join('\n');
        return `<div class="config-field${errorClass}">
          <label for="${field.key}">${field.label}</label>
          <select id="${field.key}">${optionsHtml}</select>
          ${field.description ? `<small>${field.description}</small>` : ''}
        </div>`;

      default:
        return `<div class="config-field${errorClass}">
          <label for="${field.key}">${field.label}</label>
          <input type="text" id="${field.key}" value="${field.value}" />
        </div>`;
    }
  }
}
