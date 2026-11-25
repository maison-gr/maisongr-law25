import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { describe as describeSchema, findSchema } from "../src/load.js";

const roots: string[] = [];
/** A throwaway project with these files. */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "law25-"));
  roots.push(root);
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  }
  return root;
}
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });

const DJANGO = "from django.db import models\n\nclass Customer(models.Model):\n    email = models.EmailField()\n";
const DRIZZLE = 'import { pgTable, text } from "drizzle-orm/pg-core";\nexport const users = pgTable("users", { email: text("email") });\n';

describe("finding the schema", () => {
  it("reads a Django project's models, never its tests or its dependencies", () => {
    const root = project({
      "shop/models.py": DJANGO,
      "shop/tests/test_models.py": "from django.db import models\nclass Fake(models.Model):\n    ssn = models.CharField()\n",
      "shop/test_views.py": "from django.db import models\nclass Fake2(models.Model):\n    ssn = models.CharField()\n",
      ".venv/lib/django/contrib/auth/models.py": "from django.db import models\nclass User(models.Model):\n    email = models.EmailField()\n",
    });
    const s = findSchema(root)!;
    expect(s).toMatchObject({ kind: "django", stacks: ["django"], files: ["shop/models.py"] });
    expect(s.fields.map((f) => f.ref)).toEqual(["Customer.email"]);
    expect(describeSchema(s)).toBe("the Django models (shop/models.py)");
  });

  it("prefers the ORM's models to the SQL migrations it generated", () => {
    const root = project({ "src/db/schema.ts": DRIZZLE, "migrations/0000_init.sql": "create table users (email text, extra text);" });
    expect(findSchema(root)).toMatchObject({ kind: "drizzle", files: ["src/db/schema.ts"] });
  });

  it("keeps the Prisma schema first, as before", () => {
    const root = project({ "prisma/schema.prisma": "model User {\n  id String @id\n  email String\n}\n", "src/db/schema.ts": DRIZZLE });
    expect(findSchema(root)).toMatchObject({ kind: "prisma", files: ["prisma/schema.prisma"] });
    // The CLI always passes a list of --schema paths, empty when none was given.
    expect(findSchema(root, { schema: [] })).toMatchObject({ kind: "prisma" });
  });

  it("reads every ORM a project uses, together", () => {
    const root = project({
      "api/models.py": DJANGO,
      "web/db.ts": DRIZZLE,
      "db/schema.rb": 'ActiveRecord::Schema.define do\n  create_table "visits" do |t|\n    t.string "ip"\n  end\nend\n',
    });
    const s = findSchema(root)!;
    expect(s.kind).toBe("mixed");
    expect(s.stacks).toEqual(["drizzle", "django", "rails"]);
    expect(s.fields.map((f) => f.ref)).toEqual(["users.email", "Customer.email", "visits.ip"]);
    expect(describeSchema(s)).toBe("the Drizzle tables, the Django models and the Rails schema (3 files)");
  });

  it("falls back to SQL migrations, then to an OpenAPI file", () => {
    expect(findSchema(project({ "supabase/migrations/001.sql": "create table t (email text);" }))).toMatchObject({ kind: "sql" });
    const api = project({ "docs/openapi.yaml": "openapi: 3.1.0\ncomponents:\n  schemas:\n    Lead:\n      properties:\n        phone:\n          type: string\n" });
    expect(findSchema(api)).toMatchObject({ kind: "openapi", files: ["docs/openapi.yaml"] });
    expect(findSchema(project({ "README.md": "# nothing here" }))).toBeNull();
  });

  it("reads the paths given with --schema, telling the stack from them or as --stack says", () => {
    const root = project({
      "backend/src/main/java/shop/Customer.java": "@Entity\npublic class Customer {\n    @Id private Long id;\n    private String email;\n}\n",
      "backend/src/main/java/shop/Other.java": "public class Other { private String phone; }\n",
      "contracts/signup.json": JSON.stringify({ type: "object", properties: { email: { type: "string" } } }),
    });
    expect(findSchema(root, { schema: ["backend"] })).toMatchObject({ kind: "jpa", files: ["backend/src/main/java/shop/Customer.java"] });
    // A JSON Schema with no "$schema" key isn't recognised by itself: --stack says what it is.
    expect(() => findSchema(root, { schema: ["contracts/signup.json"] })).toThrow(/no schema found in contracts\/signup.json: pass --stack/);
    expect(findSchema(root, { schema: ["contracts/signup.json"], stack: "openapi" })!.fields.map((f) => f.ref)).toEqual(["signup.email"]);
    expect(() => findSchema(root, { schema: ["missing"] })).toThrow(/missing does not exist/);
  });
});
