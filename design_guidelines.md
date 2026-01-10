# U-sistem Design Guidelines

## Design Approach

**Selected Approach:** Modern Gradient Design with Soft Colors
**Rationale:** This is a data-intensive business application with a warm, approachable aesthetic. The design uses soft purple/violet gradients to create a pleasant, professional experience.

**Brand:** U-sistem (formerly CRM Система)
**Primary Colors:** Violet to purple gradient (262° hue)

**Key Principles:**
- Soft, gradient-based color palette with purple/violet tones
- Pleasant, non-clinical aesthetic while maintaining professional functionality
- Information hierarchy through typography and spacing
- Consistent, predictable patterns across all screens
- Efficient data entry and navigation
- Clear role-based interface differentiation

---

## Core Design Elements

### A. Typography

**Font Family:** Inter (via Google Fonts)
- Primary: Inter (weights: 400, 500, 600, 700)

**Type Scale:**
- Page Headers: text-3xl font-bold (Admin), text-2xl font-bold (Employee)
- Section Headers: text-xl font-semibold
- Card Titles: text-lg font-medium
- Body Text: text-base font-normal
- Labels: text-sm font-medium
- Secondary Text: text-sm font-normal
- Table Headers: text-xs font-semibold uppercase tracking-wide
- Buttons: text-sm font-medium

---

### B. Layout System

**Spacing Units:** Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Section spacing: space-y-6, space-y-8
- Card gaps: gap-4, gap-6
- Page margins: px-6 py-8 (mobile), px-8 py-12 (desktop)

**Container Strategy:**
- Max width: max-w-7xl mx-auto
- Sidebar: w-64 (admin navigation)
- Content area: flex-1 with responsive padding

**Grid Patterns:**
- Calendar: grid-cols-7 gap-2
- Month cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Analytics cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4

---

### C. Component Library

**Navigation (Admin only):**
- Sidebar: Fixed left navigation w-64 with logo, menu items, user profile
- Menu items: Stacked list with icons (Heroicons), text-base, py-3 px-4
- Active state: Distinguished through background treatment

**Calendar System:**
- Month Cards: Rounded corners (rounded-lg), shadow (shadow-md), p-6
- Month Header: text-lg font-semibold, text-center, mb-4
- Day Grid: 7-column grid, each day rounded-md p-3
- Day states: Default, Today (distinct border), Has appointments (indicator dot)
- Clickable days: Subtle hover state, cursor-pointer

**Data Tables:**
- Table container: rounded-lg border overflow-hidden
- Header: Sticky top-0, uppercase labels, text-xs
- Rows: Hover states, alternating row treatment optional
- Cell padding: px-4 py-3
- Actions column: Right-aligned icons

**Forms & Modals:**
- Modal overlay: Centered, max-w-md to max-w-2xl depending on complexity
- Modal content: rounded-xl shadow-2xl p-6
- Form fields: Full width labels (text-sm font-medium mb-2), inputs with border rounded-md px-3 py-2
- Field spacing: space-y-4
- Button group: Flex justify-end gap-3 mt-6

**Cards:**
- Standard card: rounded-lg shadow-sm border p-6
- Record cards: Include status indicator, client name (text-lg font-medium), service (text-sm), date (text-xs)
- Analytics cards: Icon + metric (text-3xl font-bold) + label (text-sm)

**Buttons:**
- Primary: px-4 py-2 rounded-md font-medium
- Secondary: px-4 py-2 rounded-md font-medium border
- Icon buttons: p-2 rounded-md
- Hover/active states: Subtle scale or shadow changes

**Status Indicators:**
- Record status: Small badge (rounded-full px-2.5 py-0.5 text-xs font-medium)
- Checkmark/X actions: Icon buttons (p-1.5 rounded-md)

**Employee Interface:**
- Simplified single-page layout
- Prominent "Записи" tab
- Large, easy-to-scan record list
- Quick action buttons for common tasks

---

### D. Animations

**Minimal and Purposeful:**
- Modal enter/exit: 200ms fade + scale
- Dropdown menus: 150ms slide-down
- Hover states: 150ms transitions
- NO scroll animations
- NO decorative animations

---

## Page-Specific Layouts

**Admin Dashboard:**
- Sidebar navigation (left)
- Main content: Calendar grid preceded by "Today/Tomorrow" record panels (grid-cols-2 gap-4)
- Record panels: Compact card lists, max-h-96 overflow-y-auto

**Day Detail (Admin):**
- Tab navigation: Sticky top (Записи, Доходы, Расходы, Аналитика)
- Tab content area: py-6
- Date header: text-2xl font-bold with date selector

**Analytics (Month):**
- Month selector: Prominent dropdown or tab strip
- 4-card metric row: Total income, expense, result, unique clients
- Employee performance table: Full-width with sortable columns
- Financial breakdown: Two-column layout (income sources | expense categories)

**Client Detail:**
- Client header: name (text-2xl font-bold), phone (text-lg)
- Record history: Full-width table, chronologically sorted

**Employee Interface:**
- Header: Logo + employee name + logout
- Main area: Record list with large touch targets
- Add record: Floating action button (fixed bottom-right) or prominent top button

---

## Icon Strategy

**Library:** Heroicons (outline for navigation, solid for actions)
**Usage:**
- Navigation items: 20px icons
- Action buttons: 16px icons  
- Status indicators: 12px icons
- Table actions: 16px icons

---

## Accessibility

- Form labels: Always visible and associated
- Focus states: Clear outline on all interactive elements
- Keyboard navigation: Full support for tables, modals, forms
- Error messages: Red accent with icon, below field
- Required fields: Asterisk in label