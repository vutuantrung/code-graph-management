const vscode = acquireVsCodeApi();
const initialGraph = window.__GRAPH_DATA__;
let currentGraph = initialGraph;

function send(type, payload = {}) {
  vscode.postMessage({ type, ...payload });
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="toolbar">
      <button id="refreshBtn">Refresh</button>
      <button id="topBtn">Top Connected</button>
      <input id="searchInput" placeholder="Search file..." />
    </div>

    <div class="summary">
      <div>Nodes: ${currentGraph.nodes.length}</div>
      <div>Edges: ${currentGraph.edges.length}</div>
    </div>

    <div class="layout">
      <div class="panel">
        <h3>Files</h3>
        <div id="results"></div>
      </div>
      <div class="panel">
        <h3>Details</h3>
        <div id="details">Select a file</div>
      </div>
    </div>
  `;

  document.getElementById("refreshBtn").onclick = () => send("refreshGraph");
  document.getElementById("topBtn").onclick = () => send("getTopConnected", { limit: 30 });
  document.getElementById("searchInput").oninput = (e) =>
    send("searchNodes", { query: e.target.value });

  renderResults(currentGraph.nodes.slice(0, 100));
}

function renderResults(nodes) {
  const el = document.getElementById("results");
  if (!el) return;

  el.innerHTML = nodes.map((n) => `
    <div class="item">
      <div class="title" data-node-id="${escapeAttr(n.id)}">${escapeHtml(n.label)}</div>
      <div class="sub">${escapeHtml(n.path)}</div>
    </div>
  `).join("");

  el.querySelectorAll("[data-node-id]").forEach((nodeEl) => {
    const nodeId = nodeEl.getAttribute("data-node-id");
    nodeEl.addEventListener("click", () => send("inspectNode", { nodeId }));
    nodeEl.addEventListener("dblclick", () => send("openNode", { nodeId }));
  });
}

function renderDetails(nodeId, relations) {
  const details = document.getElementById("details");
  if (!details) return;

  details.innerHTML = `
    <div><strong>Node:</strong> ${escapeHtml(nodeId)}</div>
    <div><strong>Outgoing:</strong> ${relations.outgoing.length}</div>
    <div><strong>Incoming:</strong> ${relations.incoming.length}</div>

    <h4>Dependencies</h4>
    ${relations.dependencies.map((n) => `<div>${escapeHtml(n.label)}</div>`).join("") || "<div>None</div>"}

    <h4>Dependents</h4>
    ${relations.dependents.map((n) => `<div>${escapeHtml(n.label)}</div>`).join("") || "<div>None</div>"}
  `;
}

window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.type) {
    case "graphUpdated":
      currentGraph = message.graph;
      render();
      break;
    case "searchResults":
      renderResults(message.nodes);
      break;
    case "topConnectedResults":
      renderResults(message.nodes);
      break;
    case "nodeDetails":
      renderDetails(message.nodeId, message.relations);
      break;
    case "error":
      console.error(message.message);
      break;
  }
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

render();