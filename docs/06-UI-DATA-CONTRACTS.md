# Frontend Data Contracts

These are frontend contracts only. They do not define the final database schema.

> For the billing domain specifically (Invoice lifecycle, Payment, Refund,
> Credit Note, outstanding balance, overpayment, cancellation, and the full
> relationship between them), see
> [12-BILLING-DOMAIN-MODEL.md](12-BILLING-DOMAIN-MODEL.md). The shapes below
> are illustrative; that document is the source of truth for billing fields.

## Patient

```json
{
  "id": 1001,
  "patientCode": "P-1001",
  "name": "Ahmed Mohamed",
  "phone": "01000000000",
  "gender": "male",
  "dateOfBirth": "1998-05-10",
  "status": "active"
}
```

## Invoice

`total` is frozen once the invoice is issued (`lifecycleStatus: "issued"`) —
see 12-BILLING-DOMAIN-MODEL.md for why no endpoint may mutate it afterward.
`effectiveTotal`, `netPaid`, and `remaining` are always derived, never
stored directly by a write endpoint.

```json
{
  "id": 2001,
  "invoiceNumber": "INV-2026-0001",
  "patientId": 1001,
  "date": "2026-10-05",
  "lifecycleStatus": "issued",
  "subtotal": 1000,
  "discount": 100,
  "tax": 0,
  "total": 900,
  "paid": 500,
  "refunded": 0,
  "netPaid": 500,
  "credited": 0,
  "effectiveTotal": 900,
  "remaining": 400,
  "status": "partially_paid"
}
```

## Refund

Money actually returned to the patient. Reduces `netPaid`, never `total`.

```json
{
  "id": 70001,
  "refundNumber": "REF-2026-001",
  "invoiceId": 2001,
  "amount": 150,
  "method": "cash",
  "reason": "Duplicate charge",
  "status": "approved"
}
```

## Credit Note

A correction to the invoice's own value — no cash moves, so there is no
`method` field. Reduces `effectiveTotal`, never `netPaid`. Do not model this
as a refund; the two affect opposite sides of the balance.

```json
{
  "id": 85001,
  "creditNoteNumber": "CN-2026-001",
  "invoiceId": 2001,
  "amount": 200,
  "reason": "Line item not delivered",
  "status": "approved"
}
```

## Inventory Item

```json
{
  "id": 3001,
  "code": "MED-001",
  "name": "Paracetamol",
  "category": "Medicine",
  "unit": "Box",
  "quantity": 120,
  "minimumQuantity": 30,
  "status": "available"
}
```

## Important
The backend developer may change these contracts after database/API design.

Frontend code should access data through modules/services rather than assuming a database structure.
