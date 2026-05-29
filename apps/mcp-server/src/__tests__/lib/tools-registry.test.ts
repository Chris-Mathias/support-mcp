import { describe, it, expect } from "vitest";
import { buildOpenAiToolDefinitions } from "../../tools-registry.js";

describe("buildOpenAiToolDefinitions", () => {
  const defs = buildOpenAiToolDefinitions({});

  it("retorna ao menos uma tool", () => {
    expect(defs.length).toBeGreaterThan(0);
  });

  for (const def of defs) {
    describe(`tool: ${def.name}`, () => {
      it("tem type, name, description, parameters e strict: true", () => {
        expect(def.type).toBe("function");
        expect(typeof def.name).toBe("string");
        expect(typeof def.description).toBe("string");
        expect(def.strict).toBe(true);
        expect(def.parameters).toBeDefined();
      });

      it("parameters não contém $schema", () => {
        expect(def.parameters).not.toHaveProperty("$schema");
      });

      it("parameters tem additionalProperties: false", () => {
        expect(
          (def.parameters as Record<string, unknown>).additionalProperties,
        ).toBe(false);
      });

      it("todos os campos de properties estão em required", () => {
        const params = def.parameters as {
          properties?: Record<string, unknown>;
          required?: string[];
        };
        const keys = Object.keys(params.properties ?? {});
        if (keys.length > 0) {
          expect(params.required).toBeDefined();
          for (const key of keys) {
            expect(params.required).toContain(key);
          }
        }
      });
    });
  }
});
