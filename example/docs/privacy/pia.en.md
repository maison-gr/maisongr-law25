# Privacy impact assessment: Online ordering

| | |
|---|---|
| Organisation | Boulangerie Exemple inc. |
| Person in charge of the protection of personal information | Owner, in charge of the protection of personal information, vieprivee@boulangerie-exemple.ca |
| System assessed | Online ordering |
| Assessed | 25 November 2026 |
| Next review | 25 November 2027 |
| Person in charge consulted | 1 October 2026 |
| Provisions referred to | Act respecting the protection of personal information in the private sector (CQLR, c. P-39.1), ss. 3.3, 12 and 17 |

*Prepared by the organisation from its own description of the system, with an open-source tool that checks completeness and consistency with the code, not accuracy or sufficiency under the Act. Review by a qualified advisor is recommended.*

## Summary

- 5 kinds of personal information, 1 of them sensitive.
- 2 providers, 1 of them processing information outside Québec.
- 4 risks identified: 2 handled, 2 still open.

## 1. The project

Customers order bread and pastries online, choose a pickup time and pay in the shop. The team sees the day’s orders to prepare them.

### Objectives

- Prepare each order for the chosen time and hand it to the right person.
- Reach the customer when an order can’t be ready.
- Avoid serving a product with an allergen the customer told us about.

### Proportionality

A first name and an email are enough to hand over and confirm an order. The phone number and allergies are optional and used only for the order. No online payment, so no card data.

### Giving information back to the person

Customers download their information and orders as one JSON file from their account.

## 2. Roles and consultations

| Who | Role |
|---|---|
| The owner | Responsible for the assessment |
| The developer | Data inventory and technical measures |

## 3. Personal information

| Information | Whose | Source | Purpose | Retention | Stored in | Access | In the code |
|---|---|---|---|---|---|---|---|
| Email | Customers | The person | Confirm the order and sign in. | While the account exists, then deleted within 30 days of closing it. | PostgreSQL (Canada, Montréal) | The customer; the team for the day’s orders | `Customer.email` |
| First name | Customers | The person | Hand the order to the right person. | As the email. | PostgreSQL (Canada, Montréal) | The shop team | `Customer.firstName` |
| Phone | Customers who give it | The person | Reach the customer when an order can’t be ready. | As the email; erased when the customer removes it. | PostgreSQL (Canada, Montréal) | The owner | `Customer.phone` |
| Allergies | Customers who report them | The person | Avoid serving a reported allergen. | As the email; erased when the customer removes them. | PostgreSQL (Canada, Montréal) | The team preparing the order | `Customer.allergies` |
| Orders | Customers | The person | Prepare and hand over the order. | Two years for the accounts, then deleted. | PostgreSQL (Canada, Montréal) | The shop team | `Order.pickupAt`, `Order.note` |

## 4. Sensitive information (s. 12)

Personal information is sensitive when, due to its nature, in particular its medical, biometric or otherwise intimate nature, or the context of its use or communication, it entails a high level of reasonable expectation of privacy.

- **Allergies**: Health information.

## 5. Providers and communication outside Québec (s. 17)

| Provider | Service | Information | Location | Outside Québec | Safeguards |
|---|---|---|---|---|---|
| Hébergeur Canada | Database hosting | Email, First name, Phone, Allergies, Orders | Canada (Montréal) | No | Processing agreement; encryption at rest |
| Courriels Transactionnels | Order confirmation emails | Email, First name | United States | Yes | Processing agreement; data used only to send |

Before communicating personal information outside Québec, or entrusting a person or body outside Québec with collecting, using, communicating or keeping it, s. 17 requires an assessment that takes into account at least the factors below. The communication may take place if the assessment establishes that the information would receive adequate protection, in particular in light of generally recognized principles regarding the protection of personal information. It must be the subject of a written agreement that takes into account the results of the assessment and, if applicable, the terms agreed on to mitigate the risks identified. Outside Québec includes the rest of Canada.

### Courriels Transactionnels

- **Sensitivity of the information**: Low, an email and a first name.
- **Purposes of its use**: Send the order confirmation, nothing else.
- **Protection measures, contractual ones included**: Written agreement forbidding any other use; logs erased after 30 days.
- **Legal framework of the receiving State, including its privacy principles**: US privacy laws, less protective than Québec’s. The provider commits by contract to an equivalent level, but the agreement can’t set aside access by US authorities under their laws.
- **Conclusion**: Adequate protection given the low sensitivity of the information and the written agreement, which includes the measures above.

## 6. Risks and measures

### At collection

| Risk | Measure | Status |
|---|---|---|
| Asking for more than needed | Phone and allergies optional; no date of birth or address | Done |

### In use

| Risk | Measure | Status |
|---|---|---|
| The whole team sees every customer’s allergies | Allergies appear only on the ticket of the order being prepared | Planned |

### In communication

| Risk | Measure | Status |
|---|---|---|
| The email provider reuses the addresses | Written agreement forbidding any other use | Done |

### In retention and destruction

| Risk | Measure | Status |
|---|---|---|
| Inactive accounts stay forever | Automatic deletion after three years without an order | To confirm |

## 7. Action plan

| Measure | Owner | Due | Status |
|---|---|---|---|
| Allergies appear only on the ticket of the order being prepared | The developer | 15 January 2027 | Planned |
| Automatic deletion after three years without an order | The owner | — | To confirm |

## 8. Approval and history

| Approved by | Title | Date |
|---|---|---|
| Marie Exemple | Owner | 25 November 2026 |

### History

- 25 November 2026: First assessment.

---

Written from `law25.config.mjs` with [maisongr-law25](https://github.com/maison-gr/maisongr-law25).
