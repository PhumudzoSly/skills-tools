import './styles.css';

export default function Page() { return (<>

    {/* Top Navigation */}
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Skills Tools">
        <img />
        <span>Skills Tools</span>
      </a>
      <nav className="topnav" aria-label="Primary">
        <a href="#install">Install</a>
        <a href="#quick-start">Quick Start</a>
        <a href="#tools">Tools</a>
        <a href="#defaults">Defaults</a>
        <a href="#outputs">Outputs</a>
      </nav>
    </header>

    <main id="top">
      <section className="hero reveal" id="overview">        <div className="sys-badge">SYSTEM.READY</div>
        <p className="eyebrow">One page. Full mental model.</p>
        <h1>
          Find the right skill,
          <span>load SKILL.md cleanly</span>,
          feed context back to your model.
        </h1>
        <p className="hero-copy">
          <strong>@phumudzo/skills-tools</strong> gives AI SDK workflows a focused two-step loop:
          find candidates with <code>findSkillsTool</code>, then hydrate model context with
          <code>readSkillTool</code>.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#quick-start">See Integration</a>
          <a className="button ghost" href="#tools">Browse Tool API</a>
        </div>
        <ul className="hero-stats" aria-label="Feature highlights">
          <li>
            <span className="value">2</span>
            <span className="label">Core Tools</span>
          </li>
          <li>
            <span className="value">3</span>
            <span className="label">Ranking Strategies</span>
          </li>
          <li>
            <span className="value">Node 18+</span>
            <span className="label">Runtime</span>
          </li>
        </ul>
      </section>

      <section className="panel reveal" id="install">
        <div className="section-head">
          <h2>Install</h2>
          <p>Peer dependencies: <code>ai@^6</code> and <code>zod@^3.23</code>.</p>
        </div>
        <div className="command-row">
          <pre><code id="install-command">pnpm add @phumudzo/skills-tools ai zod</code></pre>
          <button type="button" id="copy-install" className="copy-button">Copy</button>
        </div>
      </section>

      <section className="panel reveal" id="quick-start">
        <div className="section-head">
          <h2>Quick Start</h2>
          <p>
            Call <code>initSkillsTools</code>, pass optional configuration, then hand
            <code>tools</code> to your generation loop.
          </p>
        </div>
        <pre><code>import { generateText, stepCountIs } from "ai";
import { initSkillsTools } from "@phumudzo/skills-tools";

const { tools } = initSkillsTools({
  find: {
    defaultMode: "search",
    rankingStrategy: "hybrid",
    preconfiguredSkills: [
      { name: "playwright", source: "vercel-labs/agent-skills" },
      { name: "prisma-expert", source: "vercel-labs/agent-skills" }
    ]
  },
  read: {
    maxChars: 16000
  }
});

const result = await generateText({
  model: "anthropic/claude-sonnet-4.5",
  messages,
  tools,
  stopWhen: stepCountIs(6)
});</code></pre>
      </section>

      <section className="panel reveal" id="flow">
        <div className="section-head">
          <h2>Two-Step Flow</h2>
          <p>Designed to make skill selection explicit instead of implicit.</p>
        </div>
        <div className="flow-grid">
          <article>
            <span>01</span>
            <h3>Find</h3>
            <p>
              Run <code>findSkillsTool</code> in <code>preconfig</code> or <code>search</code>
              mode to receive ranked candidates and a recommended pick.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Read</h3>
            <p>
              Run <code>readSkillTool</code> to resolve and load a concrete <code>SKILL.md</code>,
              then inject <code>contextPatch</code> into model context.
            </p>
          </article>
        </div>
      </section>

      <section className="panel reveal" id="tools">
        <div className="section-head">
          <h2>Tool Reference</h2>
          <p>Implementation-accurate behavior from the current source.</p>
        </div>

        <h3>findSkillsTool</h3>
        <table>
          <thead>
            <tr>
              <th>Input</th>
              <th>Type</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>mode</td>
              <td>"preconfig" | "search"</td>
              <td>Optional; defaults to configured <code>defaultMode</code> (search by default).</td>
            </tr>
            <tr>
              <td>query</td>
              <td>string</td>
              <td>Required for search mode, minimum 2 characters.</td>
            </tr>
            <tr>
              <td>limit</td>
              <td>number</td>
              <td>Clamped to 1..25.</td>
            </tr>
          </tbody>
        </table>

        <table>
          <thead>
            <tr>
              <th>Output</th>
              <th>Type</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>recommended</td>
              <td>SkillCandidate</td>
              <td>Top-ranked candidate after deterministic or AI-assisted ranking.</td>
            </tr>
            <tr>
              <td>candidates</td>
              <td>SkillCandidate[]</td>
              <td>Sorted by confidence descending.</td>
            </tr>
            <tr>
              <td>needsDisambiguation</td>
              <td>boolean</td>
              <td>True when confidence is low, scores are close, or no candidates found.</td>
            </tr>
          </tbody>
        </table>

        <h3>readSkillTool</h3>
        <table>
          <thead>
            <tr>
              <th>Input</th>
              <th>Type</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>source</td>
              <td>string</td>
              <td>GitHub owner/repo format, for example <code>vercel-labs/agent-skills</code>.</td>
            </tr>
            <tr>
              <td>skillName / slug</td>
              <td>string</td>
              <td>Name can be inferred from slug if omitted.</td>
            </tr>
            <tr>
              <td>preferredPath</td>
              <td>string</td>
              <td>Optional candidate path hint, normalized to end with <code>SKILL.md</code>.</td>
            </tr>
            <tr>
              <td>maxChars</td>
              <td>number</td>
              <td>1000..120000 per call; defaults to config value (18000 by default).</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="panel reveal" id="defaults">
        <div className="section-head">
          <h2>Default Behavior Snapshot</h2>
          <p>These values apply when you do not override config.</p>
        </div>
        <div className="cards">
          <article>
            <h3>Find Defaults</h3>
            <ul>
              <li>defaultMode: <code>search</code></li>
              <li>allowedModes: <code>["preconfig", "search"]</code></li>
              <li>searchLimit: <code>10</code></li>
              <li>rankingStrategy: <code>hybrid</code></li>
              <li>minConfidence: <code>0.68</code></li>
              <li>closeScoreDelta: <code>0.08</code></li>
            </ul>
          </article>
          <article>
            <h3>Read Defaults</h3>
            <ul>
              <li>maxChars: <code>18000</code></li>
              <li>maxCandidatesToRead: <code>20</code></li>
              <li>Branches checked: <code>main</code> then <code>master</code></li>
              <li>Frontmatter required: <code>name</code> and <code>description</code></li>
            </ul>
          </article>
          <article>
            <h3>Search API</h3>
            <ul>
              <li>Endpoint base: <code>https://skills.sh</code></li>
              <li>Route: <code>/api/search</code></li>
              <li>Query params: <code>q</code>, <code>limit</code></li>
            </ul>
          </article>
        </div>
      </section>

      <section className="panel reveal" id="outputs">
        <div className="section-head">
          <h2>Sample Output</h2>
          <p>Typical response shape from <code>readSkillTool</code>.</p>
        </div>
        <pre><code>{
  "ok": true,
  "message": "Loaded skill playwright from vercel-labs/agent-skills",
  "selected": {
    "name": "playwright",
    "source": "vercel-labs/agent-skills",
    "path": "skills/playwright/SKILL.md",
    "branch": "main",
    "description": "Playwright testing best practices"
  },
  "contextPatch": "ACTIVE SKILL: playwright\\nSOURCE: vercel-labs/agent-skills...",
  "skillMarkdown": "---\\nname: playwright..."
}</code></pre>
      </section>
    </main>

    <footer className="footer reveal">
      <p>Built for deterministic skill discovery and context hydration in AI SDK flows.</p>
      <p><span id="year"></span> Skills Tools</p>
    </footer>

    <script src="./script.js"></script>
  
</>); }