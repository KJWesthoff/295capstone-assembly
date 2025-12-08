# Cedar OS Interactive Components Implementation Guide

## Project Overview

**VentiAPI Scanner** is an AI-powered API security testing platform that combines traditional vulnerability scanning with intelligent analysis. This project uses **Cedar OS** for state management and interactive UI components, integrated with **Mastra** for AI agent orchestration.

The security dashboard provides:
- Real-time vulnerability scanning and analysis
- AI-powered security analyst that explains OWASP API Security Top 10 vulnerabilities
- Interactive visualizations (Mermaid diagrams) for attack paths
- Context-aware recommendations with code examples
- Remediation guidance and prioritization

This guide focuses on implementing three powerful interactive components to enhance the user experience:
1. **RadialMenuSpell** - Context-sensitive radial menus
2. **TooltipMenuSpell** - Hover-based quick actions
3. **QuestioningSpell** - Guided workflow wizards

---

## Complete Cedar OS Component Catalog

Cedar OS provides a comprehensive set of React components organized by category:

### 🎯 Spell Components (Interactive AI-driven UX)
- **RadialMenuSpell** - Radial menu for quick actions (context menus)
- **TooltipMenuSpell / TooltipMenu** - Context menus and hover tooltips
- **QuestioningSpell** - Interactive questioning UI for guided workflows
- **SpellActivationManager** - Manages spell lifecycle and activation
- **CommandPalette** - Command palette for quick navigation
- **Hotkey** - Keyboard shortcut system

### 🪟 Structural Components (Layout & Containers)
- **FloatingContainer** - Draggable, resizable floating windows (already implemented for Mermaid diagrams)
- **Dialog** - Modal dialogs
- **Sheet** - Side panels/drawers
- **Tabs** - Tab navigation
- **CollapsibleSection** - Collapsible/expandable sections
- **Card** - Content cards
- **Separator** - Visual dividers

### 💬 Chat Components
- **FloatingCedarChat** - Main chat interface (already active in app)
- **ChatInput** - Text input with rich features
- **ChatMessage** - Individual message rendering
- **ChatPresets** - Pre-configured chat prompts
- **MermaidDiagram** - Diagram visualization (enhanced with FloatingContainer)
- **MessageList** - Scrollable message container

### 🔧 Development Tools
- **DebuggerPanel** - Interactive debugger with tabs (already enabled)
- **MessagesTab** - Debug panel for message inspection
- **NetworkTab** - Network request monitoring
- **StatesTab** - State inspection panel

### 🎨 UI Primitives
- **Button** - Button component
- **Input** - Text input
- **Select** - Dropdown select
- **Checkbox** - Checkbox input
- **RadioGroup** - Radio button groups
- **Switch** - Toggle switches
- **Slider** - Range sliders
- **Label** - Form labels
- **Badge** - Status badges
- **Avatar** - User avatars
- **Tooltip** - Simple tooltips
- **Popover** - Popover menus
- **DropdownMenu** - Dropdown menus
- **ContextMenu** - Right-click context menus

### 🎤 Voice Components
- **VoiceButton** - Voice input trigger
- **VoiceIndicator** - Audio level visualization
- **VoicePermissionHandler** - Microphone permission management

### 🔄 State Management Hooks
- **useCedarState** - Register app state for Cedar context
- **useCedarStore** - Access global Cedar state
- **useSpell** - Create and manage spells

---

## Implementation Requirements

### 1. RadialMenuSpell - Context-Sensitive Radial Menus

**Purpose**: Provide quick, visual access to actions through circular menus that appear on right-click or long-press.

**Key Features**:
- Circular layout with icon-based menu items
- Gesture-driven activation (right-click, long-press, hotkey)
- Smooth animations for open/close
- Context-aware menu items based on what's selected
- Supports nested sub-menus

**Use Cases for VentiAPI Scanner**:

#### Use Case 1: Vulnerability Finding Actions
When user right-clicks on a vulnerability in the findings table:

```typescript
import { RadialMenuSpell } from '@/app/cedar-os/components/spells/RadialMenuSpell';
import { useCedarState } from 'cedar-os';

interface VulnerabilityRowProps {
  finding: Finding;
}

export const VulnerabilityRow: React.FC<VulnerabilityRowProps> = ({ finding }) => {
  const [selectedFinding, setSelectedFinding] = useCedarState('selectedFinding', finding);

  const menuItems = [
    {
      icon: '🎨',
      label: 'Visualize Attack Path',
      action: () => {
        // Trigger agent to generate Mermaid diagram
        sendChatMessage(`Create an attack path diagram for ${finding.vulnerability_type}`);
      }
    },
    {
      icon: '📋',
      label: 'Copy Details',
      action: () => {
        navigator.clipboard.writeText(JSON.stringify(finding, null, 2));
      }
    },
    {
      icon: '🔍',
      label: 'Deep Dive Analysis',
      action: () => {
        // Add finding to Cedar context and ask for detailed analysis
        setSelectedFinding(finding);
        sendChatMessage('@selectedFinding Provide a comprehensive analysis with code examples');
      }
    },
    {
      icon: '🛠️',
      label: 'Generate Fix',
      action: () => {
        sendChatMessage(`@selectedFinding Generate remediation code for this vulnerability`);
      }
    },
    {
      icon: '⚠️',
      label: 'Mark False Positive',
      action: () => {
        markFalsePositive(finding.id);
      }
    },
    {
      icon: '📤',
      label: 'Export Report',
      action: () => {
        exportFindingReport(finding);
      }
    },
  ];

  return (
    <div className="relative">
      <RadialMenuSpell
        items={menuItems}
        trigger="contextmenu"
        position={{ x: 0, y: 0 }} // Will be calculated on activation
      >
        <tr className="hover:bg-gray-800 cursor-context-menu">
          <td>{finding.vulnerability_type}</td>
          <td>{finding.severity}</td>
          <td>{finding.endpoint}</td>
        </tr>
      </RadialMenuSpell>
    </div>
  );
};
```

#### Use Case 2: Code Snippet Actions
When user right-clicks on a code block in chat:

```typescript
const codeBlockMenuItems = [
  {
    icon: '📋',
    label: 'Copy Code',
    action: () => navigator.clipboard.writeText(codeContent)
  },
  {
    icon: '▶️',
    label: 'Run in Playground',
    action: () => openPlayground(codeContent)
  },
  {
    icon: '💾',
    label: 'Save Snippet',
    action: () => saveToSnippets(codeContent)
  },
  {
    icon: '🔄',
    label: 'Request Alternative',
    action: () => sendChatMessage('Can you provide an alternative implementation?')
  },
  {
    icon: '❓',
    label: 'Explain Code',
    action: () => sendChatMessage('Explain this code line by line')
  },
];
```

#### Use Case 3: Scan Configuration Shortcuts
Quick actions on scan results:

```typescript
const scanMenuItems = [
  {
    icon: '🔄',
    label: 'Re-scan',
    action: () => triggerRescan(scanId)
  },
  {
    icon: '📊',
    label: 'View Metrics',
    action: () => openMetricsDashboard(scanId)
  },
  {
    icon: '🎯',
    label: 'Focus High Severity',
    action: () => filterBySeverity('high')
  },
  {
    icon: '📁',
    label: 'Group by Type',
    action: () => groupByVulnerabilityType()
  },
  {
    icon: '🧪',
    label: 'Generate Test Cases',
    action: () => sendChatMessage(`Generate test cases for findings in scan ${scanId}`)
  },
];
```

**Implementation Pattern**:

```typescript
// src/components/security/VulnerabilityContextMenu.tsx
'use client';

import { RadialMenuSpell } from '@/app/cedar-os/components/spells/RadialMenuSpell';
import { useCallback } from 'react';
import { useCedarState } from 'cedar-os';

interface MenuItem {
  icon: string;
  label: string;
  action: () => void;
  disabled?: boolean;
  shortcut?: string;
}

interface VulnerabilityContextMenuProps {
  finding: Finding;
  children: React.ReactNode;
}

export const VulnerabilityContextMenu: React.FC<VulnerabilityContextMenuProps> = ({
  finding,
  children
}) => {
  const [, setChatContext] = useCedarState('activeFinding', null);

  const handleVisualize = useCallback(() => {
    setChatContext(finding);
    // Trigger Cedar chat to generate diagram
    window.dispatchEvent(new CustomEvent('cedar:chat:send', {
      detail: { message: `@activeFinding Create an attack path diagram` }
    }));
  }, [finding, setChatContext]);

  const menuItems: MenuItem[] = [
    {
      icon: '🎨',
      label: 'Visualize',
      action: handleVisualize,
      shortcut: 'V'
    },
    {
      icon: '📋',
      label: 'Copy',
      action: () => navigator.clipboard.writeText(JSON.stringify(finding, null, 2)),
      shortcut: 'C'
    },
    {
      icon: '🔍',
      label: 'Analyze',
      action: () => {
        setChatContext(finding);
        window.dispatchEvent(new CustomEvent('cedar:chat:send', {
          detail: { message: '@activeFinding Provide detailed analysis' }
        }));
      },
      shortcut: 'A'
    },
    {
      icon: '🛠️',
      label: 'Fix',
      action: () => {
        setChatContext(finding);
        window.dispatchEvent(new CustomEvent('cedar:chat:send', {
          detail: { message: '@activeFinding Generate remediation code' }
        }));
      },
      shortcut: 'F'
    },
  ];

  return (
    <RadialMenuSpell
      items={menuItems}
      trigger="contextmenu"
      radius={80}
      itemSize={48}
    >
      {children}
    </RadialMenuSpell>
  );
};
```

---

### 2. TooltipMenuSpell - Hover-Based Quick Actions

**Purpose**: Provide contextual information and quick actions on hover, without requiring clicks.

**Key Features**:
- Appears on hover with configurable delay
- Compact menu with 3-6 quick actions
- Non-intrusive design that doesn't block content
- Smart positioning to stay within viewport
- Can include rich content (images, code, charts)

**Use Cases for VentiAPI Scanner**:

#### Use Case 1: Severity Badge Tooltips
When hovering over a severity badge:

```typescript
import { TooltipMenuSpell } from '@/app/cedar-os/components/spells/TooltipMenuSpell';

export const SeverityBadge: React.FC<{ severity: string; finding: Finding }> = ({
  severity,
  finding
}) => {
  const tooltipContent = (
    <div className="p-3 max-w-sm">
      <h4 className="font-semibold mb-2">{severity} Severity</h4>
      <p className="text-sm text-gray-300 mb-3">
        {getSeverityDescription(severity)}
      </p>
      <div className="flex gap-2">
        <button
          className="text-xs px-2 py-1 bg-blue-600 rounded hover:bg-blue-700"
          onClick={() => sendChatMessage(`Explain why this is ${severity} severity`)}
        >
          Why?
        </button>
        <button
          className="text-xs px-2 py-1 bg-green-600 rounded hover:bg-green-700"
          onClick={() => sendChatMessage(`How to fix ${severity} severity issues?`)}
        >
          Fix It
        </button>
        <button
          className="text-xs px-2 py-1 bg-purple-600 rounded hover:bg-purple-700"
          onClick={() => filterBySeverity(severity)}
        >
          Filter
        </button>
      </div>
    </div>
  );

  return (
    <TooltipMenuSpell content={tooltipContent} delay={300}>
      <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(severity)}`}>
        {severity}
      </span>
    </TooltipMenuSpell>
  );
};
```

#### Use Case 2: Endpoint Information
Quick details about API endpoints:

```typescript
export const EndpointCell: React.FC<{ endpoint: string; method: string }> = ({
  endpoint,
  method
}) => {
  const tooltipContent = (
    <div className="p-3 max-w-md">
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-1 bg-blue-900 rounded text-xs font-mono">{method}</span>
        <code className="text-sm">{endpoint}</code>
      </div>
      <div className="text-xs text-gray-400 mb-3">
        <div>Vulnerabilities: {getEndpointVulnCount(endpoint)}</div>
        <div>Last scanned: {getLastScanTime(endpoint)}</div>
      </div>
      <div className="flex gap-2">
        <button
          className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
          onClick={() => viewEndpointDetails(endpoint)}
        >
          Details
        </button>
        <button
          className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
          onClick={() => sendChatMessage(`Analyze security of ${method} ${endpoint}`)}
        >
          Ask Agent
        </button>
        <button
          className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
          onClick={() => rescanEndpoint(endpoint)}
        >
          Re-scan
        </button>
      </div>
    </div>
  );

  return (
    <TooltipMenuSpell content={tooltipContent} delay={500}>
      <div className="font-mono text-sm hover:text-blue-400 cursor-help">
        {endpoint}
      </div>
    </TooltipMenuSpell>
  );
};
```

#### Use Case 3: Code Block Previews
When hovering over truncated code snippets:

```typescript
export const CodePreview: React.FC<{ code: string; language: string }> = ({
  code,
  language
}) => {
  const fullCodeTooltip = (
    <div className="p-3 max-w-2xl">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-400">{language}</span>
        <div className="flex gap-2">
          <button
            className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
            onClick={() => navigator.clipboard.writeText(code)}
          >
            Copy
          </button>
          <button
            className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
            onClick={() => sendChatMessage('Explain this code')}
          >
            Explain
          </button>
        </div>
      </div>
      <pre className="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-96">
        <code>{code}</code>
      </pre>
    </div>
  );

  const truncatedCode = code.length > 100 ? code.substring(0, 100) + '...' : code;

  return (
    <TooltipMenuSpell content={fullCodeTooltip} delay={400}>
      <code className="text-sm bg-gray-800 px-2 py-1 rounded cursor-pointer hover:bg-gray-700">
        {truncatedCode}
      </code>
    </TooltipMenuSpell>
  );
};
```

**Implementation Pattern**:

```typescript
// src/components/shared/SmartTooltip.tsx
'use client';

import { TooltipMenuSpell } from '@/app/cedar-os/components/spells/TooltipMenuSpell';
import { ReactNode } from 'react';

interface QuickAction {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'success' | 'danger';
}

interface SmartTooltipProps {
  title: string;
  description?: string;
  actions?: QuickAction[];
  children: ReactNode;
  delay?: number;
}

export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  title,
  description,
  actions = [],
  children,
  delay = 300
}) => {
  const getActionColor = (variant: string) => {
    switch (variant) {
      case 'primary': return 'bg-blue-600 hover:bg-blue-700';
      case 'success': return 'bg-green-600 hover:bg-green-700';
      case 'danger': return 'bg-red-600 hover:bg-red-700';
      default: return 'bg-gray-700 hover:bg-gray-600';
    }
  };

  const content = (
    <div className="p-3 max-w-sm">
      <h4 className="font-semibold text-sm mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-gray-400 mb-3">{description}</p>
      )}
      {actions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {actions.map((action, idx) => (
            <button
              key={idx}
              className={`text-xs px-2 py-1 rounded transition-colors ${getActionColor(action.variant || 'default')}`}
              onClick={action.onClick}
            >
              {action.icon && <span className="mr-1">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <TooltipMenuSpell content={content} delay={delay}>
      {children}
    </TooltipMenuSpell>
  );
};
```

---

### 3. QuestioningSpell - Guided Workflow Wizards

**Purpose**: Guide users through multi-step processes with conversational, interactive flows.

**Key Features**:
- Step-by-step wizard interface
- Contextual questions based on previous answers
- Integration with Mastra agents for intelligent guidance
- Progress tracking with visual indicators
- Can branch based on user responses
- Saves state for resuming later

**Use Cases for VentiAPI Scanner**:

#### Use Case 1: Vulnerability Remediation Wizard
Guide users through fixing a vulnerability:

```typescript
import { QuestioningSpell } from '@/app/cedar-os/components/spells/QuestioningSpell';
import { useState } from 'react';

export const RemediationWizard: React.FC<{ finding: Finding }> = ({ finding }) => {
  const [wizardState, setWizardState] = useState({
    currentStep: 0,
    answers: {}
  });

  const steps = [
    {
      id: 'understand',
      question: `Do you understand what ${finding.vulnerability_type} is and why it's dangerous?`,
      type: 'boolean',
      options: ['Yes, I understand', 'No, please explain'],
      onAnswer: async (answer: string) => {
        if (answer === 'No, please explain') {
          // Trigger agent explanation
          return {
            nextStep: 'explanation',
            agentPrompt: `Explain ${finding.vulnerability_type} in simple terms with an example`
          };
        }
        return { nextStep: 'framework' };
      }
    },
    {
      id: 'explanation',
      question: 'Here\'s an explanation of the vulnerability. Would you like to proceed with fixing it?',
      type: 'confirmation',
      showAgentResponse: true,
      onAnswer: () => ({ nextStep: 'framework' })
    },
    {
      id: 'framework',
      question: 'What framework/language is your API built with?',
      type: 'select',
      options: ['Node.js/Express', 'Python/FastAPI', 'Java/Spring', 'Go', 'Ruby/Rails', 'Other'],
      onAnswer: async (framework: string) => {
        return {
          nextStep: 'solution',
          context: { framework }
        };
      }
    },
    {
      id: 'solution',
      question: 'Generating a fix specific to your framework...',
      type: 'loading',
      agentPrompt: (context: any) =>
        `Generate remediation code for ${finding.vulnerability_type} in ${context.framework}. Include:\n` +
        `1. Code example showing the fix\n` +
        `2. Configuration changes if needed\n` +
        `3. Test cases to verify the fix\n\n` +
        `Vulnerability details: ${JSON.stringify(finding)}`,
      onAnswer: () => ({ nextStep: 'verify' })
    },
    {
      id: 'verify',
      question: 'Have you implemented the fix?',
      type: 'boolean',
      options: ['Yes, implemented', 'Need help', 'Will do later'],
      onAnswer: async (answer: string) => {
        if (answer === 'Yes, implemented') {
          return { nextStep: 'test' };
        } else if (answer === 'Need help') {
          return {
            nextStep: 'help',
            agentPrompt: 'What part of the implementation do you need help with?'
          };
        } else {
          return { nextStep: 'complete', message: 'Saved for later' };
        }
      }
    },
    {
      id: 'test',
      question: 'Would you like me to generate test cases to verify the fix?',
      type: 'boolean',
      options: ['Yes, generate tests', 'No, I have tests'],
      onAnswer: async (answer: string) => {
        if (answer === 'Yes, generate tests') {
          return {
            nextStep: 'generate-tests',
            agentPrompt: `Generate comprehensive test cases for verifying the ${finding.vulnerability_type} fix`
          };
        }
        return { nextStep: 'complete' };
      }
    },
    {
      id: 'complete',
      question: 'Great! The remediation flow is complete. Would you like to:',
      type: 'multi-select',
      options: [
        'Mark this finding as resolved',
        'Generate documentation for the fix',
        'Share fix with team',
        'Re-scan to verify'
      ],
      onAnswer: async (selections: string[]) => {
        // Handle completion actions
        return { nextStep: null, complete: true };
      }
    }
  ];

  return (
    <QuestioningSpell
      steps={steps}
      currentStep={wizardState.currentStep}
      onStepComplete={(step, answer) => {
        setWizardState({
          currentStep: wizardState.currentStep + 1,
          answers: { ...wizardState.answers, [step.id]: answer }
        });
      }}
      onComplete={(answers) => {
        console.log('Remediation wizard complete:', answers);
        // Update finding status, generate report, etc.
      }}
    />
  );
};
```

#### Use Case 2: Scan Configuration Wizard
Help users configure a new scan:

```typescript
const scanConfigSteps = [
  {
    id: 'target',
    question: 'What would you like to scan?',
    type: 'radio',
    options: [
      'OpenAPI/Swagger spec file',
      'Live API endpoint',
      'Postman collection'
    ],
    onAnswer: (choice: string) => {
      if (choice === 'OpenAPI/Swagger spec file') {
        return { nextStep: 'upload-spec' };
      } else if (choice === 'Live API endpoint') {
        return { nextStep: 'endpoint-url' };
      } else {
        return { nextStep: 'postman-import' };
      }
    }
  },
  {
    id: 'upload-spec',
    question: 'Please upload your OpenAPI specification file',
    type: 'file-upload',
    accept: '.json,.yaml,.yml',
    onAnswer: (file: File) => {
      return { nextStep: 'auth', context: { spec: file } };
    }
  },
  {
    id: 'auth',
    question: 'Does your API require authentication?',
    type: 'boolean',
    options: ['Yes', 'No'],
    onAnswer: (hasAuth: boolean) => {
      if (hasAuth) {
        return { nextStep: 'auth-type' };
      }
      return { nextStep: 'scan-mode' };
    }
  },
  {
    id: 'auth-type',
    question: 'What type of authentication does your API use?',
    type: 'select',
    options: ['API Key', 'Bearer Token', 'Basic Auth', 'OAuth2', 'Custom Header'],
    onAnswer: (authType: string) => {
      return { nextStep: 'auth-credentials', context: { authType } };
    }
  },
  {
    id: 'auth-credentials',
    question: (context: any) => `Please provide your ${context.authType} credentials`,
    type: 'secure-input',
    onAnswer: (credentials: string) => {
      return { nextStep: 'scan-mode', context: { credentials } };
    }
  },
  {
    id: 'scan-mode',
    question: 'Choose scan intensity:',
    type: 'radio',
    options: [
      { label: 'Quick Scan', description: 'Fast, basic vulnerability detection (~5 min)' },
      { label: 'Standard Scan', description: 'Comprehensive OWASP API Top 10 (~15 min)' },
      { label: 'Deep Scan', description: 'Exhaustive testing with fuzzing (~30 min)' }
    ],
    onAnswer: (mode: string) => {
      return { nextStep: 'dangerous-checks' };
    }
  },
  {
    id: 'dangerous-checks',
    question: 'Enable potentially dangerous tests? (May modify data)',
    type: 'boolean',
    options: ['Enable', 'Disable'],
    default: 'Disable',
    warning: 'Dangerous tests may create, modify, or delete data in your API',
    onAnswer: (enabled: boolean) => {
      return { nextStep: 'summary' };
    }
  },
  {
    id: 'summary',
    question: 'Review your scan configuration:',
    type: 'summary',
    render: (answers: any) => (
      <div className="space-y-2">
        <div>Target: {answers.target}</div>
        <div>Authentication: {answers.auth ? answers.authType : 'None'}</div>
        <div>Scan Mode: {answers.scanMode}</div>
        <div>Dangerous Tests: {answers.dangerousChecks ? 'Enabled' : 'Disabled'}</div>
      </div>
    ),
    onAnswer: () => {
      return { nextStep: null, complete: true };
    }
  }
];
```

#### Use Case 3: Threat Modeling Wizard
Interactive threat modeling session:

```typescript
const threatModelingSteps = [
  {
    id: 'intro',
    question: 'Let\'s build a threat model for your API. First, what type of data does your API handle?',
    type: 'multi-select',
    options: [
      'Personal Identifiable Information (PII)',
      'Financial data',
      'Health records',
      'Authentication credentials',
      'Business logic/trade secrets',
      'Public data only'
    ],
    onAnswer: (dataTypes: string[]) => {
      return { nextStep: 'sensitivity', context: { dataTypes } };
    }
  },
  {
    id: 'sensitivity',
    question: 'Based on your data types, I recommend focusing on these threats. Which would you like to explore?',
    type: 'priority-list',
    generateOptions: async (context: any) => {
      // Ask Mastra agent to generate relevant threats
      const threats = await queryAgent(
        `Based on an API handling ${context.dataTypes.join(', ')}, list the top 5 OWASP API threats to prioritize`
      );
      return threats;
    },
    onAnswer: (prioritizedThreats: string[]) => {
      return { nextStep: 'controls', context: { threats: prioritizedThreats } };
    }
  },
  {
    id: 'controls',
    question: 'What security controls do you currently have in place?',
    type: 'checklist',
    options: [
      'Rate limiting',
      'Input validation',
      'Authentication',
      'Authorization (RBAC/ABAC)',
      'Encryption in transit (HTTPS)',
      'Encryption at rest',
      'Logging and monitoring',
      'API gateway',
      'WAF (Web Application Firewall)'
    ],
    onAnswer: (controls: string[]) => {
      return { nextStep: 'gaps', context: { controls } };
    }
  },
  {
    id: 'gaps',
    question: 'Analyzing security gaps...',
    type: 'loading',
    agentPrompt: (context: any) =>
      `Given an API handling: ${context.dataTypes.join(', ')}\n` +
      `Current controls: ${context.controls.join(', ')}\n` +
      `Priority threats: ${context.threats.join(', ')}\n\n` +
      `Identify security gaps and recommend additional controls.`,
    onAnswer: () => ({ nextStep: 'recommendations' })
  },
  {
    id: 'recommendations',
    question: 'Here are my recommendations. Which would you like to implement?',
    type: 'interactive-list',
    showAgentResponse: true,
    allowSelectMultiple: true,
    onAnswer: (selected: string[]) => {
      return { nextStep: 'roadmap', context: { selectedControls: selected } };
    }
  },
  {
    id: 'roadmap',
    question: 'Would you like me to create an implementation roadmap?',
    type: 'boolean',
    options: ['Yes, create roadmap', 'No, just show summary'],
    onAnswer: async (createRoadmap: boolean) => {
      if (createRoadmap) {
        return {
          nextStep: 'generate-roadmap',
          agentPrompt: `Create a phased implementation roadmap for: ${wizardState.answers.selectedControls.join(', ')}`
        };
      }
      return { nextStep: 'complete' };
    }
  }
];
```

**Implementation Pattern**:

```typescript
// src/components/workflows/QuestioningWorkflow.tsx
'use client';

import { QuestioningSpell } from '@/app/cedar-os/components/spells/QuestioningSpell';
import { useState, useCallback } from 'react';
import { useCedarState } from 'cedar-os';

interface WorkflowStep {
  id: string;
  question: string | ((context: any) => string);
  type: 'boolean' | 'select' | 'multi-select' | 'text' | 'file-upload' | 'loading' | 'summary';
  options?: string[] | { label: string; description?: string }[];
  agentPrompt?: string | ((context: any) => string);
  onAnswer: (answer: any, context?: any) => Promise<{ nextStep: string | null; context?: any }>;
  validation?: (answer: any) => boolean | string;
}

interface QuestioningWorkflowProps {
  steps: WorkflowStep[];
  onComplete: (answers: Record<string, any>) => void;
  title: string;
}

export const QuestioningWorkflow: React.FC<QuestioningWorkflowProps> = ({
  steps,
  onComplete,
  title
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [context, setContext] = useState<any>({});
  const [agentResponse, setAgentResponse] = useState<string | null>(null);

  const [, sendMessage] = useCedarState('workflowMessage', '');

  const currentStep = steps[currentStepIndex];

  const handleAnswer = useCallback(async (answer: any) => {
    // Validate if validation function exists
    if (currentStep.validation) {
      const validationResult = currentStep.validation(answer);
      if (validationResult !== true) {
        alert(typeof validationResult === 'string' ? validationResult : 'Invalid input');
        return;
      }
    }

    // Save answer
    const newAnswers = { ...answers, [currentStep.id]: answer };
    setAnswers(newAnswers);

    // If this step has an agent prompt, query the agent
    if (currentStep.agentPrompt) {
      const prompt = typeof currentStep.agentPrompt === 'function'
        ? currentStep.agentPrompt(context)
        : currentStep.agentPrompt;

      sendMessage(prompt);
      // Wait for agent response (would be handled by Cedar state subscription)
      // For now, simulate
      setAgentResponse('Agent response will appear here...');
    }

    // Execute step's onAnswer handler
    const result = await currentStep.onAnswer(answer, context);

    // Update context if provided
    if (result.context) {
      setContext({ ...context, ...result.context });
    }

    // Move to next step or complete
    if (result.nextStep === null || result.complete) {
      onComplete(newAnswers);
    } else {
      const nextStepIndex = steps.findIndex(s => s.id === result.nextStep);
      if (nextStepIndex >= 0) {
        setCurrentStepIndex(nextStepIndex);
      }
    }
  }, [currentStep, answers, context, steps, onComplete, sendMessage]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>

      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="text-sm text-gray-400">
            {Math.round(((currentStepIndex + 1) / steps.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <QuestioningSpell
        step={currentStep}
        onAnswer={handleAnswer}
        agentResponse={agentResponse}
        context={context}
      />
    </div>
  );
};
```

---

## Integration with Mastra Agents

All three components should integrate seamlessly with the existing Mastra security analyst agent:

### Pattern 1: Context-Aware Actions

```typescript
import { useCedarState } from 'cedar-os';

// Register finding in Cedar state
const [activeFinding, setActiveFinding] = useCedarState('activeFinding', null);

// When user clicks action in RadialMenu/TooltipMenu
const handleAnalyze = () => {
  setActiveFinding(finding);
  // Agent automatically has access via @activeFinding mention
  sendChatMessage('@activeFinding Provide comprehensive analysis');
};
```

### Pattern 2: Workflow Integration

```typescript
// QuestioningSpell can trigger agent queries at each step
const step = {
  id: 'analysis',
  question: 'Analyzing vulnerability...',
  type: 'loading',
  agentPrompt: `Analyze ${finding.vulnerability_type} and provide remediation steps`,
  onAnswer: (agentResponse) => {
    // Use agent response in next step
    return { nextStep: 'review', context: { analysis: agentResponse } };
  }
};
```

### Pattern 3: Tool Invocation

```typescript
// Components can trigger specific Mastra tools
const menuItems = [
  {
    icon: '🎨',
    label: 'Visualize',
    action: async () => {
      // Trigger the visualizeAttackPath tool
      const result = await mastra.tools.visualizeAttackPath.execute({
        finding: finding
      });
      // Mermaid diagram automatically renders in chat
    }
  }
];
```

---

## Success Criteria

Your implementation will be successful when:

### RadialMenuSpell
- [ ] Right-click on vulnerability rows opens radial menu with 4-6 actions
- [ ] Menu items have clear icons and labels
- [ ] Actions integrate with Cedar state (context switching works)
- [ ] Menu animates smoothly and positions intelligently
- [ ] Works on both desktop (right-click) and mobile (long-press)

### TooltipMenuSpell
- [ ] Hovering over severity badges shows rich tooltip with quick actions
- [ ] Hovering over endpoints shows details and 2-3 action buttons
- [ ] Tooltips don't interfere with scrolling or clicking
- [ ] Content loads quickly (<300ms)
- [ ] Tooltips reposition to stay within viewport

### QuestioningSpell
- [ ] Remediation wizard guides user through 5-7 steps
- [ ] Each step waits for user input before proceeding
- [ ] Agent responses integrate seamlessly into workflow
- [ ] Progress is saved and can be resumed
- [ ] Wizard completes with actionable output (code, config, test cases)

---

## Bonus Ideas & Advanced Interactions

### Combining Components
**Radial Menu → Questioning Spell**: Right-click on finding → "Guided Fix" → Opens remediation wizard

**Tooltip → Radial Menu**: Hover shows quick info, click opens full radial menu for more actions

**Questioning Spell → Mermaid Diagram**: Wizard generates attack path diagram at completion

### Keyboard Shortcuts
```typescript
// Add keyboard shortcuts to all menus
const menuItems = [
  { icon: '🎨', label: 'Visualize', action: handleVisualize, shortcut: 'V' },
  { icon: '📋', label: 'Copy', action: handleCopy, shortcut: 'C' },
  { icon: '🔍', label: 'Analyze', action: handleAnalyze, shortcut: 'A' },
];

// Use Cedar's Hotkey component
import { Hotkey } from '@/app/cedar-os/components/spells/Hotkey';

<Hotkey
  keys={['shift', 'v']}
  onTrigger={() => handleVisualize(selectedFinding)}
/>
```

### Mobile Gestures
- Long-press on vulnerability row → RadialMenuSpell
- Swipe left on finding → Quick actions (mark resolved, false positive)
- Pinch zoom on Mermaid diagrams in FloatingContainer

### Voice Integration
```typescript
import { VoiceButton } from '@/app/cedar-os/components/voice/VoiceButton';

// Add voice commands to QuestioningSpell
const wizardWithVoice = (
  <div>
    <QuestioningSpell steps={steps} />
    <VoiceButton
      onTranscript={(text) => {
        // Answer current question with voice
        handleAnswer(text);
      }}
    />
  </div>
);
```

### Collaborative Features
- Share radial menu configurations across team
- Export QuestioningSpell workflows as templates
- Real-time collaboration on remediation wizards

---

## Getting Started

1. **Read Cedar OS component documentation** in `/src/app/cedar-os/components/`
2. **Study existing implementations**:
   - MermaidDiagram.tsx (FloatingContainer usage)
   - DebuggerPanel.tsx (complex component with tabs)
   - FloatingCedarChat.tsx (Cedar integration patterns)
3. **Start with one use case**: Implement RadialMenuSpell on vulnerability table rows
4. **Test with real data**: Use existing scan results from security dashboard
5. **Iterate based on UX**: Get feedback on menu positioning, animation timing
6. **Expand to other use cases**: Add more menu items, tooltip use cases

---

## Component File Locations

Create new files in:
- `/src/components/security/` - Security-specific spell implementations
- `/src/components/shared/` - Reusable spell wrappers (SmartTooltip, etc.)
- `/src/components/workflows/` - QuestioningSpell workflows

Import Cedar OS components from:
- `@/app/cedar-os/components/spells/` - Spell components
- `@/app/cedar-os/components/structural/` - Containers, dialogs
- `cedar-os` - Hooks (useCedarState, useCedarStore, useSpell)

---

## Additional Resources

- Cedar OS documentation: Check `/src/app/cedar-os/` directory
- Mastra agent code: `/src/backend/src/mastra/agents/securityAnalystAgent.ts`
- Existing tools: `/src/backend/src/mastra/tools/`
- State management examples: Look for `useCedarState` usage in components

---

Good luck with your implementation! These interactive components will make the VentiAPI Scanner significantly more intuitive and powerful. Focus on smooth animations, clear visual feedback, and tight integration with the Mastra AI agent for the best user experience.
