/**
 * Compliance Framework Mapping Data
 *
 * Contains descriptions and metadata for compliance controls across multiple frameworks.
 * Used by the Analyst Compliance Tab for expandable details and framework coverage matrix.
 */

// =============================================================================
// NIST 800-53 Rev 5 Controls
// =============================================================================

export interface ControlDescription {
  id: string;
  name: string;
  family: string;
  description: string;
  guidance?: string;
}

export const NIST_80053_CONTROLS: Record<string, ControlDescription> = {
  'AC-3': {
    id: 'AC-3',
    name: 'Access Enforcement',
    family: 'Access Control',
    description: 'The system enforces approved authorizations for logical access to information and system resources in accordance with applicable access control policies.',
    guidance: 'Implement role-based access control (RBAC) or attribute-based access control (ABAC) mechanisms.',
  },
  'AC-6': {
    id: 'AC-6',
    name: 'Least Privilege',
    family: 'Access Control',
    description: 'The organization employs the principle of least privilege, allowing only authorized accesses for users which are necessary to accomplish assigned tasks.',
    guidance: 'Grant minimum permissions required for each role. Review and audit privilege assignments regularly.',
  },
  'AC-7': {
    id: 'AC-7',
    name: 'Unsuccessful Logon Attempts',
    family: 'Access Control',
    description: 'The system enforces a limit of consecutive invalid logon attempts by a user and automatically locks the account when the maximum is exceeded.',
    guidance: 'Implement account lockout after 3-5 failed attempts. Use exponential backoff or CAPTCHA.',
  },
  'AU-2': {
    id: 'AU-2',
    name: 'Event Logging',
    family: 'Audit and Accountability',
    description: 'The organization determines that the system is capable of auditing security-relevant events.',
    guidance: 'Log authentication events, privilege changes, and access to sensitive resources.',
  },
  'AU-3': {
    id: 'AU-3',
    name: 'Content of Audit Records',
    family: 'Audit and Accountability',
    description: 'The system generates audit records containing information about what type of event occurred, when it occurred, where it occurred, and the identity of any individuals involved.',
    guidance: 'Include timestamp, user ID, event type, resource accessed, and outcome in all log records.',
  },
  'CA-7': {
    id: 'CA-7',
    name: 'Continuous Monitoring',
    family: 'Assessment, Authorization, and Monitoring',
    description: 'The organization develops a continuous monitoring strategy and implements a continuous monitoring program.',
    guidance: 'Implement automated vulnerability scanning, configuration monitoring, and security metrics collection.',
  },
  'CM-6': {
    id: 'CM-6',
    name: 'Configuration Settings',
    family: 'Configuration Management',
    description: 'The organization establishes and documents configuration settings for systems that reflect the most restrictive mode consistent with operational requirements.',
    guidance: 'Use security baselines and hardening guides. Disable unnecessary services and features.',
  },
  'IA-2': {
    id: 'IA-2',
    name: 'Identification and Authentication',
    family: 'Identification and Authentication',
    description: 'The system uniquely identifies and authenticates organizational users.',
    guidance: 'Implement multi-factor authentication for privileged access. Use strong password policies.',
  },
  'IA-5': {
    id: 'IA-5',
    name: 'Authenticator Management',
    family: 'Identification and Authentication',
    description: 'The organization manages system authenticators by verifying identity, establishing initial content, and ensuring proper handling.',
    guidance: 'Rotate credentials regularly. Store secrets securely using vaults or HSMs.',
  },
  'RA-5': {
    id: 'RA-5',
    name: 'Vulnerability Monitoring and Scanning',
    family: 'Risk Assessment',
    description: 'The organization scans for vulnerabilities in systems and applications, and analyzes scan reports and remediation results.',
    guidance: 'Perform regular vulnerability scans. Prioritize remediation based on risk.',
  },
  'SA-11': {
    id: 'SA-11',
    name: 'Developer Testing and Evaluation',
    family: 'System and Services Acquisition',
    description: 'The organization requires the developer to create and implement a security assessment plan and employ testing methods.',
    guidance: 'Include security testing in SDLC. Perform SAST, DAST, and penetration testing.',
  },
  'SC-3': {
    id: 'SC-3',
    name: 'Security Function Isolation',
    family: 'System and Communications Protection',
    description: 'The system isolates security functions from nonsecurity functions.',
    guidance: 'Separate authentication/authorization logic from business logic. Use defense in depth.',
  },
  'SC-8': {
    id: 'SC-8',
    name: 'Transmission Confidentiality and Integrity',
    family: 'System and Communications Protection',
    description: 'The system protects the confidentiality and integrity of transmitted information.',
    guidance: 'Use TLS 1.2+ for all data in transit. Implement certificate pinning for mobile apps.',
  },
  'SC-13': {
    id: 'SC-13',
    name: 'Cryptographic Protection',
    family: 'System and Communications Protection',
    description: 'The system implements cryptographic mechanisms to prevent unauthorized disclosure and detect changes to information.',
    guidance: 'Use FIPS 140-2 validated cryptographic modules. Avoid deprecated algorithms.',
  },
  'SC-28': {
    id: 'SC-28',
    name: 'Protection of Information at Rest',
    family: 'System and Communications Protection',
    description: 'The system protects the confidentiality and integrity of information at rest.',
    guidance: 'Encrypt sensitive data at rest. Use proper key management practices.',
  },
  'SI-2': {
    id: 'SI-2',
    name: 'Flaw Remediation',
    family: 'System and Information Integrity',
    description: 'The organization identifies, reports, and corrects system flaws in a timely manner.',
    guidance: 'Establish SLAs for vulnerability remediation based on severity.',
  },
  'SI-3': {
    id: 'SI-3',
    name: 'Malicious Code Protection',
    family: 'System and Information Integrity',
    description: 'The organization employs malicious code protection mechanisms at entry and exit points.',
    guidance: 'Implement input validation, output encoding, and content security policies.',
  },
  'SI-10': {
    id: 'SI-10',
    name: 'Information Input Validation',
    family: 'System and Information Integrity',
    description: 'The system checks the validity of information inputs.',
    guidance: 'Validate all input on server-side. Use allowlists over denylists.',
  },
};

// =============================================================================
// NIST CSF (Cybersecurity Framework) Functions and Categories
// =============================================================================

export const NIST_CSF_CONTROLS: Record<string, ControlDescription> = {
  'ID.AM-1': {
    id: 'ID.AM-1',
    name: 'Physical Devices Inventory',
    family: 'Identify > Asset Management',
    description: 'Physical devices and systems within the organization are inventoried.',
  },
  'ID.AM-2': {
    id: 'ID.AM-2',
    name: 'Software Platforms Inventory',
    family: 'Identify > Asset Management',
    description: 'Software platforms and applications within the organization are inventoried.',
  },
  'PR.AC-1': {
    id: 'PR.AC-1',
    name: 'Identity Management',
    family: 'Protect > Identity Management & Access Control',
    description: 'Identities and credentials are issued, managed, verified, revoked, and audited for authorized devices, users, and processes.',
  },
  'PR.AC-4': {
    id: 'PR.AC-4',
    name: 'Access Permissions',
    family: 'Protect > Identity Management & Access Control',
    description: 'Access permissions and authorizations are managed, incorporating the principles of least privilege and separation of duties.',
  },
  'PR.AC-7': {
    id: 'PR.AC-7',
    name: 'Authentication',
    family: 'Protect > Identity Management & Access Control',
    description: 'Users, devices, and other assets are authenticated commensurate with the risk of the transaction.',
  },
  'PR.DS-1': {
    id: 'PR.DS-1',
    name: 'Data-at-Rest Protection',
    family: 'Protect > Data Security',
    description: 'Data-at-rest is protected.',
  },
  'PR.DS-2': {
    id: 'PR.DS-2',
    name: 'Data-in-Transit Protection',
    family: 'Protect > Data Security',
    description: 'Data-in-transit is protected.',
  },
  'PR.DS-5': {
    id: 'PR.DS-5',
    name: 'Data Leakage Protection',
    family: 'Protect > Data Security',
    description: 'Protections against data leaks are implemented.',
  },
  'PR.IP-1': {
    id: 'PR.IP-1',
    name: 'Security Baselines',
    family: 'Protect > Information Protection',
    description: 'A baseline configuration of systems is created and maintained incorporating security principles.',
  },
  'PR.IP-3': {
    id: 'PR.IP-3',
    name: 'Configuration Change Control',
    family: 'Protect > Information Protection',
    description: 'Configuration change control processes are in place.',
  },
  'PR.IP-12': {
    id: 'PR.IP-12',
    name: 'Vulnerability Management',
    family: 'Protect > Information Protection',
    description: 'A vulnerability management plan is developed and implemented.',
  },
  'PR.PT-1': {
    id: 'PR.PT-1',
    name: 'Audit Logging',
    family: 'Protect > Protective Technology',
    description: 'Audit/log records are determined, documented, implemented, and reviewed.',
  },
  'PR.PT-3': {
    id: 'PR.PT-3',
    name: 'Least Functionality',
    family: 'Protect > Protective Technology',
    description: 'The principle of least functionality is incorporated by configuring systems to provide only essential capabilities.',
  },
  'PR.PT-4': {
    id: 'PR.PT-4',
    name: 'Communications Protection',
    family: 'Protect > Protective Technology',
    description: 'Communications and control networks are protected.',
  },
  'DE.CM-1': {
    id: 'DE.CM-1',
    name: 'Network Monitoring',
    family: 'Detect > Security Continuous Monitoring',
    description: 'The network is monitored to detect potential cybersecurity events.',
  },
  'DE.CM-4': {
    id: 'DE.CM-4',
    name: 'Malicious Code Detection',
    family: 'Detect > Security Continuous Monitoring',
    description: 'Malicious code is detected.',
  },
  'DE.CM-6': {
    id: 'DE.CM-6',
    name: 'External Service Provider Monitoring',
    family: 'Detect > Security Continuous Monitoring',
    description: 'External service provider activity is monitored to detect potential cybersecurity events.',
  },
  'DE.CM-7': {
    id: 'DE.CM-7',
    name: 'Unauthorized Activity Monitoring',
    family: 'Detect > Security Continuous Monitoring',
    description: 'Monitoring for unauthorized personnel, connections, devices, and software is performed.',
  },
  'DE.CM-8': {
    id: 'DE.CM-8',
    name: 'Vulnerability Scanning',
    family: 'Detect > Security Continuous Monitoring',
    description: 'Vulnerability scans are performed.',
  },
};

// =============================================================================
// PCI-DSS v4.0 Requirements
// =============================================================================

export const PCI_DSS_CONTROLS: Record<string, ControlDescription> = {
  '1.2.1': {
    id: '1.2.1',
    name: 'Network Security Controls',
    family: 'Requirement 1: Network Security Controls',
    description: 'Configuration standards for network security controls are defined, implemented, and maintained.',
  },
  '2.2.1': {
    id: '2.2.1',
    name: 'System Configuration Standards',
    family: 'Requirement 2: Secure Configurations',
    description: 'Configuration standards are developed, implemented, and maintained for all system components.',
  },
  '3.4.1': {
    id: '3.4.1',
    name: 'PAN Masking',
    family: 'Requirement 3: Protect Stored Account Data',
    description: 'PAN is masked when displayed such that only personnel with a legitimate business need can see more than the first six/last four digits.',
  },
  '3.5.1': {
    id: '3.5.1',
    name: 'Encryption Key Access',
    family: 'Requirement 3: Protect Stored Account Data',
    description: 'Access to cleartext cryptographic keys is restricted to the fewest number of custodians necessary.',
  },
  '4.2.1': {
    id: '4.2.1',
    name: 'Strong Cryptography',
    family: 'Requirement 4: Protect Cardholder Data in Transit',
    description: 'Strong cryptography and security protocols are implemented to safeguard PAN during transmission over open, public networks.',
  },
  '5.2.1': {
    id: '5.2.1',
    name: 'Anti-Malware Solution',
    family: 'Requirement 5: Protect Against Malware',
    description: 'An anti-malware solution is deployed on all systems commonly affected by malware.',
  },
  '6.2.1': {
    id: '6.2.1',
    name: 'Secure Software Development',
    family: 'Requirement 6: Develop Secure Systems',
    description: 'Bespoke and custom software is developed securely.',
  },
  '6.2.4': {
    id: '6.2.4',
    name: 'Injection Flaws',
    family: 'Requirement 6: Develop Secure Systems',
    description: 'Software engineering techniques are defined and in use to prevent or mitigate common software attacks including injection attacks.',
  },
  '6.3.1': {
    id: '6.3.1',
    name: 'Security Vulnerabilities',
    family: 'Requirement 6: Develop Secure Systems',
    description: 'Security vulnerabilities are identified and managed.',
  },
  '6.4.1': {
    id: '6.4.1',
    name: 'Public Web Application Protection',
    family: 'Requirement 6: Develop Secure Systems',
    description: 'For public-facing web applications, new threats and vulnerabilities are addressed on an ongoing basis.',
  },
  '6.5.1': {
    id: '6.5.1',
    name: 'Injection Prevention',
    family: 'Requirement 6: Develop Secure Systems',
    description: 'Changes to all system components in the production environment are made according to established procedures.',
  },
  '7.2.1': {
    id: '7.2.1',
    name: 'Access Control Model',
    family: 'Requirement 7: Restrict Access',
    description: 'An access control model is defined and includes granting access based on job classification and function.',
  },
  '7.2.2': {
    id: '7.2.2',
    name: 'Privilege Assignment',
    family: 'Requirement 7: Restrict Access',
    description: 'Access is assigned to users based on job classification and function.',
  },
  '8.2.1': {
    id: '8.2.1',
    name: 'Unique User IDs',
    family: 'Requirement 8: Identify Users',
    description: 'All users are assigned a unique ID before being allowed access to system components or cardholder data.',
  },
  '8.3.1': {
    id: '8.3.1',
    name: 'Strong Authentication',
    family: 'Requirement 8: Identify Users',
    description: 'All user access to system components for users and administrators is authenticated via at least one authentication factor.',
  },
  '10.2.1': {
    id: '10.2.1',
    name: 'Audit Logs',
    family: 'Requirement 10: Log and Monitor',
    description: 'Audit logs are enabled and active for all system components and cardholder data.',
  },
  '11.3.1': {
    id: '11.3.1',
    name: 'Vulnerability Scanning',
    family: 'Requirement 11: Test Security',
    description: 'Internal vulnerability scans are performed at least once every three months.',
  },
  '11.4.1': {
    id: '11.4.1',
    name: 'Penetration Testing',
    family: 'Requirement 11: Test Security',
    description: 'External and internal penetration testing is regularly performed.',
  },
};

// =============================================================================
// CWE to Framework Mappings
// =============================================================================

export interface FrameworkMapping {
  framework: string;
  controls: string[];
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
}

export const CWE_TO_FRAMEWORKS: Record<string, FrameworkMapping[]> = {
  // BOLA - Broken Object Level Authorization
  'CWE-639': [
    { framework: 'NIST 800-53', controls: ['AC-3', 'AC-6', 'SC-3'], severity: 'High' },
    { framework: 'NIST CSF', controls: ['PR.AC-4', 'PR.DS-5'], severity: 'High' },
    { framework: 'PCI-DSS', controls: ['7.2.1', '7.2.2'], severity: 'Critical' },
  ],
  // BFLA - Broken Function Level Authorization
  'CWE-285': [
    { framework: 'NIST 800-53', controls: ['AC-3', 'AC-6'], severity: 'High' },
    { framework: 'NIST CSF', controls: ['PR.AC-4', 'PR.PT-3'], severity: 'High' },
    { framework: 'PCI-DSS', controls: ['7.2.1', '7.2.2'], severity: 'Critical' },
  ],
  'CWE-862': [
    { framework: 'NIST 800-53', controls: ['AC-3', 'AC-6'], severity: 'High' },
    { framework: 'NIST CSF', controls: ['PR.AC-4'], severity: 'High' },
    { framework: 'PCI-DSS', controls: ['7.2.1'], severity: 'High' },
  ],
  // SQL Injection
  'CWE-89': [
    { framework: 'NIST 800-53', controls: ['SI-10', 'SA-11'], severity: 'Critical' },
    { framework: 'NIST CSF', controls: ['PR.DS-5', 'DE.CM-4'], severity: 'Critical' },
    { framework: 'PCI-DSS', controls: ['6.2.4', '6.5.1'], severity: 'Critical' },
  ],
  // XSS
  'CWE-79': [
    { framework: 'NIST 800-53', controls: ['SI-10', 'SI-3'], severity: 'High' },
    { framework: 'NIST CSF', controls: ['PR.DS-5', 'DE.CM-4'], severity: 'High' },
    { framework: 'PCI-DSS', controls: ['6.2.4', '6.4.1'], severity: 'High' },
  ],
  // Command Injection
  'CWE-78': [
    { framework: 'NIST 800-53', controls: ['SI-10', 'SA-11'], severity: 'Critical' },
    { framework: 'NIST CSF', controls: ['PR.DS-5', 'DE.CM-4'], severity: 'Critical' },
    { framework: 'PCI-DSS', controls: ['6.2.4', '6.5.1'], severity: 'Critical' },
  ],
  // Broken Authentication
  'CWE-287': [
    { framework: 'NIST 800-53', controls: ['IA-2', 'IA-5', 'AC-7'], severity: 'Critical' },
    { framework: 'NIST CSF', controls: ['PR.AC-1', 'PR.AC-7'], severity: 'Critical' },
    { framework: 'PCI-DSS', controls: ['8.2.1', '8.3.1'], severity: 'Critical' },
  ],
  'CWE-306': [
    { framework: 'NIST 800-53', controls: ['IA-2', 'AC-3'], severity: 'High' },
    { framework: 'NIST CSF', controls: ['PR.AC-1', 'PR.AC-7'], severity: 'High' },
    { framework: 'PCI-DSS', controls: ['8.3.1'], severity: 'High' },
  ],
  // Sensitive Data Exposure
  'CWE-200': [
    { framework: 'NIST 800-53', controls: ['SC-8', 'SC-28', 'AC-3'], severity: 'High' },
    { framework: 'NIST CSF', controls: ['PR.DS-1', 'PR.DS-2', 'PR.DS-5'], severity: 'High' },
    { framework: 'PCI-DSS', controls: ['3.4.1', '4.2.1'], severity: 'Critical' },
  ],
  // Rate Limiting
  'CWE-770': [
    { framework: 'NIST 800-53', controls: ['SC-3', 'CA-7'], severity: 'Medium' },
    { framework: 'NIST CSF', controls: ['DE.CM-1', 'PR.PT-4'], severity: 'Medium' },
    { framework: 'PCI-DSS', controls: ['6.4.1'], severity: 'Medium' },
  ],
  // SSRF
  'CWE-918': [
    { framework: 'NIST 800-53', controls: ['SI-10', 'SC-3'], severity: 'High' },
    { framework: 'NIST CSF', controls: ['PR.IP-12', 'DE.CM-7'], severity: 'High' },
    { framework: 'PCI-DSS', controls: ['6.2.4'], severity: 'High' },
  ],
  // Deserialization
  'CWE-502': [
    { framework: 'NIST 800-53', controls: ['SI-10', 'SA-11'], severity: 'Critical' },
    { framework: 'NIST CSF', controls: ['DE.CM-4', 'PR.DS-5'], severity: 'Critical' },
    { framework: 'PCI-DSS', controls: ['6.2.4'], severity: 'Critical' },
  ],
  // Hardcoded Credentials
  'CWE-798': [
    { framework: 'NIST 800-53', controls: ['IA-5', 'SC-28'], severity: 'Critical' },
    { framework: 'NIST CSF', controls: ['PR.AC-1', 'PR.DS-1'], severity: 'Critical' },
    { framework: 'PCI-DSS', controls: ['3.5.1', '8.2.1'], severity: 'Critical' },
  ],
  // Weak Cryptography
  'CWE-327': [
    { framework: 'NIST 800-53', controls: ['SC-13', 'SC-8'], severity: 'High' },
    { framework: 'NIST CSF', controls: ['PR.DS-1', 'PR.DS-2'], severity: 'High' },
    { framework: 'PCI-DSS', controls: ['4.2.1', '3.5.1'], severity: 'High' },
  ],
  // Mass Assignment
  'CWE-915': [
    { framework: 'NIST 800-53', controls: ['SI-10', 'AC-3'], severity: 'Medium' },
    { framework: 'NIST CSF', controls: ['PR.DS-5', 'PR.AC-4'], severity: 'Medium' },
    { framework: 'PCI-DSS', controls: ['6.2.4'], severity: 'Medium' },
  ],
  // Security Misconfiguration
  'CWE-16': [
    { framework: 'NIST 800-53', controls: ['CM-6', 'SA-11'], severity: 'Medium' },
    { framework: 'NIST CSF', controls: ['PR.IP-1', 'PR.IP-3'], severity: 'Medium' },
    { framework: 'PCI-DSS', controls: ['2.2.1'], severity: 'Medium' },
  ],
  // Insufficient Logging
  'CWE-778': [
    { framework: 'NIST 800-53', controls: ['AU-2', 'AU-3'], severity: 'Medium' },
    { framework: 'NIST CSF', controls: ['PR.PT-1', 'DE.CM-1'], severity: 'Medium' },
    { framework: 'PCI-DSS', controls: ['10.2.1'], severity: 'High' },
  ],
  // Path Traversal
  'CWE-22': [
    { framework: 'NIST 800-53', controls: ['SI-10', 'AC-3'], severity: 'High' },
    { framework: 'NIST CSF', controls: ['PR.DS-5', 'DE.CM-4'], severity: 'High' },
    { framework: 'PCI-DSS', controls: ['6.2.4'], severity: 'High' },
  ],
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get control description by framework and control ID
 */
export function getControlDescription(framework: string, controlId: string): ControlDescription | undefined {
  switch (framework) {
    case 'NIST 800-53':
      return NIST_80053_CONTROLS[controlId];
    case 'NIST CSF':
      return NIST_CSF_CONTROLS[controlId];
    case 'PCI-DSS':
      return PCI_DSS_CONTROLS[controlId];
    default:
      return undefined;
  }
}

/**
 * Get all framework mappings for a list of CWEs
 */
export function getFrameworkMappingsForCWEs(cweIds: string[]): Record<string, FrameworkMapping[]> {
  const result: Record<string, FrameworkMapping[]> = {};

  for (const cwe of cweIds) {
    const normalizedCwe = cwe.toUpperCase().startsWith('CWE-') ? cwe.toUpperCase() : `CWE-${cwe}`;
    if (CWE_TO_FRAMEWORKS[normalizedCwe]) {
      result[normalizedCwe] = CWE_TO_FRAMEWORKS[normalizedCwe];
    }
  }

  return result;
}

/**
 * Get aggregated framework impact for a finding
 */
export function getComplianceImpact(cweIds: string[]): {
  framework: string;
  controlCount: number;
  maxSeverity: 'Critical' | 'High' | 'Medium' | 'Low';
}[] {
  const frameworkImpact: Record<string, { controls: Set<string>; maxSeverity: 'Critical' | 'High' | 'Medium' | 'Low' }> = {};
  const severityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };

  for (const cwe of cweIds) {
    const normalizedCwe = cwe.toUpperCase().startsWith('CWE-') ? cwe.toUpperCase() : `CWE-${cwe}`;
    const mappings = CWE_TO_FRAMEWORKS[normalizedCwe] || [];

    for (const mapping of mappings) {
      if (!frameworkImpact[mapping.framework]) {
        frameworkImpact[mapping.framework] = { controls: new Set(), maxSeverity: 'Low' };
      }

      mapping.controls.forEach(c => frameworkImpact[mapping.framework].controls.add(c));

      if (severityOrder[mapping.severity] > severityOrder[frameworkImpact[mapping.framework].maxSeverity]) {
        frameworkImpact[mapping.framework].maxSeverity = mapping.severity;
      }
    }
  }

  return Object.entries(frameworkImpact).map(([framework, data]) => ({
    framework,
    controlCount: data.controls.size,
    maxSeverity: data.maxSeverity,
  }));
}

/**
 * Generate context explanation for why a finding maps to a control
 */
export function getControlContextForCWE(cwe: string, controlId: string): string {
  const cweContexts: Record<string, Record<string, string>> = {
    'CWE-639': {
      'AC-3': 'This BOLA vulnerability allows unauthorized access to resources, directly violating access enforcement requirements.',
      'AC-6': 'Users can access resources beyond their authorized scope, violating least privilege principles.',
      'SC-3': 'Authorization logic is not properly isolated, allowing bypass of security controls.',
    },
    'CWE-89': {
      'SI-10': 'SQL injection indicates improper validation of user-supplied input before use in database queries.',
      'SA-11': 'Injection vulnerabilities suggest insufficient security testing during development.',
    },
    'CWE-79': {
      'SI-10': 'XSS indicates failure to properly validate and sanitize user input before rendering.',
      'SI-3': 'Cross-site scripting allows injection of malicious code, similar to malware injection.',
    },
    'CWE-287': {
      'IA-2': 'Broken authentication undermines the ability to uniquely identify and verify users.',
      'IA-5': 'Authentication bypass indicates inadequate authenticator management.',
      'AC-7': 'Missing protections against brute force attacks on authentication.',
    },
  };

  const normalizedCwe = cwe.toUpperCase().startsWith('CWE-') ? cwe.toUpperCase() : `CWE-${cwe}`;
  return cweContexts[normalizedCwe]?.[controlId] || 'This vulnerability type maps to this control based on security best practices.';
}
