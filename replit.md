# CRM System - Client, Services & Finance Management

## Overview

A CRM system for managing clients, services, appointments, and finances with calendar-based scheduling and role-based access control. Built for a Russian-speaking audience with separate interfaces for administrators and employees.

**Core Purpose:** Track client appointments, manage services and pricing, record income/expenses, and provide analytics for business operations.

**Key Entity:** The "Record" (appointment) connects clients, services, and employees - it drives the financial and analytics features.

## Recent Changes (January 2026)

### Record Management Features
- **Edit records**: Admins and managers can edit existing records (client, service, date, time, patient count)
- **Delete records**: Admins and managers can delete records
- **Price calculation**: Record price = Service price × Patient count (not affected by number of completions)

### Employee Management Features
- **Edit employees**: Admins can edit employee login, password, name, and role
- **Delete employees**: Admins can delete employees (with option to cascade delete records)

### Multi-Employee Record Completion
- **Records are no longer assigned to specific employees at creation**
  - Records are visible to all employees
  - Any employee can complete any record
  - Multiple employees can complete the same record
- **New `recordCompletions` table** tracks:
  - Which employee completed the record
  - How many patients they served
  - When the completion occurred
- **Patient count per record**: Each record specifies expected patient count
- **Income created on completion**: Income is generated when an employee completes a record, based on patient count
- **Employee selection removed from record creation form**
- **Completion dialog added**: Employees click "Выполнить" to open dialog where they enter patient count

### Previous Changes
- Implemented full CRM MVP with PostgreSQL database
- Added authentication with session-based login
- Created admin dashboard with calendar view
- Built day page with tabs for records, income, expenses, and analytics
- Added client, service, and employee management pages
- Added monthly analytics with employee performance tracking
- Added date and service filters to employee analytics page (admin view)
- Enhanced analytics page with clickable cards for Income, Expense, and Clients
- Added detailed Income, Expense, Clients pages with charts
- Added report export feature (Excel/Word files)

## Test Credentials

- **Admin:** login = "admin", password = "admin123"
- **Employee:** login = "employee", password = "employee123"

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React with TypeScript using Vite as the build tool
- **Routing:** wouter for client-side routing
- **State Management:** TanStack React Query for server state management
- **UI Components:** shadcn/ui component library with Radix UI primitives
- **Styling:** Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Design System:** Material Design-inspired with Inter font family

**Role-Based UI:**
- Admin interface: Full sidebar navigation with calendar, clients, services, analytics, and employee management
- Employee interface: Simplified single-page layout with records view only

### Backend Architecture
- **Framework:** Express.js with TypeScript
- **API Pattern:** RESTful endpoints under `/api` prefix
- **Authentication:** Session-based auth using express-session with PostgreSQL session store
- **Password Security:** scrypt hashing with random salts

**Route Structure:**
- `/api/auth/*` - Authentication (login, logout, current user)
- `/api/users/*` - User/employee management (admin only)
- `/api/clients/*` - Client CRUD operations
- `/api/services/*` - Service CRUD operations
- `/api/records/*` - Appointment/booking management
- `/api/incomes/*` & `/api/expenses/*` - Financial tracking
- `/api/analytics/*` - Monthly reporting

### Data Layer
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Schema Location:** `shared/schema.ts` (shared between client and server)
- **Validation:** Zod schemas generated from Drizzle schema using drizzle-zod

**Core Tables:**
- `users` - Admin and employee accounts with role enum
- `clients` - Customer information (name, phone)
- `services` - Available services with pricing
- `records` - Appointments linking clients, services, and employees with status tracking
- `incomes` & `expenses` - Financial records tied to dates

### Build & Development
- **Dev Server:** Vite dev server with HMR proxied through Express
- **Production Build:** Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Database Migrations:** `drizzle-kit push` for schema synchronization

## External Dependencies

### Database
- **PostgreSQL** - Primary database accessed via `DATABASE_URL` environment variable
- **connect-pg-simple** - Session storage in PostgreSQL

### Key npm Packages
- **UI:** @radix-ui/* primitives, lucide-react icons, embla-carousel-react
- **Forms:** react-hook-form with @hookform/resolvers
- **Date Handling:** date-fns with Russian locale support
- **Validation:** zod for runtime validation