
# Redesign: Attack Surface Analyzer Page

## Data Available (from latest NEXTA scan)

The scan collects rich data per IP: ports (masscan), services with product/version/CPE (nmap), web services with TLS/technologies (httpx), and CVE matches. The redesign will surface all of this effectively.

## Layout Structure

### Preserved Elements
- Title "Attack Surface Analyzer" with Radar icon
- Subtitle about automatic daily scans
- Workspace selector (Super Admin/Super Suporte only)
- Scan/Cancel buttons (Super Admin/Super Suporte only)
- Progress bar during scans

### New Layout (top to bottom)

**1. Summary Stats Row (5 columns)**
Keep the current 5-column grid (Score gauge + 4 stat cards: IPs, Portas, Serviços, CVEs) with the last scan timestamp integrated below.

**2. CVE Alert Banner (conditional)**
If critical/high CVEs exist, display a prominent alert card listing them with severity badges, scores, and links to NVD. This gives immediate visibility to the most actionable findings.

**3. Two-Column: Port Heatmap | Tech Stack (kept)**
These cards remain as-is since the user explicitly liked them.

**4. Web Services Discovered (new card)**
A table showing all web services found across all IPs: URL, status code, server, technologies, TLS certificate info (CN, issuer, expiry). This consolidates httpx data into a single actionable view.

**5. TLS Certificates Overview (new card)**
A dedicated card listing all TLS certificates found, with CN, issuer, expiry date, and a visual indicator for certificates expiring soon (within 30 days).

**6. IP Inventory Table (redesigned)**
Each IP as an expandable row showing:
- IP, origin (DNS/Firewall badge), label, port count, service count
- Expanded: services table (port, protocol, product, version) and web services details

## Technical Implementation

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Complete rewrite of the page body (lines 616-712) while preserving:
- All imports and hooks at the top
- `useClientId`, `useAttackSurfaceProgress`, `SeverityBadge`, `ExposureScoreGauge` helper components
- `PortHeatmap` and `TechStackSection` components (kept as-is)
- Header section with workspace selector and scan buttons

New/modified sections:
- **CVEAlertSection**: New component that renders a card with all CVEs grouped by severity, showing cve_id, title, score, and advisory link
- **WebServicesSection**: New component that iterates all IPs, collects web_services, and renders a unified table with URL, status, server, technologies, and TLS details
- **TLSCertificatesSection**: New component that extracts all unique TLS certificates from web_services and nmap scripts, showing CN, issuer, expiry, and days remaining with color coding
- **IPDetailRow**: Refactored to show services in a cleaner inline format within the expandable area, removing redundant web services display (now in its own section)
- **Last scan timestamp**: Moved inline with the stats row instead of being a separate section

### No new files or dependencies needed
All components stay in the same page file, following the existing pattern. No new hooks or data fetching required -- all data already exists in the snapshot.
