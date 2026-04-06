const vscode = acquireVsCodeApi();

const state = {
  graph: window.__GRAPH_DATA__ || { nodes: [], edges: [] },
  references: [],
  selectedNode: null,
  selectedSymbols: [],
  selectedSymbol: null,
  symbolInspection: null,
};

function send(type, payload = {}) {
  vscode.postMessage({ type, ...payload });
}

function render() {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  app.innerHTML = `
    <div class="toolbar">
      <button id="refreshBtn">Refresh</button>
      <button id="topBtn">Top Connected</button>
      <input id="searchInput" placeholder="Search file..." />
    </div>

    <div class="summary">
      <div>Nodes: ${state.graph.nodes.length}</div>
      <div>Edges: ${state.graph.edges.length}</div>
      <div>References: ${state.references.length}</div>
      <div>Symbols: ${state.selectedSymbols.length}</div>
    </div>

    <div class="layout layout-4">
      <div class="panel">
        <h3>Files</h3>
        <div id="results"></div>
      </div>

      <div class="panel">
        <h3>Details</h3>
        <div id="details">Select a file</div>
      </div>

      <div class="panel">
        <h3>Symbols</h3>
        <div id="symbols">Select a file</div>
      </div>

      <div class="panel">
        <h3>References / Calls</h3>
        <div id="references"></div>
      </div>
    </div>
  `;

  document.getElementById("refreshBtn").onclick = () => send("refreshGraph");
  document.getElementById("topBtn").onclick = () => send("getTopConnected", { limit: 30 });
  document.getElementById("searchInput").oninput = (event) => {
    send("searchNodes", { query: event.target.value });
  };

  renderResults(state.graph.nodes.slice(0, 100));
  renderDetails();
  renderSymbols();
  renderReferencesPanel();
}

function renderResults(nodes) {
  const el = document.getElementById("results");
  if (!el) {
    return;
  }

  el.innerHTML = nodes
    .map(
      (node) => `
      <div class="item ${state.selectedNode?.id === node.id ? "selected" : ""}">
        <div class="title" data-node-id="${escapeAttr(node.id)}">${escapeHtml(node.label)}</div>
        <div class="sub">${escapeHtml(node.path)}</div>
      </div>
    `
    )
    .join("");

  el.querySelectorAll("[data-node-id]").forEach((nodeEl) => {
    const nodeId = nodeEl.getAttribute("data-node-id");
    nodeEl.addEventListener("click", () => {
      const node = state.graph.nodes.find((item) => item.id === nodeId);
      if (!node) {
        return;
      }
      state.selectedNode = node;
      state.selectedSymbols = [];
      state.selectedSymbol = null;
      state.symbolInspection = null;
      send("inspectNode", { nodeId });
      send("listSymbols", { uri: toFileUri(node.path) });
      render();
    });
    nodeEl.addEventListener("dblclick", () => send("openNode", { nodeId }));
  });
}

function renderDetails(relations) {
  const details = document.getElementById("details");
  if (!details) {
    return;
  }

  if (!state.selectedNode) {
    details.innerHTML = "Select a file";
    return;
  }

  const safeRelations = relations || state.selectedNode.relations || {
    incoming: [],
    outgoing: [],
    dependencies: [],
    dependents: [],
  };

  details.innerHTML = `
    <div><strong>Node:</strong> ${escapeHtml(state.selectedNode.label)}</div>
    <div><strong>Outgoing:</strong> ${safeRelations.outgoing.length}</div>
    <div><strong>Incoming:</strong> ${safeRelations.incoming.length}</div>

    <h4>Dependencies</h4>
    ${renderNodeList(safeRelations.dependencies)}

    <h4>Dependents</h4>
    ${renderNodeList(safeRelations.dependents)}
  `;
}

function renderNodeList(nodes) {
  if (!nodes || nodes.length === 0) {
    return `<div class="muted">None</div>`;
  }
  return nodes.map((node) => `<div>${escapeHtml(node.label)}</div>`).join("");
}

function renderSymbols() {
  const el = document.getElementById("symbols");
  if (!el) {
    return;
  }

  if (!state.selectedNode) {
    el.innerHTML = `<div class="muted">Select a file</div>`;
    return;
  }

  if (state.selectedSymbols.length === 0) {
    el.innerHTML = `<div class="muted">No symbols loaded</div>`;
    return;
  }

  el.innerHTML = state.selectedSymbols
    .map(
      (symbol) => `
      <div class="item ${state.selectedSymbol?.id === symbol.id ? "selected" : ""}" data-symbol-id="${escapeAttr(symbol.id)}">
        <div class="title">${escapeHtml(symbol.name)}</div>
        <div class="sub">[${escapeHtml(symbol.kind)}] ${escapeHtml(symbol.containerName || "")}</div>
      </div>
    `
    )
    .join("");

  el.querySelectorAll("[data-symbol-id]").forEach((symbolEl) => {
    const symbolId = symbolEl.getAttribute("data-symbol-id");
    symbolEl.addEventListener("click", () => {
      const symbol = state.selectedSymbols.find((item) => item.id === symbolId);
      if (!symbol) {
        return;
      }
      state.selectedSymbol = symbol;
      state.symbolInspection = null;
      send("inspectSymbol", { symbol });
      renderSymbols();
      renderReferencesPanel();
    });
    symbolEl.addEventListener("dblclick", () => {
      const symbol = state.selectedSymbols.find((item) => item.id === symbolId);
      if (symbol) {
        send("openSymbol", { symbol });
      }
    });
  });
}

function renderReferencesPanel() {
  const el = document.getElementById("references");
  if (!el) {
    return;
  }

  if (state.symbolInspection) {
    const { references, incomingCalls, outgoingCalls } = state.symbolInspection;
    el.innerHTML = `
      <h4>Incoming Calls (${incomingCalls.length})</h4>
      ${renderCallItems(incomingCalls)}
      <h4>Outgoing Calls (${outgoingCalls.length})</h4>
      ${renderCallItems(outgoingCalls)}
      <h4>References (${references.length})</h4>
      ${renderReferenceItems(references, true)}
    `;
    bindCallItems(el);
    bindReferenceItems(el, true);
    return;
  }

  if (!state.references || state.references.length === 0) {
    el.innerHTML = `<div class="muted">No references loaded</div>`;
    return;
  }

  el.innerHTML = renderReferenceItems(state.references, false);
  bindReferenceItems(el, false);
}

function renderCallItems(items) {
  if (!items || items.length === 0) {
    return `<div class="muted">None</div>`;
  }

  return items
    .map(
      (item) => `
      <div class="item call-item" data-call-symbol-id="${escapeAttr(item.symbol.id)}">
        <div class="title">${escapeHtml(item.symbol.name)}</div>
        <div class="sub">${escapeHtml(item.symbol.uri)}</div>
      </div>
    `
    )
    .join("");
}

function renderReferenceItems(items, symbolMode) {
  if (!items || items.length === 0) {
    return `<div class="muted">None</div>`;
  }

  return items
    .map((item, index) => {
      const id = symbolMode
        ? `${item.uri}:${item.range.startLine}:${item.range.startCharacter}:${index}`
        : item.id;
      const locationText = symbolMode
        ? `${item.uri}:${item.range.startLine + 1}:${item.range.startCharacter + 1}`
        : `${item.filePath}:${item.line}:${item.column}`;
      const preview = symbolMode ? item.preview : item.preview;
      return `
        <div class="item ref-item" data-ref-id="${escapeAttr(id)}">
          <div class="title">${escapeHtml(locationText)}</div>
          <div class="sub">[${escapeHtml(item.kind)}] ${escapeHtml(preview)}</div>
        </div>
      `;
    })
    .join("");
}

function bindCallItems(container) {
  container.querySelectorAll("[data-call-symbol-id]").forEach((nodeEl) => {
    const symbolId = nodeEl.getAttribute("data-call-symbol-id");
    nodeEl.addEventListener("click", () => {
      const lists = [
        ...(state.symbolInspection?.incomingCalls || []),
        ...(state.symbolInspection?.outgoingCalls || []),
      ];
      const item = lists.find((entry) => entry.symbol.id === symbolId);
      if (item) {
        send("openSymbol", { symbol: item.symbol });
      }
    });
  });
}

function bindReferenceItems(container, symbolMode) {
  container.querySelectorAll("[data-ref-id]").forEach((nodeEl) => {
    const refId = nodeEl.getAttribute("data-ref-id");
    nodeEl.addEventListener("click", () => {
      if (symbolMode) {
        const ref = (state.symbolInspection?.references || []).find((item, index) => {
          return `${item.uri}:${item.range.startLine}:${item.range.startCharacter}:${index}` === refId;
        });
        if (ref) {
          send("openLocation", { uri: ref.uri, range: ref.range });
        }
        return;
      }

      const item = state.references.find((entry) => entry.id === refId);
      if (item) {
        send("openReference", { item });
      }
    });
  });
}

window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.type) {
    case "graphUpdated":
      state.graph = message.graph;
      render();
      break;
    case "searchResults":
      renderResults(message.nodes);
      break;
    case "topConnectedResults":
      renderResults(message.nodes);
      break;
    case "nodeDetails": {
      if (state.selectedNode && state.selectedNode.id === message.nodeId) {
        state.selectedNode = { ...state.selectedNode, relations: message.relations };
      }
      renderDetails(message.relations);
      break;
    }
    case "referencesFound":
      state.references = message.items || [];
      renderReferencesPanel();
      break;
    case "symbolsListed":
      state.selectedSymbols = message.symbols || [];
      renderSymbols();
      break;
    case "symbolInspected":
      state.symbolInspection = message.result;
      renderReferencesPanel();
      break;
    case "error":
      console.error(message.message);
      break;
  }
});

function toFileUri(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
}

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
