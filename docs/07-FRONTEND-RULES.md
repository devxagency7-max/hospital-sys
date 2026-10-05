# Frontend Development Rules

## Do
- Use reusable components.
- Keep modules isolated.
- Keep mock data separate.
- Use consistent naming.
- Use semantic HTML.
- Support RTL.
- Handle loading, empty, error, and success states.
- Validate forms on the client for user experience.
- Keep business-critical validation on the backend later.
- Make tables scalable.
- Keep destructive actions behind confirmation dialogs.

## Do Not
- Do not build backend code.
- Do not connect to a real database.
- Do not put API URLs throughout random files.
- Do not hard-code permissions in individual pages.
- Do not duplicate components unnecessarily.
- Do not use fake success messages for actions that do not actually happen.
- Do not silently hide errors.
- Do not export incomplete reports.
- Do not delete financial transaction history from the UI.

## Naming
Use clear names:
- `patient-list.js`
- `patient-profile.js`
- `invoice-table.js`
- `report-filters.js`

Avoid:
- `test2.js`
- `new.js`
- `final-final.js`

## Git
Recommended branch pattern:

```text
main
feature/frontend-layout
feature/patients
feature/billing-ui
feature/accounting-ui
feature/inventory-ui
feature/reports-ui
```

Do not work directly on `main`.
