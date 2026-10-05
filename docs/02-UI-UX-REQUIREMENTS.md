# UI/UX Requirements

## Design Direction
The product should look like a modern enterprise application, not a traditional desktop hospital application.

### Visual goals
- Clean
- Professional
- Fast to scan
- Information-dense without being cluttered
- Consistent
- Accessible
- Responsive

## Language
Primary language: Arabic.

The UI must support:
- RTL layout
- Arabic labels
- Arabic dates/text where required
- English technical values when appropriate

The architecture should allow future English localization.

## Global Layout

```text
┌──────────────────────────────────────────────────────┐
│ Header                                               │
├───────────────┬──────────────────────────────────────┤
│ Sidebar       │ Breadcrumbs                          │
│               │                                      │
│ Navigation    │ Page Content                         │
│               │                                      │
│               │                                      │
└───────────────┴──────────────────────────────────────┘
```

## Global Components
Create reusable components for:
- Sidebar
- Header
- Breadcrumbs
- Buttons
- Inputs
- Selects
- Date picker
- Search
- Filters
- Tables
- Pagination
- Cards
- Badges
- Tabs
- Modals
- Drawers
- Toasts
- Alerts
- Empty states
- Loading states
- Error states
- Confirmation dialogs

## Tables
Every major data table should support:
- Search
- Filters
- Sorting
- Pagination
- Column visibility where useful
- Row actions
- Bulk actions where useful
- Export action where applicable

## Forms
Forms should have:
- Clear labels
- Required-field indicators
- Validation messages
- Disabled/loading states
- Success/error feedback
- Confirmation before destructive actions

## Statuses
Use consistent visual states:
- Draft
- Pending
- Approved
- Rejected
- Paid
- Partially Paid
- Unpaid
- Cancelled
- Active
- Inactive
- Expired

## Responsive
Desktop is the primary target, but the system should remain usable on:
- Laptop
- Tablet
- Mobile

Do not simply shrink desktop tables. Provide appropriate responsive behavior.
