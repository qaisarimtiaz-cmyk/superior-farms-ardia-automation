# SF Test Automation — Architecture (Simple View)

A high-level, presentation-friendly overview of the automation suite.

> Paste into [mermaid.live](https://mermaid.live) or VS Code (Mermaid preview) to render and export
> as PNG/SVG for slides.

```mermaid
flowchart LR

  RUN["Test Runner<br/>Playwright + TypeScript"]

  subgraph FRAMEWORK["Framework"]
    direction TB
    CONFIG["Config &amp; Test Data"]
    UTILS["Utilities<br/>ID generation + shared state"]
    TESTS["Test Suite<br/>TC1 - TC9"]
  end

  subgraph SUT["Systems Under Test"]
    direction TB
    D365["Dynamics 365 F&amp;O<br/>(Cloud)"]
    ARDIA["Ardia App<br/>(On-prem)"]
  end

  RESULTS["Results &amp; Evidence<br/>API checks · Screenshots · Video"]
  REPORTS["Client Reports<br/>Excel + branded HTML (print to PDF)"]

  RUN --> FRAMEWORK
  FRAMEWORK --> SUT
  SUT --> RESULTS
  RESULTS --> REPORTS

  classDef sut fill:#1f6feb,stroke:#0b3a8c,color:#fff;
  classDef res fill:#d3f9d8,stroke:#2f9e44,color:#0b3d16;
  classDef rep fill:#e7e0ff,stroke:#6741d9,color:#2a1a66;
  class D365,ARDIA sut;
  class RESULTS res;
  class REPORTS rep;
```

---

## In one line per layer

- **Test Runner** — Playwright drives a real browser; tests written in TypeScript.
- **Framework** — config, test data, reusable utilities, and the 9 test cases.
- **Systems Under Test** — D365 (cloud ERP) and Ardia (on-prem production app).
- **Results & Evidence** — API status checks, per-step screenshots, and run video.
- **Client Reports** — every run produces an Excel workbook and a branded, self-contained HTML report (open in Chrome → Print → Save as PDF) for client hand-off.
