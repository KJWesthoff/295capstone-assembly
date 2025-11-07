🎯 SECURE-VISION-CHAT MIGRATION PLAN

  📊 PROJECT OVERVIEW

  Source: Vite + React + React Router (secure-vision-chat)Target: Next.js 15 + Cedar OS + Mastra (cedar-mastra)Purpose: Security vulnerability dashboard with AI-powered analysis

  The secure-vision-chat app is a multi-role security dashboard that provides:
  - Security Analyst View: Detailed vulnerability findings with CVSS scores, exploitability, and OWASP mappings
  - Developer View: Technical remediation guidance with code examples
  - Executive View: Business impact analysis, risk trends, compliance snapshots, and board reports

  ---
  🏗️ ARCHITECTURE ANALYSIS

  Current State (Vite App)

  - Single-page app with React Router (/ route only)
  - Cedar OS integrated with OpenAI provider
  - Context Basket system for collecting items to send to AI
  - Mock data for findings, executive KPIs, and trends
  - Role-based views (3 different personas)

  Key Features to Migrate

  1. Context Basket: Shopping basket-style UI for collecting context items
  2. Role Switcher: Dropdown to switch between Security Analyst / C-Suite / Developer views
  3. Findings Tables: Sortable, filterable tables with severity badges
  4. Detail Drawers: Slide-out panels showing full vulnerability details
  5. Executive Dashboard: KPI cards, trend charts, compliance snapshots
  6. Board Brief Wizard: Multi-step form to generate executive reports
  7. Chat Presets: Quick-action buttons for common AI queries
  8. Diff View: Modal showing new/regressed/resolved findings

  ---
  📋 COMPREHENSIVE MIGRATION TASK LIST

  PHASE 1: Core Infrastructure Setup ⚙️

  1.1 Dependencies & Configuration

  - Install missing Radix UI components (8 additional components needed):
  npx shadcn@latest add aspect-ratio alert-dialog pagination sheet
  npx shadcn@latest add hover-card navigation-menu collapsible calendar
  - Install additional dependencies:
  npm install embla-carousel-react vaul input-otp react-resizable-panels
  - Install charting library:
  npm install recharts
  - Update Cedar OS to v0.1.23 (currently on v0.1.18):
  npm install cedar-os@^0.1.23

  1.2 Routing Architecture

  - Create new route: /dashboard (main scanner dashboard)
  - Update homepage routing:
    - / → Marketing homepage (DONE in previous migration)
    - /dashboard → Security scanner dashboard (NEW)
    - /security → Keep existing security page or consolidate with /dashboard

  ---
  PHASE 2: Data Layer Migration 📊

  2.1 Type Definitions

  - Copy src/types/finding.ts → cedar-mastra/src/types/finding.ts
    - Contains complete Finding interface with flags, OWASP, CWE fields

  2.2 Mock Data

  - Copy src/data/mockFindings.ts → cedar-mastra/src/data/mockFindings.ts
    - 15+ sample vulnerabilities with realistic data
  - Copy src/data/mockExecutiveData.ts → cedar-mastra/src/data/mockExecutiveData.ts
    - Executive KPIs, trend data, compliance snapshots

  2.3 State Management

  - Copy src/contexts/ContextBasketContext.tsx → cedar-mastra/src/contexts/ContextBasketContext.tsx
    - Manages context basket items (add/remove/clear)
    - Tracks token counts
  - Integrate with existing cedar-mastra/src/app/cedar-os/state.ts

  ---
  PHASE 3: Core Components Migration 🧩

  3.1 Main Layout Components

  - Migrate src/pages/Index.tsx → cedar-mastra/src/app/dashboard/page.tsx
    - Role switcher dropdown
    - Sidebar toggle logic
    - Tab management (Context Basket vs AI Chat)

  3.2 Security Analyst Components

  - SecurityAnalystView.tsx → cedar-mastra/src/components/security/SecurityAnalystView.tsx
  - FindingsTable.tsx → cedar-mastra/src/components/security/FindingsTable.tsx
    - Sortable columns: Priority Score, Severity, Endpoint, CVSS, Exploit, OWASP
    - Row selection with checkboxes
    - Diff view button (shows new/regressed/resolved counts)
  - FindingDetailsDrawer.tsx → cedar-mastra/src/components/security/FindingDetailsDrawer.tsx
    - Slide-out panel with full vulnerability details
    - "Add to Chat" button integration
  - DiffViewModal.tsx → cedar-mastra/src/components/security/DiffViewModal.tsx
    - Shows findings categorized as new/regressed/resolved
  - ChatPresets.tsx (analyst) → cedar-mastra/src/components/security/AnalystChatPresets.tsx
    - Quick-action buttons for common queries

  3.3 Developer Components

  - DeveloperView.tsx → cedar-mastra/src/components/developer/DeveloperView.tsx
  - DeveloperFindingsTable.tsx → cedar-mastra/src/components/developer/DeveloperFindingsTable.tsx
    - Grouped by repository/service
    - Shows remediation status (planned/in-progress/merged)
  - DeveloperDetailsDrawer.tsx → cedar-mastra/src/components/developer/DeveloperDetailsDrawer.tsx
    - Code snippets for vulnerable code
    - Remediation plan with staged steps
  - ChatPresets.tsx (developer) → cedar-mastra/src/components/developer/DeveloperChatPresets.tsx
    - Technical remediation queries

  3.4 Executive Components

  - ExecutiveView.tsx → cedar-mastra/src/components/executive/ExecutiveView.tsx
  - ExecutiveKPICards.tsx → cedar-mastra/src/components/executive/ExecutiveKPICards.tsx
    - Risk score, critical/high counts, MTTR metrics
    - "Add to Report" chips on each card
  - ExecutiveTrendChart.tsx → cedar-mastra/src/components/executive/ExecutiveTrendChart.tsx
    - Recharts line charts for vulnerability trends and SLA compliance
  - ExecutiveTopRisks.tsx → cedar-mastra/src/components/executive/ExecutiveTopRisks.tsx
    - Top 5 risks with business impact descriptions
  - ExecutiveComplianceSnapshot.tsx → cedar-mastra/src/components/executive/ExecutiveComplianceSnapshot.tsx
    - SOC2, PCI-DSS, GDPR compliance percentages
  - ExecutiveOwnershipTable.tsx → cedar-mastra/src/components/executive/ExecutiveOwnershipTable.tsx
    - Team ownership with SLA breach percentages
  - BoardBriefWizard.tsx → cedar-mastra/src/components/executive/BoardBriefWizard.tsx
    - Multi-step wizard to generate executive board reports
    - Integrates selected KPIs and risks
  - ExecutiveChatPresets.tsx → cedar-mastra/src/components/executive/ExecutiveChatPresets.tsx
    - Business-focused queries
  - AddToReportChip.tsx → cedar-mastra/src/components/executive/AddToReportChip.tsx
    - Small chip button for adding items to board brief

  3.5 Shared Components

  - ContextBasket.tsx → cedar-mastra/src/components/chat/ContextBasket.tsx
    - Shopping basket UI for context items
    - Token counter
    - "Send to AI" button
  - SecurityChatbot.tsx → cedar-mastra/src/components/chat/SecurityChatbot.tsx
    - IMPORTANT: Replace with Cedar OS FloatingCedarChat or integrate properly
    - Currently uses simulated responses; needs real LLM integration
  - EmptyState.tsx → cedar-mastra/src/components/security/EmptyState.tsx
    - Initial state when no scan results
  - StatCard.tsx → cedar-mastra/src/components/security/StatCard.tsx
    - Reusable stat card component
  - VulnerabilityItem.tsx → cedar-mastra/src/components/security/VulnerabilityItem.tsx
    - Individual vulnerability list item
  - ScanResults.tsx → Keep or remove (may be redundant with new views)
  - ScanConfigDialog.tsx → Already exists in cedar-mastra, verify compatibility

  ---
  PHASE 4: Cedar OS Integration 🌲

  4.1 Cedar Provider Setup

  - Update Cedar provider in cedar-mastra/src/app/layout.tsx
    - Currently uses Mastra backend
    - secure-vision-chat uses OpenAI directly
    - Decision needed: Keep Mastra or switch to OpenAI?

  4.2 Context Bridges

  - Copy src/lib/cedar/bridges.tsx → cedar-mastra/src/lib/cedar/bridges.tsx
    - FindingsSelectionBridge: Auto-syncs selected findings to Cedar context
    - ExecutiveDataBridge: Auto-syncs executive KPIs to Cedar context
  - Mount bridges in appropriate views:
    - SecurityAnalystView: FindingsSelectionBridge
    - DeveloperView: FindingsSelectionBridge
    - ExecutiveView: ExecutiveDataBridge

  4.3 Cedar Actions & Hooks

  - Copy src/lib/cedar/actions.ts → cedar-mastra/src/lib/cedar/actions.ts
    - Helper functions for Cedar context manipulation
  - Copy src/lib/cedar/hooks.ts → cedar-mastra/src/lib/cedar/hooks.ts
    - useCedarActions: Provides addToContext() helper
  - Wire "Add to Chat" buttons throughout components

  4.4 Cedar Context Strategy

  - Review Cedar context documentation in README_CEDAR_CONTEXT.md
  - Implement context structure for:
    - Selected findings (analyst/developer views)
    - Executive summary data (executive view)
    - Board brief selections

  ---
  PHASE 5: Styling & UI Polish 🎨

  5.1 Theme Integration

  - Verify UC Berkeley colors are applied to migrated components
  - Update gradient definitions if needed:
    - .bg-gradient-primary used in multiple components

  5.2 Layout Adjustments

  - Convert Vite import.meta.env to Next.js process.env
    - Example: VITE_OPENAI_API_KEY → NEXT_PUBLIC_OPENAI_API_KEY
  - Replace React Router <Link> with Next.js <Link>
    - No changes needed (only uses / route)
  - Verify responsive breakpoints work in Next.js

  5.3 Component Polish

  - Test all drawer/modal animations
  - Verify table sorting and filtering
  - Test role switcher dropdown
  - Verify sidebar toggle animations

  ---
  PHASE 6: Backend Integration 🔌

  6.1 Connect to Real Scanner API

  - Replace mockFindings with real API calls to /api/scan/results
  - Update ScanConfigDialog to trigger real scans
  - Wire scan progress polling (already exists in /security page)

  6.2 AI Backend Integration

  - Option A: Keep Mastra backend (port 4111)
    - Update Cedar provider to use Mastra
    - Implement context passing through Mastra workflows
  - Option B: Use OpenAI directly
    - Keep existing src/lib/cedar/provider.tsx from secure-vision-chat
    - Add NEXT_PUBLIC_OPENAI_API_KEY to .env
  - Replace simulated SecurityChatbot responses with real LLM calls

  6.3 Context Basket → AI Integration

  - Implement "Send to AI" functionality
    - Collect context basket items
    - Send structured context to LLM
    - Stream response back to SecurityChatbot
  - Integrate with Cedar context system

  ---
  PHASE 7: Testing & Validation ✅

  7.1 Component Testing

  - Test SecurityAnalystView with mock data
  - Test DeveloperView with mock data
  - Test ExecutiveView with mock data
  - Test role switching
  - Test context basket add/remove/clear
  - Test "Add to Chat" buttons
  - Test "Add to Report" buttons (executive view)

  7.2 Cedar OS Testing

  - Verify FindingsSelectionBridge syncs state to Cedar
  - Verify ExecutiveDataBridge syncs state to Cedar
  - Test AI chat with context (open Cedar copilot with Ctrl+/)
  - Verify context appears in Cedar DevTools

  7.3 Integration Testing

  - Test full scan workflow: Config → Scan → Results → AI Analysis
  - Test role-specific AI responses
  - Test Board Brief generation
  - Test diff view with new/regressed/resolved findings

  7.4 Cross-Browser Testing

  - Chrome
  - Safari
  - Firefox

  ---
  PHASE 8: Documentation & Cleanup 📚

  8.1 Update Documentation

  - Update docs/CLAUDE.md with new dashboard route
  - Document role-based views
  - Document context basket usage
  - Document Cedar bridge setup

  8.2 Archive Old Code

  - Archive secure-vision-chat/ folder (move to frontend-legacy/secure-vision-chat/)
  - Keep for reference until migration complete

  8.3 Environment Variables

  - Update .env.example with new variables:
  NEXT_PUBLIC_OPENAI_API_KEY=sk-...  # If using OpenAI directly
  SCANNER_SERVICE_URL=http://localhost:8000

  ---
  🔍 KEY DIFFERENCES & CHALLENGES

  1. Router Migration

  - Challenge: Vite uses React Router, Next.js uses file-based routing
  - Solution: Move Index.tsx → /dashboard/page.tsx

  2. Environment Variables

  - Challenge: Vite uses import.meta.env.VITE_*, Next.js uses process.env.NEXT_PUBLIC_*
  - Solution: Search/replace all env variable references

  3. Cedar Provider

  - Challenge: secure-vision-chat uses OpenAI directly, cedar-mastra uses Mastra
  - Solution: Decision needed - keep Mastra or switch to OpenAI?

  4. SecurityChatbot vs FloatingCedarChat

  - Challenge: secure-vision-chat has custom SecurityChatbot, cedar-mastra has FloatingCedarChat
  - Solution: Decide which to keep or merge features

  5. Mock Data vs Real API

  - Challenge: secure-vision-chat uses mock data, cedar-mastra has real scanner API
  - Solution: Replace mock data with API calls progressively

  ---
  🎯 RECOMMENDED MIGRATION ORDER

  1. Start with Phase 1-2 (dependencies + data layer) - Quick wins
  2. Phase 3.1-3.2 (Security Analyst view) - Core functionality
  3. Phase 4 (Cedar OS integration) - Critical for AI features
  4. Phase 3.3-3.4 (Developer + Executive views) - Nice-to-haves
  5. Phase 5-6 (styling + backend) - Polish
  6. Phase 7-8 (testing + docs) - Validation

  ---
  📊 MIGRATION SCOPE SUMMARY

  - Files to migrate: ~40 components + 3 contexts + 2 data files + Cedar utilities
  - New routes: /dashboard (main scanner dashboard)
  - Dependencies: 12+ new packages
  - Estimated effort: 8-12 hours (with breaks)