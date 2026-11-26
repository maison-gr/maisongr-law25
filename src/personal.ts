// Which schema fields look like personal information, by name. A heuristic that errs towards asking: a field it flags
// is either listed in the assessment or explained in `notPersonal`, and a `@personal` / `@not-personal` comment in the
// schema always wins. Law 25 s. 2: personal information is any information that concerns a natural person and allows
// that person to be identified, directly or indirectly.

import type { Field } from "./schema.js";

/** Words that make a field personal on any table, with what they are. */
const ALWAYS: Record<string, string> = {
  email: "an email address",
  phone: "a phone number", mobile: "a phone number", telephone: "a phone number",
  address: "a postal or network address", street: "a postal address", postal: "a postal address", postcode: "a postal address", zip: "a postal address",
  birth: "a date of birth", birthday: "a date of birth", birthdate: "a date of birth", dob: "a date of birth",
  gender: "gender", sex: "sex", pronouns: "pronouns",
  ssn: "a government identifier", sin: "a social insurance number", nas: "a social insurance number", passport: "a passport number",
  ip: "an IP address", useragent: "a device's user agent",
  latitude: "a location", longitude: "a location", lat: "a location", lng: "a location", geo: "a location", geolocation: "a location",
  avatar: "a photo", photo: "a photo", selfie: "a photo", portrait: "a photo",
  salary: "financial information", income: "financial information", iban: "a bank account",
  mood: "a mood or emotional state (possibly health information)",
  health: "health information", medical: "health information", diagnosis: "health information", medication: "health information", symptom: "health information", symptoms: "health information",
  religion: "religious beliefs", ethnicity: "ethnic origin", race: "ethnic origin", sexuality: "sexual orientation",
  biometric: "biometric information", fingerprint: "biometric information", faceprint: "biometric information", voiceprint: "biometric information",
  signature: "a signature", surname: "a name", nickname: "a name", username: "a name",
  password: "a password or its hash", passwd: "a password or its hash",
  resume: "a résumé", cv: "a résumé",
  linkedin: "a social or professional profile", github: "a social or professional profile", twitter: "a social or professional profile", instagram: "a social or professional profile", facebook: "a social or professional profile",
  nationality: "nationality", citizenship: "nationality", immigration: "immigration status (sensitive)",
};

/** Two-word names: first name, last name… */
const PAIRS: Record<string, string> = {
  "first name": "a name", "last name": "a name", "full name": "a name", "given name": "a name", "family name": "a name",
  "display name": "a name", "maiden name": "a name", "middle name": "a name", "user name": "a name",
  "user agent": "a device's user agent", "ip address": "an IP address", "date of": "a date",
  "work authorization": "immigration status (sensitive)", "work permit": "immigration status (sensitive)", "visa status": "immigration status (sensitive)",
  "card number": "a payment card", "bank account": "a bank account", "account number": "a bank account",
  "cell phone": "a phone number", "driver licence": "a licence number", "driver license": "a licence number",
};

/** Tables about a person, where "name", "city" or "country" is that person's: people, and what one person submits about themself. */
const PERSON = /^(user|users|person|people|persons|customer|customers|member|members|contact|contacts|patient|patients|employee|employees|lead|leads|profile|profiles|client|clients|account|accounts|subscriber|subscribers|guest|guests|attendee|attendees|student|students|author|authors|applicant|applicants|candidate|candidates|partner|partners|visitor|visitors|application|applications|registration|registrations|signup|signups|enrollment|enrollments|enrolment|enrolments)$/i;
const ON_PERSON: Record<string, string> = { name: "a name", city: "a place of residence", country: "a country of residence", age: "an age", location: "a location" };

/** A role a person plays: "author_name", "reviewerName" is that person's name. */
const ROLE = new Set(["author", "reviewer", "owner", "sender", "recipient", "contact", "customer", "client", "user", "member", "patient", "guest", "parent", "guardian", "holder", "cardholder", "applicant", "candidate", "employee", "manager", "referee", "referrer", "signer", "buyer", "seller", "driver", "student", "teacher", "attendee", "speaker", "commenter", "requester", "assignee", "reporter", "emergency", "spouse", "child", "beneficiary", "billing", "shipping"]);

/**
 * The last word of a name that is about the information, not the information: email_type, scheduled_email_id,
 * emailDomain, isEmailVerified, emailVerificationTokenExpiresAt. A hash stays: a hashed email is still personal.
 */
const ABOUT = new Set(["id", "ids", "uuid", "type", "types", "kind", "status", "template", "count", "size", "domain", "provider", "at", "enabled", "verified", "sent", "token", "opened", "clicked", "bounced"]);

/** Free text, by its last word. On rows about a person, it can hold anything about them. */
const FREE_TEXT = new Set(["content", "message", "body", "text", "notes", "note", "comment", "comments", "description", "input", "response", "answer", "answers", "feedback", "bio", "about", "entry", "story", "reflection", "intention", "other", "letter", "messages", "transcript", "transcripts", "conversation", "conversations", "debrief", "chat"]);
/** Last words that are free text whatever comes before: employerNotes, coverLetter, negative_feedback, admin_note. */
const ALWAYS_FREE = new Set(["notes", "note", "letter", "message", "messages", "transcript", "transcripts", "conversation", "debrief", "comment", "comments", "feedback", "bio", "response", "answer", "answers", "reflection", "story"]);
/** A field that points to a person: the rows of its table belong to that person. */
const PERSON_LINK = /^(user|author|owner|profile|member|customer|patient|account|client|person|sender|requester|reporter|candidate|applicant)(_?id|Id)$/;
/** Tables that are themselves exchanges between people or about one: their free text is about or by a person. */
const EXCHANGE = new Set(["message", "messages", "note", "notes", "comment", "comments", "conversation", "conversations", "review", "reviews", "scorecard", "scorecards", "ticket", "tickets", "entry", "entries", "journal", "journals", "chat", "chats", "reply", "replies", "testimonial", "testimonials", "survey", "surveys", "interview", "interviews"]);
/** Words that make a field a preference about the information, not the information: email_opt_out, notifPrefs.emailJobMatches. */
const PREFERENCE = new Set(["opt", "optin", "optout", "unsubscribed", "subscribed", "prefs", "preferences", "settings", "notif", "notifs", "notifications", "notification"]);
/** Before "fingerprint", a device or an identity rather than a finger. */
const DEVICE = new Set(["device", "browser", "identity", "key", "ssh", "public", "client", "canvas", "tls"]);

/** "dateOfBirth", "date_of_birth", "IPAddress" → ["date", "of", "birth"], ["ip", "address"]. */
export function words(name: string): string[] {
  return name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/** Each schema field that looks personal, with what it seems to hold: the fields of its model given as context. */
export function personalFields<F extends Pick<Field, "model" | "name" | "marked">>(fields: F[]): { field: F; why: string }[] {
  const byModel = new Map<string, string[]>();
  for (const f of fields) (byModel.get(f.model) ?? byModel.set(f.model, []).get(f.model)!).push(f.name);
  const out: { field: F; why: string }[] = [];
  for (const field of fields) {
    const why = looksPersonal(field, byModel.get(field.model));
    if (why) out.push({ field, why });
  }
  return out;
}

/**
 * What the field seems to hold when it looks personal, or null. `siblings`, the names of the other fields of its
 * model, tell whether its rows belong to a person (a user_id), so free text there counts.
 */
export function looksPersonal(field: Pick<Field, "model" | "name" | "marked">, siblings: string[] = []): string | null {
  if (field.marked === true) return "marked @personal";
  if (field.marked === false) return null;
  const w = words(field.name);
  // Sensitive information first: "workAuthorizationStatus" is the status itself, whatever its last word.
  for (let i = 0; i + 1 < w.length; i++) {
    const pair = PAIRS[`${w[i]} ${w[i + 1]}`];
    if (pair?.includes("sensitive")) return pair;
  }
  if (w.length > 1 && ABOUT.has(w.at(-1)!)) return null;
  if (w.some((x) => PREFERENCE.has(x))) return null;
  const fingerprint = w.indexOf("fingerprint");
  if (fingerprint > 0 && DEVICE.has(w[fingerprint - 1]!)) return "a device or identity fingerprint";
  if (w.length > 1 && w.at(-1) === "name" && w.slice(0, -1).some((x) => ROLE.has(x) || x === "by")) return "a name";
  const table = words(field.model);
  const aboutPerson = PERSON.test(table.at(-1) ?? "") || EXCHANGE.has(table.at(-1) ?? "") || siblings.some((s) => PERSON_LINK.test(s));
  // "body" is free text; "licensing_body" is an organisation. A compound name counts when its last word always is free text.
  const freeText = w.length === 1 ? FREE_TEXT.has(w[0]!) : ALWAYS_FREE.has(w.at(-1)!);
  if (freeText && aboutPerson) return "free text about or by a person";
  for (let i = 0; i + 1 < w.length; i++) {
    const pair = PAIRS[`${w[i]} ${w[i + 1]}`];
    if (pair && !(w[i] === "date" && w[i + 1] === "of" && w[i + 2] !== "birth")) return w[i] === "date" ? "a date of birth" : pair;
  }
  for (const x of w) {
    const hit = ALWAYS[x];
    if (hit) return hit;
  }
  const model = words(field.model).at(-1) ?? "";
  if (w.length === 1 && PERSON.test(model)) {
    const hit = ON_PERSON[w[0]!];
    if (hit) return hit;
  }
  return null;
}
