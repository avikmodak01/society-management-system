# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Society Cooperative Management System built for financial institutions like credit societies and cooperatives. The system manages members, subscriptions, loans, fixed deposits, and generates comprehensive financial reports. Built with vanilla HTML/CSS/JavaScript and Supabase as the backend.

## Architecture

### Tech Stack
- **Frontend**: Pure HTML5, CSS3, Vanilla JavaScript (no frameworks)
- **Backend**: Supabase (PostgreSQL database with REST API)
- **Authentication**: Multi-tier system with admin/member access levels
- **External Libraries**: jsPDF, XLSX.js, Supabase SDK v2

### Core Components

**Main Application Files:**
- `index.html` - Landing page with module selector and authentication gateway
- `home.html` - Primary dashboard for society operations (requires admin auth)
- `script.js` - Core business logic, database operations, financial calculations
- `auth.js` - Authentication middleware for admin panel security

**Specialized Modules:**
- `member-portal.html` - Mobile-optimized member self-service portal (PIN-based)
- `admin.html` - PIN management system for member portal access
- `member-management.html` - Dedicated member and subscription management
- `data-admin.html` - Data administration tools (super admin access)

### Database Architecture

**Database**: PostgreSQL via Supabase Cloud
**Connection Config**: Located in script files with hardcoded credentials

**Key Tables**:
- `members` - Member profiles, status, contact information
- `subscriptions` - Monthly subscription payment records
- `loans` - Loan accounts with principal, interest, repayment tracking
- `loan_interest_accruals` - Monthly interest calculations and posting
- `deposits` - Fixed deposit accounts with maturity tracking
- `member_pins` - PIN-based authentication for member portal
- `admin_passwords` - Role-based admin authentication
- `quarter_settings` - Financial quarter definitions for reporting

### Authentication System

**Admin Authentication** (`auth.js`):
- Role-based: `admin` (standard operations) and `super_admin` (data management)
- Module-specific passwords stored in `admin_passwords` table
- Session-based with 2-hour timeout and automatic extension
- Visual session indicators and monitoring

**Member Authentication**:
- 4-digit PIN system (default: last 4 digits of mobile number)
- PIN management through admin interface
- Session storage for member portal access

## Development Commands

### Local Development
```bash
# No build system - serve files directly
# Use VS Code Live Server extension or python -m http.server
python -m http.server 8000
```

### Database Operations
```sql
-- Change admin passwords (run in Supabase SQL editor)
UPDATE admin_passwords SET password_hash = 'new_password' WHERE module_name = 'main-operations';
UPDATE admin_passwords SET password_hash = 'new_password' WHERE module_name = 'pin-management';
UPDATE admin_passwords SET password_hash = 'new_password' WHERE module_name = 'data-admin';
```

### Testing
- Manual testing through browser interface
- Use browser developer tools for debugging
- Test responsive design on multiple screen sizes
- Test authentication flows for all user roles

## Key Architecture Patterns

### Data Flow
1. Client JavaScript → Supabase REST API → PostgreSQL
2. No middleware server - direct client-to-database communication
3. Real-time updates via Supabase subscriptions
4. Local storage for session management and caching

### Financial Calculations
**Interest Accrual System** (`script.js`):
- Monthly interest calculation on loans
- Compound interest for fixed deposits
- Quarter-based financial reporting
- Automatic interest posting with detailed audit trails

**Subscription Management**:
- Monthly payment tracking with member status updates
- Bulk subscription entry for efficient processing
- Payment history with search and filtering
- Arrears calculation and member status management

### Security Implementation
- **XSS Protection**: Proper DOM manipulation, no innerHTML with user data
- **CSRF Protection**: Session validation on all authenticated requests
- **Role-Based Access**: Module-specific authentication with permission checks
- **Input Sanitization**: All user inputs validated before database operations

## Common Development Tasks

### Adding New Features
1. Identify target module (home.html for main features, separate file for new modules)
2. Add database table if needed (via Supabase dashboard)
3. Implement UI in appropriate HTML file
4. Add business logic to script.js
5. Update navigation if creating new module
6. Test authentication and permissions

### Database Schema Changes
1. Make changes in Supabase dashboard SQL editor
2. Update corresponding JavaScript code in script.js
3. Test data operations thoroughly
4. Update any affected reports or calculations

### Authentication Changes
1. Admin password changes: Update admin_passwords table
2. New admin modules: Add to auth.js CONFIG.modules mapping
3. Permission changes: Update checkAdminPermission() function
4. Member PIN changes: Use admin.html PIN management interface

### UI/UX Updates
1. Main dashboard: Edit home.html and home-dashboard.css
2. Member portal: Edit member-portal.html (mobile-first design)
3. Module navigation: Update index.html module cards
4. Responsive design: Test across all screen sizes

### Financial System Modifications
1. Interest rate changes: Update calculation functions in script.js
2. New financial products: Add database tables and UI components
3. Report modifications: Update PDF/Excel generation functions
4. Quarter system changes: Modify quarter_settings table and related logic

## Important Implementation Notes

### Database Connections
- Supabase client initialized in each HTML file
- Connection parameters embedded in script tags
- No connection pooling - relies on Supabase automatic scaling

### Performance Considerations
- Large data operations use pagination and filtering
- Export functions process data in chunks for memory efficiency
- Database queries select only required fields
- Member search uses indexed fields for fast lookup

### Mobile Optimization
- Member portal designed mobile-first
- Touch-friendly interface elements
- PWA capabilities for app-like experience
- Responsive breakpoints for all screen sizes

### Data Integrity
- Foreign key relationships enforced at database level
- Transaction-based operations for financial calculations
- Audit trails for all financial transactions
- Data validation both client-side and database-side

### Backup and Recovery
- Regular database backups via Supabase automatic backups
- Export functions provide data portability
- Import functions allow data restoration
- Admin tools for selective data management

## File Dependencies

**Critical Files** (system won't work without these):
- `script.js` - Core business logic
- `auth.js` - Authentication system
- `index.html` - Entry point and navigation

**Module Files** (can be developed independently):
- `home.html` + `home-dashboard.css` - Main dashboard
- `member-portal.html` - Member self-service
- `admin.html` - PIN management
- `member-management.html` - Member operations
- `data-admin.html` - Data administration

**Configuration Files**:
- `admin password change.txt` - SQL snippets for password updates

## Security Considerations

- **Never commit database credentials** - currently hardcoded but should be environment variables
- **Validate all user inputs** before database operations
- **Use parameterized queries** through Supabase client (prevents SQL injection)
- **Implement proper session management** with timeouts and monitoring
- **Test authentication bypasses** regularly
- **Audit financial calculations** for accuracy and consistency