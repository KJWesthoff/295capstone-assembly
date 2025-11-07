# VentiAPI Scanner - Threat Model and Security Analysis

## Executive Summary

The VentiAPI Scanner is a containerized web application that performs automated API security testing. This threat model identifies significant security vulnerabilities and attack vectors that could compromise the application, its users, and the systems it scans. 

**Critical Findings:**
- **HIGH RISK**: Container escape potential through Docker socket exposure
- **HIGH RISK**: SSRF vulnerabilities enabling internal network scanning
- **MEDIUM RISK**: JWT secret management and authentication bypasses
- **MEDIUM RISK**: File upload vulnerabilities allowing malicious payloads

## System Architecture Overview

### Components
1. **React Frontend** (Port 3000) - TypeScript SPA served by Nginx
2. **FastAPI Backend** (Port 8000) - Python web API with JWT authentication  
3. **Redis Cache** (Port 6379) - Session management and job queuing
4. **Scanner Containers** - Isolated Docker containers for security testing
   - VentiAPI Scanner (Python-based API security testing)
   - OWASP ZAP Scanner (Web application security scanning)
5. **Nginx Reverse Proxy** - Routes requests and serves static content

### Data Flow
```
User → Nginx → React Frontend → FastAPI API → Scanner Containers → Target APIs
                     ↓
                Redis Cache
```

## Attack Surface Analysis

### 1. Web Application Interface
- **Entry Points**: HTTP/HTTPS endpoints on port 3000
- **Authentication**: JWT token-based
- **User Input**: URLs, file uploads, scan parameters
- **Assets**: Static React application, API documentation

### 2. API Backend
- **Entry Points**: REST API endpoints on port 8000
- **Authentication**: JWT with role-based access control
- **Critical Endpoints**:
  - `/api/auth/login` - Authentication
  - `/api/scan/start` - Scan initiation  
  - `/api/scan/{id}/status` - Progress monitoring
  - `/api/scan/{id}/findings` - Results retrieval

### 3. Container Infrastructure
- **Docker Engine**: Privileged access via `/var/run/docker.sock`
- **Network**: Host network mode bypassing container isolation
- **Volumes**: Shared file system between containers
- **Registry**: Local container images

### 4. External Dependencies
- **Target Systems**: User-specified URLs for security testing
- **Cloud Infrastructure**: AWS EC2 deployment environment
- **Package Dependencies**: Python packages, npm modules

## Threat Analysis by STRIDE Categories

### Spoofing (Identity)

**T1.1 - JWT Token Forgery** ⚠️ **MEDIUM RISK**
- **Description**: Attackers could forge JWT tokens if the secret is compromised
- **Impact**: Complete authentication bypass, unauthorized access to admin functions
- **Evidence**: `security.py:20` - JWT secret from environment variable
- **Likelihood**: Medium (if secret is weak or exposed)
- **Mitigations**: 
  - Strong JWT secret generation and rotation
  - Token expiration and revocation capabilities

**T1.2 - Container Identity Spoofing** ⚠️ **LOW RISK**  
- **Description**: Malicious containers could impersonate scanner containers
- **Impact**: Malicious scan results, data exfiltration
- **Evidence**: `scanner_engines.py:56-68` - Docker container labeling
- **Likelihood**: Low (requires local access)

### Tampering (Data)

**T2.1 - OpenAPI Specification Tampering** ⚠️ **MEDIUM RISK**
- **Description**: Malicious OpenAPI specs could exploit YAML parsing vulnerabilities
- **Impact**: Code execution, container compromise
- **Evidence**: `security.py:176-191` - File validation with dangerous pattern detection
- **Likelihood**: Medium (user-controlled file uploads)
- **Mitigations**: 
  - YAML safe loading implemented
  - File content validation for dangerous patterns

**T2.2 - Scanner Result Manipulation** 🔴 **HIGH RISK**
- **Description**: Results stored in shared volumes could be modified
- **Impact**: False security findings, compliance violations
- **Evidence**: `docker-compose.yml:33-34` - Shared volumes for results
- **Likelihood**: High (containers run with broad access)

### Repudiation (Non-repudiation)

**T3.1 - Insufficient Audit Logging** ⚠️ **MEDIUM RISK**
- **Description**: Limited security event logging for forensic analysis
- **Impact**: Inability to detect or investigate security incidents
- **Evidence**: `security.py:361-374` - Basic security event logging
- **Likelihood**: High (operational requirement)

### Information Disclosure

**T4.1 - Sensitive Information in Logs** ⚠️ **MEDIUM RISK**
- **Description**: URLs, scan parameters, and errors logged in plaintext
- **Impact**: Exposure of internal network topology, credentials
- **Evidence**: `main.py:210-219` - Debug logging with sensitive parameters
- **Likelihood**: Medium (operational logs)

**T4.2 - Container File System Access** 🔴 **HIGH RISK**
- **Description**: Shared volumes allow cross-container file access
- **Impact**: Exposure of scan results, specifications, temporary files
- **Evidence**: `docker-compose.yml:33-34,63-65` - Volume sharing configuration
- **Likelihood**: High (by design)

### Denial of Service

**T5.1 - Resource Exhaustion via Containers** 🔴 **HIGH RISK**
- **Description**: Unlimited container spawning could exhaust system resources
- **Impact**: Service unavailability, system compromise
- **Evidence**: `scanner_engines.py:97` - No container count limits in code
- **Likelihood**: High (user-controlled scan requests)
- **Mitigations**: 
  - Container memory limits (512MB)
  - CPU limits (0.5 cores)
  - Need concurrent scan limits

**T5.2 - Rate Limiting Bypass** ⚠️ **MEDIUM RISK**
- **Description**: Rate limits could be bypassed via multiple containers
- **Impact**: Target system overload, service disruption
- **Evidence**: `security.py:339-344` - Rate limiting per IP, not per scan
- **Likelihood**: Medium (distributed attack)

### Elevation of Privilege

**T6.1 - Docker Socket Privilege Escalation** 🔴 **CRITICAL RISK**
- **Description**: Container access to Docker socket enables host system compromise
- **Impact**: Complete host system takeover, lateral movement
- **Evidence**: `docker-compose.yml:35` - Docker socket mount
- **Likelihood**: High (direct exposure)
- **Attack Vector**: Container breakout → Docker commands → Host access

**T6.2 - Host Network Access** 🔴 **HIGH RISK**
- **Description**: Host network mode bypasses container network isolation
- **Impact**: Direct access to host services, internal network scanning
- **Evidence**: `security.py:44` - Host network configuration
- **Likelihood**: High (by design for localhost scanning)

## Server-Side Request Forgery (SSRF) Analysis

### SSRF Attack Vectors

**S1 - Internal Network Scanning** 🔴 **HIGH RISK**
- **Description**: Scanner can target internal IP ranges despite validation
- **Evidence**: `security.py:210-227` - IP validation with localhost bypass
- **Attack**: User sets `allow_localhost=True` to scan internal services
- **Impact**: Internal service discovery, data exfiltration

**S2 - Cloud Metadata Service Access** 🔴 **HIGH RISK**  
- **Description**: Scanner could access AWS metadata service
- **Target**: `http://169.254.169.254/latest/meta-data/`
- **Impact**: AWS credentials, instance information disclosure
- **Evidence**: Limited validation in URL checking

**S3 - Protocol Smuggling** ⚠️ **MEDIUM RISK**
- **Description**: Non-HTTP protocols could bypass validation
- **Attack**: `file://`, `ftp://`, `gopher://` protocol injection
- **Mitigation**: Protocol restriction to HTTP/HTTPS implemented

## Container Security Analysis

### Docker Configuration Vulnerabilities

**C1 - Privileged Container Operations** 🔴 **CRITICAL RISK**
- **Evidence**: `docker-compose.yml:35` - Docker socket mount
- **Risk**: Direct Docker API access enables:
  - Container escape via privileged containers
  - Host file system access
  - Network configuration changes
  - Image manipulation

**C2 - Host Network Exposure** 🔴 **HIGH RISK**
- **Evidence**: `security.py:44` - Host network mode
- **Risk**: 
  - Bypass network isolation
  - Access to host services (SSH, databases)
  - Port scanning capabilities

**C3 - Volume Mount Vulnerabilities** ⚠️ **MEDIUM RISK**
- **Evidence**: `docker-compose.yml:33-34` - Shared volumes
- **Risk**:
  - Cross-container data access
  - File system race conditions
  - Data persistence issues

## Authentication and Authorization Flaws

### JWT Implementation Issues

**A1 - Weak Secret Management** ⚠️ **MEDIUM RISK**
- **Evidence**: `security.py:20` - Environment-based secret
- **Risk**: Default or weak secrets enable token forgery
- **Issue**: No secret rotation mechanism

**A2 - Admin Privilege Escalation** ⚠️ **MEDIUM RISK**
- **Evidence**: `security.py:230-237` - Admin-only dangerous scans
- **Risk**: Mass assignment could allow privilege escalation
- **Attack**: User registration with admin=true parameter

**A3 - Token Expiration Issues** ⚠️ **LOW RISK**
- **Evidence**: `security.py:22` - 24-hour expiration
- **Risk**: Long-lived tokens increase compromise window
- **Issue**: No revocation mechanism implemented

## Input Validation Vulnerabilities

### File Upload Security

**F1 - YAML Deserialization Attacks** ⚠️ **MEDIUM RISK**
- **Evidence**: `security.py:176-191` - File content validation
- **Risk**: Despite protections, YAML parsing could enable RCE
- **Mitigations**: Safe loading and pattern detection implemented

**F2 - Path Traversal Prevention** ✅ **LOW RISK**
- **Evidence**: `security.py:230-248` - Path sanitization
- **Status**: Properly implemented with regex validation

### URL Validation Bypass

**U1 - International Domain Names** ⚠️ **LOW RISK**
- **Risk**: Unicode domains could bypass validation
- **Impact**: Access to unintended systems

**U2 - URL Parsing Inconsistencies** ⚠️ **LOW RISK**
- **Risk**: Different parsers may interpret URLs differently
- **Impact**: Validation bypass via parser confusion

## Network Security Analysis

### External Communication

**N1 - Unencrypted Internal Communication** ⚠️ **MEDIUM RISK**
- **Evidence**: `nginx.conf:26` - HTTP proxy to backend
- **Risk**: Man-in-the-middle attacks on internal traffic
- **Impact**: Credential interception, data tampering

**N2 - Permissive CORS Configuration** ⚠️ **MEDIUM RISK**
- **Evidence**: `main.py:75-81` - Wildcard CORS origins
- **Risk**: Cross-origin attacks from malicious sites
- **Impact**: CSRF, credential theft

## Risk Assessment Matrix

| Threat | Likelihood | Impact | Risk Level | Priority |
|--------|------------|--------|------------|----------|
| Docker Socket Privilege Escalation | High | Critical | **CRITICAL** | 1 |
| Resource Exhaustion via Containers | High | High | **HIGH** | 2 |
| SSRF - Internal Network Scanning | High | High | **HIGH** | 3 |
| Scanner Result Manipulation | High | Medium | **HIGH** | 4 |
| JWT Token Forgery | Medium | High | **MEDIUM** | 5 |
| YAML Deserialization Attacks | Medium | High | **MEDIUM** | 6 |
| Insufficient Audit Logging | High | Medium | **MEDIUM** | 7 |

## Recommended Security Controls

### Immediate Actions (Critical/High Risk)

1. **Remove Docker Socket Access**
   - Implement Docker-in-Docker or remote Docker API
   - Use pre-built scanner images with restricted capabilities
   - Consider serverless scanning architecture

2. **Implement Container Orchestration Security**
   - Deploy on Kubernetes with Pod Security Standards
   - Use network policies for micro-segmentation
   - Implement resource quotas and limits

3. **Enhance SSRF Protection**
   - Implement strict IP allowlisting
   - Add DNS resolution validation
   - Create isolated scanning network

4. **Secure File Handling**
   - Use temporary file systems for uploads
   - Implement virus scanning for uploaded files
   - Add file integrity monitoring

### Medium-Term Improvements

1. **Authentication Hardening**
   - Implement OAuth 2.0 / OIDC
   - Add multi-factor authentication
   - Create JWT revocation mechanism
   - Implement secure secret rotation

2. **Network Security**
   - Enable TLS for all internal communication
   - Implement mutual TLS (mTLS) between services
   - Add Web Application Firewall (WAF)

3. **Monitoring and Logging**
   - Implement SIEM integration
   - Add real-time security monitoring
   - Create incident response procedures
   - Add compliance audit trails

### Long-Term Architecture

1. **Zero Trust Architecture**
   - Implement service mesh (Istio/Linkerd)
   - Add identity-based access controls
   - Create dynamic security policies

2. **Secure Development**
   - Implement automated security testing
   - Add dependency vulnerability scanning
   - Create secure coding guidelines
   - Add security code review process

## Compliance Considerations

### OWASP Top 10
- **A01 - Broken Access Control**: JWT implementation, admin privileges
- **A02 - Cryptographic Failures**: TLS configuration, secret management
- **A03 - Injection**: YAML parsing, SQL injection in scanner
- **A04 - Insecure Design**: Container architecture, SSRF vulnerabilities
- **A05 - Security Misconfiguration**: Docker socket, host network
- **A06 - Vulnerable Components**: Dependency vulnerabilities
- **A10 - Server-Side Request Forgery**: URL validation bypass

### Container Security Standards
- **CIS Docker Benchmark**: Multiple violations in current configuration
- **NIST Container Security**: Requires enhanced isolation and monitoring

## Conclusion

The VentiAPI Scanner contains several critical security vulnerabilities that pose significant risks to the application and its deployment environment. The most critical issue is the Docker socket exposure, which provides a direct path to host system compromise. Immediate action is required to address the highest-risk vulnerabilities before production deployment.

The application demonstrates security awareness with implemented rate limiting, input validation, and JWT authentication, but the container architecture undermines many of these protections. A security-first redesign of the container infrastructure is recommended for production use.

---
*This threat model was generated through static analysis and architectural review. Dynamic testing and penetration testing are recommended to validate these findings.*