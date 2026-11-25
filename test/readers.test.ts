import { describe, expect, it } from "vitest";
import { parseDecorated, parseDrizzle, parseMongoose, parseSequelize } from "../src/readers/javascript.js";
import { parseDjango, parseSqlAlchemy } from "../src/readers/python.js";
import { parseLaravel, parseRails } from "../src/readers/migrations.js";
import { parseEntityFramework, parseGorm, parseJpa } from "../src/readers/typed.js";
import { parseOpenApi } from "../src/readers/openapi.js";
import type { Field } from "../src/schema.js";

const refs = (fields: Field[]) => fields.map((f) => f.ref);
const one = (fields: Field[], ref: string) => fields.find((f) => f.ref === ref);

describe("Drizzle", () => {
  const source = `import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: integer("id").primaryKey(),
  emailAddress: text("email_address").notNull(), // reached by email
  // @personal: what the person writes about themself
  bio: text("bio"),
  ...timestamps,
});
export const posts = sqliteTable('posts', (t) => ({
  title: t.text(),
  note: t.text(), // @not-personal
}));`;
  const fields = parseDrizzle([{ file: "src/db/schema.ts", source }]);

  it("reads each table's columns as the code names them, with their line", () => {
    expect(refs(fields)).toEqual(["users.id", "users.emailAddress", "users.bio", "posts.title", "posts.note"]);
    expect(one(fields, "users.emailAddress")).toMatchObject({ type: "text", file: "src/db/schema.ts", line: 4 });
  });

  it("reads @personal and @not-personal from the comments", () => {
    expect(one(fields, "users.bio")?.marked).toBe(true);
    expect(one(fields, "posts.note")?.marked).toBe(false);
    expect(one(fields, "users.emailAddress")?.marked).toBeUndefined();
  });
});

describe("TypeORM, MikroORM, sequelize-typescript, NestJS", () => {
  it("reads the decorated properties of an entity, and leaves relations, methods and statics out", () => {
    const source = `import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany } from "typeorm";
@Entity({ name: "customers" })
export class Customer {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  /** @personal */
  @Column("text", { nullable: true })
  notes?: string | null;

  @ManyToOne(() => Company, (c) => c.customers)
  company!: Company;

  @OneToMany(() => Order, (o) => o.customer)
  orders!: Order[];

  static table = "customers";

  fullName(): string { return \`\${this.first} \${this.last}\`; }
}`;
    const fields = parseDecorated([{ file: "customer.entity.ts", source }]);
    expect(refs(fields)).toEqual(["Customer.id", "Customer.email", "Customer.notes"]);
    expect(one(fields, "Customer.email")).toMatchObject({ type: "string", line: 8 });
    expect(one(fields, "Customer.notes")?.marked).toBe(true);
  });

  it("reads MikroORM's @Property, sequelize-typescript's bare @Column, NestJS's @Prop without ref", () => {
    const mikro = parseDecorated([{ file: "a.ts", source: `@Entity()\nexport class User {\n  @PrimaryKey() id!: number;\n  @Property() phone?: string;\n}` }]);
    expect(refs(mikro)).toEqual(["User.id", "User.phone"]);
    const st = parseDecorated([{ file: "b.ts", source: `@Table\nexport class Member extends Model {\n  @Column\n  name!: string;\n  @BelongsTo(() => Team)\n  team!: Team;\n}` }]);
    expect(refs(st)).toEqual(["Member.name"]);
    const nest = parseDecorated([{ file: "c.ts", source: `@Schema()\nexport class Cat {\n  @Prop({ required: true }) name: string;\n  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: "Owner" }) owner: Owner;\n}` }]);
    expect(refs(nest)).toEqual(["Cat.name"]);
  });
});

describe("Mongoose", () => {
  it("reads a schema's paths, nested ones as address.city, and leaves references out", () => {
    const source = `const userSchema = new Schema<IUser>({
  email: { type: String, required: true },
  name: String,
  tags: [String],
  address: {
    street: String,
    city: { type: String }, // @personal
  },
  team: { type: Schema.Types.ObjectId, ref: "Team" },
  logins: [{ at: Date, ip: String }],
});
export const User = mongoose.model("Account", userSchema);`;
    const fields = parseMongoose([{ file: "models/user.js", source }]);
    expect(refs(fields)).toEqual(["Account.email", "Account.name", "Account.tags", "Account.address.street", "Account.address.city", "Account.logins.at", "Account.logins.ip"]);
    expect(one(fields, "Account.email")).toMatchObject({ type: "String", line: 2 });
    expect(one(fields, "Account.address.city")?.marked).toBe(true);
  });

  it("names the model after its variable when no model() call names it", () => {
    expect(refs(parseMongoose([{ file: "a.js", source: "const visitSchema = new mongoose.Schema({ ip: String });" }]))).toEqual(["Visit.ip"]);
  });
});

describe("Sequelize", () => {
  it("reads define() and init() models", () => {
    const source = `const User = sequelize.define("User", {
  email: { type: DataTypes.STRING, allowNull: false },
  birthDate: DataTypes.DATEONLY, // @personal
  full: { type: DataTypes.VIRTUAL, get() { return 1; } },
});
class Visit extends Model {}
Visit.init({ ip: DataTypes.STRING }, { sequelize });`;
    const fields = parseSequelize([{ file: "models.js", source }]);
    expect(refs(fields)).toEqual(["User.email", "User.birthDate", "Visit.ip"]);
    expect(one(fields, "User.birthDate")).toMatchObject({ type: "DATEONLY", marked: true, line: 3 });
  });

  it("follows migrations in order, ignoring down()", () => {
    const fields = parseSequelize([
      { file: "migrations/001-users.js", source: `module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Users", { id: { type: Sequelize.INTEGER }, email: { type: Sequelize.STRING } });
  },
  async down(queryInterface) { await queryInterface.dropTable("Users"); },
};` },
      { file: "migrations/002-phone.js", source: `module.exports = {
  up: async (queryInterface, Sequelize) => { await queryInterface.addColumn("Users", "phone", { type: Sequelize.STRING }); },
  down: async (queryInterface) => { await queryInterface.removeColumn("Users", "phone"); },
};` },
    ]);
    expect(refs(fields)).toEqual(["Users.id", "Users.email", "Users.phone"]);
  });
});

describe("Django", () => {
  it("reads model fields, leaves relations out, and adds what AbstractUser brings", () => {
    const source = `from django.db import models
from django.contrib.auth.models import AbstractUser

class Member(AbstractUser):
    # @personal: the member's own words
    bio = models.TextField(blank=True)
    phone = PhoneNumberField(
        blank=True,
    )
    team = models.ForeignKey("Team", on_delete=models.CASCADE)

    class Meta:
        ordering = ["username"]

    def __str__(self):
        name = models.CharField()  # not a field: inside a method
        return self.username

class Order(models.Model):
    total = models.DecimalField(max_digits=8, decimal_places=2)
    notes = models.TextField()  # @not-personal
`;
    const fields = parseDjango([{ file: "app/models.py", source }]);
    expect(refs(fields)).toEqual(["Member.bio", "Member.phone", "Member.username", "Member.first_name", "Member.last_name", "Member.email", "Member.password", "Member.last_login", "Member.date_joined", "Order.total", "Order.notes"]);
    expect(one(fields, "Member.bio")).toMatchObject({ type: "TextField", marked: true, line: 6 });
    expect(one(fields, "Member.email")).toMatchObject({ type: "AbstractUser field", line: 4 });
    expect(one(fields, "Order.notes")?.marked).toBe(false);
  });
});

describe("SQLAlchemy and SQLModel", () => {
  it("reads Column, mapped_column and bare Mapped annotations, and leaves relationship() out", () => {
    const source = `from sqlalchemy import Column, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    nickname: Mapped[Optional[str]]
    phone = Column(String(20))  # @personal
    posts: Mapped[List["Post"]] = relationship(back_populates="author")

audit = Table(
    "audit",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("ip", String),
)
`;
    const fields = parseSqlAlchemy([{ file: "models.py", source }]);
    expect(refs(fields)).toEqual(["User.id", "User.email", "User.nickname", "User.phone", "audit.id", "audit.ip"]);
    expect(one(fields, "User.email")).toMatchObject({ type: "String", line: 7 });
    expect(one(fields, "User.nickname")?.type).toBe("str");
    expect(one(fields, "User.phone")?.marked).toBe(true);
    expect(one(fields, "audit.ip")).toMatchObject({ type: "String", line: 16 });
  });

  it("reads Flask-SQLAlchemy's db.Column and SQLModel tables", () => {
    expect(refs(parseSqlAlchemy([{ file: "a.py", source: "class Client(db.Model):\n    id = db.Column(db.Integer, primary_key=True)\n    email = db.Column(db.String(120))\n" }]))).toEqual(["Client.id", "Client.email"]);
    const sqlModel = parseSqlAlchemy([{ file: "b.py", source: "class Hero(SQLModel, table=True):\n    id: int | None = Field(default=None, primary_key=True)\n    secret_name: str\n    team: Team | None = Relationship(back_populates=\"heroes\")\n\nclass HeroRead(SQLModel):\n    name: str\n" }]);
    expect(refs(sqlModel)).toEqual(["Hero.id", "Hero.secret_name"]);
  });
});

describe("Rails", () => {
  it("reads db/schema.rb, leaving indexes, timestamps and references out", () => {
    const source = `ActiveRecord::Schema[7.1].define(version: 2026_11_01_000000) do
  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "first_name", "last_name"
    t.date "birth_date", comment: "@personal"
    t.references "company", foreign_key: true
    t.timestamps
    t.index ["email"], name: "index_users_on_email", unique: true
  end
end`;
    const fields = parseRails([{ file: "db/schema.rb", source }]);
    expect(refs(fields)).toEqual(["users.email", "users.first_name", "users.last_name", "users.birth_date"]);
    expect(one(fields, "users.email")).toMatchObject({ type: "string", line: 3 });
    expect(one(fields, "users.birth_date")?.marked).toBe(true);
  });

  it("follows migrations in order, skipping def down", () => {
    const fields = parseRails([
      { file: "db/migrate/20260101_create_people.rb", source: "class CreatePeople < ActiveRecord::Migration[7.1]\n  def change\n    create_table :people do |t|\n      t.string :name\n      t.string :fax\n    end\n  end\nend\n" },
      { file: "db/migrate/20260201_more.rb", source: "class More < ActiveRecord::Migration[7.1]\n  def up\n    add_column :people, :phone, :string\n    remove_column :people, :fax\n    rename_column :people, :name, :full_name\n  end\n\n  def down\n    remove_column :people, :phone\n  end\nend\n" },
    ]);
    expect(refs(fields)).toEqual(["people.full_name", "people.phone"]);
  });
});

describe("Laravel", () => {
  it("reads up() of each migration in order: columns, drops and renames, never down()", () => {
    const fields = parseLaravel([
      { file: "database/migrations/2026_01_01_000000_create_users_table.php", source: `<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('fax')->nullable();
            $table->text('bio')->nullable(); // @personal
            $table->foreignId('team_id')->constrained();
            $table->ipAddress();
            $table->rememberToken();
            $table->timestamps();
            $table->index(['email', 'team_id']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};` },
      { file: "database/migrations/2026_02_01_000000_alter_users.php", source: `<?php
return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('fax');
            $table->renameColumn('bio', 'about');
            $table->date('birth_date')->nullable();
        });
    }
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) { $table->dropColumn('birth_date'); });
    }
};` },
    ]);
    // A renamed column keeps its place: about is where bio was.
    expect(refs(fields)).toEqual(["users.id", "users.email", "users.about", "users.team_id", "users.ip_address", "users.remember_token", "users.birth_date"]);
    expect(one(fields, "users.email")).toMatchObject({ type: "string", line: 7, file: "database/migrations/2026_01_01_000000_create_users_table.php" });
    expect(one(fields, "users.about")?.marked).toBe(true);
  });
});

describe("Entity Framework", () => {
  it("reads the context's entities and their base classes, leaving navigation and [NotMapped] properties out", () => {
    const fields = parseEntityFramework([
      { file: "Data/AppDbContext.cs", source: "public class AppDbContext : IdentityDbContext<AppUser>\n{\n    public DbSet<Customer> Customers => Set<Customer>();\n    public DbSet<Order> Orders { get; set; } = null!;\n}" },
      { file: "Models/Customer.cs", source: `namespace Shop.Models;

public abstract class Entity
{
    public int Id { get; set; }
}

public class Customer : Entity
{
    [Required, MaxLength(200)]
    public string Email { get; set; } = "";

    // @personal
    public string? Notes { get; init; }

    [NotMapped]
    public string Display => Email;

    public ICollection<Order> Orders { get; set; } = new List<Order>();

    public static int Count { get; set; }

    private string Secret { get; set; } = "";
}

public class Order : Entity
{
    public decimal Total { get; set; }
    public Customer Customer { get; set; } = null!;
}

public class AppUser : IdentityUser { public string? Nickname { get; set; } }

public class Unrelated { public string Email { get; set; } = ""; }` },
    ]);
    expect(refs(fields)).toEqual(["Entity.Id", "Customer.Email", "Customer.Notes", "Order.Total", "AppUser.Nickname", "AppUser.UserName", "AppUser.NormalizedUserName", "AppUser.Email", "AppUser.NormalizedEmail", "AppUser.PhoneNumber", "AppUser.PasswordHash"]);
    expect(one(fields, "Customer.Email")).toMatchObject({ type: "string", line: 10 });
    expect(one(fields, "Customer.Notes")?.marked).toBe(true);
  });
});

describe("JPA and Hibernate", () => {
  it("reads a Java entity's fields, leaving relations, statics and @Transient out", () => {
    const source = `package shop;

@Entity
@Table(name = "customers")
public class Customer {
    @Id @GeneratedValue
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    /** @personal */
    private LocalDate birthDate;

    private Map<String, String> preferences = new HashMap<>();

    @OneToMany(mappedBy = "customer")
    private List<Order> orders;

    @Transient
    private String display;

    private static final long serialVersionUID = 1L;

    public String getEmail() { return email; }
}`;
    const fields = parseJpa([{ file: "src/main/java/shop/Customer.java", source }]);
    expect(refs(fields)).toEqual(["Customer.id", "Customer.email", "Customer.birthDate", "Customer.preferences"]);
    expect(one(fields, "Customer.email")).toMatchObject({ type: "String", line: 9 });
    expect(one(fields, "Customer.birthDate")?.marked).toBe(true);
    expect(one(fields, "Customer.preferences")?.type).toBe("Map<String, String>");
  });

  it("reads a Kotlin entity's constructor and body properties", () => {
    const source = `@Entity
class Patient(
    @Id val id: Long = 0,
    @Column(nullable = false) val email: String,
    val healthCard: String?, // @personal
    @ManyToOne val clinic: Clinic,
) {
    @field:Column
    var phone: String? = null

    fun label() = email
}`;
    const fields = parseJpa([{ file: "Patient.kt", source }]);
    expect(refs(fields)).toEqual(["Patient.id", "Patient.email", "Patient.healthCard", "Patient.phone"]);
    expect(one(fields, "Patient.healthCard")).toMatchObject({ type: "String?", marked: true, line: 5 });
  });
});

describe("GORM", () => {
  it("reads the models' exported fields, leaving embedded structs, relations and gorm:\"-\" out", () => {
    const source = `package models

type User struct {
\tgorm.Model
\tEmail    string \`gorm:"uniqueIndex"\`
\t// @personal
\tBio      string
\tFirst, Last string
\tCompany  Company \`gorm:"foreignKey:CompanyID"\`
\tCompanyID uint
\tOrders   []Order
\tCache    string \`gorm:"-"\`
\tinternal string
}

type Company struct {
\tID   uint
\tName string \`gorm:"size:100"\`
}

type Order struct {
\tID uint
}

type NotAModel struct {
\tEmail string
}

func main() { db.AutoMigrate(&User{}, &Company{}, &Order{}) }`;
    const fields = parseGorm([{ file: "models/user.go", source }]);
    expect(refs(fields)).toEqual(["User.Email", "User.Bio", "User.First", "User.Last", "User.CompanyID", "Company.ID", "Company.Name", "Order.ID"]);
    expect(one(fields, "User.Email")).toMatchObject({ type: "string", line: 5 });
    expect(one(fields, "User.Bio")?.marked).toBe(true);
  });
});

describe("OpenAPI and JSON Schema", () => {
  it("reads an OpenAPI YAML file's schemas, nested objects as address.city, x-personal as a marker", () => {
    const source = `openapi: 3.1.0
info:
  title: Shop
paths: {}
components:
  schemas:
    Customer:
      type: object
      required: [email]
      properties:
        email:
          type: string
          format: email
        notes:
          type: string
          x-personal: true # free text
        address:
          type: object
          properties:
            city: { type: string }
        orders:
          type: array
          items:
            $ref: "#/components/schemas/Order"
    Order:
      allOf:
        - $ref: "#/components/schemas/Base"
        - type: object
          properties:
            total:
              type: number
`;
    const fields = parseOpenApi([{ file: "openapi.yaml", source }]);
    expect(refs(fields)).toEqual(["Customer.email", "Customer.notes", "Customer.address.city", "Customer.orders", "Order.total"]);
    expect(one(fields, "Customer.email")).toMatchObject({ type: "string", line: 11 });
    expect(one(fields, "Customer.notes")?.marked).toBe(true);
    expect(one(fields, "Customer.address.city")).toMatchObject({ type: "string", line: 20 });
    expect(one(fields, "Customer.orders")?.type).toBe("object[]");
  });

  it("reads a JSON Schema file: the root and its $defs, with lines", () => {
    const source = JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", title: "Signup form", type: "object", properties: { email: { type: "string" }, consent: { type: "boolean", "x-personal": false } }, $defs: { Phone: { type: "object", properties: { number: { type: "string" } } } } }, null, 2);
    const fields = parseOpenApi([{ file: "schemas/signup.schema.json", source }]);
    expect(refs(fields)).toEqual(["Signupform.email", "Signupform.consent", "Phone.number"]);
    expect(one(fields, "Signupform.email")?.line).toBe(6);
    expect(one(fields, "Signupform.consent")?.marked).toBe(false);
  });
});

describe("Windows line endings", () => {
  it("reads every stack the same with CRLF", () => {
    const crlf = (s: string) => s.replace(/\n/g, "\r\n");
    const django = "from django.db import models\nclass A(models.Model):\n    email = models.EmailField()\n";
    expect(refs(parseDjango([{ file: "a.py", source: crlf(django) }]))).toEqual(["A.email"]);
    const rails = 'create_table "a" do |t|\n  t.string "email"\nend\n';
    expect(refs(parseRails([{ file: "db/schema.rb", source: crlf(rails) }]))).toEqual(["a.email"]);
    const go = "type A struct {\n\tgorm.Model\n\tEmail string\n}\n";
    expect(refs(parseGorm([{ file: "a.go", source: crlf(go) }]))).toEqual(["A.Email"]);
    const yaml = "openapi: 3.0.0\ncomponents:\n  schemas:\n    A:\n      properties:\n        email:\n          type: string\n";
    expect(refs(parseOpenApi([{ file: "openapi.yml", source: crlf(yaml) }]))).toEqual(["A.email"]);
  });
});
