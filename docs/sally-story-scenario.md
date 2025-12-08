# Sally's Story: Scenario Specification

## Character Profile

**Name:** Sally Chen  
**Business:** Petal & Stem Florals — a local florist with online ordering  
**Location:** Sacramento, CA  
**Technical Skill:** Can use Squarespace, Instagram, and her POS system. Has heard the word "API" but couldn't define it.  
**Website:** Built 18 months ago by a freelance developer ("Marcus") for $2,500. WordPress + WooCommerce + a custom plugin for local delivery scheduling.  
**Payment Processing:** Stripe integration via WooCommerce  
**Monthly Online Revenue:** ~$8,000 (about 30% of total revenue)

---

## Act 1: The Inciting Incident

### Scene 1.1: The Email

**Date:** Tuesday, 10:47 AM  
**Context:** Sally is processing a Mother's Day pre-order rush when her phone buzzes.

```
From: Google Merchant Center <merchant-center-noreply@google.com>
To: sally@petalandstemflorals.com
Subject: Action required: Your account has policy violations

Hi Sally,

Your Google Merchant Center account (Merchant ID: 548293017) has been 
suspended due to security policy violations detected on your website.

Issue detected: Security vulnerabilities on your website
Affected products: All 47 products in your feed
Status: Suspended from Google Shopping

What we found:
Our automated security scan detected the following issues:
• Potential exposure of customer data through insecure API endpoints
• Missing security headers on checkout pages
• Outdated software components with known vulnerabilities

Why this matters:
These issues could put your customers' payment information and personal 
data at risk. To protect shoppers, we've temporarily removed your 
products from Google Shopping.

What you need to do:
1. Fix the security vulnerabilities on your website
2. Request a review once issues are resolved
3. Allow 3-5 business days for re-review

If issues aren't resolved within 30 days, your account may be 
permanently suspended.

Google Merchant Center Team
```

### Scene 1.2: Sally's Reaction

**What she texts Marcus:**

```
Sally: Hey, Google says my website has security problems and 
       suspended my shopping account. Can you look at it?
       
Marcus: I can take a look this weekend maybe. Might need to 
        hire someone tho, security isn't really my thing

Sally: How much would that cost?

Marcus: idk, probably like $150-200/hr? my buddy paid $5k 
        for a security audit last year

Sally: I can't afford that right now 😫
```

---

## Act 2: The VentiAPI Solution

### Scene 2.1: VentiAPI Scan — Executive View

**What Sally Sees:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  SECURITY SUMMARY FOR PETALANDSTEMFLORALS.COM                      │
│  Scan completed: December 3, 2025 at 2:47 PM                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔴 YOUR RISK LEVEL: HIGH                                          │
│                                                                     │
│  You have 3 critical issues that need immediate attention.         │
│  These could expose your customers' payment and personal data.     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  WHAT THIS MEANS FOR YOUR BUSINESS:                                │
│                                                                     │
│  ⚠️  CRITICAL: Customer Data at Risk                               │
│      An attacker could steal customer names, addresses, and        │
│      order history from your delivery scheduling system.           │
│      This is likely why Google suspended your account.             │
│                                                                     │
│  ⚠️  CRITICAL: Order Information Exposed                           │
│      Anyone could view other customers' orders without logging     │
│      in. This includes what they bought and their addresses.       │
│                                                                     │
│  ⚠️  HIGH: Customer Accounts Vulnerable                            │
│      An attacker could access any customer's account by            │
│      guessing their customer number.                               │
│                                                                     │
│  ⚡ 4 additional issues (medium/low priority)                      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  💰 POTENTIAL COST OF INACTION:                                    │
│                                                                     │
│  • Average small business data breach cost: $108,000               │
│  • Your exposure: Customer data for ~2,400 orders                  │
│  • California CCPA fines: Up to $7,500 per violation               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ WHAT YOU CAN DO:                                               │
│                                                                     │
│  1. Share the Developer Report with Marcus                         │
│     → It tells them exactly which files to fix and how             │
│                                                                     │
│  2. The critical fixes take about 2-4 hours of developer time      │
│                                                                     │
│  3. After fixes, re-scan to generate a clean report for Google     │
│                                                                     │
│  [📤 Send Developer Report to Marcus]  [📋 Download Summary PDF]   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Scene 2.2: Developer Report (What Marcus Receives)

```
From: sally@petalandstemflorals.com (via VentiAPI)
To: marcus.developer@gmail.com
Subject: Security fixes needed — detailed instructions attached

Hi Marcus,

I ran a security scan. The report below shows exactly what needs 
to be fixed with specific files, line numbers, and example code.

Can you estimate how long this would take?

Sally
```

**Attached Report:**

```
## VentiAPI Developer Report
## Target: petalandstemflorals.com

### CRITICAL PRIORITY — Fix within 48 hours

#### Issue 1: SQL Injection in Delivery Scheduling Plugin

**Location:** `/wp-content/plugins/petal-delivery-scheduler/includes/class-api.php`  
**Line:** 47  
**Endpoint:** `POST /wp-json/petal-delivery/v1/slots`

**What's happening:**  
User input is concatenated directly into a SQL query. An attacker 
can inject malicious SQL to extract your entire customer database.

**Vulnerable code:**
```php
// Line 47 - VULNERABLE
$query = "SELECT * FROM {$wpdb->prefix}delivery_slots 
          WHERE date = '" . $_POST['date'] . "'";
```

**Fixed code:**
```php
$query = $wpdb->prepare(
    "SELECT * FROM {$wpdb->prefix}delivery_slots WHERE date = %s",
    sanitize_text_field($_POST['date'])
);
```

---

#### Issue 2: Broken Object Level Authorization (BOLA)

**Endpoint:** `GET /wp-json/wc/v3/orders/{id}`

**What's happening:**  
Any user can view any order by changing the order ID in the URL.

**Fix — add to functions.php:**
```php
add_filter('woocommerce_rest_check_permissions', 
  function($permission, $context, $object_id, $post_type) {
    if ($post_type === 'shop_order' && $context === 'read') {
        $order = wc_get_order($object_id);
        if ($order->get_customer_id() !== get_current_user_id()) {
            return false;
        }
    }
    return $permission;
}, 10, 4);
```

---

### ESTIMATED EFFORT

| Issue | Priority | Est. Time |
|-------|----------|-----------|
| SQL Injection fix | Critical | 30 min |
| BOLA authorization | Critical | 1-2 hrs |
| Customer endpoint auth | High | 1 hr |
| Security headers | Medium | 30 min |
| **Total** | | **3-5 hours** |
```

---

## Act 3: Resolution

### Scene 3.1: Post-Fix Scan

**VentiAPI Executive View — After Remediation:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  SECURITY SUMMARY FOR PETALANDSTEMFLORALS.COM                      │
│  Scan completed: December 7, 2025 at 3:22 PM                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🟢 YOUR RISK LEVEL: LOW                                           │
│                                                                     │
│  Great news! Your critical vulnerabilities have been resolved.     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ RESOLVED ISSUES:                                               │
│  • SQL Injection vulnerability — FIXED                             │
│  • Order data exposure — FIXED                                     │
│  • Customer account access — FIXED                                 │
│                                                                     │
│  📋 2 remaining low-priority items (optional improvements)         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📄 GOOGLE MERCHANT CENTER REINSTATEMENT                           │
│                                                                     │
│  [📥 Download Compliance Report for Google Review]                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Scene 3.2: Sally's Closing Line

> "I went from 'what's an API?' to 'here's exactly what my developer needs to fix' in fifteen minutes. I didn't have to learn a new language — I just needed someone to translate."

---

## Technical Specifications

### Vulnerability Fingerprints

| Finding ID | Type | CWE | CVSS | Endpoint |
|------------|------|-----|------|----------|
| PETAL-001 | SQL Injection | CWE-89 | 9.8 | `/wp-json/petal-delivery/v1/slots` |
| PETAL-002 | BOLA | CWE-639 | 7.5 | `/wp-json/wc/v3/orders/{id}` |
| PETAL-003 | Broken Auth | CWE-287 | 8.1 | `/wp-json/wc/v3/customers/{id}` |
| PETAL-004 | Missing Headers | CWE-693 | 5.3 | Multiple |
| PETAL-005 | Outdated Component | CWE-1104 | 6.5 | Plugin directory |
| PETAL-006 | Info Disclosure | CWE-200 | 3.7 | `/wp-json/` |
| PETAL-007 | Weak TLS | CWE-326 | 4.3 | SSL config |

### Key Narrative Points

1. **Sally never becomes technical.** She succeeds because she doesn't have to.
2. **The Mother's Day timing matters.** Stakes are concrete and immediate.
3. **The contrast is density.** Traditional scanners show 50 fields; Executive View shows 3 bullet points.
4. **Marcus gets actionable instructions.** Copy-paste ready code, not research assignments.
