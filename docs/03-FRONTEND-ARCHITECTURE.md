# Frontend Architecture

## Objective
Keep the frontend modular enough that a backend developer can connect real APIs later without rewriting screens.

## Suggested Structure

```text
frontend/
├── index.html
├── pages/
│   ├── dashboard/
│   ├── patients/
│   ├── appointments/
│   ├── billing/
│   ├── accounting/
│   ├── inventory/
│   ├── purchasing/
│   ├── pharmacy/
│   ├── laboratory/
│   ├── radiology/
│   ├── reports/
│   ├── users/
│   ├── audit/
│   └── settings/
│
├── components/
│   ├── layout/
│   ├── forms/
│   ├── tables/
│   ├── modals/
│   ├── feedback/
│   └── common/
│
├── js/
│   ├── core/
│   ├── api/
│   ├── mock/
│   ├── state/
│   ├── utils/
│   └── modules/
│
├── css/
│   └── app.css
│
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
│
└── README.md
```

## Important Rule
Do not place business logic directly inside HTML event handlers.

Bad:
```html
<button onclick="savePatient()">Save</button>
```

Prefer centralized JavaScript handlers/modules.

## API Abstraction
Even though no backend exists yet, create an API layer such as:

```text
js/api/
├── patients.api.js
├── billing.api.js
├── accounting.api.js
├── inventory.api.js
└── reports.api.js
```

During frontend development these functions return mock data.

Later they can be replaced with real HTTP requests.

## Mock Data
Mock data should live separately from UI code.

Example:
```text
js/mock/patients.mock.js
js/mock/invoices.mock.js
js/mock/inventory.mock.js
```

## No Backend Assumptions
Do not hard-code database IDs, SQL logic, or backend implementation details into the UI.

The frontend only depends on defined data contracts.
