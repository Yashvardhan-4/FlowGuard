# FlowGuard — Developer Friction Log

**Project:** FlowGuard (Amazon Developer Hackathon: Build & Ship Shape)  
**Author:** Yashvardhan  
**Repository:** https://github.com/Yashvardhan-4/FlowGuard  

---

## Friction Item 1: Handling Duplicate Smart-Home Event Invocations

### 1. Specific Task Attempted
Handling rapid, repeat doorbell rings and motion sensor triggers from couriers and visitors arriving at the door within a 5–15 second window (e.g., a delivery driver pressing the doorbell button, setting down two packages, and pressing the button again before departing).

### 2. Steps Taken
1. Configured simulated Ring doorbell event webhooks dispatched to the FlowGuard MCP arbitration server.
2. Injected two consecutive delivery events sharing the exact same `eventId` (`evt-ring-deliv-001`) within 5 seconds of each other.
3. Evaluated whether the AWS Bedrock runtime model and downstream tool execution pipeline would recognize the temporal and identifier collision.

### 3. Expected vs. Actual Result
- **Expected:** The arbitration engine would recognize the duplicate context, suppress redundant audio execution, and avoid playing outdoor speaker replies twice to the courier.
- **Actual:** Because LLM inference is stateless by design, passing each event independently caused Bedrock to treat the second ring as a fresh interruption, re-recommending outdoor speaker audio and triggering redundant hardware playback.

### 4. Severity Rating
**Medium** — Redundant smart-speaker replies and duplicate push notifications degrade user trust and irritate visitors.

### 5. Workaround Used
Implemented an application-level sliding TTL deduplication cache (`DeduplicationTracker`) in TypeScript. When an interruption event arrives:
1. The tracker checks if `eventId` was executed within a 15-minute sliding window.
2. If already processed, it intercepts execution before calling Bedrock or triggering hardware, safely returning a cached result with status `DUPLICATE_IGNORED`.
3. Verified via automated tests in `test/deduplication.test.ts`.

### 6. Actionable Suggestion for AWS / Alexa SDKs
Standardize an **Idempotency Token** header (similar to Stripe's `Idempotency-Key` or AWS S3 Client Request Tokens) across the Alexa Skills Kit (ASK) and smart device event payloads. This would allow agentic backends and MCP tool servers to handle repeat event deduplication at the protocol gateway level rather than requiring custom in-memory caching layers.

---

## Friction Item 2: Multi-Session Protocol Lifecycle in Model Context Protocol (MCP)

### 1. Specific Task Attempted
Connecting both an external Server-Sent Events (SSE) client transport for third-party MCP clients and an in-process adapter for the web dashboard simultaneously to the MCP Server instance.

### 2. Steps Taken
Attempted to connect multiple client transports directly to a single `McpServer` instance using `@modelcontextprotocol/sdk`.

### 3. Expected vs. Actual Result
- **Expected:** `McpServer` would multiplex multiple active transports out of the box.
- **Actual:** The SDK threw `Already connected to a transport. Call close() before connecting to a new transport, or use a separate Protocol instance per connection.`

### 4. Severity Rating
**Low / Developer Experience**

### 5. Workaround Used
Architected an `McpServer` session factory function (`createFlowGuardMcpServer()`) paired with `InMemoryTransport.createLinkedPair()`. Each SSE connection and internal adapter creates its own linked protocol session while sharing the singleton state and policy layers.

### 6. Actionable Suggestion for Model Context Protocol Team
Provide official multi-tenant connection pool documentation and first-party Express 5 middleware templates in `@modelcontextprotocol/sdk`.
