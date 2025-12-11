/**
 * Semgrep Registry API Client
 *
 * Fetches security rules from Semgrep's public registry for use as guardrails.
 *
 * API Endpoints:
 * - Search: https://semgrep.dev/api/registry/rules?q=<query>&language=<lang>
 * - Get rule: https://semgrep.dev/c/r/<rule-path> (returns YAML)
 * - Get pack: https://semgrep.dev/c/p/<pack-name> (returns YAML)
 */

import YAML from 'yaml';

const SEMGREP_API_BASE = 'https://semgrep.dev/api/registry';
const SEMGREP_CONTENT_BASE = 'https://semgrep.dev/c/r';

// CWE to search query mapping for better results
// Note: Semgrep focuses on CODE patterns, not API architecture issues.
// CWEs like BOLA (639), BFLA (285) are API-level issues without direct code patterns.
const CWE_SEARCH_QUERIES: Record<string, string[]> = {
  // Code-level vulnerabilities (Semgrep has many rules for these)
  'CWE-89': ['sql injection', 'sqli', 'raw query'],
  'CWE-79': ['xss', 'cross-site scripting', 'innerHTML'],
  'CWE-78': ['command injection', 'os command', 'subprocess'],
  'CWE-287': ['authentication', 'auth bypass', 'jwt'],
  'CWE-306': ['authentication', 'missing authentication'],
  'CWE-918': ['ssrf', 'server-side request forgery', 'url fetch'],
  'CWE-22': ['path traversal', 'directory traversal', 'file path'],
  'CWE-502': ['deserialization', 'pickle', 'yaml load'],
  'CWE-611': ['xxe', 'xml external entity', 'xml parse'],
  'CWE-798': ['hardcoded credentials', 'hardcoded secret', 'password'],
  'CWE-327': ['weak crypto', 'insecure cipher', 'md5', 'sha1'],
  'CWE-330': ['weak random', 'insecure random', 'random'],
  'CWE-400': ['resource consumption', 'regex dos'],
  'CWE-601': ['open redirect', 'url redirect'],
  'CWE-94': ['code injection', 'eval', 'exec'],
  'CWE-95': ['eval injection', 'code execution'],
  'CWE-116': ['output encoding', 'escape'],
  'CWE-532': ['log injection', 'sensitive log'],
  // API-specific CWEs - mapped to related code-level patterns that can help
  'CWE-639': ['authorization', 'access control', 'permission'], // BOLA -> auth patterns
  'CWE-862': ['authorization', 'access control', 'decorator'],
  'CWE-863': ['authorization', 'permission check'],
  'CWE-285': ['authorization', 'access control', 'role'],  // BFLA
  'CWE-770': ['rate limit', 'throttle'], // Rate limiting
  'CWE-915': ['mass assignment', 'attr accessible'], // Mass assignment
  'CWE-200': ['information disclosure', 'sensitive data', 'exposure'], // Data exposure
};

// Fallback: Map API CWEs to code CWEs that Semgrep has rules for
const CWE_FALLBACK_MAP: Record<string, string> = {
  'CWE-639': 'CWE-862',  // BOLA -> Missing Authorization (more common)
  'CWE-285': 'CWE-862',  // BFLA -> Missing Authorization
  'CWE-770': 'CWE-400',  // Rate limit -> Resource consumption
  'CWE-915': 'CWE-502',  // Mass assignment -> Deserialization (similar pattern)
  'CWE-200': 'CWE-532',  // Data exposure -> Info leak in logs
};

// Curated list of known-good rule paths by CWE and language
// The Semgrep search API is unreliable, so we use direct rule fetching for common CWEs
// These paths were verified against https://semgrep.dev/c/p/{language}
const CURATED_RULES: Record<string, Record<string, string[]>> = {
  'CWE-89': { // SQL Injection
    'python': [
      'python.django.security.injection.sql.sql-injection-using-raw.sql-injection-using-raw',
      'python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query',
    ],
    'javascript': [
      'javascript.sequelize.security.audit.sequelize-raw-query.sequelize-raw-query',
    ],
    'typescript': [
      'typescript.sequelize.security.audit.sequelize-raw-query.sequelize-raw-query',
    ],
    'java': [
      'java.lang.security.audit.sqli.jdbc-sqli.jdbc-sqli',
    ],
  },
  'CWE-79': { // XSS
    'python': [
      'python.django.security.injection.xss.var-in-script-tag.var-in-script-tag',
      'python.flask.security.xss.audit.template-autoescape-off.template-autoescape-off',
    ],
    'javascript': [
      'javascript.browser.security.raw-html-concat.raw-html-concat',
    ],
    'typescript': [
      'typescript.react.security.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml',
    ],
  },
  'CWE-78': { // Command Injection
    'python': [
      'python.django.security.injection.command.command-injection-os-system.command-injection-os-system',
      'python.lang.security.audit.subprocess.subprocess-shell-true.subprocess-shell-true',
    ],
    'javascript': [
      'javascript.lang.security.detect-child-process.detect-child-process',
    ],
  },
  'CWE-918': { // SSRF
    'python': [
      'python.django.security.injection.ssrf.ssrf-injection-urllib.ssrf-injection-urllib',
    ],
  },
  'CWE-502': { // Deserialization
    'python': [
      'python.django.security.audit.avoid-insecure-deserialization.avoid-insecure-deserialization',
    ],
    'java': [
      'java.lang.security.audit.object-deserialization.object-deserialization',
    ],
  },
  'CWE-798': { // Hardcoded Credentials
    'python': [
      'python.boto3.security.hardcoded-token.hardcoded-token',
    ],
  },
  'CWE-327': { // Weak Crypto
    'python': [
      'python.cryptography.security.insecure-cipher-algorithms.insecure-cipher-algorithm-idea',
      'python.pycryptodome.security.insecure-cipher-algorithm-blowfish.insecure-cipher-algorithm-blowfish',
    ],
  },
};

// Language aliases for Semgrep
const LANGUAGE_ALIASES: Record<string, string> = {
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'python': 'python',
  'py': 'python',
  'java': 'java',
  'go': 'go',
  'golang': 'go',
  'ruby': 'ruby',
  'rb': 'ruby',
  'php': 'php',
  'c': 'c',
  'cpp': 'cpp',
  'c++': 'cpp',
  'csharp': 'csharp',
  'c#': 'csharp',
  'rust': 'rust',
  'scala': 'scala',
  'kotlin': 'kotlin',
  'swift': 'swift',
};

/**
 * Normalize a value that might be a string, array, or undefined to an array of strings
 */
function normalizeToArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

export interface SemgrepRuleMetadata {
  cwe?: string[];
  owasp?: string[];
  category?: string;
  technology?: string[];
  confidence?: string;
  likelihood?: string;
  impact?: string;
  references?: string[];
  vulnerability_class?: string[];
}

export interface SemgrepRule {
  id: string;
  message: string;
  severity: string;
  languages: string[];
  pattern?: string;
  patterns?: unknown[];
  fix?: string;
  metadata: SemgrepRuleMetadata;
  sourceUrl?: string;
  shortlink?: string;
}

export interface SemgrepSearchResult {
  id: string;
  path: string;
  visibility: 'public' | 'team_tier';
  source_uri: string;
  meta: {
    author?: string;
    rule: {
      r_id: number;
      rv_id: number;
      rule_id: string;
      version_id: string;
      url: string;
      origin: string;
    };
  };
}

export interface GuardrailRule {
  id: string;
  name: string;
  description: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  language: string;
  pattern?: string;
  fix?: string;
  cwe: string[];
  owasp: string[];
  references: string[];
  sourceUrl: string;
  ruleYaml: string;
  confidence?: string;
  impact?: string;
}

/**
 * Search for Semgrep rules by query and optional language filter
 */
export async function searchSemgrepRules(
  query: string,
  language?: string,
  limit = 10
): Promise<SemgrepSearchResult[]> {
  const normalizedLang = language ? LANGUAGE_ALIASES[language.toLowerCase()] : undefined;

  const params = new URLSearchParams({
    q: query,
    ...(normalizedLang && { language: normalizedLang }),
  });

  try {
    const response = await fetch(`${SEMGREP_API_BASE}/rules?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Semgrep API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const results: SemgrepSearchResult[] = await response.json();

    // Filter to only public rules (not team_tier/pro)
    let publicRules = results.filter(r => r.visibility === 'public');

    // The Semgrep API doesn't filter by language properly, so we filter by path
    // Rule paths typically start with the language: python.django.security...
    if (normalizedLang) {
      publicRules = publicRules.filter(r => {
        const pathLower = r.path.toLowerCase();
        return pathLower.startsWith(normalizedLang + '.') ||
               pathLower.includes('.' + normalizedLang + '.') ||
               pathLower.includes(normalizedLang + '/');
      });
    }

    return publicRules.slice(0, limit);
  } catch (error) {
    console.error('Error searching Semgrep rules:', error);
    return [];
  }
}

/**
 * Fetch the full YAML content of a specific rule
 */
export async function fetchRuleContent(rulePath: string): Promise<SemgrepRule | null> {
  try {
    const response = await fetch(`${SEMGREP_CONTENT_BASE}/${rulePath}`, {
      headers: {
        'Accept': 'text/yaml',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch rule ${rulePath}: ${response.status}`);
      return null;
    }

    const yamlContent = await response.text();
    const parsed = YAML.parse(yamlContent);

    // Semgrep returns { rules: [...] } format
    if (parsed.rules && parsed.rules.length > 0) {
      const rule = parsed.rules[0];
      return {
        ...rule,
        sourceUrl: `https://semgrep.dev/r/${rulePath}`,
        shortlink: rule.metadata?.semgrep?.dev?.rule?.shortlink,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching rule ${rulePath}:`, error);
    return null;
  }
}

/**
 * Search for guardrail rules by CWE ID
 */
export async function getGuardrailsByCWE(
  cweId: string,
  language?: string,
  limit = 5
): Promise<GuardrailRule[]> {
  // Normalize CWE ID (handle both "CWE-89" and "89" formats)
  let normalizedCwe = cweId.toUpperCase().startsWith('CWE-')
    ? cweId.toUpperCase()
    : `CWE-${cweId}`;

  const normalizedLang = language ? LANGUAGE_ALIASES[language.toLowerCase()] : undefined;

  // Check if we should use a fallback CWE (for API-specific CWEs that Semgrep lacks rules for)
  const fallbackCwe = CWE_FALLBACK_MAP[normalizedCwe];
  const cwesToSearch = fallbackCwe ? [normalizedCwe, fallbackCwe] : [normalizedCwe];

  const guardrails: GuardrailRule[] = [];

  // FIRST: Try curated rules for reliable results
  for (const cwe of cwesToSearch) {
    const curatedForCwe = CURATED_RULES[cwe];
    if (curatedForCwe && normalizedLang && curatedForCwe[normalizedLang]) {
      const rulePaths = curatedForCwe[normalizedLang];
      for (const path of rulePaths.slice(0, limit)) {
        if (guardrails.length >= limit) break;
        const rule = await fetchRuleContent(path);
        if (rule) {
          guardrails.push(transformToGuardrail(rule, path));
        }
      }
    }
    if (guardrails.length >= limit) break;
  }

  // If we got curated rules, return them
  if (guardrails.length > 0) {
    return guardrails.slice(0, limit);
  }

  // FALLBACK: Use search API if no curated rules found
  // Get search queries for these CWEs
  let searchQueries: string[] = [];
  for (const cwe of cwesToSearch) {
    const queries = CWE_SEARCH_QUERIES[cwe] || [cwe];
    searchQueries.push(...queries);
  }
  // Dedupe queries
  searchQueries = [...new Set(searchQueries)];

  const allResults: SemgrepSearchResult[] = [];

  // Search with multiple queries to maximize results
  for (const query of searchQueries) {
    const results = await searchSemgrepRules(query, language, limit);
    allResults.push(...results);

    // Stop if we have enough results
    if (allResults.length >= limit * 2) break;
  }

  // Deduplicate by rule path
  const uniqueResults = Array.from(
    new Map(allResults.map(r => [r.path, r])).values()
  );

  // Fetch full rule content for each result from search API fallback
  for (const result of uniqueResults.slice(0, limit)) {
    if (guardrails.length >= limit) break;

    const rule = await fetchRuleContent(result.path);

    if (rule) {
      // Handle case where cwe might be a string, array, or undefined
      const rawCwes = rule.metadata?.cwe;
      const ruleCwes: string[] = Array.isArray(rawCwes)
        ? rawCwes
        : (typeof rawCwes === 'string' ? [rawCwes] : []);

      // Check if rule matches any of the CWEs we're searching for (including fallbacks)
      const matchesCwe = ruleCwes.some(cwe =>
        typeof cwe === 'string' && cwesToSearch.some(searchCwe =>
          cwe.toUpperCase().includes(searchCwe)
        )
      );

      // Also accept if the rule message or path matches our search queries
      const matchesQuery = searchQueries.some(q =>
        rule.message?.toLowerCase().includes(q.toLowerCase()) ||
        result.path.toLowerCase().includes(q.toLowerCase().replace(/\s+/g, '-'))
      );

      // Only accept rules that match CWE or query - don't accept random security rules
      // The search API often returns irrelevant results
      if (matchesCwe || matchesQuery) {
        guardrails.push(transformToGuardrail(rule, result.path));
      }
    }
  }

  return guardrails.slice(0, limit);
}

/**
 * Search for guardrail rules by vulnerability type keyword
 */
export async function getGuardrailsByKeyword(
  keyword: string,
  language?: string,
  limit = 5
): Promise<GuardrailRule[]> {
  const results = await searchSemgrepRules(keyword, language, limit * 2);

  const guardrails: GuardrailRule[] = [];

  for (const result of results.slice(0, limit)) {
    const rule = await fetchRuleContent(result.path);

    if (rule) {
      guardrails.push(transformToGuardrail(rule, result.path));
    }
  }

  return guardrails;
}

/**
 * Transform a Semgrep rule to our GuardrailRule format
 */
function transformToGuardrail(rule: SemgrepRule, path: string): GuardrailRule {
  // Extract pattern(s) for display
  let patternDisplay: string | undefined;
  if (rule.pattern) {
    patternDisplay = rule.pattern;
  } else if (rule.patterns && Array.isArray(rule.patterns)) {
    // For complex patterns, show a summary
    patternDisplay = YAML.stringify(rule.patterns);
  }

  // Build the YAML representation for the guardrail section
  const ruleYaml = YAML.stringify({
    rules: [{
      id: rule.id,
      message: rule.message,
      severity: rule.severity,
      languages: rule.languages,
      ...(rule.pattern && { pattern: rule.pattern }),
      ...(rule.patterns && { patterns: rule.patterns }),
      ...(rule.fix && { fix: rule.fix }),
      metadata: {
        cwe: rule.metadata?.cwe,
        owasp: rule.metadata?.owasp,
      },
    }]
  });

  return {
    id: rule.id,
    name: extractRuleName(rule.id),
    description: rule.message,
    severity: rule.severity as 'ERROR' | 'WARNING' | 'INFO',
    language: rule.languages?.[0] || 'generic',
    pattern: patternDisplay,
    fix: rule.fix,
    cwe: normalizeToArray(rule.metadata?.cwe).map(c => extractCweId(c)),
    owasp: normalizeToArray(rule.metadata?.owasp),
    references: rule.metadata?.references || [],
    sourceUrl: `https://semgrep.dev/r/${path}`,
    ruleYaml,
    confidence: rule.metadata?.confidence,
    impact: rule.metadata?.impact,
  };
}

/**
 * Extract a human-readable name from the rule ID
 * e.g., "python.django.security.injection.sql.sql-injection-using-raw.sql-injection-using-raw"
 *  -> "SQL Injection Using Raw"
 */
function extractRuleName(ruleId: string): string {
  const parts = ruleId.split('.');
  const lastPart = parts[parts.length - 1] || ruleId;

  return lastPart
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract just the CWE ID from the full string
 * e.g., "CWE-89: Improper Neutralization of Special Elements..." -> "CWE-89"
 */
function extractCweId(cweString: string): string {
  const match = cweString.match(/CWE-\d+/);
  return match ? match[0] : cweString;
}

/**
 * Get guardrails for a finding based on its CWE and language
 */
export async function getGuardrailsForFinding(
  cweIds: string[],
  language?: string,
  limit = 3
): Promise<GuardrailRule[]> {
  const allGuardrails: GuardrailRule[] = [];

  for (const cweId of cweIds) {
    const guardrails = await getGuardrailsByCWE(cweId, language, limit);
    allGuardrails.push(...guardrails);

    if (allGuardrails.length >= limit) break;
  }

  // Deduplicate by rule ID
  return Array.from(
    new Map(allGuardrails.map(g => [g.id, g])).values()
  ).slice(0, limit);
}
