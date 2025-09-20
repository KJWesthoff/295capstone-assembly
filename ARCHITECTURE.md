# VentiAPI Scanner - Comprehensive Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            VentiAPI Scanner Platform                                │
│                      Microservice API Security Testing                             │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │    Internet     │
                                    │    Clients      │
                                    └─────────┬───────┘
                                              │ HTTP/HTTPS
                                              │ Port: 3000
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               Railway Platform                                      │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │                          Nginx Reverse Proxy                                   │ │
│ │                            (Port 3000)                                         │ │
│ │ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │ │
│ │ │  Static Files   │  │   API Routing   │  │ Security Headers│                 │ │
│ │ │  (React Build)  │  │   /api/* →      │  │ - X-Frame       │                 │ │
│ │ │  - index.html   │  │   web-api:8000  │  │ - CORS          │                 │ │
│ │ │  - JS/CSS       │  │                 │  │ - XSS Protection│                 │ │
│ │ │  - Assets       │  │                 │  │                 │                 │ │
│ │ └─────────────────┘  └─────────────────┘  └─────────────────┘                 │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      │                       │                       │
                      ▼                       ▼                       ▼
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│      Frontend           │     │       Backend           │     │        Redis            │
│   (React + TypeScript)  │     │     (FastAPI)           │     │    (Cache & State)      │
│                         │     │                         │     │                         │
│ ┌─────────────────────┐ │     │ ┌─────────────────────┐ │     │ ┌─────────────────────┐ │
│ │   Components        │ │     │ │     Main API        │ │     │ │   Rate Limiting     │ │
│ │ ┌─────────────────┐ │ │     │ │                     │ │     │ │   - Auth throttle   │ │
│ │ │  ApiScanner     │ │ │     │ │ ┌─────────────────┐ │ │     │ │   - Scan throttle   │ │
│ │ │  - File Upload  │ │ │◄────┤ │ │ Authentication  │ │ │     │ │                     │ │
│ │ │  - URL Input    │ │ │     │ │ │ - JWT Tokens    │ │ │     │ │   Scan State        │ │
│ │ │  - Config Form  │ │ │     │ │ │ - User Auth     │ │ │     │ │   - Progress Data   │ │
│ │ └─────────────────┘ │ │     │ │ │ - Role-based    │ │ │     │ │   - Chunk Status    │ │
│ │                     │ │     │ │ └─────────────────┘ │ │     │ │   - Findings Cache  │ │
│ │ ┌─────────────────┐ │ │     │ │                     │ │     │ └─────────────────────┘ │
│ │ │  Report         │ │ │     │ │ ┌─────────────────┐ │ │     └─────────────────────────┘
│ │ │  - Progress     │ │ │     │ │ │ Scan Endpoints  │ │ │                   │
│ │ │  - Findings     │ │ │     │ │ │ - POST /start   │ │ │                   │
│ │ │  - Download     │ │ │     │ │ │ - GET /status   │ │ │                   │
│ │ └─────────────────┘ │ │     │ │ │ - GET /findings │ │ │                   │
│ │                     │ │     │ │ │ - GET /report   │ │ │                   │
│ │ ┌─────────────────┐ │ │     │ │ │ - DELETE /scan  │ │ │                   │
│ │ │ParallelProgress │ │ │     │ │ └─────────────────┘ │ │                   │
│ │ │ - 3 Workers     │ │ │     │ │                     │ │                   │
│ │ │ - Real-time     │ │ │     │ │ ┌─────────────────┐ │ │                   │
│ │ │ - TanStack      │ │ │     │ │ │Security Middleware│ │                   │
│ │ │   Query Poll    │ │ │     │ │ │ - CORS Handler  │ │ │                   │
│ │ └─────────────────┘ │ │     │ │ │ - Rate Limiter  │ │ │◄──────────────────┘
│ └─────────────────────┘ │     │ │ │ - File Validate │ │ │
│                         │     │ │ └─────────────────┘ │ │
│ ┌─────────────────────┐ │     │ └─────────────────────┘ │
│ │   TanStack Query    │ │     │                         │
│ │ ┌─────────────────┐ │ │     │ ┌─────────────────────┐ │
│ │ │ Real-time Poll  │ │ │     │ │  Scanner Orchestr.  │ │
│ │ │ - 2sec interval │ │ │     │ │ ┌─────────────────┐ │ │
│ │ │ - Auto stop     │ │ │     │ │ │Docker Execution │ │ │
│ │ │ - Smart cache   │ │ │     │ │ │ - Async Subprocess│ │
│ │ └─────────────────┘ │ │     │ │ │ - Progress Monitor│ │
│ └─────────────────────┘ │     │ │ │ - Result Parser │ │ │
└─────────────────────────┘     │ │ └─────────────────┘ │ │
                                │ │                     │ │
                                │ │ ┌─────────────────┐ │ │
                                │ │ │Parallel Simulation│ │
                                │ │ │ - 3 Worker Chunks │ │
                                │ │ │ - Staggered Prog. │ │
                                │ │ │ - Endpoint Groups │ │
                                │ │ └─────────────────┘ │ │
                                │ └─────────────────────┘ │
                                └─────────────────────────┘
                                              │
                                              │ Docker Commands
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Docker Runtime Environment                             │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         Scanner Container                                   │   │
│  │                    (ventiapi-scanner:latest)                               │   │
│  │                                                                             │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │   │
│  │  │  Authentication │    │   Scan Probes   │    │  Report Engine  │        │   │
│  │  │     Probes      │    │   (OWASP API    │    │                 │        │   │
│  │  │ ┌─────────────┐ │    │    Top 10)      │    │ ┌─────────────┐ │        │   │
│  │  │ │ Token Tests │ │    │ ┌─────────────┐ │    │ │ HTML Report │ │        │   │
│  │  │ │ JWT Bypass  │ │    │ │ API1: BOLA  │ │    │ │ JSON Output │ │        │   │
│  │  │ │ Auth Bypass │ │    │ │ API2: Auth  │ │    │ │ Findings    │ │        │   │
│  │  │ └─────────────┘ │    │ │ API3: Data  │ │    │ │ Evidence    │ │        │   │
│  │  └─────────────────┘    │ │ API4: Rate  │ │    │ └─────────────┘ │        │   │
│  │                         │ │ API5: BFLA  │ │    └─────────────────┘        │   │
│  │  ┌─────────────────┐    │ │ API6: Mass  │ │                               │   │
│  │  │   Target API    │    │ │ API7: Config│ │    ┌─────────────────┐        │   │
│  │  │   Interface     │    │ │ API8: Inject│ │    │   Shared Volumes│        │   │
│  │  │ ┌─────────────┐ │    │ │ API9: Assets│ │    │ ┌─────────────┐ │        │   │
│  │  │ │ HTTP Client │ │    │ │ API10: Log  │ │    │ │/shared/specs│ │        │   │
│  │  │ │ OpenAPI     │ │    │ └─────────────┘ │    │ │/shared/results│ │      │   │
│  │  │ │ Spec Parser │ │    └─────────────────┘    │ └─────────────┘ │        │   │
│  │  │ │ Request Gen │ │                           └─────────────────┘        │   │
│  │  │ └─────────────┘ │                                                      │   │
│  │  └─────────────────┘                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              │ HTTP Requests
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Target API Under Test                                 │
│                               (User's Application)                                 │
│                                                                                     │
│  Example: VAmPI (Vulnerable API)          │    Custom User APIs                    │
│  ┌─────────────────────────────────┐      │  ┌─────────────────────────────────┐   │
│  │ Endpoints:                      │      │  │ Any OpenAPI 3.0 Spec:          │   │
│  │ - GET /users/v1                 │      │  │ - REST APIs                     │   │
│  │ - POST /users/v1/login          │      │  │ - Authentication endpoints      │   │
│  │ - GET /books/v1                 │      │  │ - CRUD operations               │   │
│  │ - PUT /books/v1/{title}         │      │  │ - File uploads                  │   │
│  │ - GET /users/v1/_debug          │      │  │ - Admin interfaces              │   │
│  │                                 │      │  │                                 │   │
│  │ Known Vulnerabilities:          │      │  │ Potential Vulnerabilities:      │   │
│  │ - Debug endpoint exposure       │      │  │ - Authentication bypass         │   │
│  │ - Broken authentication         │      │  │ - Authorization flaws           │   │
│  │ - Mass assignment               │      │  │ - Data exposure                 │   │
│  │ - SQL injection                 │      │  │ - Rate limiting issues          │   │
│  │ - Excessive data exposure       │      │  │ - Configuration problems        │   │
│  └─────────────────────────────────┘      │  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                Data Flow Diagram                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

User Input → Frontend → API Gateway → Backend → Scanner → Target API → Results

┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │    │React UI │    │ Nginx   │    │FastAPI  │    │ Docker  │    │Target   │
│ Browser │    │         │    │ Proxy   │    │Backend  │    │Scanner  │    │   API   │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │              │              │
     │1. Upload Spec│              │              │              │              │
     │   + Config   │              │              │              │              │
     ├─────────────→│              │              │              │              │
     │              │2. POST       │              │              │              │
     │              │ /api/scan/   │              │              │              │
     │              │   start      │              │              │              │
     │              ├─────────────→│              │              │              │
     │              │              │3. Proxy to  │              │              │
     │              │              │   Backend    │              │              │
     │              │              ├─────────────→│              │              │
     │              │              │              │4. Validate & │              │
     │              │              │              │   Store Spec │              │
     │              │              │              │              │              │
     │              │              │              │5. Launch     │              │
     │              │              │              │   Scanner    │              │
     │              │              │              ├─────────────→│              │
     │              │              │              │              │6. Parse Spec │
     │              │              │              │              │   & Config   │
     │              │              │              │              │              │
     │              │              │              │              │7. Execute    │
     │              │              │              │              │   Security   │
     │              │              │              │              │   Probes     │
     │              │              │              │              ├─────────────→│
     │              │              │              │              │              │
     │              │              │              │              │8. HTTP Reqs  │
     │              │              │              │              │   (Auth, BOLA│
     │              │              │              │              │    Injection)│
     │              │              │              │              │◄─────────────┤
     │              │              │              │              │9. Responses  │
     │              │              │              │              │   & Errors   │
     │              │              │              │              │              │
     │              │              │              │10. Generate  │              │
     │              │              │              │    Results   │              │
     │              │              │              │◄─────────────┤              │
     │              │              │              │              │              │
     │              │11. Store in  │              │              │              │
     │              │    Redis &   │              │              │              │
     │              │    Memory    │              │              │              │
     │              │◄─────────────┤              │              │              │
     │              │              │              │              │              │
     │12. Real-time │              │              │              │              │
     │    Polling   │              │              │              │              │
     │   (2 seconds)│              │              │              │              │
     ├─────────────→│              │              │              │              │
     │              │13. GET       │              │              │              │
     │              │ /api/scan/   │              │              │              │
     │              │   {id}/status│              │              │              │
     │              ├─────────────→│              │              │              │
     │              │              ├─────────────→│              │              │
     │              │              │              │14. Progress  │              │
     │              │              │              │    & Chunk   │              │
     │              │              │              │    Status    │              │
     │              │              │◄─────────────┤              │              │
     │              │◄─────────────┤              │              │              │
     │15. Update UI │              │              │              │              │
     │    Progress  │              │              │              │              │
     │◄─────────────┤              │              │              │              │
     │              │              │              │              │              │
     │16. GET       │              │              │              │              │
     │   Findings   │              │              │              │              │
     ├─────────────→│              │              │              │              │
     │              ├─────────────→│              │              │              │
     │              │              ├─────────────→│              │              │
     │              │              │              │17. Findings  │              │
     │              │              │              │    Data      │              │
     │              │              │◄─────────────┤              │              │
     │              │◄─────────────┤              │              │              │
     │18. Display   │              │              │              │              │
     │    Results   │              │              │              │              │
     │◄─────────────┤              │              │              │              │
     │              │              │              │              │              │
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Component Breakdown                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

Frontend (React + TypeScript)
├── src/
│   ├── components/
│   │   ├── ApiScanner.tsx           # Main scanning interface
│   │   │   ├── File upload handling
│   │   │   ├── URL input validation
│   │   │   ├── Configuration form
│   │   │   └── Scan initiation
│   │   │
│   │   ├── Report.tsx               # Results display & management
│   │   │   ├── Scan status monitoring
│   │   │   ├── Findings visualization
│   │   │   ├── HTML report download
│   │   │   └── TanStack Query integration
│   │   │
│   │   └── ParallelScanProgress.tsx # Real-time progress display
│   │       ├── 3 worker visualization
│   │       ├── Individual chunk progress
│   │       ├── Current endpoint display
│   │       └── Status indicators
│   │
│   ├── api/
│   │   └── scannerApi.ts            # API client
│   │       ├── Authentication headers
│   │       ├── FormData handling
│   │       ├── Error management
│   │       └── TypeScript interfaces
│   │
│   └── hooks/
│       └── TanStack Query configuration
│           ├── 2-second polling
│           ├── Smart cache management
│           ├── Auto-stop on completion
│           └── Error handling

Backend (FastAPI + Python)
├── main.py                          # Core API server
│   ├── Authentication
│   │   ├── JWT token generation
│   │   ├── User credential validation
│   │   └── Role-based access control
│   │
│   ├── Scan Endpoints
│   │   ├── POST /api/scan/start     # Initiate scans
│   │   ├── GET /api/scan/{id}/status # Real-time status
│   │   ├── GET /api/scan/{id}/findings # Paginated results
│   │   ├── GET /api/scan/{id}/report # HTML download
│   │   └── DELETE /api/scan/{id}    # Cleanup
│   │
│   ├── Scanner Orchestration
│   │   ├── Docker container management
│   │   ├── Async subprocess execution
│   │   ├── Progress monitoring
│   │   └── Result aggregation
│   │
│   └── Parallel Simulation
│       ├── 3-worker chunk division
│       ├── Staggered progress updates
│       ├── Individual endpoint tracking
│       └── Status synchronization
│
├── security.py                      # Security middleware
│   ├── Rate limiting (Redis-backed)
│   ├── CORS handling
│   ├── File upload validation
│   └── Security headers
│
└── scanner_plugins/
    └── microservice_scanner.py      # Docker integration
        ├── Container lifecycle
        ├── Volume mounting
        ├── Command generation
        └── Output parsing

Scanner Engine (Git Submodule)
├── external-scanner/
│   └── ventiapi-scanner/
│       ├── scanner/
│       │   ├── probes/               # OWASP API Top 10 tests
│       │   │   ├── auth/            # Authentication probes
│       │   │   ├── bola/            # Broken Object Level Auth
│       │   │   ├── data_exposure/   # Excessive data exposure
│       │   │   ├── rate_limiting/   # Resource & rate limiting
│       │   │   ├── bfla/            # Broken Function Level Auth
│       │   │   ├── mass_assignment/ # Mass assignment
│       │   │   ├── security_config/ # Security misconfiguration
│       │   │   ├── injection/       # Injection flaws
│       │   │   ├── assets/          # Improper assets management
│       │   │   └── logging/         # Insufficient logging
│       │   │
│       │   ├── core/                # Scanner framework
│       │   │   ├── http_client.py   # HTTP request handling
│       │   │   ├── spec_parser.py   # OpenAPI parsing
│       │   │   ├── probe_engine.py  # Probe execution
│       │   │   └── evidence.py      # Evidence collection
│       │   │
│       │   └── report/              # Report generation
│       │       ├── html_generator.py # HTML report creation
│       │       ├── json_output.py   # JSON findings export
│       │       └── templates/       # Report templates
│       │
│       └── Dockerfile               # Scanner container build
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Security Layers                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 Layer 7: Application Security                       │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│ │  Input Valid.   │  │ File Validation │  │  Auth & AuthZ   │  │  Rate Limiting  │ │
│ │ - OpenAPI spec  │  │ - File size     │  │ - JWT tokens    │  │ - Per endpoint  │ │
│ │ - URL format    │  │ - MIME types    │  │ - User roles    │  │ - Redis backed  │ │
│ │ - Parameter     │  │ - Content scan  │  │ - Session mgmt  │  │ - Sliding window│ │
│ │   sanitization  │  │                 │  │                 │  │                 │ │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 Layer 6: Web Security                               │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│ │ Security Headers│  │     CORS        │  │  Content-Type   │  │   XSS Protect   │ │
│ │ - X-Frame-Opts  │  │ - Origin check  │  │ - Validation    │  │ - Content sniff │ │
│ │ - Referrer      │  │ - Method allow  │  │ - JSON enforce  │  │ - Frame options │ │
│ │ - HSTS ready    │  │ - Header allow  │  │                 │  │                 │ │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                Layer 5: Network Security                           │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│ │ Docker Networks │  │  Internal Comm  │  │   TLS Ready     │  │ Port Isolation  │ │
│ │ - Isolated nets │  │ - Service names │  │ - HTTPS support │  │ - Single entry  │ │
│ │ - No external   │  │ - No exposed    │  │ - Cert mount    │  │ - Port 3000 only│ │
│ │   container     │  │   ports         │  │   ready         │  │                 │ │
│ │   access        │  │                 │  │                 │  │                 │ │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               Layer 4: Container Security                          │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│ │ Image Security  │  │  Resource Limits│  │ Volume Security │  │  User Mapping   │ │
│ │ - Minimal base  │  │ - Memory caps   │  │ - Read-only     │  │ - UID 999       │ │
│ │ - No root user  │  │ - CPU limits    │  │ - Shared vols   │  │ - Non-root      │ │
│ │ - Alpine Linux  │  │ - Container     │  │   controlled    │  │ - Privilege     │ │
│ │               │  │   isolation     │  │                 │  │   drop          │ │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               Layer 3: Data Security                               │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│ │ Secrets Mgmt    │  │ Temporary Data  │  │   Scan Results  │  │ Config Security │ │
│ │ - Env variables │  │ - Memory only   │  │ - Isolated      │  │ - .env.local    │ │
│ │ - No hardcoded  │  │ - Auto cleanup  │  │ - Shared volumes│  │ - .gitignore    │ │
│ │ - JWT secrets   │  │ - Session based │  │ - Controlled    │  │ - Runtime only  │ │
│ │               │  │               │  │   access        │  │               │ │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

### Kubernetes Deployment (Recommended)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Kubernetes Cluster                                    │
│                              (Local k3d / AWS EKS)                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘

Production Environment:
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                Kubernetes Pods                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │                         Pod Orchestration Layer                                │ │
│ │                                                                                 │ │
│ │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │ │
│ │  │   Frontend Pod  │   │   Web-API Pod   │   │    Redis Pod    │              │ │
│ │  │                 │   │                 │   │                 │              │ │
│ │  │ - nginx:alpine  │   │ - FastAPI app   │   │ - redis:7-alpine│              │ │
│ │  │ - React build   │   │ - Auth & scan   │   │ - Rate limiting │              │ │
│ │  │ - Port 80       │   │ - Port 8000     │   │ - Port 6379     │              │ │
│ │  │ - Replicas: 2   │   │ - Replicas: 2   │   │ - Replicas: 1   │              │ │
│ │  │ - Auto-scale    │   │ - Auto-scale    │   │ - Persistent    │              │ │
│ │  └─────────────────┘   └─────────────────┘   └─────────────────┘              │ │
│ │           │                      │                      │                     │ │
│ │           └──────────────────────┼──────────────────────┘                     │ │
│ │                                  │                                            │ │
│ │  ┌─────────────────────────────────────────────────────────────┐              │ │
│ │  │               Dynamic Scanner Jobs                          │              │ │
│ │  │                  (Kubernetes Jobs)                         │              │ │
│ │  │                                                             │              │ │
│ │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │              │ │
│ │  │  │Scanner Job 1│  │Scanner Job 2│  │Scanner Job N│  ...   │              │ │
│ │  │  │             │  │             │  │             │        │              │ │
│ │  │  │- OWASP API  │  │- Custom SQL │  │- JWT Fuzzer │        │              │ │
│ │  │  │  Top 10     │  │  Injection  │  │  Specialist │        │              │ │
│ │  │  │- Auto-spawn │  │- Database   │  │- Token      │        │              │ │
│ │  │  │- Auto-clean │  │  Testing    │  │  Testing    │        │              │ │
│ │  │  └─────────────┘  └─────────────┘  └─────────────┘        │              │ │
│ │  └─────────────────────────────────────────────────────────────┘              │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│ Features:                                                                           │
│ - Horizontal Pod Autoscaler (HPA)                                                  │
│ - Resource limits and requests                                                     │
│ - Health checks and readiness probes                                               │
│ - Rolling updates with zero downtime                                               │
│ - Service discovery and load balancing                                             │
│ - Persistent volumes for data                                                      │
│ - Secrets management for credentials                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

Local Development (k3d):
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              k3d Cluster (Local)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │  Port Mappings:                                                                 │ │
│ │  - Frontend: localhost:3000 → NodePort 30000                                   │ │
│ │  - API: localhost:8000 → NodePort 30001                                        │ │
│ │                                                                                 │ │
│ │  Quick Start:                                                                   │ │
│ │  ./kubernetes_deploy.sh                                                         │ │
│ │                                                                                 │ │
│ │  Management:                                                                    │ │
│ │  kubectl get all -n ventiapi                                                   │ │
│ │  k3d cluster delete ventiapi-local                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘

### Docker Compose Deployment (Development)

Production Environment:
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                Railway Platform                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │                         Container Orchestration                                 │ │
│ │                                                                                 │ │
│ │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │ │
│ │  │   nginx:alpine  │   │  web-api:latest │   │ redis:7-alpine  │              │ │
│ │  │                 │   │                 │   │                 │              │ │
│ │  │ - Static serve  │   │ - FastAPI app   │   │ - Rate limiting │              │ │
│ │  │ - Reverse proxy │   │ - Auth & scan   │   │ - Session store │              │ │
│ │  │ - Port 3000     │   │ - Internal:8000 │   │ - Internal:6379 │              │ │
│ │  │                 │   │                 │   │                 │              │ │
│ │  └─────────────────┘   └─────────────────┘   └─────────────────┘              │ │
│ │           │                      │                      │                     │ │
│ │           └──────────────────────┼──────────────────────┘                     │ │
│ │                                  │                                            │ │
│ │  ┌─────────────────────────────────────────────────────────────┐              │ │
│ │  │                    Shared Volumes                           │              │ │
│ │  │  /shared/specs/  - OpenAPI specifications                   │              │ │
│ │  │  /shared/results/ - Scan results and reports                │              │ │
│ │  └─────────────────────────────────────────────────────────────┘              │ │
│ │                                  │                                            │ │
│ │  ┌─────────────────────────────────────────────────────────────┐              │ │
│ │  │              Dynamic Scanner Containers                     │              │ │
│ │  │  ventiapi-scanner:latest (created on-demand)                │              │ │
│ │  │  - Security probe execution                                 │              │ │
│ │  │  - OWASP API Top 10 testing                                 │              │ │
│ │  │  - Result generation                                        │              │ │
│ │  │  - Auto-cleanup after scan                                  │              │ │
│ │  └─────────────────────────────────────────────────────────────┘              │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│ Environment Variables:                                                              │
│ - REDIS_URL=redis://redis:6379                                                     │
│ - JWT_SECRET=<secure-random-string>                                                 │
│ - DEFAULT_ADMIN_USERNAME=<admin-user>                                              │
│ - DEFAULT_ADMIN_PASSWORD=<secure-password>                                         │
│ - SCANNER_MAX_PARALLEL_CONTAINERS=5                                                │
│ - SCANNER_CONTAINER_MEMORY_LIMIT=512m                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

Development Environment:
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Local Docker Compose                                  │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │  Services:                                                                      │ │
│ │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │ │
│ │  │    frontend     │   │     web-api     │   │      redis      │              │ │
│ │  │                 │   │                 │   │                 │              │ │
│ │  │ - React dev     │   │ - Python app    │   │ - Cache & state │              │ │
│ │  │ - Hot reload    │   │ - Volume mount  │   │ - Persistence   │              │ │
│ │  │ - localhost:3000│   │ - localhost:8000│   │ - localhost:6379│              │ │
│ │  └─────────────────┘   └─────────────────┘   └─────────────────┘              │ │
│ │                                                                                 │ │
│ │  Quick Start:                                                                   │ │
│ │  1. cp .env.local.example .env.local                                           │ │
│ │  2. ./start-dev.sh                                                              │ │
│ │  3. Open http://localhost:3000                                                  │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Technology Matrix                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

Frontend Technology:
├── React 18+ (Hooks, Functional Components)
├── TypeScript (Type Safety & Interfaces)
├── TanStack Query v4 (State Management & Caching)
├── CSS3 (Modern styling, Grid, Flexbox)
└── Modern Build Tools (Create React App, Webpack)

Backend Technology:
├── FastAPI (Async Python Web Framework)
├── Pydantic (Data Validation & Serialization)
├── JWT (JSON Web Tokens for Authentication)
├── Redis (Rate Limiting & Session Storage)
└── Python Subprocess Management (Container Orchestration)

Infrastructure & Orchestration:
├── Kubernetes (Container Orchestration)
│   ├── k3d (Local Development Clusters)
│   ├── AWS EKS (Production Clusters)
│   ├── Horizontal Pod Autoscaler (Auto-scaling)
│   ├── Jobs API (Dynamic Scanner Execution)
│   └── Service Discovery & Load Balancing
├── Docker & Docker Compose (Containerization)
│   ├── Multi-stage Builds
│   ├── Image Optimization
│   └── Development Environment
├── nginx (Reverse Proxy & Static File Serving)
├── Alpine Linux (Minimal Container Images)
└── Git Submodules (External Scanner Integration)

Deployment Platforms:
├── Local Development
│   ├── k3d (Kubernetes)
│   └── Docker Compose
├── Cloud Production
│   ├── AWS EKS (Kubernetes)
│   ├── AWS Lightsail (VPS + Docker)
│   └── Railway/Render (Simplified PaaS)

Security Engine:
├── Python 3.9+ (Core Scanner Language)
├── requests & httpx (HTTP Client Libraries)
├── OpenAPI 3.0 Specification Parsing
├── Custom Security Probe Framework
└── HTML Report Generation (Jinja2 Templates)

OWASP API Security Coverage:
├── API1: Broken Object Level Authorization (BOLA)
├── API2: Broken User Authentication
├── API3: Excessive Data Exposure
├── API4: Lack of Resources & Rate Limiting
├── API5: Broken Function Level Authorization (BFLA)
├── API6: Mass Assignment
├── API7: Security Misconfiguration
├── API8: Injection Flaws
├── API9: Improper Assets Management
└── API10: Insufficient Logging & Monitoring
```

This comprehensive architecture diagram shows the complete VentiAPI Scanner platform with all major components, data flows, security layers, and deployment strategies for both development and production environments.