/**
 * Visual Attack Path Generator Tool
 *
 * This tool generates beautiful Mermaid diagrams that visualize attack paths,
 * showing developers exactly how a vulnerability can be exploited.
 *
 * WOW FACTOR: Automatic visual attack flow diagrams!
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';

// ============================================================================
// Input Schema
// ============================================================================

const VisualizeAttackPathSchema = z.object({
  vulnerabilityType: z.string().describe('Type of vulnerability (e.g., "SQL Injection", "BOLA", "Authentication Bypass", "XSS")'),
  endpoint: z.string().describe('Vulnerable API endpoint (e.g., "/api/users/:id", "/search?q=")'),
  method: z.string().describe('HTTP method (GET, POST, PUT, DELETE)'),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low']).describe('Vulnerability severity level'),
  description: z.string().describe('Brief description of the vulnerability'),
  attackVector: z.string().optional().describe('How the attacker exploits this (e.g., "Manipulate user ID parameter", "Inject SQL in search query")'),
  impact: z.string().optional().describe('What happens if exploited (e.g., "Unauthorized data access", "Data exfiltration", "System compromise")'),
  affectedResources: z.array(z.string()).optional().describe('Resources at risk (e.g., ["User Database", "Payment Info", "Admin Panel"])'),
});

// ============================================================================
// Helper: Sanitize Strings for Mermaid
// ============================================================================

function sanitizeForMermaid(text: string | undefined): string {
  if (!text) return '';
  // Replace quotes with apostrophes to prevent breaking mermaid syntax
  // Remove newlines or replace them with <br/> if needed (mermaid handles some html)
  // Also escape brackets [] {} () as they are special characters in Mermaid node definitions
  return text
    .replace(/"/g, "'")
    .replace(/\n/g, '<br/>')
    .replace(/[\[\]\{\}\(\)]/g, (match) => {
      const map: Record<string, string> = {
        '[': '#91;',
        ']': '#93;',
        '{': '#123;',
        '}': '#125;',
        '(': '#40;',
        ')': '#41;'
      };
      return map[match] || match;
    });
}

// ============================================================================
// Helper: Generate Mermaid Diagram Based on Vulnerability Type
// ============================================================================

function generateAttackPathDiagram(input: z.infer<typeof VisualizeAttackPathSchema>): string {
  const {
    vulnerabilityType,
    endpoint,
    method,
    severity,
    description,
    attackVector,
    impact,
    affectedResources = []
  } = input;

  // Severity color mapping for Mermaid
  const severityColors: Record<string, string> = {
    'Critical': '#DC2626',
    'High': '#EA580C',
    'Medium': '#CA8A04',
    'Low': '#2563EB',
  };

  const severityColor = severityColors[severity] || '#6B7280';

  // Detect vulnerability category for specialized diagrams
  const vulnLower = vulnerabilityType.toLowerCase();

  if (vulnLower.includes('sql') || vulnLower.includes('injection') || vulnLower.includes('nosql')) {
    return generateInjectionAttackDiagram(input, severityColor);
  } else if (vulnLower.includes('bola') || vulnLower.includes('idor') || vulnLower.includes('authorization')) {
    return generateBOLAAttackDiagram(input, severityColor);
  } else if (vulnLower.includes('auth') || vulnLower.includes('authentication')) {
    return generateAuthAttackDiagram(input, severityColor);
  } else if (vulnLower.includes('xss') || vulnLower.includes('cross-site')) {
    return generateXSSAttackDiagram(input, severityColor);
  } else if (vulnLower.includes('rate') || vulnLower.includes('dos') || vulnLower.includes('denial')) {
    return generateRateLimitAttackDiagram(input, severityColor);
  } else {
    return generateGenericAttackDiagram(input, severityColor);
  }
}

// ============================================================================
// Diagram Templates for Different Attack Types
// ============================================================================

function generateInjectionAttackDiagram(input: z.infer<typeof VisualizeAttackPathSchema>, color: string): string {
  const endpoint = sanitizeForMermaid(input.endpoint);
  const method = sanitizeForMermaid(input.method);
  const attackVector = sanitizeForMermaid(input.attackVector);
  const impact = sanitizeForMermaid(input.impact);
  const affectedResource = sanitizeForMermaid(input.affectedResources?.[0]);
  const vulnType = sanitizeForMermaid(input.vulnerabilityType);
  const description = sanitizeForMermaid(input.description);

  return `\`\`\`mermaid
graph LR
    A["🎭 Attacker"] -- "1. Craft Malicious Payload" --> B["💉 Injection Payload"]
    B -- "2. Send ${method} Request" --> C["📡 ${endpoint}"]
    C -- "3. No Input Validation" --> D{"🔍 Database Query"}
    D -- "4. Execute Malicious SQL" --> E["💥 SQL Execution"]
    E -- "5. Extract Data" --> F["💾 ${affectedResource || 'Database'}"]
    F -- "6. Data Breach" --> G["🔓 ${impact || 'Unauthorized Access'}"]

    style A fill:#4B5563,stroke:#9CA3AF,color:#fff
    style B fill:#DC2626,stroke:#EF4444,color:#fff
    style C fill:${color},stroke:#FCA5A5,color:#fff
    style D fill:#7C3AED,stroke:#A78BFA,color:#fff
    style E fill:#DC2626,stroke:#EF4444,color:#fff
    style F fill:#EA580C,stroke:#FB923C,color:#fff
    style G fill:#DC2626,stroke:#EF4444,color:#fff
\`\`\`

**Attack Flow Explanation:**
1. **Attacker** crafts malicious ${vulnType} payload
2. **Injection** payload sent to vulnerable endpoint \`${method} ${endpoint}\`
3. **Missing validation** allows payload to reach database query
4. **Malicious query** executes with elevated privileges
5. **Data extraction** from ${affectedResource || 'sensitive database'}
6. **Impact**: ${impact || 'Complete database compromise'}

**🚨 Severity: ${input.severity}** - ${description}`;
}

function generateBOLAAttackDiagram(input: z.infer<typeof VisualizeAttackPathSchema>, color: string): string {
  const endpoint = sanitizeForMermaid(input.endpoint);
  const method = sanitizeForMermaid(input.method);
  const impact = sanitizeForMermaid(input.impact);
  const affectedResources = (input.affectedResources || []).map(r => sanitizeForMermaid(r));
  const description = sanitizeForMermaid(input.description);

  return `\`\`\`mermaid
graph TB
    A["🎭 Attacker<br/>User ID: 123"] -- "1. Authenticated Request" --> B["📱 ${method} ${endpoint}"]
    B -- "2. Manipulate ID Parameter" --> C{"🔍 Authorization Check?"}
    C -- "❌ No Check" --> D["👤 Victim's Data<br/>User ID: 456"]
    C -- "✅ Should Block" --> E["🛡️ Access Denied"]
    D -- "3. Return Sensitive Data" --> F["💾 ${affectedResources.join(', ') || 'User Records'}"]
    F -- "4. Data Breach" --> G["🔓 ${impact || 'Unauthorized Access'}"]

    style A fill:#4B5563,stroke:#9CA3AF,color:#fff
    style B fill:${color},stroke:#FCA5A5,color:#fff
    style C fill:#7C3AED,stroke:#A78BFA,color:#fff
    style D fill:#DC2626,stroke:#EF4444,color:#fff
    style E fill:#10B981,stroke:#34D399,color:#fff
    style F fill:#EA580C,stroke:#FB923C,color:#fff
    style G fill:#DC2626,stroke:#EF4444,color:#fff
\`\`\`

**Attack Flow Explanation:**
1. **Authenticated attacker** (User 123) sends legitimate request to \`${endpoint}\`
2. **Parameter tampering**: Attacker changes user ID from 123 → 456
3. **Missing authorization check**: Server doesn't verify if attacker owns ID 456
4. **Victim's data** (User 456) returned to attacker
5. **Impact**: ${impact || 'Complete access to other users\' data'}

**🚨 Severity: ${input.severity}** - ${description}

**Why This Is Critical**: Any authenticated user can access ALL other users' data by simply changing the ID parameter.`;
}

function generateAuthAttackDiagram(input: z.infer<typeof VisualizeAttackPathSchema>, color: string): string {
  const endpoint = sanitizeForMermaid(input.endpoint);
  const method = sanitizeForMermaid(input.method);
  const attackVector = sanitizeForMermaid(input.attackVector);
  const impact = sanitizeForMermaid(input.impact);
  const description = sanitizeForMermaid(input.description);

  return `\`\`\`mermaid
graph LR
    A["🎭 Attacker"] -- "1. Identify Weakness" --> B["🔐 ${method} ${endpoint}"]
    B -- "2. ${attackVector || 'Bypass Authentication'}" --> C{"🔑 Auth Validation"}
    C -- "❌ Bypassed" --> D["🚪 Admin Access"]
    C -- "✅ Should Block" --> E["🛡️ Access Denied"]
    D -- "3. Elevated Privileges" --> F["⚙️ Admin Panel"]
    F -- "4. Full Control" --> G["💥 ${impact || 'System Compromise'}"]

    style A fill:#4B5563,stroke:#9CA3AF,color:#fff
    style B fill:${color},stroke:#FCA5A5,color:#fff
    style C fill:#7C3AED,stroke:#A78BFA,color:#fff
    style D fill:#DC2626,stroke:#EF4444,color:#fff
    style E fill:#10B981,stroke:#34D399,color:#fff
    style F fill:#EA580C,stroke:#FB923C,color:#fff
    style G fill:#DC2626,stroke:#EF4444,color:#fff
\`\`\`

**Attack Flow Explanation:**
1. **Attacker** discovers authentication weakness in \`${endpoint}\`
2. **Bypass technique**: ${attackVector || 'Manipulate authentication tokens or session data'}
3. **Failed validation** grants unauthorized admin access
4. **Privilege escalation** to administrator role
5. **Impact**: ${impact || 'Complete system takeover'}

**🚨 Severity: ${input.severity}** - ${description}`;
}

function generateXSSAttackDiagram(input: z.infer<typeof VisualizeAttackPathSchema>, color: string): string {
  const endpoint = sanitizeForMermaid(input.endpoint);
  const method = sanitizeForMermaid(input.method);
  const impact = sanitizeForMermaid(input.impact);
  const description = sanitizeForMermaid(input.description);

  return `\`\`\`mermaid
graph TB
    A["🎭 Attacker"] -- "1. Inject Malicious Script" --> B["📝 ${method} ${endpoint}"]
    B -- "2. Store Unsanitized" --> C["💾 Database"]
    C -- "3. Retrieve & Display" --> D["🌐 Victim's Browser"]
    D -- "4. Execute Script" --> E["⚡ JavaScript Execution"]
    E -- "5. Steal Credentials" --> F["🍪 Session Cookie/Token"]
    F -- "6. Session Hijacking" --> G["🔓 ${impact || 'Account Takeover'}"]

    style A fill:#4B5563,stroke:#9CA3AF,color:#fff
    style B fill:${color},stroke:#FCA5A5,color:#fff
    style C fill:#7C3AED,stroke:#A78BFA,color:#fff
    style D fill:#DC2626,stroke:#EF4444,color:#fff
    style E fill:#EA580C,stroke:#FB923C,color:#fff
    style F fill:#DC2626,stroke:#EF4444,color:#fff
    style G fill:#DC2626,stroke:#EF4444,color:#fff
\`\`\`

**Attack Flow Explanation:**
1. **Attacker** injects malicious JavaScript into \`${endpoint}\`
2. **No sanitization**: Script stored directly in database
3. **Victim loads page** containing attacker's script
4. **Malicious script executes** in victim's browser context
5. **Session theft**: Attacker steals authentication tokens
6. **Impact**: ${impact || 'Complete account takeover of victims'}

**🚨 Severity: ${input.severity}** - ${description}`;
}

function generateRateLimitAttackDiagram(input: z.infer<typeof VisualizeAttackPathSchema>, color: string): string {
  const endpoint = sanitizeForMermaid(input.endpoint);
  const method = sanitizeForMermaid(input.method);
  const impact = sanitizeForMermaid(input.impact);
  const description = sanitizeForMermaid(input.description);

  return `\`\`\`mermaid
graph LR
    A["🎭 Attacker"] -- "1. Automated Requests" --> B["🔁 Bulk Requests"]
    B -- "2. 1000+ req/sec" --> C["📡 ${method} ${endpoint}"]
    C -- "3. No Rate Limiting" --> D{"⚡ Server Resources"}
    D -- "4. Resource Exhaustion" --> E["💥 Server Overload"]
    E -- "5. Service Degradation" --> F["⏸️ ${impact || 'Service Unavailable'}"]

    style A fill:#4B5563,stroke:#9CA3AF,color:#fff
    style B fill:#DC2626,stroke:#EF4444,color:#fff
    style C fill:${color},stroke:#FCA5A5,color:#fff
    style D fill:#7C3AED,stroke:#A78BFA,color:#fff
    style E fill:#DC2626,stroke:#EF4444,color:#fff
    style F fill:#EA580C,stroke:#FB923C,color:#fff
\`\`\`

**Attack Flow Explanation:**
1. **Attacker** uses automated tools (e.g., scripts, bots)
2. **Flood attack**: Sends thousands of requests per second
3. **No rate limiting** on \`${endpoint}\` allows unlimited requests
4. **Server resources** (CPU, memory, bandwidth) exhausted
5. **Impact**: ${impact || 'Service becomes unavailable to legitimate users'}

**🚨 Severity: ${input.severity}** - ${description}`;
}

function generateGenericAttackDiagram(input: z.infer<typeof VisualizeAttackPathSchema>, color: string): string {
  const endpoint = sanitizeForMermaid(input.endpoint);
  const method = sanitizeForMermaid(input.method);
  const attackVector = sanitizeForMermaid(input.attackVector);
  const impact = sanitizeForMermaid(input.impact);
  const affectedResources = (input.affectedResources || []).map(r => sanitizeForMermaid(r));
  const vulnType = sanitizeForMermaid(input.vulnerabilityType);
  const description = sanitizeForMermaid(input.description);

  const resources = affectedResources.length > 0
    ? affectedResources.join('<br/>')
    : 'System Resources';

  return `\`\`\`mermaid
graph LR
    A["🎭 Attacker"] -- "1. Identify Target" --> B["📡 ${method} ${endpoint}"]
    B -- "2. ${attackVector || 'Exploit Vulnerability'}" --> C{"🔍 Security Control"}
    C -- "❌ Bypassed" --> D["💾 ${resources}"]
    C -- "✅ Should Block" --> E["🛡️ Access Denied"]
    D -- "3. ${vulnType}" --> F["💥 ${impact || 'Security Breach'}"]

    style A fill:#4B5563,stroke:#9CA3AF,color:#fff
    style B fill:${color},stroke:#FCA5A5,color:#fff
    style C fill:#7C3AED,stroke:#A78BFA,color:#fff
    style D fill:#EA580C,stroke:#FB923C,color:#fff
    style E fill:#10B981,stroke:#34D399,color:#fff
    style F fill:#DC2626,stroke:#EF4444,color:#fff
\`\`\`

**Attack Flow Explanation:**
1. **Attacker** targets vulnerable endpoint \`${method} ${endpoint}\`
2. **Exploitation**: ${attackVector || 'Leverages security weakness to bypass controls'}
3. **Security control bypassed**: ${vulnType} allows unauthorized access
4. **Affected resources**: ${affectedResources.join(', ') || 'Critical system components'}
5. **Impact**: ${impact || 'Security breach and potential data loss'}

**🚨 Severity: ${input.severity}** - ${description}`;
}

// ============================================================================
// Tool Export
// ============================================================================

export const visualizeAttackPathTool = createTool({
  id: 'visualize-attack-path',
  name: 'Visualize Attack Path',
  description: `🎨 Generate beautiful Mermaid flowchart diagrams showing exactly how a vulnerability can be exploited.

  This tool creates interactive, color-coded attack flow visualizations that help developers understand:
  - Step-by-step attack progression
  - Entry points and exploit techniques
  - Security control failures
  - Impact and affected resources

  WHEN TO USE:
  - When user asks "How does this attack work?"
  - When user says "Show me the attack path" or "Visualize this"
  - When explaining vulnerability exploitation to developers
  - When user wants to see attack flow diagram
  - Anytime you need to visually explain a security vulnerability

  The diagram will automatically render in the chat as a beautiful flowchart!`,

  inputSchema: VisualizeAttackPathSchema,

  execute: async ({ context }) => {
    try {
      console.log('🎨 Generating visual attack path diagram...');
      const diagram = generateAttackPathDiagram(context);

      console.log('✅ Attack path diagram generated successfully');

      return `${diagram}\n\n✅ Attack path visualization generated! Click the button above to view the interactive diagram.`;
    } catch (error) {
      console.error('❌ Failed to generate attack path diagram:', error);
      throw new Error(`Failed to generate attack path visualization: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
