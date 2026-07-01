# Additional / Better Candidates Discovered

**Validation status:** Research-based (public sources). NOT cloned, built, or scanned locally.
**Researched:** 2026-06-30 (data approximate, as of mid 2026)

These were surfaced while researching the AI/LangGraph candidates. They are stronger or complementary for a TypeScript-centric, production AI SaaS stack.

---

## 1. langchain-ai/langgraphjs (TOP pick if Maralito's AI tier is TypeScript)
- **URL:** https://github.com/langchain-ai/langgraphjs | **License:** MIT | **Lang:** TypeScript (~98%)
- **Stars:** ~3.1k (approx) | **Forks:** ~515 (approx) | **Open issues:** ~60
- **Latest release:** `@langchain/langgraph` 1.4.x (mid-2026) — very active
- **Why it matters:** Same graph/state/durable-execution/HITL/memory model as Python LangGraph, but native TS. Lets the AI workflow layer live **in the same TypeScript monorepo** as a Next.js app — no separate Python service required. Cited users include Replit, Uber, LinkedIn, GitLab.
- **Trade-off:** Smaller ecosystem and fewer examples than the Python repo; some advanced features land in Python first.
- **Best used as:** Adopt-reference for an in-monorepo TS agent engine (strongest Maralito fit of the AI options if backend is TS).

## 2. assistant-ui/assistant-ui (TOP pick for the agent chat FRONTEND)
- **URL:** https://github.com/assistant-ui/assistant-ui | **License:** MIT | **Lang:** TypeScript (~82%)
- **Stars:** ~10.9k (approx) | **Forks:** ~1.1k (approx) | **Open issues:** ~4 (very clean)
- **Why it matters:** Production-grade React primitives (Thread, Message, Composer) for ChatGPT-style UX: streaming, retries, attachments, markdown/code, generative UI, tool-call rendering with inline human approval. First-class adapters for **Vercel AI SDK** and **LangGraph** (`@assistant-ui/react-langgraph`). Y Combinator-backed; ~2.8k dependents; used by Mastra, LangChain, Helicone.
- **Best used as:** Adopt-reference for the agent chat UI layer in a Next.js app. Pairs cleanly with langgraphjs or a LangGraph service.

## 3. CopilotKit/CopilotKit (broad agentic-frontend framework)
- **URL:** https://github.com/CopilotKit/CopilotKit | **License:** MIT | **Lang:** TypeScript (~78%)
- **Stars:** ~35.7k (approx) | **Forks:** ~4.4k (approx) | **Open issues:** ~330
- **Why it matters:** "Frontend stack for agents" — chat UI, generative UI, shared agent/UI state, HITL. Creators of the **AG-UI protocol**; deep integrations with LangGraph, CrewAI, Mastra, PydanticAI. Enterprise offering available.
- **Trade-off:** Larger/more opinionated than assistant-ui; more framework lock-in and higher issue volume. Strong if you want shared-state "copilot in your app" UX rather than just a chat thread.
- **Best used as:** Reference for generative-UI / shared-state copilot patterns; heavier-weight alternative to assistant-ui.

## 4. langchain-ai/react-agent (official LangGraph template)
- **URL:** https://github.com/langchain-ai/react-agent | **License:** MIT | **Lang:** Python (~84%)
- **Stars:** ~780 (approx) | **Forks:** ~690 (approx) | high fork:star ratio = used as a scaffold
- **Why it matters:** Canonical minimal ReAct agent template (Tavily tool, multi-provider, LangGraph Studio, LangSmith). A TS variant and `create-agent-chat-app` scaffolder also exist in the LangChain ecosystem.
- **Best used as:** Starting-point template / pattern reference for a single ReAct agent — not a full service.

---

## Recommendation summary (AI tier)
- **If AI tier is TypeScript / in-monorepo:** langgraphjs (engine) + assistant-ui (frontend). Cleanest fit.
- **If AI tier is Python / separate service:** langgraph (engine) + agent-service-toolkit (service layer) + assistant-ui (frontend).
- CopilotKit is the alternative when you need shared-state copilot/generative-UI rather than a chat thread.
