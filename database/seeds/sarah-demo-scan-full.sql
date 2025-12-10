-- ============================================================================
-- Sarah's Story: Petal & Stem Florals - Full Demo Scan Data
-- Adapted for schema: 01-create-scanner-schema.sql
-- Evidence structure matches frontend Evidence interface
-- ============================================================================

DO $$
DECLARE
    v_scan_id TEXT := 'sarah-petal-stem-demo-001';
BEGIN

-- ============================================================================
-- Insert the scan record
-- ============================================================================

INSERT INTO scans (
    scan_id,
    status,
    server_url,
    spec_url,
    scanners,
    dangerous,
    fuzz_auth,
    max_requests,
    progress,
    findings_count,
    user_id,
    created_at,
    updated_at,
    completed_at
) VALUES (
    v_scan_id,
    'completed',
    'https://petalandstemflorals.com',
    NULL,
    ARRAY['ventiapi', 'zap', 'nuclei'],
    false,
    false,
    100,
    100,
    8,
    'sarah@petalandstemflorals.com',
    '2025-12-09 09:15:22',
    '2025-12-09 09:21:47',
    '2025-12-09 09:21:47'
)
ON CONFLICT (scan_id) DO UPDATE SET
    updated_at = NOW(),
    status = EXCLUDED.status,
    progress = EXCLUDED.progress,
    findings_count = EXCLUDED.findings_count;

-- ============================================================================
-- Delete existing findings for this scan (idempotent)
-- ============================================================================

DELETE FROM findings WHERE scan_id = v_scan_id;

-- ============================================================================
-- Finding 1: SQL Injection (CRITICAL) - PETAL-001
-- ============================================================================

INSERT INTO findings (
    scan_id,
    scanner,
    scanner_description,
    rule,
    title,
    severity,
    score,
    endpoint,
    method,
    description,
    evidence
) VALUES (
    v_scan_id,
    'ventiapi',
    'VentiAPI OWASP API Security Scanner',
    'injection',
    'SQL Injection in Delivery Slot Query',
    'Critical',
    98,
    '/wp-json/petal-delivery/v1/slots',
    'POST',
    'The delivery scheduling endpoint concatenates user input directly into SQL queries without sanitization. An attacker can inject malicious SQL to extract, modify, or delete data from the entire database, including customer payment information and order history.',
    '{
        "request": {
            "method": "POST",
            "url": "/wp-json/petal-delivery/v1/slots",
            "headers": {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": "wordpress_logged_in_xxx=customer123"
            },
            "body": "date=2025-01-01'' OR ''1''=''1"
        },
        "response": {
            "status_code": 200,
            "headers": {
                "Content-Type": "application/json",
                "X-Powered-By": "PHP/8.1"
            },
            "body": "[{\"id\":1,\"date\":\"2025-01-15\",\"time\":\"09:00\"},{\"id\":2,\"date\":\"2025-01-15\",\"time\":\"10:00\"},...(847 more records)]",
            "size_bytes": 45230
        },
        "auth_context": "Authenticated as customer123",
        "probe_name": "sql_injection_detection",
        "timestamp": "2025-12-09T09:17:42-08:00",
        "curl_command": "curl -X POST https://petalandstemflorals.com/wp-json/petal-delivery/v1/slots -H \"Cookie: wordpress_logged_in_xxx=customer123\" -d \"date=2025-01-01'' OR ''1''=''1\"",
        "steps": [
            "Navigate to delivery scheduling page",
            "Open browser developer tools",
            "Intercept the POST request to /wp-json/petal-delivery/v1/slots",
            "Modify the date parameter to include SQL injection payload",
            "Observe that all 849 delivery slots are returned instead of filtered results"
        ],
        "why_vulnerable": "User input is concatenated directly into SQL query without sanitization or parameterization",
        "attack_scenario": "An attacker sends a crafted date parameter containing SQL code. The application executes the malicious query, returning all customer records including names, addresses, phone numbers, and order history.",
        "poc_references": [],
        "vulnerable_code": {
            "file": "/wp-content/plugins/petal-delivery-scheduler/includes/class-api.php",
            "line": 47,
            "language": "php",
            "snippet": "$query = \"SELECT * FROM {$wpdb->prefix}delivery_slots WHERE date = ''\" . $_POST[''date''] . \"''\";"
        },
        "fix_code": {
            "language": "php",
            "snippet": "$query = $wpdb->prepare(\n    \"SELECT * FROM {$wpdb->prefix}delivery_slots WHERE date = %s\",\n    sanitize_text_field($_POST[''date''])\n);\n$results = $wpdb->get_results($query);"
        },
        "business_impact": "Complete database compromise. It is likely that Google suspended your Merchant Center account because of this vulnerability.",
        "remediation_time": "30 minutes",
        "executive_summary": "An attacker could steal customer names, addresses, and order history from your delivery scheduling system. This is likely why Google suspended your account."
    }'::jsonb
);

-- ============================================================================
-- Finding 2: Broken Object Level Authorization - Orders (CRITICAL) - PETAL-002
-- ============================================================================

INSERT INTO findings (
    scan_id,
    scanner,
    scanner_description,
    rule,
    title,
    severity,
    score,
    endpoint,
    method,
    description,
    evidence
) VALUES (
    v_scan_id,
    'zap',
    'OWASP ZAP API Scanner',
    'bola',
    'Broken Object Level Authorization - Order Data Exposure',
    'Critical',
    86,
    '/wp-json/wc/v3/orders/{id}',
    'GET',
    'The WooCommerce REST API allows any authenticated user to access any order by manipulating the order ID parameter. A logged-in customer can view other customers'' orders, including their names, addresses, items purchased, and payment details.',
    '{
        "request": {
            "method": "GET",
            "url": "/wp-json/wc/v3/orders/1847",
            "headers": {
                "Authorization": "Bearer eyJ...(token for customer ID 42)",
                "Content-Type": "application/json"
            }
        },
        "response": {
            "status_code": 200,
            "headers": {
                "Content-Type": "application/json",
                "X-WC-Total": "2847"
            },
            "body": "{\"id\":1847,\"customer_id\":156,\"billing\":{\"first_name\":\"Margaret\",\"last_name\":\"Thompson\",\"address_1\":\"742 Evergreen Terrace\",\"city\":\"Sacramento\",\"phone\":\"916-555-0147\"},\"line_items\":[{\"name\":\"Mother''s Day Deluxe Arrangement\",\"quantity\":1,\"total\":\"89.99\"}]}",
            "size_bytes": 1847
        },
        "auth_context": "Authenticated as customer ID 42 (different from order owner 156)",
        "probe_name": "bola_idor_detection",
        "timestamp": "2025-12-09T09:18:03-08:00",
        "curl_command": "curl -X GET https://petalandstemflorals.com/wp-json/wc/v3/orders/1847 -H \"Authorization: Bearer eyJ...\"",
        "steps": [
            "Create or use an existing customer account",
            "Authenticate and obtain a valid JWT token",
            "Make a GET request to /wp-json/wc/v3/orders/1847 (an order belonging to another customer)",
            "Observe that the full order details are returned including billing address and items"
        ],
        "why_vulnerable": "The API endpoint does not verify that the authenticated user owns the requested order before returning data",
        "attack_scenario": "Attacker creates a customer account, then iterates through order IDs (1, 2, 3...) to harvest all customer order data including names, addresses, and purchase history.",
        "poc_references": [],
        "fix_code": {
            "language": "php",
            "file": "functions.php",
            "snippet": "add_filter(''woocommerce_rest_check_permissions'', function($permission, $context, $object_id, $post_type) {\n    if ($post_type === ''shop_order'' && $context === ''read'') {\n        $order = wc_get_order($object_id);\n        if ($order && $order->get_customer_id() !== get_current_user_id()) {\n            return false;\n        }\n    }\n    return $permission;\n}, 10, 4);"
        },
        "business_impact": "Mass customer data exposure. All 2,400+ historical orders accessible to any registered user.",
        "remediation_time": "1-2 hours",
        "executive_summary": "Anyone could view other customers'' orders without logging in. This includes what they bought and their addresses."
    }'::jsonb
);

-- ============================================================================
-- Finding 3: Broken Authentication - Customer Endpoint (HIGH) - PETAL-003
-- ============================================================================

INSERT INTO findings (
    scan_id,
    scanner,
    scanner_description,
    rule,
    title,
    severity,
    score,
    endpoint,
    method,
    description,
    evidence
) VALUES (
    v_scan_id,
    'nuclei',
    'ProjectDiscovery Nuclei Scanner',
    'auth',
    'Broken Authentication - Customer Profile Access',
    'High',
    75,
    '/wp-json/wc/v3/customers/{id}',
    'GET',
    'Customer profile endpoints lack proper authorization checks. Any authenticated user can access other customers'' profiles by modifying the customer ID parameter, exposing personal information including email addresses and order history.',
    '{
        "request": {
            "method": "GET",
            "url": "/wp-json/wc/v3/customers/156",
            "headers": {
                "Authorization": "Bearer eyJ...(token for customer ID 42)"
            }
        },
        "response": {
            "status_code": 200,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": "{\"id\":156,\"email\":\"margaret.t@email.com\",\"first_name\":\"Margaret\",\"last_name\":\"Thompson\",\"billing\":{\"address_1\":\"742 Evergreen Terrace\",\"city\":\"Sacramento\",\"state\":\"CA\",\"postcode\":\"95814\",\"phone\":\"916-555-0147\"},\"orders_count\":12,\"total_spent\":\"1,247.88\"}",
            "size_bytes": 892
        },
        "auth_context": "Authenticated as customer ID 42",
        "probe_name": "broken_auth_idor",
        "timestamp": "2025-12-09T09:18:26-08:00",
        "curl_command": "curl -X GET https://petalandstemflorals.com/wp-json/wc/v3/customers/156 -H \"Authorization: Bearer eyJ...\"",
        "steps": [
            "Authenticate as any customer",
            "Request another customer''s profile by changing the ID in the URL",
            "Observe that PII is returned without authorization check"
        ],
        "why_vulnerable": "No ownership validation on customer profile endpoint",
        "attack_scenario": "Attacker enumerates customer IDs to build a database of customer emails, addresses, and spending patterns for phishing or identity theft.",
        "poc_references": [],
        "fix_code": {
            "language": "php",
            "file": "functions.php",
            "snippet": "add_filter(''woocommerce_rest_check_permissions'', function($permission, $context, $object_id, $post_type) {\n    if ($post_type === ''customer'' && $context === ''read'') {\n        if ($object_id !== get_current_user_id()) {\n            return false;\n        }\n    }\n    return $permission;\n}, 10, 4);"
        },
        "business_impact": "Customer PII exposure enables targeted phishing attacks against your customers.",
        "remediation_time": "1 hour",
        "executive_summary": "An attacker could access any customer''s account by guessing their customer number."
    }'::jsonb
);

-- ============================================================================
-- Finding 4: Missing Security Headers (MEDIUM) - PETAL-004
-- ============================================================================

INSERT INTO findings (
    scan_id,
    scanner,
    scanner_description,
    rule,
    title,
    severity,
    score,
    endpoint,
    method,
    description,
    evidence
) VALUES (
    v_scan_id,
    'zap',
    'OWASP ZAP Baseline Scanner',
    'misconfig',
    'Missing Security Headers on Checkout Pages',
    'Medium',
    53,
    '/checkout/',
    'GET',
    'Critical security headers are missing from checkout pages, increasing vulnerability to clickjacking, MIME-type sniffing, and cross-site scripting attacks. This is particularly concerning on pages handling payment information.',
    '{
        "request": {
            "method": "GET",
            "url": "/checkout/",
            "headers": {
                "Accept": "text/html"
            }
        },
        "response": {
            "status_code": 200,
            "headers": {
                "Content-Type": "text/html; charset=UTF-8",
                "Server": "nginx"
            },
            "body": "<!DOCTYPE html><html>...(checkout page HTML)...</html>",
            "size_bytes": 45000
        },
        "auth_context": "Unauthenticated",
        "probe_name": "security_headers_check",
        "timestamp": "2025-12-09T09:19:14-08:00",
        "curl_command": "curl -I https://petalandstemflorals.com/checkout/",
        "steps": [
            "Request the checkout page",
            "Inspect response headers",
            "Note missing X-Frame-Options, CSP, HSTS headers"
        ],
        "why_vulnerable": "Server does not send security headers that protect against common web attacks",
        "attack_scenario": "Attacker creates a malicious website with your checkout page embedded in an invisible iframe. When customers think they''re clicking on the attacker''s site, they''re actually completing purchases on your site.",
        "poc_references": [],
        "missing_headers": ["X-Frame-Options", "X-Content-Type-Options", "Content-Security-Policy", "Strict-Transport-Security"],
        "fix_code": {
            "language": "php",
            "file": "functions.php",
            "snippet": "add_action(''send_headers'', function() {\n    header(''X-Frame-Options: DENY'');\n    header(''X-Content-Type-Options: nosniff'');\n    header(''X-XSS-Protection: 1; mode=block'');\n    header(''Referrer-Policy: strict-origin-when-cross-origin'');\n    header(\"Content-Security-Policy: default-src ''self''; script-src ''self'' https://js.stripe.com;\");\n});"
        },
        "business_impact": "Customers could be tricked into unauthorized purchases or credential theft through clickjacking.",
        "remediation_time": "30 minutes",
        "executive_summary": "Missing security headers on checkout pages could allow attackers to trick customers."
    }'::jsonb
);

-- ============================================================================
-- Finding 5: Outdated Plugin with Known Vulnerabilities (MEDIUM) - PETAL-005
-- ============================================================================

INSERT INTO findings (
    scan_id,
    scanner,
    scanner_description,
    rule,
    title,
    severity,
    score,
    endpoint,
    method,
    description,
    evidence
) VALUES (
    v_scan_id,
    'nuclei',
    'ProjectDiscovery Nuclei - WordPress Templates',
    'inventory',
    'Outdated Third-Party Plugin with Known Vulnerabilities',
    'Medium',
    65,
    '/wp-content/plugins/petal-delivery-scheduler/',
    'GET',
    'The custom delivery scheduling plugin has not been updated in over 2 years and contains multiple known security vulnerabilities. Unmaintained plugins are a common attack vector for WordPress sites.',
    '{
        "request": {
            "method": "GET",
            "url": "/wp-content/plugins/petal-delivery-scheduler/readme.txt",
            "headers": {}
        },
        "response": {
            "status_code": 200,
            "headers": {
                "Content-Type": "text/plain"
            },
            "body": "=== Petal Delivery Scheduler ===\nVersion: 1.2.3\nLast Updated: 2023-04-15\nRequires PHP: 7.4\nTested up to: 6.1",
            "size_bytes": 1200
        },
        "auth_context": "Unauthenticated",
        "probe_name": "wordpress_plugin_version",
        "timestamp": "2025-12-09T09:19:45-08:00",
        "curl_command": "curl https://petalandstemflorals.com/wp-content/plugins/petal-delivery-scheduler/readme.txt",
        "steps": [
            "Request plugin readme.txt file",
            "Parse version information",
            "Compare against known vulnerability databases"
        ],
        "why_vulnerable": "Plugin has not received security updates in over 2 years",
        "attack_scenario": "Attackers actively scan for outdated WordPress plugins with known vulnerabilities. Automated tools can exploit these within hours of public disclosure.",
        "poc_references": [],
        "plugin_info": {
            "name": "Petal Delivery Scheduler",
            "version": "1.2.3",
            "last_updated": "2023-04-15",
            "days_since_update": 847
        },
        "business_impact": "Continued use of unmaintained plugin leaves site permanently vulnerable to evolving attacks.",
        "remediation_time": "1-2 hours",
        "executive_summary": "Outdated plugin hasn''t been updated in over 2 years and contains known vulnerabilities."
    }'::jsonb
);

-- ============================================================================
-- Finding 6: WordPress REST API User Enumeration (MEDIUM) - PETAL-006
-- ============================================================================

INSERT INTO findings (
    scan_id,
    scanner,
    scanner_description,
    rule,
    title,
    severity,
    score,
    endpoint,
    method,
    description,
    evidence
) VALUES (
    v_scan_id,
    'ventiapi',
    'VentiAPI OWASP API Security Scanner',
    'exposure',
    'WordPress REST API Exposes User Information',
    'Medium',
    43,
    '/wp-json/wp/v2/users',
    'GET',
    'The WordPress REST API publicly exposes user information including usernames, which can be used for brute-force password attacks or social engineering.',
    '{
        "request": {
            "method": "GET",
            "url": "/wp-json/wp/v2/users",
            "headers": {}
        },
        "response": {
            "status_code": 200,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": "[{\"id\":1,\"name\":\"Sarah Chen\",\"slug\":\"sarah\",\"link\":\"https://petalandstemflorals.com/author/sarah/\"},{\"id\":2,\"name\":\"marcus_dev\",\"slug\":\"marcus_dev\"}]",
            "size_bytes": 450
        },
        "auth_context": "Unauthenticated",
        "probe_name": "user_enumeration",
        "timestamp": "2025-12-09T09:20:08-08:00",
        "curl_command": "curl https://petalandstemflorals.com/wp-json/wp/v2/users",
        "steps": [
            "Request the WordPress users REST endpoint without authentication",
            "Observe that user information is returned including usernames"
        ],
        "why_vulnerable": "WordPress REST API exposes user endpoints by default without authentication",
        "attack_scenario": "Attacker discovers admin username ''sarah'' and launches automated password brute-force attack against wp-login.php.",
        "poc_references": [],
        "exposed_users": [
            {"id": 1, "username": "sarah", "display_name": "Sarah Chen"},
            {"id": 2, "username": "marcus_dev", "display_name": "marcus_dev"}
        ],
        "fix_code": {
            "language": "php",
            "file": "functions.php",
            "snippet": "add_filter(''rest_endpoints'', function($endpoints) {\n    if (isset($endpoints[''/wp/v2/users''])) {\n        unset($endpoints[''/wp/v2/users'']);\n    }\n    return $endpoints;\n});"
        },
        "business_impact": "Exposed usernames enable targeted credential attacks against site administrators.",
        "remediation_time": "15 minutes",
        "executive_summary": "Admin usernames are publicly exposed, enabling targeted password attacks."
    }'::jsonb
);

-- ============================================================================
-- Finding 7: Weak TLS Configuration (LOW) - PETAL-007
-- ============================================================================

INSERT INTO findings (
    scan_id,
    scanner,
    scanner_description,
    rule,
    title,
    severity,
    score,
    endpoint,
    method,
    description,
    evidence
) VALUES (
    v_scan_id,
    'zap',
    'OWASP ZAP SSL Scanner',
    'misconfig',
    'Deprecated TLS Versions Enabled',
    'Low',
    43,
    'https://petalandstemflorals.com',
    'GET',
    'The server accepts connections using deprecated TLS 1.0 and TLS 1.1 protocols, which have known vulnerabilities. While TLS 1.2/1.3 are also supported, the presence of older versions creates unnecessary risk.',
    '{
        "request": {
            "method": "GET",
            "url": "https://petalandstemflorals.com",
            "headers": {}
        },
        "response": {
            "status_code": 200,
            "headers": {
                "Content-Type": "text/html"
            },
            "body": "<!DOCTYPE html>...",
            "size_bytes": 25000
        },
        "auth_context": "N/A - TLS handshake analysis",
        "probe_name": "tls_version_check",
        "timestamp": "2025-12-09T09:20:37-08:00",
        "curl_command": "curl -v --tlsv1.0 https://petalandstemflorals.com",
        "steps": [
            "Attempt TLS 1.0 connection - succeeds (vulnerable)",
            "Attempt TLS 1.1 connection - succeeds (vulnerable)",
            "Attempt TLS 1.2 connection - succeeds (good)",
            "Attempt TLS 1.3 connection - succeeds (good)"
        ],
        "why_vulnerable": "Server accepts deprecated TLS versions with known vulnerabilities",
        "attack_scenario": "Attacker performs downgrade attack to force connection to weaker TLS version, then exploits protocol vulnerabilities to intercept encrypted traffic.",
        "poc_references": ["CVE-2011-3389"],
        "tls_configuration": {
            "grade": "B",
            "tls_1_0": true,
            "tls_1_1": true,
            "tls_1_2": true,
            "tls_1_3": true
        },
        "business_impact": "Low immediate risk as modern browsers prefer TLS 1.3/1.2, but non-compliance with PCI-DSS 3.2+ requirements.",
        "remediation_time": "Depends on hosting provider",
        "executive_summary": "Server accepts outdated encryption protocols that have known vulnerabilities."
    }'::jsonb
);

-- ============================================================================
-- Finding 8: Cleartext Storage of Sensitive Information (HIGH) - PETAL-008
-- CVE-2025-4394 / CWE-312
-- ============================================================================

INSERT INTO findings (
    scan_id,
    scanner,
    scanner_description,
    rule,
    title,
    severity,
    score,
    endpoint,
    method,
    description,
    evidence
) VALUES (
    v_scan_id,
    'nuclei',
    'ProjectDiscovery Nuclei - Sensitive Data Scanner',
    'exposure',
    'Cleartext Storage of Customer Payment Credentials',
    'High',
    78,
    '/wp-content/uploads/petal-payments/',
    'GET',
    'The custom payment processing plugin stores Stripe API keys and customer payment tokens in unencrypted plaintext files on the server. Similar to CVE-2025-4394 (Medtronic device cleartext storage), this exposes sensitive payment data to anyone with filesystem access.',
    '{
        "request": {
            "method": "GET",
            "url": "/wp-content/uploads/petal-payments/config.json",
            "headers": {}
        },
        "response": {
            "status_code": 200,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": "{\"stripe_secret_key\":\"sk_live_51ABC...redacted\",\"stripe_publishable_key\":\"pk_live_51ABC...\",\"webhook_secret\":\"whsec_...\",\"customer_tokens\":[{\"customer_id\":\"cus_ABC\",\"pm_id\":\"pm_XYZ\"}]}",
            "size_bytes": 847
        },
        "auth_context": "Unauthenticated - publicly accessible",
        "probe_name": "sensitive_data_exposure",
        "timestamp": "2025-12-09T09:21:22-08:00",
        "curl_command": "curl https://petalandstemflorals.com/wp-content/uploads/petal-payments/config.json",
        "steps": [
            "Navigate to wp-content/uploads directory",
            "Locate petal-payments subdirectory",
            "Access config.json containing API credentials",
            "Observe plaintext storage of Stripe secret keys and customer payment tokens"
        ],
        "why_vulnerable": "Payment credentials and API keys are stored in cleartext on the filesystem without encryption (CWE-312: Cleartext Storage of Sensitive Information)",
        "attack_scenario": "An attacker exploiting any file read vulnerability (LFI, path traversal) or gaining limited server access could immediately obtain Stripe API keys. With the secret key, they can process fraudulent transactions, issue refunds to themselves, or access all customer payment data.",
        "poc_references": ["CVE-2025-4394", "GHSA-99gr-q2p8-x55m", "CWE-312"],
        "vulnerable_code": {
            "file": "/wp-content/plugins/petal-payments/includes/class-config.php",
            "line": 23,
            "language": "php",
            "snippet": "$config = json_encode([\n    ''stripe_secret_key'' => get_option(''stripe_sk''),\n    ''customer_tokens'' => $this->get_all_tokens()\n]);\nfile_put_contents(WP_CONTENT_DIR . ''/uploads/petal-payments/config.json'', $config);"
        },
        "fix_code": {
            "language": "php",
            "snippet": "// Store credentials in environment variables or encrypted database\n$stripe_key = getenv(''STRIPE_SECRET_KEY'');\n\n// If file storage is required, encrypt with sodium\n$key = sodium_crypto_secretbox_keygen();\n$nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);\n$encrypted = sodium_crypto_secretbox($config, $nonce, $key);\n\n// Store encrypted data with proper permissions\nfile_put_contents($path, base64_encode($nonce . $encrypted));\nchmod($path, 0600);"
        },
        "cve_reference": {
            "id": "CVE-2025-4394",
            "similarity": "Both vulnerabilities involve unencrypted storage of sensitive data on accessible storage. CVE-2025-4394 affects Medtronic patient monitors; this finding shows the same pattern in web applications.",
            "cvss_score": 6.8,
            "cwe": "CWE-312"
        },
        "business_impact": "Complete compromise of payment processing. Attacker could steal API keys to process fraudulent transactions, access all stored customer payment methods, or drain merchant account.",
        "remediation_time": "2-4 hours",
        "executive_summary": "Your payment processing credentials are stored in a plain text file that anyone could access. This could let someone steal your Stripe keys and process fake transactions."
    }'::jsonb
);

-- ============================================================================
-- Success message
-- ============================================================================

RAISE NOTICE '✅ Successfully inserted Sarah demo scan with 8 findings';
RAISE NOTICE '   - 2 Critical: SQL Injection, BOLA Order Exposure';
RAISE NOTICE '   - 2 High: Broken Authentication, Cleartext Storage (CVE-2025-4394)';
RAISE NOTICE '   - 3 Medium: Security Headers, Outdated Plugin, User Enumeration';
RAISE NOTICE '   - 1 Low: Deprecated TLS';

END $$;

-- ============================================================================
-- Verification queries
-- ============================================================================

SELECT
    scan_id,
    server_url,
    status,
    findings_count,
    user_id,
    created_at
FROM scans
WHERE scan_id = 'sarah-petal-stem-demo-001';

SELECT
    severity,
    rule,
    title,
    scanner,
    score
FROM findings
WHERE scan_id = 'sarah-petal-stem-demo-001'
ORDER BY
    CASE severity
        WHEN 'Critical' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Medium' THEN 3
        WHEN 'Low' THEN 4
        ELSE 5
    END,
    score DESC;
