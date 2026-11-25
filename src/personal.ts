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
  health: "health information", medical: "health information", diagnosis: "health information", medication: "health information", symptom: "health information", symptoms: "health information",
  religion: "religious beliefs", ethnicity: "ethnic origin", race: "ethnic origin", sexuality: "sexual orientation",
  biometric: "biometric information", fingerprint: "biometric information", faceprint: "biometric information", voiceprint: "biometric information",
  signature: "a signature", surname: "a name", nickname: "a name", username: "a name",
};

/** Two-word names: first name, last name… */
const PAIRS: Record<string, string> = {
  "first name": "a name", "last name": "a name", "full name": "a name", "given name": "a name", "family name": "a name",
  "display name": "a name", "maiden name": "a name", "middle name": "a name", "user name": "a name",
  "user agent": "a device's user agent", "ip address": "an IP address", "date of": "a date",
  "card number": "a payment card", "bank account": "a bank account", "account number": "a bank account",
  "cell phone": "a phone number", "driver licence": "a licence number", "driver license": "a licence number",
};

/** Tables about a person, where "name", "city" or "country" is that person's. */
const PERSON = /^(user|users|person|people|persons|customer|customers|member|members|contact|contacts|patient|patients|employee|employees|lead|leads|profile|profiles|client|clients|account|accounts|subscriber|subscribers|guest|guests|attendee|attendees|student|students|author|authors|applicant|applicants|candidate|candidates|partner|partners|visitor|visitors)$/i;
const ON_PERSON: Record<string, string> = { name: "a name", city: "a place of residence", country: "a country of residence", age: "an age", location: "a location" };

/** "dateOfBirth", "date_of_birth", "IPAddress" → ["date", "of", "birth"], ["ip", "address"]. */
export function words(name: string): string[] {
  return name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/** What the field seems to hold when it looks personal, or null. */
export function looksPersonal(field: Pick<Field, "model" | "name" | "marked">): string | null {
  if (field.marked === true) return "marked @personal";
  if (field.marked === false) return null;
  const w = words(field.name);
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
