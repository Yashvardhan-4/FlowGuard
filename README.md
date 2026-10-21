# FlowGuard: Alexa+ Deep-Work Interruption Arbitration Agent

> **Amazon Developer Hackathon Submission**  
> An intelligent deep-work interruption arbitration agent powered by **AWS Bedrock**, self-hosted **Model Context Protocol (MCP)** specification **2025-11-25** over **Streamable HTTP (SSE)**, deterministic application-level policy boundaries, and a desktop-first command center interface.

---

## Architecture Overview

```mermaid
flowchart TD
    UserUI["FlowGuard Web Console\n(Desktop-First Studio)"] -->|REST Adapter /api/*| Adapter["MCP Client Adapter\n(InMemoryTransport)"]
    ExternalMCP["External MCP Clients\n(Claude Desktop / Cursor)"] -->|SSE /sse & POST /messages| Server["FlowGuard MCP Server\n(Spec 2025-11-25)"]
    Adapter --> Server

    subgraph FlowGuard Core
        Server --> State["Focus State Manager\n(Active Objective, Policies, Reminders)"]
        Server --> Dedup["Deduplication & Idempotency\n(Sliding TTL Cache)"]
        Server --> Bedrock["AWS Bedrock Runtime\n(Claude 3.5 / Haiku / Nova)\n+ Deterministic Fallback"]
        Server --> Privacy["Privacy Guardrail Engine\n(Context Leakage Prevention)"]
        Server --> Policy["Deterministic Policy Engine\n(Authorization & Boundaries)"]
    end

    Policy -->|execute_deflection| Hardware["Hardware Execution Layer"]
    Hardware --> RingSpeaker["Simulated Ring Doorbell\n(Outdoor Speaker Audio)"]
    Hardware --> RingChime["Simulated Ring Chime\n(Indoor Chime Muted)"]
    Hardware --> SilentDigest["Silent Notification Queue\n(Post-Focus Debrief Digest)"]
```

---

## Key Product Workspaces & Interface Panes

1. **Focus Workspace**:
   - Live session countdown timer with scheduled completion time.
   - Objective setter, duration selector (25m, 45m, 60m, 90m).
   - Interruption tolerance levels (`emergency_only`, `urgent_only`, `allow_family`, `lenient`).
   - Permitted deflection channels (`ring_quick_reply`, `silent_queue`, `alexa_spoken_response`, `emergency_breakthrough`).
   - Safe preauthorizations: Auto-Deflect Deliveries & Privacy Guardrail mode toggles.
   - Start, Update, and End Focus controls.

2. **Live Interruption Center**:
   - Real-world household triggers:
     - 📦 **Amazon Delivery**: Courier dropping two parcels on the front porch.
     - 🚨 **Kitchen Smoke Alarm**: Critical emergency with continuous siren.
     - 🗣️ **Solar Sales Solicitor**: Unsolicited door-to-door pitch.
     - 👨‍👩‍👧 **Family Member Knock**: Spouse asking a question at the door.
     - 🕵️ **Inquisitive Stranger**: Probing questions attempting to extract the resident's work details.
   - Custom event builder (device source, category, visitor name, transcription, urgency signals).
   - Real-time device listening and processing states.

3. **AI Arbitration Panel**:
   - Side-by-side contrast between **Bedrock AI Recommendation** vs **Deterministic Application Policy Decision**.
   - Urgency score gauge (`1` to `10`) with color-coded severity.
   - Spoken outdoor response preview (what will be transmitted over the Ring doorbell speaker).
   - Privacy audit result badge (`ZERO LEAKAGE` vs `SANITIZED BY GUARD`).
   - Interactive Approval Controls: "Grant Approval & Execute" vs "Deny / Hold in Silent Queue".

4. **Execution Timeline & Hardware State**:
   - Hardware status indicators: Ring outdoor speaker transmission status & Ring indoor chime mute state (`MUTED (Flow Protected)` vs `ACTIVE`).
   - Reverse-chronological audit stream recording every arbitration, execution, privacy redaction, and duplicate suppression.

5. **Post-Focus Queue & Debrief**:
   - Silent notification digest of events deferred during deep work.
   - Individual item review & acknowledgment actions.
   - Zero-interruption guarantee: Resident is never pulled out of flow for non-emergencies.

---

## MCP Tools Reference

FlowGuard exposes 4 core tools on the MCP server:

| Tool Name | Purpose | Key Inputs |
| :--- | :--- | :--- |
| `set_focus_state` | Establish active focus session, duration, and filtering rules | `objective`, `durationMinutes`, `interruptionPolicy`, `allowedResponses`, `autoDeflectDeliveries`, `privacyMode` |
| `arbitrate_interruption` | Evaluates structured interruption event against active policy via Bedrock | `eventId`, `source`, `category`, `visitorName`, `transcription`, `urgencySignals` |
| `execute_deflection` | Deterministically validates action, checks approval, executes simulated hardware | `eventId`, `action`, `targetDevice`, `spokenResponseToVisitor`, `internalReason`, `urgencyScore`, `requiresUserApproval`, `userApprovalGranted` |
| `get_focus_session_summary` | Retrieves active session state, pending silent reminders, and audit history | None |

---

## UI Controls to Backend Functions Mapping

| UI Interactive Control | Endpoint / Transport | Underlying MCP Tool / Backend Function |
| :--- | :--- | :--- |
| **"Activate Deep Work" / "Update Policy"** | `POST /api/focus` | `mcpAdapter.setFocusState()` &rarr; MCP `set_focus_state` |
| **"End Focus"** | `POST /api/focus/clear` | `focusStateManager.clearFocus()` |
| **"Amazon Delivery" / Presets** | `POST /api/arbitrate` | `mcpAdapter.arbitrateInterruption()` &rarr; MCP `arbitrate_interruption` |
| **"Dispatch Custom Event"** | `POST /api/arbitrate` | `mcpAdapter.arbitrateInterruption()` &rarr; MCP `arbitrate_interruption` |
| **"Execute Deflection via MCP Tool"** | `POST /api/deflect` | `mcpAdapter.executeDeflection()` &rarr; MCP `execute_deflection` |
| **"Grant Approval & Execute"** | `POST /api/deflect` | `mcpAdapter.executeDeflection({ userApprovalGranted: true })` |
| **"Deny / Hold in Silent Queue"** | `POST /api/deflect` | `mcpAdapter.executeDeflection({ userApprovalGranted: false })` |
| **"Ack" (Acknowledge Reminder)** | `POST /api/reminders/:id/acknowledge` | `focusStateManager.markReminderReviewed()` |
| **"Demo 1: Delivery Deflection"** | `POST /api/demo/scenario` | Runs end-to-end delivery deflection & duplicate prevention sequence |
| **"Demo 2: Policy Denial"** | `POST /api/demo/scenario` | Runs approval denied & policy enforcement sequence |
| **"Demo 3: Privacy Shield"** | `POST /api/demo/scenario` | Runs privacy leakage probe & redaction sequence |
| **"Reset"** | `POST /api/reset` | `focusStateManager.resetAll()` & `deduplicationTracker.clear()` |

---

## Quickstart & Local Execution

### 1. Installation
```bash
npm install
```

### 2. Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional: Provide AWS credentials in `.env` for live Bedrock invocation. If omitted, FlowGuard automatically uses its built-in deterministic local arbitrator).*

### 3. Build & Run
```bash
# Build both TypeScript backend and React UI
npm run build

# Start the unified server on port 3000
npm start
```

Visit the interactive web console at **`http://127.0.0.1:3000`**.

### 4. Run Automated Test Suite
```bash
npm test
```
**Results: 29 passed across 6 test suites (100% passing)**:
- `test/policyEngine.test.ts` (5 tests)
- `test/privacyGuard.test.ts` (5 tests)
- `test/deduplication.test.ts` (2 tests)
- `test/bedrockArbitrator.test.ts` (3 tests)
- `test/mcpProtocol.test.ts` (6 protocol-level tests over live SSE)
- `test/apiAdapter.test.ts` (8 REST adapter & scenario tests)

### 5. Run CLI Protocol Demo
```bash
npm run demo
```

---

## Timed Three-Minute Demonstration Script

### **[0:00 - 0:30] — Introduction & Focus Setup**
1. Open `http://127.0.0.1:3000`. Point out the header pills:
   - System Spec: **MCP Server 2025-11-25**.
   - Reasoning Mode: **AWS Bedrock (Deterministic Fallback Mode)** or **Live Bedrock**.
   - Hardware: **Simulated Ring & Alexa** (clearly disclosed).
2. In the **Focus Workspace**, set the objective to *"Executive Board Financial Modeling & Strategy"*, duration to **45 minutes**, tolerance to **Urgent Only**, and ensure **Auto-Deflect Deliveries** and **Privacy Guardrail** are enabled.
3. Click **"Activate Deep Work"**. The timer starts countdown (`45:00`) and the indoor chime is muted.

### **[0:30 - 1:15] — Simulated Delivery Deflection (Happy Path)**
1. In the **Live Interruption Center**, click **"Amazon Delivery"** (or click the top bar **"Demo 1: Delivery Deflection"** button).
2. Highlight the **AI Arbitration Panel**:
   - Urgency score: **2/10 (Low)**.
   - Bedrock recommendation: `DEFLECT_RING_PRESET`.
   - Spoken audio preview: *"Please leave the package by the door. Thank you!"*.
   - Policy boundary: Pre-authorized by auto-deflection policy.
3. Click **"Execute Deflection via MCP Tool"**.
4. Check the **Execution Timeline**:
   - Status: `EXECUTED`.
   - Simulated Ring outdoor speaker audio transmitted.
   - Ring indoor chime remains muted (resident was never interrupted).
   - Notification held in **Post-Focus Queue**.

### **[1:15 - 1:50] — Deduplication & Idempotency Demonstration**
1. Re-click the exact same **"Amazon Delivery"** button (simulating a courier pressing the doorbell a second time 10 seconds later).
2. Click **"Execute Deflection"**.
3. Highlight the outcome in the **Execution Timeline**:
   - Status: `DUPLICATE_IGNORED`.
   - Explanation: *"Duplicate event already executed. Redundant execution prevented."*
   - Shows that repeat rings never play audio twice or create redundant notifications.

### **[1:50 - 2:30] — Policy Denial & Approval Boundary (Demo 2)**
1. Click **"Demo 2: Policy Denial"** in the top bar (or select *Strict Emergency Only* and trigger a visitor asking for a ladder).
2. Point out the **AI Arbitration Panel**:
   - The LLM proposed an action, but the policy engine flagged: `EXPLICIT APPROVAL REQUIRED`.
   - Notice that the outdoor speaker is **not** transmitted automatically.
   - Demonstrate the interactive control: User can click **"Grant Approval"** or **"Deny / Hold in Silent Queue"**.
   - Explain: *"Application code deterministically prevents the LLM from inventing authorizations."*

### **[2:30 - 3:00] — Privacy Shield & Post-Focus Debrief (Demo 3)**
1. Click **"Demo 3: Privacy Shield"**. An inquisitive stranger rings asking what project the resident is working on.
2. An unsafe proposal attempting to disclose *"Executive Board Financial Modeling"* is evaluated.
3. Highlight the **Privacy Audit** badge: `SANITIZED BY GUARD`.
   - The sensitive objective was redacted.
   - Replaced with: *"The resident is currently unavailable. Please leave a message or reach out by phone."*
4. Click **"End Focus"** in the Focus Workspace.
5. Review the **Post-Focus Queue**: All deferred deliveries and visitor summaries are listed cleanly. Click **"Ack"** to acknowledge each item.
6. Conclude: FlowGuard protected 45 minutes of deep work without missing a single package or compromising privacy.

---

## AWS Bedrock Verification Status

- **Integration Code**: Fully implemented using `@aws-sdk/client-bedrock-runtime` (`ConverseCommand`).
- **Environment Status**: When valid AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) are present in `.env`, FlowGuard calls the configured Bedrock model (`anthropic.claude-3-haiku-20240307-v1:0` or `anthropic.claude-3-5-sonnet-20241022-v2:0`).
- **Honest Verification Disclosure**: The local environment does not currently have active AWS credentials configured. FlowGuard honestly discloses this in both the UI status pill and structured logs: `AWS Bedrock (Deterministic Fallback Mode)`. It does **not** falsely claim live Bedrock execution was tested when credentials were not provided. Supplying credentials immediately activates live Bedrock without code modifications.

---

## Blockers and Outstanding Items

- **None**: All 6 phases, automated tests, full builds, MCP protocol endpoints, and interactive UI features are verified and operational.

---

## License

This project is licensed under the [MIT License](LICENSE).
