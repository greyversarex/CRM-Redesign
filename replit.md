# CRM System - Client, Services & Finance Management

## Overview

A CRM system for managing clients, services, appointments, and finances with calendar-based scheduling and role-based access control. Built for a Russian-speaking audience with separate interfaces for administrators and employees.

**Core Purpose:** Track client appointments, manage services and pricing, record income/expenses, and provide analytics for business operations.

**Key Entity:** The "Record" (appointment) connects clients, services, and employees - it drives the financial and analytics features.

## Recent Changes (January 2026)

- Implemented full CRM MVP with PostgreSQL database
- Added authentication with session-based login
- Created admin dashboard with calendar view
- Built day page with tabs for records, income, expenses, and analytics
- Added client, service, and employee management pages
- Implemented auto-income generation when records are marked as done
- Added monthly analytics with employee performance tracking

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