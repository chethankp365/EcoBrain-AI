<div align="center">

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/hero.svg" alt="EcoBrain AI" width="100%"/>

<br/>

[![Live demo](https://img.shields.io/badge/LIVE_DEMO-Open_EcoBrain_AI-5df0a8?style=for-the-badge&labelColor=07150f)](https://6cg9h4qr-5173.inc1.devtunnels.ms/)
[![Pilot](https://img.shields.io/badge/PILOT-Bengaluru-2f81f7?style=for-the-badge&labelColor=07150f)](#bengaluru-pilot)
[![Status](https://img.shields.io/badge/STATUS-Setup_in_progress-f5a623?style=for-the-badge&labelColor=07150f)](#capabilities-and-status)

![Supabase](https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-8e75b2?style=flat-square&logo=googlegemini&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5a0fc8?style=flat-square&logo=pwa&logoColor=white)

</div>

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/stats.svg" alt="5 roles, 13 capabilities, 4-step workflow, 1 pilot ward" width="100%"/>

## Overview

EcoBrain AI is a waste-management platform that connects **residents**, **collection workers**, **dispatchers** and **administrators** in one workflow.

Waste collection is usually reactive: someone spots an overflowing bin, a complaint is raised, a vehicle is sent. EcoBrain AI moves towards a data-informed process that answers three questions:

> **What needs collecting, when, and in what order?**

AI results are always **suggestions, not proof**. A human reviews classifications and approves routes.

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/pipeline.svg" alt="Pipeline: report, classify, prioritise, route, learn" width="100%"/>

## Screenshots

<div align="center">
<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/01-hero.png" alt="EcoBrain AI landing page" width="100%"/>
<br/><sub>Landing page, with demo content clearly marked <b>SIMULATED</b></sub>
</div>

<br/>

<table>
  <tr>
    <td width="50%"><img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/06-create-account.png" alt="Create account"/><br/><sub><b>Create account.</b> New signups are always residents; admins promote roles later.</sub></td>
    <td width="50%"><img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/02-how-it-works.png" alt="How it works and route demo"/><br/><sub><b>How it works</b> and the interactive route demo (Optimised / Original order).</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/03-capabilities.png" alt="13 capabilities clearly labelled"/><br/><sub><b>13 capabilities</b>, each labelled LIVE, PILOT SETUP or DEMO ONLY.</sub></td>
    <td width="50%"><img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/04-demo-roles.png" alt="Demo roles"/><br/><sub><b>Demo roles:</b> Resident, Worker, Dispatcher, Admin, Analyst.</sub></td>
  </tr>
</table>

<div align="center">
<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/05-trust-privacy.png" alt="Trust, privacy, human in the loop" width="100%"/>
<br/><sub><b>Trust, privacy, human in the loop</b></sub>
</div>

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/divider.svg" width="100%" alt=""/>

## How it works

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/ai-review.svg" alt="AI suggests a category, a person reviews it, and the report is saved" width="100%"/>

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#0f1a16','primaryTextColor':'#e7efeb','primaryBorderColor':'#5df0a8','lineColor':'#5df0a8','actorBkg':'#0f1a16','actorTextColor':'#e7efeb','actorBorder':'#5df0a8','signalColor':'#5df0a8','noteBkgColor':'#13201b','noteTextColor':'#e7efeb'}}}%%
sequenceDiagram
    autonumber
    actor R as Resident
    participant W as Web app
    participant DB as Supabase
    participant AI as Gemini (server-side)
    actor H as Human reviewer

    R->>W: Report issue (category, pin, optional photo)
    W->>DB: Save report and private photo
    W->>AI: Request a suggestion
    AI-->>DB: Suggested label saved for review
    H->>DB: Confirm or correct the suggestion
    DB-->>R: Status timeline updated
    Note over AI,H: The AI suggests. A human decides.
```

## Route optimisation

The same nine stops, visited in the original order and in an optimised order. The red stop is a high-priority case. Routes are recommendations and a **dispatcher approves** the final plan.

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/route-demo.svg" alt="Animated comparison of original and optimised routes" width="100%"/>

Try the real interactive version on the [live demo](https://6cg9h4qr-5173.inc1.devtunnels.ms/) using the **Optimised / Original order** toggle. The engine is a **TypeScript VRP** with baselines, a validator and human approval. Demo actions never write to the live database.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#0f1a16','primaryTextColor':'#e7efeb','primaryBorderColor':'#5df0a8','lineColor':'#5df0a8','tertiaryColor':'#0b1210'}}}%%
flowchart LR
    A[Eligible stops] --> B[Travel-time matrix]
    B --> C{{VRP solver}}
    C --> D[Validator]
    D -->|hard constraints met| E[Dispatcher review]
    D -->|infeasible| F[Reasons and unassigned stops]
    C -.->|solver fails| H[Safe default order]
    H --> E
    E --> G[Approved route plan]
    style C fill:#0d3b2a,stroke:#5df0a8,color:#e7efeb
    style G fill:#5df0a8,stroke:#07150f,color:#07150f
```

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/divider.svg" width="100%" alt=""/>

## Capabilities and status

Live account and resident-report integrations are kept separate from simulated operational demos. Demo-only features never create live records.

| Capability | What it does | Status |
|---|---|:---:|
| **Accounts and RBAC** | Live resident sign-up, sign-in and profiles. Staff role provisioning is not enabled. | ![live](https://img.shields.io/badge/LIVE-5df0a8?style=flat-square&labelColor=07150f) |
| **Reporting** | Resident reports, private photos and history stored in Supabase for the configured pilot area. | ![pilot](https://img.shields.io/badge/PILOT_SETUP-f5a623?style=flat-square&labelColor=07150f) |
| **AI image classification** | Gemini suggestions generated server-side and saved for human review. | ![pilot](https://img.shields.io/badge/PILOT_SETUP-f5a623?style=flat-square&labelColor=07150f) |
| **Priority and duplicates** | Transparent scores. Nearby matches are suggested, never silently dropped. | ![demo](https://img.shields.io/badge/DEMO_ONLY-6b7280?style=flat-square&labelColor=07150f) |
| **Smart scheduling** | Shift planner ranking work by deadline, age and capacity. | ![demo](https://img.shields.io/badge/DEMO_ONLY-6b7280?style=flat-square&labelColor=07150f) |
| **Route optimisation** | TypeScript VRP with baselines, validator and human approval. | ![demo](https://img.shields.io/badge/DEMO_ONLY-6b7280?style=flat-square&labelColor=07150f) |
| **Worker interface** | Installable PWA, offline outbox, large touch targets. | ![demo](https://img.shields.io/badge/DEMO_ONLY-6b7280?style=flat-square&labelColor=07150f) |
| **Supervisor dashboard** | Live queue, map, exceptions and assignment. | ![demo](https://img.shields.io/badge/DEMO_ONLY-6b7280?style=flat-square&labelColor=07150f) |
| **Maps and hotspots** | Clusters, heat and recurring polygons, privacy-aware. | ![demo](https://img.shields.io/badge/DEMO_ONLY-6b7280?style=flat-square&labelColor=07150f) |

<sub>Four more capabilities are listed on the <a href="https://6cg9h4qr-5173.inc1.devtunnels.ms/">live site</a>.</sub>

## Roles

| Role | Focus |
|---|---|
| **Resident** | Snap a photo, drop a pin, track the timeline |
| **Worker** | Task list for the shift, next stop, mark complete / inaccessible / follow-up |
| **Dispatcher** | Review the priority queue, assign work, approve route plans |
| **Admin** | Users and roles, service areas, vehicles, settings |
| **Analyst** | Hotspot maps, service trends, route metrics |

New signups are always residents. Admins promote roles later.

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/divider.svg" width="100%" alt=""/>

## Where the AI is, and where it is not

Not every automated rule is called AI here.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#0f1a16','primaryTextColor':'#e7efeb','primaryBorderColor':'#5df0a8','lineColor':'#5df0a8','clusterBkg':'#0b1210','clusterBorder':'#1b2a25'}}}%%
flowchart LR
    subgraph RULES[Deterministic rules]
      R1[Validation]
      R2[Status transitions]
      R3[Permissions]
      R4[Transparent priority scores]
    end
    subgraph ML[AI-assisted interpretation]
      M1[Gemini image suggestion]
      M2[Confidence and review]
    end
    subgraph OPT[Optimisation]
      O1[Vehicle routing]
      O2[Capacity, shifts, priority]
    end
    RULES --> ML --> OPT --> HUMAN([Human approval])
    style HUMAN fill:#5df0a8,stroke:#07150f,color:#07150f
```

| Layer | Technique | Guardrail |
|---|---|---|
| Workflow | Deterministic rules | Server-enforced permissions |
| Image classification | Gemini, server-side | Suggestion only, saved for human review |
| Route planning | VRP optimiser | Validator, human approval, safe fallback order |

## Report lifecycle

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#0f1a16','primaryTextColor':'#e7efeb','primaryBorderColor':'#5df0a8','lineColor':'#5df0a8'}}}%%
stateDiagram-v2
    [*] --> Submitted
    Submitted --> Validated
    Validated --> PendingAssignment
    Validated --> RejectedDuplicate
    PendingAssignment --> Assigned
    Assigned --> InProgress
    InProgress --> Completed
    InProgress --> PartiallyCompleted
    InProgress --> Inaccessible
    Completed --> Reopened: issue persists
    Reopened --> Assigned
    Completed --> [*]
```

## Architecture

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/architecture.svg" alt="Animated architecture diagram" width="100%"/>

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/divider.svg" width="100%" alt=""/>

## Analytics

Dashboards turn operational records into a clear current-state view: open and overdue requests, time to resolution, and recurring hotspots. Every metric needs a precise definition, and simulated figures are always labelled.

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/dashboard.svg" alt="Dashboard preview with simulated data" width="100%"/>

## Trust, privacy and human in the loop

- Account sessions and resident-report access are **enforced by the server**.
- AI results remain **suggestions, not proof**. Low-confidence cases go to a person.
- Operational modules stay demo-labelled until they use live records.
- Photos are private and access-controlled. Exact locations are not shown publicly.
- Simulated data is always labelled **SIMULATED**.

## Bengaluru pilot

| | |
|---|---|
| **Selected pilot** | Ramaswamy Palya Ward 1, Bengaluru |
| **Status** | Setup in progress |
| **Live today** | Resident sign-up, sign-in and profiles |
| **Pilot setup** | Reports, private photos, AI suggestions saved for review |

## Roadmap

| Phase | Scope |
|---|---|
| 1. Foundation | Authentication, roles, app shell, database schema |
| 2. Reporting | Create, list and track reports, photo upload |
| 3. Dispatch and worker flow | Assignment, task list, completion and exceptions |
| 4. Maps and route baseline | Map view, travel estimates, route proposal, approval |
| 5. AI classification | Model integration, confidence handling, evaluation |
| 6. Analytics | KPIs, hotspots, exports |
| 7. Hardening | Security checks, tests, deployment, documentation |
| 8. Extensions | Forecasting, IoT sensors, offline sync, multi-vehicle planning |

## Evaluation approach

- **Classification:** per-class precision, recall and F1, confusion matrix, and the share sent to human review.
- **Routing:** compare the optimised plan with the original order and a nearest-neighbour baseline on the same inputs: distance and time, constraint violations, runtime, unassigned stops.
- **Operations:** median and 90th-percentile resolution time, on-time completion, repeat reports.
- Results from synthetic data are labelled as simulation, never as real-world outcomes.

<img src="https://raw.githubusercontent.com/chethankp365/EcoBrain-AI/main/divider.svg" width="100%" alt=""/>

## Getting started

```bash
git clone https://github.com/chethankp365/EcoBrain-AI.git
cd EcoBrain-AI
npm install
cp .env.example .env   # add Supabase keys; keep the Gemini key server-side only
npm run dev
```

Or try the hosted demo: **[EcoBrain AI live demo](https://6cg9h4qr-5173.inc1.devtunnels.ms/)**

## Repository layout

```text
├── src/            web app source
├── api/            server-side functions
├── shared/         shared types and logic
├── supabase/       database migrations
├── tests/          automated tests
├── docs/           documentation
├── public/         static files
└── README.md
```

<div align="center">

<br/>

[![Get started](https://img.shields.io/badge/GET_STARTED-Open_the_live_demo-5df0a8?style=for-the-badge&labelColor=07150f)](https://6cg9h4qr-5173.inc1.devtunnels.ms/)

<sub>© 2026 EcoBrain AI · Bengaluru resident pilot</sub>

</div>
