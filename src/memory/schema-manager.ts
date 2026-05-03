/**
 * Schema Manager — validates memory entries against registered schemas
 */

import type {
  Schema,
  SchemaFieldType,
  SchemaValidationResult,
  SchemaManagerService,
} from './types.js';

export class SchemaManagerImpl implements SchemaManagerService {
  private readonly schemas: Map<string, Schema> = new Map();

  /**
   * Register a new schema.
   */
  registerSchema(schema: Schema): void {
    this.schemas.set(schema.name, schema);
  }

  /**
   * Get a schema by name.
   */
  getSchema(name: string): Schema | null {
    return this.schemas.get(name) ?? null;
  }

  /**
   * List all registered schemas.
   */
  listSchemas(): Schema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Validate an entry against a schema.
   */
  validate(entry: Record<string, unknown>, schemaName: string): SchemaValidationResult {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      return {
        valid: false,
        errors: [`Schema '${schemaName}' not found`],
      };
    }

    const errors: string[] = [];

    // Check required fields
    for (const field of schema.requiredFields) {
      const schemaField = schema.fields.find((f) => f.name === field);
      if (!schemaField) {
        errors.push(`Required field '${field}' not defined in schema`);
        continue;
      }

      if (!(field in entry) || entry[field] === undefined || entry[field] === null) {
        errors.push(`Missing required field: '${field}'`);
      }
    }

    // Validate field types
    for (const field of schema.fields) {
      if (!(field.name in entry)) continue;

      const value = entry[field.name];
      if (value === undefined || value === null) continue;

      if (!this.checkFieldType(value, field.type)) {
        errors.push(
          `Field '${field.name}' expected type '${field.type}', got '${typeof value}'`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a typed entry with defaults applied.
   */
  createTypedEntry(
    schemaName: string,
    data: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const schema = this.schemas.get(schemaName);
    if (!schema) return null;

    // Apply defaults
    const entry: Record<string, unknown> = {};
    for (const field of schema.fields) {
      if (field.name in data) {
        entry[field.name] = data[field.name];
      } else if (field.defaultValue !== undefined) {
        entry[field.name] = field.defaultValue;
      }
    }

    // Validate
    const result = this.validate(entry, schemaName);
    if (!result.valid) return null;

    return entry;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private checkFieldType(value: unknown, expectedType: SchemaFieldType): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !Number.isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
}
