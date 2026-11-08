# 🏭 Alumex Maintenance System (CMMS)
> **Modern Industrial Plant Floor Maintenance, Offline QR Inspection & Compliance Portal**  
> *Dedicated to Alumex Extrusion Plant (`CH/MT/102`) & VPC Plant (`LS/MT/102`)*

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js&style=flat-square)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&style=flat-square)](https://tailwindcss.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&style=flat-square)](https://www.prisma.io/)
[![Supabase PostgreSQL](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&style=flat-square)](https://supabase.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-Offline%20First-purple?style=flat-square)](https://dexie.org/)
[![Vercel Ready](https://img.shields.io/badge/Vercel-Deployment%20Ready-black?logo=vercel&style=flat-square)](https://vercel.com/)

---

## 📌 Executive Summary

The **Alumex Maintenance System** is a mission-critical, full-stack industrial Computerized Maintenance Management System (CMMS) designed specifically for factory floor technicians and engineering supervisors at **Alumex PLC**. 

Built with **Next.js 14**, **Prisma ORM**, **Supabase PostgreSQL**, and an **Offline-First IndexedDB architecture**, the platform guarantees 100% operational uptime inside high-interference factory floors. Technicians scan physical machine panel QR codes to retrieve official master checklists, record inspection observations, and submit tamper-proof records governed by a **strict 30-minute compliance lockout rule**.

---

## 🔄 System Architecture & Workflow

```mermaid
flowchart TD
    subgraph Floor["🏭 Factory Floor Inspection"]
        A["Technician walks to Machine Panel"] --> B["📷 Scan Panel QR Tag via Live Camera / Photo"]
        B --> C["📋 Official Station Checklist Loaded (13 Stations / 146 Checks)"]
        C --> D["Mark Status: [OK] | [DEFECT] | [STANDBY]"]
        D --> E["✏️ Enter Checkpoint Observations / Defect Details (Always Visible)"]
        E --> F["Submit Station Inspection"]
    end

    subgraph Logic["⏱️ Compliance & Storage Layer"]
        F --> G["Strict 30-Minute Grace Window Begins"]
        G --> H{"Within 30 Mins?"}
        H -- "Yes" --> I["Technician can edit observations & statuses"]
        H -- "No (>30 mins)" --> J["🔒 Permanently Locked (Tamper-Proof Audit State)"]
        
        F --> K{"Network Online?"}
        K -- "Offline" --> L["💾 Stored in Browser Dexie IndexedDB (Queued)"]
        L -.->|"Auto-sync when Wi-Fi connects"| M["☁️ Supabase PostgreSQL Database (aws-0 Tokyo)"]
        K -- "Online" --> M
    end

    subgraph Supervisor["📊 Engineering Supervisor Portal"]
        M --> N["1–31 Day Monthly Verification Grid Matrix"]
        N --> O["Cell Audit Inspector: EPF, Timestamp, Lockout, Notes"]
        N --> P["📥 Export Official Monthly Excel (.xlsx) Report"]
        N --> Q["🖨️ Printable Machine Panel QR Tag Generator"]
    end
```

---

## ✨ Core Features & Capabilities

### 1. 📷 Machine Panel QR Scanning (Field Inspection Mode)
- **Zero Manual Searching:** Technicians walk up to the machine control panel and point their smartphone or tablet camera at the high-contrast QR code tag.
- **Hardware Agnostic:** Supports live camera feed with an animated scanning laser or uploading a panel tag photo directly from the device gallery.
- **Instant Checklist Binding:** Instantly resolves the station, document reference, machine code, and associated master checkpoints.

### 2. ⚡ Touch-Optimized 3-Way Evaluation
- Checkpoints are marked with a single tap using high-contrast, thumb-friendly buttons:
  - **`✓ OK` (Emerald):** Operational condition normal; complies with standard criteria.
  - **`✕ DEFECT` (Rose):** Anomaly or malfunction detected; triggers defect alerts in supervisor matrices.
  - **`0 STANDBY` (Amber):** Equipment is idle, on planned maintenance, or waiting for billets.

### 3. 📝 Always-Visible Checkpoint Observation Text Box
- Every single checkpoint includes an inline observations and defect notes text area that remains **permanently visible** regardless of the status selected (`OK`, `DEFECT`, or `STANDBY`).
- Allows technicians to record grease levels, vibration observations, acoustic notes, pneumatic pressures, or defect specifics without navigating away.

### 4. 🔒 Strict 30-Minute Grace Window & Lockout Rule
- **Grace Period (0–30 Minutes):** Technicians have a 30-minute countdown window following initial submission to correct any honest errors or update observations.
- **Permanent Lockout (>30 Minutes):** Once 30 minutes elapse, the record is permanently sealed. Neither technicians nor administrators can alter or erase the historical submission, satisfying ISO compliance and corporate maintenance auditing standards.

### 5. 📴 100% Offline-First Architecture (Dexie.js IndexedDB)
- **Zero Signal Interruption:** When inspecting deep inside shielded plant areas without Wi-Fi or cellular coverage, inspections are written instantaneously to the client-side IndexedDB database.
- **Visual Status Badges:** The portal shows real-time `Online (Supabase)` or `Offline (IndexedDB)` indicators and displays a queued counter (`X Queued`).
- **Auto-Sync:** As soon as connectivity returns, all cached records automatically synchronize to the remote PostgreSQL database.

### 6. 👤 Role-Based Authentication & Profile Maintenance
- **Technician Access:** Simplified login via EPF Number (e.g. `EPF-4820`) with a default initial password (`tech123`).
- **Self-Service Credential Maintenance:** Technicians can securely change their password directly from their profile modal.
- **Supervisor Portal Access:** Privileged login (`admin` / `admin123`) providing full access to monthly audit matrices, equipment metrics, and reporting tools.

### 7. 📊 Engineering Supervisor Dashboard & Verification Grid
- **1–31 Day Monthly Matrix:** Comprehensive visual grid showing daily statuses (`√`, `X`, `0`) for all 146 master checkpoints across all 31 days of any selected month.
- **Drill-down Cell Audit:** Clicking any grid cell opens an audit modal revealing inspector EPF, exact timestamp, lockout state, and submitted observations.
- **Automated Excel Export:** Single-click generation of multi-sheet official monthly audit reports (`.xlsx`) formatted for engineering management reviews.
- **Printable QR Tag Generator:** Generates high-resolution, printable QR codes formatted for printing and physical affixing on factory machine panels.

---

## 🏭 Master Stations & Equipment Checklist Scope

The system monitors **13 Master Stations** comprising **146 Master Checkpoints** across two main operational plants:

### Extrusion Plant (`CH/MT/102` - 84 Checkpoints)
| Station Code | Station Name | Machine Tag | Equipment Scope |
|---|---|---|---|
| **01** | Billet Loading Cams & Pusher | `EXT-BILLET-PUSHER` | Pneumatic jacks, solenoids, pusher chains, sprockets, proximity sensors |
| **02** | Log Furnace & Blower | `EXT-LOG-FURNACE` | LPG gas line & regulators, burners 1–4, VRS valves, thermocouple probes, hydraulics |
| **03** | Extruder Main Press | `EXT-EXTRUDER` | Hydraulic oil temp & level, ram shafts, acoustics, loader alignment, pre-fill valves |
| **04** | Die Slide & Bolster | `EXT-DIE-SLIDE` | Bolster cylinder, clamp jack, die slide guides, wear plates, limit switches |
| **05** | Leadout Table & Puller | `EXT-LEADOUT-PULLER` | Graphite rollers, puller carriage, cable chains, track alignment, tension chains |
| **06** | Cooling Table & Stretcher | `EXT-COOLING-TABLE` | Walking beam belts, cooling fans, stretcher jaws, clamp cylinder pressure |
| **07** | Profile Saw & Storage | `EXT-PROFILE-SAW` | Saw blade tooth condition, mist lubrication, feed cylinder, safety hoods |

### VPC Plant (`LS/MT/102` - 62 Checkpoints)
| Station Code | Station Name | Machine Tag | Equipment Scope |
|---|---|---|---|
| **01** | Loading Conveyor & Hoist | `VPC-LOADING-HOIST` | Lifting wire ropes, hoist hook latch, drive gear motor, pendant pushbuttons |
| **02** | Pre-Treatment Tanks | `VPC-PRETREAT-TANKS` | Chemical pumps, circulation lines, steam coils, exhaust duct fans, rinse sprays |
| **03** | Anodizing Bath & Rectifiers | `VPC-ANODIZING-BATH` | DC copper bus bars, air agitation pipes, chiller heat exchanger, rectifier ripple |
| **04** | Electro-Coloring Tank | `VPC-COLORING-TANK` | AC/DC coloring electrodes, chemical dosing pumps, tank lining integrity |
| **05** | Hot Water Sealing Tank | `VPC-HOT-SEAL-TANK` | High-temperature heating elements, deionized water circulation, level sensors |
| **06** | Unloading Conveyor & Inspection | `VPC-UNLOAD-CONVEYOR`| Unloading transfer rollers, profile support racks, hoist brake testing |

---

## 💻 Tech Stack & Dependencies

| Category | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js 14 (App Router)](https://nextjs.org/) | Modern server & client React architecture, serverless API routes |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | End-to-end type safety across database models and API payloads |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) | Modern responsive design, light theme industrial aesthetic |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, accessible industrial iconography |
| **Database ORM** | [Prisma 5](https://www.prisma.io/) | Type-safe PostgreSQL schema definitions, migrations, and queries |
| **Database** | [Supabase PostgreSQL](https://supabase.com/) | Serverless cloud PostgreSQL with PgBouncer connection pooling |
| **Offline Storage** | [Dexie.js (IndexedDB)](https://dexie.org/) | Offline client-side data persistence with automated background sync |
| **QR Code Engine** | [html5-qrcode](https://github.com/mebjas/html5-qrcode) & [qrcode.react](https://github.com/zpao/qrcode.react) | Real-time camera viewfinder QR scanning and SVG tag generation |
| **Excel Engine** | [xlsx (SheetJS)](https://sheetjs.com/) | Dynamic multi-sheet Excel spreadsheet export generation |
| **Notifications** | [Sonner](https://sonner.emilkowal.ski/) | Non-blocking, touch-friendly toast alerts |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** `v18.17.0` or higher (tested on Node v20/v24)
- **Package Manager:** `npm` (or `pnpm`)
- **Git**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/nimharachalana/Alumex-Maintenance-System.git
cd plant_maintenance_portal

# Install project dependencies
npm install
```

### 3. Environment Variables Configuration
Create a `.env` file in the root directory based on `.env.example`:
```env
# 1. Transaction Pooler Connection URL (Port 6543 with ?pgbouncer=true)
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[YOUR_PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# 2. Session Pooler Connection URL (Port 5432 - IPv4 compatible for migrations)
DIRECT_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[YOUR_PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# Next.js Environment
NODE_ENV="development"
```

### 4. Database Setup & Seeding
```bash
# Push the Prisma schema directly to your Supabase PostgreSQL database
npm run db:push

# Seed the 13 Master Stations, 146 Checkpoints, and default accounts
npm run db:seed
```

### 5. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deployment Guide (Vercel & Supabase)

### Step 1: Push Repository to GitHub
Ensure your local code is committed and pushed to your remote repository:
```bash
git add .
git commit -m "Prepare production deployment"
git push origin main
```

### Step 2: Import into Vercel
1. Visit [vercel.com/new](https://vercel.com/new) and import the repository.
2. Under **Environment Variables**, enter your Supabase connection strings:
   - **`DATABASE_URL`**: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
     - Environments: **Production and Preview** (Checked)
   - **`DIRECT_URL`**: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`
     - Environments: **Production and Preview** (Checked)
3. Click **Deploy**. Vercel will automatically run `"postinstall": "prisma generate"` and compile the production build.

---

## 🔑 Default Credentials

| Role | Username / EPF | Default Password | Access Level |
|---|---|---|---|
| **Technician** | `EPF-4820` *(or any EPF-####)* | `tech123` | Camera QR scanner, station checklist, 30-min editing grace, profile maintenance |
| **Supervisor / Admin** | `admin` | `admin123` | Full audit matrix, plant filters, compliance inspection, Excel downloads, QR sheets |

> *Note: Technicians can modify their password anytime via the **Change Password** button in their profile.*

---

## 📂 Project Directory Structure

```text
plant_maintenance_portal/
├── prisma/
│   ├── schema.prisma          # PostgreSQL models (User, Station, Checkpoint, Inspection, Results)
│   └── seed.js                # Master data seed script for 13 stations and 146 checkpoints
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/login/            # EPF authentication endpoint
│   │   │   ├── export/                # Dynamic Excel (.xlsx) generator route
│   │   │   ├── inspections/           # Inspection CRUD with 30-min lockout validation
│   │   │   └── profile/change-password# Self-service password change endpoint
│   │   ├── globals.css                # Tailwind styling, custom scrollbars, animated scanner laser
│   │   ├── layout.tsx                 # Root layout with Sonner Toaster notification provider
│   │   └── page.tsx                   # Master responsive CMMS portal (Scanner, Checklist, History, Admin)
│   └── lib/
│       ├── db.ts                      # Prisma client singleton instance
│       ├── lockout.ts                 # 30-minute lockout compliance evaluator & countdown logic
│       ├── master-data.ts             # Complete Extrusion & VPC plant equipment master dataset
│       └── offline-db.ts              # Dexie.js IndexedDB schema & offline sync queue
├── .env.example                       # Documented template for Supabase pooler connection strings
├── package.json                       # Next.js scripts, postinstall hook, and package dependencies
├── tailwind.config.ts                 # Tailwind configuration
└── tsconfig.json                      # Strict TypeScript compiler options
```

---

## 🛡️ Compliance, Security & Quality Assurance

- **Zero Data Loss Guarantee:** Dual-persistence ensures inspections are recorded in local IndexedDB before transmitting over the network.
- **Tamper-Proof Audit Trail:** Database records cannot be updated once the 30-minute grace period elapses, preventing post-incident retroactive record alteration.
- **Connection Pooling:** Utilizes Supabase PgBouncer (Port `6543`) to prevent connection exhaustion in serverless Vercel edge functions.
- **Strict HTTPS / Camera Access:** Production deployment over SSL ensures secure mobile camera viewfinder access without requiring custom browser flags.

---

## 📄 License
Internal proprietary software developed for **Alumex PLC** maintenance operations. All rights reserved.
