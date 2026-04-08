# Governance Rules with MemoryBank

1. Every new feature/refactor must follow the feature-flow or refactor-flow.
2. Drift must be logged in memorybank and converted to rules/tasks.
3. AI reads memorybank before generating code.
4. Memorybank entries automatically generate Todo tasks for follow-up:
   - Fix drift
   - Add missing tests
   - Refactor
   - Optimize performance
5. Subagents must operate in narrow roles to minimize hallucinations.
6. Layered review passes:
   - Architecture → Boundaries → Scalability → Data → Tests → Staff Review
7. All MCP servers feed logs to memorybank for continuous learning.
