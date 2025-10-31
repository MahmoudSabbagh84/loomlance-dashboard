# 📚 LoomLance Dashboard - Comprehensive Codebase Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Core Files & Purpose](#core-files--purpose)
5. [Component Architecture](#component-architecture)
6. [State Management](#state-management)
7. [Data Flow & Interactions](#data-flow--interactions)
8. [Performance Optimizations](#performance-optimizations)
9. [Development Patterns](#development-patterns)
10. [Key Conventions](#key-conventions)

---

## Project Overview

**LoomLance Dashboard** is a modern, all-in-one freelancer management platform built with React 18. The application provides a unified workspace for managing invoices, contracts, clients, and business metrics.

### Technology Stack

- **Frontend Framework**: React 18.3.1 with modern hooks and patterns
- **Build Tool**: Vite 6.0.1 for fast development and optimized builds
- **Routing**: React Router DOM 6.28.0 with lazy loading
- **Styling**: Tailwind CSS 3.4.15 with custom design system
- **Icons**: Lucide React 0.468.0
- **State Management**: React Context API with optimized selectors
- **Data Persistence**: localStorage with debounced operations
- **Deployment**: AWS Amplify/S3

---

## Architecture Overview

### Application Flow

```
Entry Point (main.jsx)
    ↓
App Component (App.jsx)
    ↓
Provider Hierarchy:
    ErrorBoundary
    → ThemeProvider
    → AuthProvider
    → DataProvider
    → SettingsProvider
    ↓
Router (React Router)
    ↓
Protected Routes → Layout → Pages
```

### Design Principles

1. **Performance First**: Extensive use of React.memo, useMemo, useCallback, and lazy loading
2. **Type Safety**: Modern JavaScript with optional chaining and nullish coalescing
3. **Error Resilience**: Comprehensive error boundaries and graceful error handling
4. **Code Splitting**: Lazy-loaded pages reduce initial bundle size
5. **Context Optimization**: Selector hooks prevent unnecessary re-renders
6. **Responsive Design**: Mobile-first approach with Tailwind CSS

---

## Project Structure

```
loomlance-dashboard/
├── public/
│   └── logo.png                    # Application logo
├── src/
│   ├── main.jsx                   # Application entry point
│   ├── App.jsx                    # Main app component with routing
│   ├── index.css                  # Global styles and Tailwind imports
│   │
│   ├── pages/                     # Page-level components (views)
│   │   ├── Dashboard.jsx          # Main dashboard with statistics
│   │   ├── Invoices.jsx           # Invoice management page
│   │   ├── Contracts.jsx          # Contract management page
│   │   ├── Clients.jsx           # Client management page
│   │   ├── Profile.jsx            # User profile page
│   │   ├── Settings.jsx           # Application settings
│   │   ├── Archive.jsx            # Archived items page
│   │   └── Login.jsx              # Authentication page
│   │
│   ├── components/                # Reusable UI components
│   │   ├── Layout.jsx             # Main app layout (sidebar, header)
│   │   ├── ProtectedRoute.jsx     # Route protection wrapper
│   │   ├── ErrorBoundary.jsx      # Error handling component
│   │   ├── InvoiceModal.jsx       # Invoice creation/edit modal
│   │   ├── InvoiceDetailsModal.jsx # Invoice details view
│   │   ├── InvoiceListModal.jsx   # List of invoices modal
│   │   ├── InvoiceTemplate.jsx    # Invoice PDF template
│   │   ├── ContractDetailsModal.jsx # Contract details view
│   │   └── ArchiveButton.jsx      # Archive action component
│   │
│   ├── context/                    # React Context providers
│   │   ├── AuthContext.jsx        # Authentication state
│   │   ├── DataContext.jsx        # Business data (invoices, contracts, clients)
│   │   ├── ThemeContext.jsx       # Theme (light/dark mode)
│   │   └── SettingsContext.jsx    # User preferences
│   │
│   ├── services/                  # External service integrations
│   │   └── awsService.js          # AWS SDK integration
│   │
│   ├── utils/                     # Utility functions and hooks
│   │   └── performance.jsx       # Performance monitoring & optimization utilities
│   │
│   ├── styles/                    # Styling configuration
│   │   └── theme.js               # Theme classes and helper functions
│   │
│   └── config/                    # Configuration files
│       └── aws.js                 # AWS configuration
│
├── dist/                          # Production build output
├── node_modules/                  # Dependencies
├── index.html                     # HTML entry point
├── package.json                   # Dependencies and scripts
├── vite.config.js                 # Vite build configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── postcss.config.js              # PostCSS configuration
└── amplify.yml                    # AWS Amplify deployment config
```

---

## Core Files & Purpose

### Entry Points

#### `src/main.jsx`
**Purpose**: React application entry point

**What it does**:
- Renders the root React component
- Initializes React with `createRoot` (React 18 API)
- Wraps app in `StrictMode` for development warnings
- Imports global CSS

**Key Code**:
```javascript
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

---

#### `src/App.jsx`
**Purpose**: Main application component orchestrating routing and provider hierarchy

**What it does**:
- Sets up React Router for navigation
- Wraps app in context providers (Theme, Auth, Data, Settings)
- Implements lazy loading for all page components
- Configures error boundaries for each route
- Defines all application routes

**Provider Hierarchy** (outermost to innermost):
1. `ErrorBoundary` - Catches JavaScript errors
2. `ThemeProvider` - Theme state management
3. `AuthProvider` - Authentication state
4. `DataProvider` - Business data management
5. `SettingsProvider` - User preferences
6. `Router` - Routing functionality

**Key Features**:
- Lazy-loaded pages with `React.lazy()`
- `SuspenseWithErrorBoundary` wrapper for error handling
- Protected routes using `ProtectedRoute` component

**Routes**:
- `/login` - Public login page
- `/` - Dashboard (protected)
- `/invoices` - Invoice management (protected)
- `/contracts` - Contract management (protected)
- `/clients` - Client management (protected)
- `/profile` - User profile (protected)
- `/settings` - Settings page (protected)
- `/archive` - Archived items (protected)

---

### Context Providers

#### `src/context/AuthContext.jsx`
**Purpose**: Manages user authentication state

**Exports**:
- `AuthProvider` - Context provider component
- `useAuth()` - Hook to access full auth context
- `useUser()` - Hook to get only user data
- `useIsAuthenticated()` - Hook to get only authentication status
- `useAuthActions()` - Hook to get only action functions

**State**:
- `user`: Current user object (from localStorage)
- `isAuthenticated`: Boolean authentication status

**Actions**:
- `login(userData)` - Sets user and authentication status
- `logout()` - Clears user and authentication status
- `updateUser(userData)` - Updates user information

**Data Persistence**: 
- Saves/loads from `localStorage` key: `'loomlance-user'`
- Includes error handling for localStorage operations

**Optimization**:
- Actions wrapped in `useCallback`
- Context value memoized with `useMemo`
- Selector hooks prevent unnecessary re-renders

---

#### `src/context/DataContext.jsx`
**Purpose**: Central state management for business data (invoices, contracts, clients)

**Exports**:
- `DataProvider` - Context provider component
- `useData()` - Hook to access full data context
- **Selector Hooks** (prevent unnecessary re-renders):
  - `useInvoices()` - Get invoices array
  - `useContracts()` - Get contracts array
  - `useClients()` - Get clients array
  - `useInvoiceActions()` - Get invoice action functions
  - `useContractActions()` - Get contract action functions
  - `useClientActions()` - Get client action functions
  - `useArchiveActions()` - Get archive action functions

**State**:
- `invoices`: Array of invoice objects
- `contracts`: Array of contract objects
- `clients`: Array of client objects
- `archivedInvoices`: Array of archived invoices
- `archivedContracts`: Array of archived contracts

**Key Features**:
- **Debounced localStorage**: Prevents excessive localStorage writes
- **Batch Updates**: `BATCH_UPDATE` action for multiple updates
- **UID Generation**: Uses `crypto.randomUUID()` for unique IDs
- **Initial Data Loading**: Loads from localStorage or creates sample data

**Actions**:

**Invoices**:
- `addInvoice(invoice)` - Create new invoice
- `updateInvoice(invoice)` - Update existing invoice
- `deleteInvoice(id)` - Delete invoice
- `markInvoiceAsPaid(id)` - Mark invoice as paid
- `markInvoiceAsPending(id)` - Mark invoice as pending
- `markAllInvoicesAsPaid()` - Mark all invoices as paid
- `archiveInvoice(id)` - Move invoice to archive

**Contracts**:
- `addContract(contract)` - Create new contract
- `updateContract(contract)` - Update existing contract
- `deleteContract(id)` - Delete contract
- `markContractAsActive(id)` - Mark contract as active
- `markContractAsCompleted(id)` - Mark contract as completed
- `markContractAsPending(id)` - Mark contract as pending
- `markContractAsCancelled(id)` - Mark contract as cancelled
- `nullifyContractValue(id)` - Set contract value to null
- `archiveContract(id)` - Move contract to archive

**Clients**:
- `addClient(client)` - Create new client
- `updateClient(client)` - Update existing client
- `deleteClient(id)` - Delete client

**Data Persistence**:
- localStorage keys:
  - `'loomlance-invoices'`
  - `'loomlance-contracts'`
  - `'loomlance-clients'`
  - `'loomlance-archived-invoices'`
  - `'loomlance-archived-contracts'`

**Optimization**:
- All actions wrapped in `useCallback`
- Context value memoized with `useMemo`
- Debounced localStorage operations (300ms delay)
- Selector hooks for granular subscriptions

---

#### `src/context/ThemeContext.jsx`
**Purpose**: Manages application theme (light/dark mode)

**Exports**:
- `ThemeProvider` - Context provider component
- `useTheme()` - Hook to access full theme context
- `useThemeValue()` - Hook to get only theme value ('light' | 'dark')
- `useIsDark()` - Hook to get only dark mode boolean
- `useThemeActions()` - Hook to get only theme action functions

**State**:
- `theme`: Current theme ('light' | 'dark')
- `isDark`: Boolean for dark mode
- `isLight`: Boolean for light mode

**Actions**:
- `toggleTheme()` - Switch between light and dark
- `setLightTheme()` - Explicitly set light theme
- `setDarkTheme()` - Explicitly set dark theme

**Features**:
- Detects system preference on first load
- Applies theme to root HTML element
- Persists theme in localStorage
- Includes error handling

**Optimization**:
- Actions wrapped in `useCallback`
- Context value memoized with `useMemo`
- Selector hooks prevent unnecessary re-renders

---

#### `src/context/SettingsContext.jsx`
**Purpose**: Manages user preferences and application settings

**Exports**:
- `SettingsProvider` - Context provider component
- `useSettings()` - Hook to access full settings context
- `useInvoiceBilledDisplay()` - Hook to get invoice display preference
- `useSettingsActions()` - Hook to get only settings action functions

**State**:
- `invoiceBilledDisplay`: Display format for invoice billing ('paid-vs-total' | other formats)

**Actions**:
- `updateInvoiceBilledDisplay(value)` - Update invoice display setting
- `resetSettings()` - Reset all settings to defaults

**Data Persistence**:
- localStorage key: `'loomlance-settings-invoice-billed-display'`

**Optimization**:
- Actions wrapped in `useCallback`
- Context value memoized with `useMemo`
- Selector hooks prevent unnecessary re-renders

---

### Core Components

#### `src/components/Layout.jsx`
**Purpose**: Main application layout with sidebar navigation and header

**Features**:
- Responsive sidebar (collapsible on mobile)
- Navigation menu with active state highlighting
- User profile dropdown
- Theme toggle button
- Logout functionality

**Props**: Accepts `children` to render page content

**Optimization**:
- Wrapped in `React.memo`
- Navigation array memoized with `useMemo`
- All handlers wrapped in `useCallback`
- Uses selector hooks from contexts

---

#### `src/components/ProtectedRoute.jsx`
**Purpose**: Route guard that redirects unauthenticated users to login

**What it does**:
- Checks `isAuthenticated` from `AuthContext`
- Redirects to `/login` if not authenticated
- Renders children if authenticated

**Usage**:
```jsx
<ProtectedRoute>
  <ProtectedPage />
</ProtectedRoute>
```

---

#### `src/components/ErrorBoundary.jsx`
**Purpose**: Catches JavaScript errors in child components

**Features**:
- Class component implementing error boundary pattern
- Displays user-friendly error UI
- Shows error details in development
- `SuspenseWithErrorBoundary` combines error boundary with Suspense

**Usage**:
```jsx
<ErrorBoundary showDetails={isDev}>
  <App />
</ErrorBoundary>
```

---

### Page Components

All page components follow similar patterns:
- Wrapped in `React.memo` for performance
- Use selector hooks from contexts (not full context)
- Memoized computations with `useMemo`
- Memoized handlers with `useCallback`
- Search/filter with `useDeferredValue` and `useTransition`

#### `src/pages/Dashboard.jsx`
**Purpose**: Main dashboard displaying business metrics and overview

**Displays**:
- Statistics cards (total invoices, contracts, revenue)
- Recent invoices and contracts
- Upcoming due dates
- Quick action buttons

**Features**:
- Real-time statistics calculation
- Notification dismiss functionality
- Links to detailed views

---

#### `src/pages/Invoices.jsx`
**Purpose**: Invoice management interface

**Features**:
- Invoice list with status badges
- Search functionality (client name, invoice number, description)
- Status filtering (all, paid, pending, overdue)
- Create, edit, view, delete invoices
- Quick status toggle (paid/pending)
- Archive functionality
- Link to contract details

**State Management**:
- Uses `useInvoices()` for invoice data
- Uses `useInvoiceActions()` for actions
- Uses `useDeferredValue` for search performance
- Uses `useTransition` for filter changes

---

#### `src/pages/Contracts.jsx`
**Purpose**: Contract management interface

**Features**:
- Contract list with status badges
- Search functionality
- Status filtering
- Create, edit, delete contracts
- Generate invoice from contract
- View contract invoices
- Archive functionality

**State Management**:
- Uses selector hooks for optimized data access
- Memoized filtered contracts
- Memoized statistics

---

#### `src/pages/Clients.jsx`
**Purpose**: Client management interface

**Features**:
- Client list with contact information
- Search functionality
- Create, edit, delete clients
- View client details

**State Management**:
- Uses selector hooks for optimized data access
- Memoized filtered clients
- Memoized statistics

---

#### `src/pages/Login.jsx`
**Purpose**: User authentication page

**Features**:
- Login form
- Simulates authentication (stores user in AuthContext)
- Redirects to dashboard on success

---

#### `src/pages/Profile.jsx`
**Purpose**: User profile management

**Features**:
- Display user information
- Edit profile functionality

---

#### `src/pages/Settings.jsx`
**Purpose**: Application settings page

**Features**:
- Invoice display preferences
- Theme settings (moved from dedicated page)
- Other user preferences

---

#### `src/pages/Archive.jsx`
**Purpose**: View archived invoices and contracts

**Features**:
- List archived items
- Restore functionality
- Permanent delete

---

### Modal Components

#### `src/components/InvoiceModal.jsx`
**Purpose**: Create/edit invoice modal

**Features**:
- Form for invoice creation/editing
- Line items management
- Tax calculation
- Contract-based or standalone invoice types
- Auto-population from contracts

**Optimization**:
- Wrapped in `React.memo`
- Uses selector hooks (`useContracts`, `useClients`)
- Memoized filtered contracts
- All handlers wrapped in `useCallback`

---

#### `src/components/InvoiceDetailsModal.jsx`
**Purpose**: Display detailed invoice information

**Features**:
- Read-only invoice details
- Status display
- Line items breakdown
- Navigation to invoices page

**Optimization**:
- Wrapped in `React.memo`
- Memoized handlers

---

#### `src/components/InvoiceListModal.jsx`
**Purpose**: Display list of invoices for a contract

**Features**:
- Lists all invoices for a specific contract
- Click to view individual invoice
- Navigation to invoices page

**Optimization**:
- Wrapped in `React.memo`
- Memoized handlers

---

#### `src/components/ContractDetailsModal.jsx`
**Purpose**: Display detailed contract information

**Features**:
- Read-only contract details
- Status display
- Financial summary
- Navigation to contracts page

**Optimization**:
- Wrapped in `React.memo`
- Memoized handlers

---

#### `src/components/InvoiceTemplate.jsx`
**Purpose**: PDF-ready invoice template

**Features**:
- Printable invoice format
- Professional layout
- Company branding support

---

### Utility Files

#### `src/utils/performance.jsx`
**Purpose**: Performance monitoring and optimization utilities

**Exports**:

**PerformanceMonitor Class**:
- Tracks render counts per component
- Monitors operation timing
- Warns about slow operations
- Reports performance metrics

**Hooks**:
- `usePerformanceOptimization()` - Performance tracking hook
- `useContextSelector(context, selector)` - Optimized context selection
- `useCallbackFactory(factory)` - Factory for creating callbacks
- `useMemoFactory(factory)` - Factory for creating memoized values
- `useOptimizedTransition()` - Enhanced transition hook
- `useOptimizedDeferredValue(value)` - Enhanced deferred value hook

**Optimization Utilities**:
- `bundleOptimizations`: Lazy loading helpers
- `memoryOptimizations`: LRU cache, WeakMap memoization
- `networkOptimizations`: API caching, request deduplication
- `domOptimizations`: ResizeObserver utilities
- `performanceReporting`: Metrics reporting

**Usage Example**:
```javascript
import { performanceMonitor } from './utils/performance'

performanceMonitor.startTiming('data-fetch')
await fetchData()
performanceMonitor.endTiming('data-fetch')
```

---

#### `src/styles/theme.js`
**Purpose**: Theme utilities and CSS class helpers

**Exports**:
- `themeClasses`: Predefined Tailwind classes for theme elements
- `combineThemeClasses(...classes)`: Utility to combine theme classes

**Usage**:
```javascript
import { themeClasses, combineThemeClasses } from '../styles/theme'

<div className={combineThemeClasses("p-4", themeClasses.card.background)}>
```

---

### Configuration Files

#### `vite.config.js`
**Purpose**: Vite build and development configuration

**Key Features**:
- React plugin with fast refresh
- Code splitting by vendor
- Modern ES build targets (`esnext`)
- Terser minification
- Optimized dependency pre-bundling
- HMR (Hot Module Replacement) enabled

**Build Optimizations**:
- Manual chunk splitting (react-vendor, router, ui, date, aws)
- Asset file naming with hash for caching
- Console removal in production

---

#### `tailwind.config.js`
**Purpose**: Tailwind CSS configuration and design system

**Features**:
- Custom color palette (primary, success, warning, error, neutral)
- Light/dark mode color variants
- Custom font family (Inter)
- Brand shadows

**Design System Colors**:
- Primary: Orange (#F39C12)
- Success: Green (#27AE60)
- Warning: Orange (#F39C12)
- Error: Red (#E74C3C)
- Text: Dark (#2D3E50)

---

#### `package.json`
**Purpose**: Project dependencies and scripts

**Key Scripts**:
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run build:prod` - Production build with optimizations
- `npm run deploy:aws` - Deploy to AWS S3

---

## Component Architecture

### Component Hierarchy

```
App
├── ErrorBoundary
│   └── ThemeProvider
│       └── AuthProvider
│           └── DataProvider
│               └── SettingsProvider
│                   └── Router
│                       ├── ProtectedRoute (all routes except /login)
│                       │   └── Layout
│                       │       └── Page Component
│                       │           └── Modal Components (conditional)
│                       └── Login Page (unprotected)
```

### Component Categories

1. **Provider Components**: Context providers that wrap the application
2. **Layout Components**: Structural components (Layout, ProtectedRoute)
3. **Page Components**: Full-page views (Dashboard, Invoices, etc.)
4. **Modal Components**: Overlay dialogs for forms/details
5. **Utility Components**: Reusable UI elements (ArchiveButton, etc.)

---

## State Management

### Context Provider Hierarchy

State flows from outermost to innermost provider:

```
ErrorBoundary (error handling)
  ↓
ThemeProvider (theme state - no dependencies)
  ↓
AuthProvider (auth state - no dependencies)
  ↓
DataProvider (business data - depends on AuthProvider for user)
  ↓
SettingsProvider (settings - no dependencies)
  ↓
Router & Components (consume contexts)
```

### Context Subscription Pattern

**Old Pattern (Causes Re-renders)**:
```javascript
const { invoices, contracts, clients, addInvoice } = useData()
// Component re-renders when ANY context value changes
```

**New Pattern (Optimized)**:
```javascript
const invoices = useInvoices() // Only subscribes to invoices
const { addInvoice } = useInvoiceActions() // Only subscribes to actions
// Component only re-renders when invoices change
```

### State Updates Flow

1. User action triggers handler (memoized with `useCallback`)
2. Handler calls context action (memoized in context)
3. Action dispatches reducer update
4. Reducer updates state and localStorage (debounced)
5. Context value updates (memoized)
6. Only subscribed components re-render (via selector hooks)

---

## Data Flow & Interactions

### Authentication Flow

```
User enters credentials
  ↓
Login.jsx calls authActions.login(userData)
  ↓
AuthContext updates state and localStorage
  ↓
ProtectedRoute checks isAuthenticated
  ↓
Redirects to dashboard if authenticated
```

### Invoice Creation Flow

```
User clicks "New Invoice" button
  ↓
Invoices.jsx opens InvoiceModal
  ↓
User fills form in InvoiceModal
  ↓
InvoiceModal calls onSave(invoice)
  ↓
Invoices.jsx calls addInvoice(invoice) from DataContext
  ↓
DataContext reducer adds invoice to state
  ↓
DataContext debounced save to localStorage
  ↓
Invoice list updates (memoized filter)
```

### Contract → Invoice Flow

```
User marks contract as completed
  ↓
Contracts.jsx calls markContractAsCompleted(id)
  ↓
Notification appears to generate invoice
  ↓
User clicks "Generate Invoice"
  ↓
InvoiceModal opens with contract data pre-filled
  ↓
User saves invoice
  ↓
Invoice created and linked to contract via contractUid
```

### Theme Toggle Flow

```
User clicks theme toggle in Layout
  ↓
Layout calls toggleTheme() from ThemeContext
  ↓
ThemeContext updates theme state
  ↓
ThemeContext updates localStorage and root HTML class
  ↓
All components using theme classes update automatically
```

### Search/Filter Flow (Optimized)

```
User types in search input
  ↓
Handler uses useTransition for non-urgent update
  ↓
Search term updates (deferred with useDeferredValue)
  ↓
Filtered list re-computes (memoized)
  ↓
Results display without blocking UI
```

---

## Performance Optimizations

### React Optimization Techniques

1. **React.memo**: Prevents re-renders when props haven't changed
   - Applied to: All page components, modal components, Layout

2. **useMemo**: Memoizes expensive computations
   - Applied to: Filtered lists, statistics, navigation arrays

3. **useCallback**: Memoizes function references
   - Applied to: All event handlers, context actions

4. **useDeferredValue**: Defers non-urgent updates
   - Applied to: Search terms in list views

5. **useTransition**: Marks updates as non-urgent
   - Applied to: Search and filter state updates

6. **Lazy Loading**: Code splitting for routes
   - Applied to: All page components

### Context Optimizations

1. **Selector Hooks**: Subscribe to specific context slices
   - Prevents unnecessary re-renders
   - Examples: `useInvoices()`, `useInvoiceActions()`

2. **Memoized Context Values**: Context values wrapped in `useMemo`
   - Prevents new object references on every render

3. **Memoized Actions**: All action functions wrapped in `useCallback`
   - Stable function references

### localStorage Optimizations

1. **Debouncing**: Batch localStorage writes (300ms delay)
   - Prevents performance issues with rapid updates
   - Implemented in DataContext

2. **Error Handling**: Try-catch around all localStorage operations
   - Prevents crashes from quota exceeded errors

### Build Optimizations

1. **Code Splitting**: Manual chunk splitting by vendor
   - Reduces initial bundle size
   - Better caching strategy

2. **Tree Shaking**: Unused code elimination
   - Configured in Vite

3. **Minification**: Terser with aggressive options
   - Removes console statements in production
   - Optimizes code size

---

## Development Patterns

### Component Structure Pattern

```javascript
import React, { useState, useMemo, useCallback, memo } from 'react'
import { useInvoices, useInvoiceActions } from '../context/DataContext'

const ComponentName = memo(() => {
  // 1. Hooks from contexts (selector hooks preferred)
  const invoices = useInvoices()
  const { addInvoice } = useInvoiceActions()
  
  // 2. Local state
  const [searchTerm, setSearchTerm] = useState('')
  
  // 3. Memoized computations
  const filteredItems = useMemo(() => {
    return invoices.filter(/* ... */)
  }, [invoices, searchTerm])
  
  // 4. Memoized handlers
  const handleAction = useCallback(() => {
    // action logic
  }, [dependencies])
  
  // 5. Render
  return (
    // JSX
  )
})

ComponentName.displayName = 'ComponentName'
export default ComponentName
```

### Context Usage Pattern

**Always use selector hooks when available**:
```javascript
// ✅ Good - Only subscribes to invoices
const invoices = useInvoices()
const { addInvoice } = useInvoiceActions()

// ❌ Bad - Subscribes to entire context
const { invoices, contracts, clients, ... } = useData()
```

### Error Handling Pattern

```javascript
// In contexts
try {
  localStorage.setItem(key, value)
} catch (error) {
  console.error('Failed to save:', error)
  // Graceful fallback
}

// In components
<ErrorBoundary>
  <Component />
</ErrorBoundary>
```

### Modal Pattern

```javascript
const [isOpen, setIsOpen] = useState(false)
const [data, setData] = useState(null)

const handleOpen = useCallback((item) => {
  setData(item)
  setIsOpen(true)
}, [])

const handleClose = useCallback(() => {
  setIsOpen(false)
  setData(null)
}, [])

// In JSX
{isOpen && <Modal data={data} onClose={handleClose} />}
```

---

## Key Conventions

### Naming Conventions

- **Components**: PascalCase (`InvoiceModal.jsx`)
- **Hooks**: camelCase starting with `use` (`useInvoices()`)
- **Context Files**: `*Context.jsx`
- **Page Files**: Located in `pages/` directory
- **Utility Files**: Located in `utils/` directory

### File Organization

1. **Imports** (grouped):
   - React and React hooks
   - Third-party libraries
   - Context hooks
   - Components
   - Utilities
   - Styles

2. **Component Structure**:
   - Imports
   - Component definition
   - Hooks (contexts, state, memoized values)
   - Handlers (memoized)
   - Effects
   - Render

### CSS Class Naming

- Use Tailwind utility classes primarily
- Use `combineThemeClasses` for theme-aware classes
- Follow Tailwind's responsive and state variant patterns

### State Management Rules

1. **Local state** for UI-only state (modals, dropdowns)
2. **Context state** for shared application state
3. **localStorage** for persistence (via contexts)
4. **Selector hooks** for context consumption

### Performance Rules

1. Always wrap components in `React.memo` if they receive props
2. Always use `useCallback` for event handlers passed as props
3. Always use `useMemo` for expensive computations
4. Use selector hooks instead of full context consumption
5. Use `useDeferredValue` for search/filter inputs
6. Use `useTransition` for non-urgent state updates

---

## Common Tasks & How-To

### Adding a New Page

1. Create file in `src/pages/NewPage.jsx`
2. Follow component structure pattern
3. Use selector hooks from contexts
4. Wrap in `React.memo`
5. Add lazy loading in `App.jsx`:
   ```javascript
   const NewPage = React.lazy(() => import('./pages/NewPage'))
   ```
6. Add route in `App.jsx`:
   ```jsx
   <Route path="/new-page" element={
     <ProtectedRoute>
       <Layout>
         <SuspenseWithErrorBoundary fallback={<LoadingSpinner />}>
           <NewPage />
         </SuspenseWithErrorBoundary>
       </Layout>
     </ProtectedRoute>
   } />
   ```

### Adding a New Context

1. Create file in `src/context/NewContext.jsx`
2. Follow context pattern:
   - Create context with `createContext()`
   - Create reducer (if needed)
   - Create provider component with memoized actions
   - Export provider and hooks
   - Create selector hooks
3. Add provider to `App.jsx` in correct order
4. Use selector hooks in components

### Adding a New Action to DataContext

1. Add action to reducer in `DataContext.jsx`
2. Create action function wrapped in `useCallback`
3. Add to appropriate action group object
4. Export via selector hook (e.g., `useInvoiceActions()`)

### Debugging Performance Issues

1. Use `PerformanceMonitor`:
   ```javascript
   import { performanceMonitor } from './utils/performance'
   
   performanceMonitor.startTiming('operation')
   // ... operation
   performanceMonitor.endTiming('operation')
   ```

2. Check render counts:
   ```javascript
   console.log(performanceMonitor.getRenderCounts())
   ```

3. Use React DevTools Profiler

---

## Testing Considerations

### Component Testing

- Test components in isolation
- Mock context providers
- Test user interactions (clicks, form submissions)
- Test error states

### Context Testing

- Test reducer logic
- Test action functions
- Test localStorage persistence
- Test error handling

### Integration Testing

- Test routing
- Test authentication flow
- Test data flow between components
- Test modal interactions

---

## Deployment

### Production Build

```bash
npm run build
```

Build output in `dist/` directory.

### AWS Deployment

```bash
npm run deploy:aws
```

Deploys to S3 bucket configured in `aws-config.json`.

### Build Configuration

See `vite.config.js` for build optimizations:
- Code splitting
- Minification
- Asset optimization
- Environment variables

---

## Future Improvements

### Potential Enhancements

1. **TypeScript Migration**: Add type safety
2. **Testing**: Add Jest/React Testing Library
3. **State Management**: Consider Zustand or Redux Toolkit for complex state
4. **API Integration**: Replace localStorage with backend API
5. **Real-time Updates**: WebSocket integration
6. **Offline Support**: Service Worker and PWA features
7. **Internationalization**: i18n support

---

## Conclusion

This documentation provides a comprehensive overview of the LoomLance Dashboard codebase. The application follows modern React patterns with a focus on performance, maintainability, and developer experience.

For questions or contributions, refer to this documentation or explore the codebase directly. Each component and context is well-documented with inline comments.

**Key Takeaways**:
- Modern React 18 patterns throughout
- Performance-first architecture
- Optimized context subscriptions
- Comprehensive error handling
- Lazy-loaded routes
- Debounced localStorage operations
- Memoized computations and handlers

