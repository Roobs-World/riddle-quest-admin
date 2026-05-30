const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(workspaceRoot, "docs");
const outputPath = path.join(docsRoot, "tasks.html");
const sourceExtensions = new Set([".md", ".html"]);
const actionableStatuses = new Set(["todo", "in-progress", "failed"]);

const walk = (dir) => {
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return fullPath;
  });
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[^\x00-\x7F]/g, (char) => `&#${char.codePointAt(0)};`);

const decodeHtml = (value) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");

const normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim();

const stripHtml = (value) =>
  normalizeWhitespace(
    decodeHtml(
      value
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );

const stripMarkdown = (value) =>
  normalizeWhitespace(
    value
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1"),
  );

const buildLineStarts = (content) => {
  const starts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") starts.push(index + 1);
  }
  return starts;
};

const lineNumberAt = (lineStarts, index) => {
  let low = 0;
  let high = lineStarts.length - 1;
  let found = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found + 1;
};

const getTitle = (content, extension, fallback) => {
  if (extension === ".html") {
    const title = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (title) return stripHtml(title[1]);
    const h1 = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) return stripHtml(h1[1]);
  }

  const heading = content.match(/^#\s+(.+)$/m);
  return heading ? stripMarkdown(heading[1]) : fallback;
};

const extractHtmlHeadings = (content) => {
  const headings = [];
  const pattern = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    headings.push({index: match.index, text: stripHtml(match[0])});
  }

  return headings;
};

const findPreviousHeading = (headings, index, fallback) => {
  let low = 0;
  let high = headings.length - 1;
  let found = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (headings[mid].index < index) {
      found = headings[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found?.text || fallback;
};

const statusFromText = (text) => {
  if (/\bIN_PROGRESS\b/i.test(text)) return "in-progress";
  if (/\bDEFERRED\b/i.test(text)) return "deferred";
  if (/\bBLOCKED\b/i.test(text)) return "blocked";
  if (/\bUNREACHABLE\b/i.test(text)) return "unreachable";
  if (/\bSKIPPED\b/i.test(text)) return "skipped";
  if (/\bFAIL(?:ED)?\b/i.test(text)) return "failed";
  return "todo";
};

const statusFromIssueText = (text) => {
  if (/\b(?:FIXED|CLOSED|DONE|PASS(?:ED)?)\b/i.test(text)) return "done";
  return statusFromText(text);
};

const truncate = (value, max = 420) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}...`;
};

const addTask = (tasks, task) => {
  const text = truncate(normalizeWhitespace(task.text));
  if (!text) return;
  tasks.push({...task, text});
};

const parseMarkdownTasks = (content, relPath, title) => {
  const tasks = [];
  let heading = title;

  content.split(/\r?\n/).forEach((line, index) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      heading = stripMarkdown(headingMatch[2]);
      return;
    }

    const taskMatch = line.match(/^\s*(?:[-*+]|\d+\.)\s+\[([ xX])\]\s+(.+)$/);
    if (!taskMatch) return;

    addTask(tasks, {
      source: relPath,
      title,
      section: heading,
      line: index + 1,
      status: taskMatch[1].toLowerCase() === "x" ? "done" : "todo",
      text: stripMarkdown(taskMatch[2]),
      kind: "markdown-checklist",
    });
  });

  return tasks;
};

const parseHtmlCheckboxTasks = (content, relPath, title, headings, lineStarts) => {
  const tasks = [];
  const blockPattern = /<li\b[\s\S]*?<\/li>/gi;
  let match;

  while ((match = blockPattern.exec(content)) !== null) {
    const block = match[0];
    const input = block.match(/<input\b[^>]*type=["']?checkbox["']?[^>]*>/i);
    if (!input) continue;
    if (/\bdisabled\b/i.test(input[0])) continue;

    addTask(tasks, {
      source: relPath,
      title,
      section: findPreviousHeading(headings, match.index, title),
      line: lineNumberAt(lineStarts, match.index),
      status: /\bchecked\b/i.test(input[0]) ? "done" : "todo",
      text: stripHtml(block),
      kind: "html-checklist",
    });
  }

  return tasks;
};

const parseHtmlIssueRows = (content, relPath, title, lineStarts) => {
  const tasks = [];
  const rowPattern = /<tr\b[\s\S]*?<\/tr>/gi;
  let match;

  while ((match = rowPattern.exec(content)) !== null) {
    const row = match[0];
    if (!/data-label=["']Next Action["']/i.test(row)) continue;

    const cells = {};
    const cellPattern = /<td\b([^>]*)>([\s\S]*?)<\/td>/gi;
    let cellMatch;

    while ((cellMatch = cellPattern.exec(row)) !== null) {
      const label = cellMatch[1].match(/data-label=["']([^"']+)["']/i);
      if (label) cells[label[1]] = stripHtml(cellMatch[2]);
    }

    const action = cells["Next Action"];
    if (!action) continue;
    const status = statusFromIssueText(cells.Status || action);
    const id = cells.ID ? `${cells.ID}: ` : "";
    const issue = cells.Issue ? `${cells.Issue} ` : "";

    addTask(tasks, {
      source: relPath,
      title,
      section: "Issue Register Next Actions",
      line: lineNumberAt(lineStarts, match.index),
      status,
      text: `${id}${issue}Next action: ${action}`,
      kind: "html-issue-row",
    });
  }

  return tasks;
};

const collectTasks = () => {
  const sources = walk(docsRoot)
    .filter((file) => sourceExtensions.has(path.extname(file).toLowerCase()))
    .filter((file) => path.resolve(file) !== outputPath)
    .sort((a, b) => a.localeCompare(b));

  const tasks = [];

  sources.forEach((file) => {
    const extension = path.extname(file).toLowerCase();
    const relPath = path.relative(docsRoot, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    const title = getTitle(content, extension, relPath);
    const lineStarts = buildLineStarts(content);

    if (extension === ".md") {
      tasks.push(...parseMarkdownTasks(content, relPath, title));
    } else {
      const headings = extractHtmlHeadings(content);
      tasks.push(...parseHtmlCheckboxTasks(content, relPath, title, headings, lineStarts));
      tasks.push(...parseHtmlIssueRows(content, relPath, title, lineStarts));
    }
  });

  const seen = new Set();
  return tasks.filter((task) => {
    const key = `${task.source}:${task.line}:${task.status}:${task.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const statusLabel = (status) =>
  ({
    "in-progress": "In progress",
    done: "Done",
    todo: "Todo",
    blocked: "Blocked",
    unreachable: "Unreachable",
    skipped: "Skipped",
    failed: "Failed",
    deferred: "Deferred",
  })[status] || status;

const renderHtml = (tasks) => {
  const byStatus = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});
  const openCount = tasks.filter((task) => actionableStatuses.has(task.status)).length;
  const bySource = tasks.reduce((acc, task) => {
    if (!acc.has(task.source)) acc.set(task.source, []);
    acc.get(task.source).push(task);
    return acc;
  }, new Map());
  const generatedAt = new Date().toISOString().slice(0, 10);
  const activeWorkFiles = [
    "docs/issues/0001-android-emulator-firebase-qa-plan.md",
    "docs/issues/0002-design-issues.md",
    "docs/issues/0004-performance-optimizations.md",
    "docs/issues/0006-ads-rewarded-implementation.md",
    "docs/performance-optimizations-todo.md",
    "docs/google-admob-rewarded-ads-implementation.md",
    "docs/design-issues.html",
    "docs/legal-todo.html",
    "docs/memory-bank/rn-0.85-baseline.md",
    "docs/memory-bank/activeContext.md",
    "docs/memory-bank/progress.md",
  ];

  const summaryCards = [
    ["Total", tasks.length],
    ["Actionable Open", openCount],
    ["Todo", byStatus.todo || 0],
    ["Blocked", byStatus.blocked || 0],
    ["Done", byStatus.done || 0],
  ]
    .map(
      ([label, value]) => `
          <div class="metric">
            <strong>${value}</strong>
            <span>${label}</span>
          </div>`,
    )
    .join("");

  const sourceSections = [...bySource.entries()]
    .map(([source, sourceTasks]) => {
      const title = sourceTasks[0]?.title || source;
      const rows = sourceTasks
        .map(
          (task) => `
              <li class="task" data-status="${escapeHtml(task.status)}">
                <span class="badge ${escapeHtml(task.status)}">${escapeHtml(statusLabel(task.status))}</span>
                <div>
                  <p>${escapeHtml(task.text)}</p>
                  <small>${escapeHtml(task.section)} - line ${task.line} - ${escapeHtml(task.kind)}</small>
                </div>
              </li>`,
        )
        .join("");

      return `
        <section class="source" data-source="${escapeHtml(source)}">
          <div class="source-header">
            <div>
              <h2>${escapeHtml(title)}</h2>
              <a href="${escapeHtml(source)}">${escapeHtml(source)}</a>
            </div>
            <span>${sourceTasks.length} tasks</span>
          </div>
          <ul>${rows}
          </ul>
        </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Docs Task List</title>
    <style>
      :root {
        --bg: #172033;
        --panel: #f7fafc;
        --surface: #ffffff;
        --text: #172033;
        --muted: #667085;
        --border: #d7e0ea;
        --accent: #1d6f8f;
        --todo: #8a5a00;
        --done: #18794e;
        --blocked: #b42318;
        --skipped: #596579;
        --failed: #9a3412;
        --deferred: #475467;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      main {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        padding: 24px 0 40px;
      }

      header {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 22px;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        font-size: clamp(26px, 4vw, 38px);
        line-height: 1.1;
      }

      h2 {
        font-size: 18px;
        line-height: 1.25;
      }

      a {
        color: var(--accent);
        overflow-wrap: anywhere;
      }

      .lede {
        max-width: 780px;
        margin-top: 10px;
        color: var(--muted);
        line-height: 1.5;
      }

      .meta {
        margin-top: 8px;
        color: var(--muted);
        font-size: 14px;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 10px;
        margin-top: 18px;
      }

      .metric {
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        padding: 12px;
      }

      .metric strong {
        display: block;
        font-size: 26px;
        line-height: 1;
      }

      .metric span {
        display: block;
        margin-top: 6px;
        color: var(--muted);
        font-size: 13px;
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 18px 0;
      }

      button {
        min-height: 36px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text);
        cursor: pointer;
        font: inherit;
        padding: 0 12px;
      }

      button.active {
        border-color: var(--accent);
        color: #ffffff;
        background: var(--accent);
      }

      .source {
        margin-top: 14px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
      }

      .source-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 16px;
        border-bottom: 1px solid var(--border);
      }

      .source-header span {
        flex: 0 0 auto;
        color: var(--muted);
        font-size: 14px;
      }

      ul {
        display: grid;
        gap: 0;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .task {
        display: grid;
        grid-template-columns: 112px 1fr;
        gap: 12px;
        padding: 14px 16px;
        border-top: 1px solid var(--border);
        background: var(--surface);
      }

      .task:first-child {
        border-top: 0;
      }

      .task p {
        line-height: 1.45;
      }

      .task small {
        display: block;
        margin-top: 6px;
        color: var(--muted);
        line-height: 1.35;
      }

      .badge {
        justify-self: start;
        align-self: start;
        border-radius: 999px;
        padding: 4px 8px;
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
      }

      .badge.todo,
      .badge.in-progress {
        background: var(--todo);
      }

      .badge.done {
        background: var(--done);
      }

      .badge.blocked,
      .badge.unreachable {
        background: var(--blocked);
      }

      .badge.skipped {
        background: var(--skipped);
      }

      .badge.deferred {
        background: var(--deferred);
      }

      .badge.failed {
        background: var(--failed);
      }

      .hidden {
        display: none;
      }

      @media (max-width: 680px) {
        main {
          width: min(100% - 20px, 1180px);
          padding-top: 10px;
        }

        header,
        .source-header {
          padding: 14px;
        }

        .source-header,
        .task {
          display: grid;
          grid-template-columns: 1fr;
        }

        .task {
          gap: 8px;
          padding: 12px 14px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Docs Task List</h1>
        <p class="lede">
          Consolidated task inventory generated from markdown checklists, HTML checklists, issue-register next actions,
          and other structured task rows in the docs folder.
        </p>
        <p class="meta">
          <strong>Work-in-progress ownership marker:</strong> current docs backlog pass is actively updating the open issue files
          and generated task index. Coordinate before parallel edits to the files listed in
          <code>docs/memory-bank/activeContext.md</code> so progress notes stay consistent.
        </p>
        <p class="meta">
          Active work files:
          ${activeWorkFiles.map((file) => `<code>${escapeHtml(file)}</code>`).join(" ")}
        </p>
        <p class="meta">Generated ${escapeHtml(generatedAt)} from ${bySource.size} docs sources.</p>
        <div class="metrics">${summaryCards}
        </div>
      </header>

      <nav class="filters" aria-label="Task filters">
        <button class="active" type="button" data-filter="all">All</button>
        <button type="button" data-filter="open">Open</button>
        <button type="button" data-filter="todo">Todo</button>
        <button type="button" data-filter="blocked">Blocked</button>
        <button type="button" data-filter="deferred">Deferred</button>
        <button type="button" data-filter="done">Done</button>
      </nav>
${sourceSections}
    </main>

    <script>
      const buttons = [...document.querySelectorAll("[data-filter]")];
      const tasks = [...document.querySelectorAll(".task")];
      const sources = [...document.querySelectorAll(".source")];
      const visibleFor = (status, filter) =>
        filter === "all" ||
        status === filter ||
        (filter === "open" && ${JSON.stringify([...actionableStatuses])}.includes(status)) ||
        (filter === "blocked" && (status === "blocked" || status === "unreachable" || status === "failed"));

      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          const filter = button.dataset.filter;
          buttons.forEach((item) => item.classList.toggle("active", item === button));
          tasks.forEach((task) => {
            task.classList.toggle("hidden", !visibleFor(task.dataset.status, filter));
          });
          sources.forEach((source) => {
            source.classList.toggle("hidden", !source.querySelector(".task:not(.hidden)"));
          });
        });
      });
    </script>
  </body>
</html>
`;
};

const tasks = collectTasks();
fs.writeFileSync(outputPath, renderHtml(tasks), "utf8");
console.log(`Generated ${path.relative(workspaceRoot, outputPath)} with ${tasks.length} tasks.`);
