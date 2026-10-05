# Frontend Data Contracts

These are frontend contracts only. They do not define the final database schema.

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

```json
{
  "id": 2001,
  "invoiceNumber": "INV-2026-0001",
  "patientId": 1001,
  "date": "2026-10-05",
  "subtotal": 1000,
  "discount": 100,
  "tax": 0,
  "total": 900,
  "paid": 500,
  "remaining": 400,
  "status": "partially_paid"
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
