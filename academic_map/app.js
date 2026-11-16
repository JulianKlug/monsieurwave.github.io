const THEMES = [
  { id: "stroke", label: "Stroke & imaging" },
  { id: "networks", label: "Brain networks & cognition" },
  { id: "neurocritical", label: "Neurocritical care" },
  { id: "prehospital", label: "Prehospital trauma" },
  { id: "clinical-ai", label: "Clinical AI" },
  { id: "other", label: "Other" },
];
const WIDTH = 1000;
const HEIGHT = 560;
const HUB_RADIUS_RATIO = 0.34;
const HUB_SIZE = 9;
const MIN_NODE = 5;
const MAX_NODE = 11;
const HUB_LINK_DISTANCE = 70;
const ZOOM_RANGE = [0.5, 4];
const DOI_BASE = "https://doi.org/";

const themeColor = (id) => `var(--${id})`;
const themeLabel = (id) => THEMES.find((t) => t.id === id).label;

const state = { active: new Set(THEMES.map((t) => t.id)), maxYear: 0, selected: null };

fetch("data/works.json")
  .then((r) => r.json())
  .then(init);

function init(works) {
  const years = works.map((w) => w.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  state.maxYear = maxYear;

  const hubs = layoutHubs();
  const nodes = works.map((w) => ({ ...w, type: "paper" }));
  const links = nodes.flatMap((n) =>
    n.themes.map((t) => ({ source: n, target: hubs.find((h) => h.id === t) })),
  );

  const sizeScale = d3.scaleLinear().domain([minYear, maxYear]).range([MIN_NODE, MAX_NODE]);
  const nodeSize = (d) => sizeScale(d.year);

  const svg = d3.select("#graph").attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  const root = svg.append("g");
  svg.call(
    d3.zoom().scaleExtent(ZOOM_RANGE).on("zoom", (e) => root.attr("transform", e.transform)),
  );

  const linkSel = root.append("g").selectAll("line").data(links).join("line").attr("class", "link");

  const hubSel = root.append("g").selectAll("g").data(hubs).join("g");
  hubSel.append("circle").attr("r", HUB_SIZE).attr("fill", (d) => themeColor(d.id));
  hubSel.append("text").attr("class", "hub-label").attr("dy", -16).text((d) => d.label);

  const nodeSel = root
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("class", "node")
    .attr("r", nodeSize)
    .attr("fill", (d) => themeColor(d.themes[0]))
    .on("click", (_, d) => select(d))
    .append("title")
    .text((d) => `${d.title} (${d.year})`)
    .select(function () { return this.parentNode; });

  // Hubs are pinned; papers are pulled toward each of their themes' hubs.
  const sim = d3
    .forceSimulation([...nodes, ...hubs])
    .force("link", d3.forceLink(links).distance(HUB_LINK_DISTANCE).strength(0.6))
    .force("collide", d3.forceCollide((d) => (d.type === "hub" ? HUB_SIZE + 8 : nodeSize(d) + 2)))
    .force("charge", d3.forceManyBody().strength(-25))
    .on("tick", () => {
      linkSel
        .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      nodeSel.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      hubSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

  // Dimming: a paper is visible if any of its themes is active and year <= slider.
  const isVisible = (w) => w.year <= state.maxYear && w.themes.some((t) => state.active.has(t));

  function refresh() {
    nodeSel.classed("dim", (d) => !isVisible(d)).classed("sel", (d) => d === state.selected);
    linkSel.classed("dim", (d) => !isVisible(d.source) || !state.active.has(d.target.id));
    hubSel.style("opacity", (d) => (state.active.has(d.id) ? 1 : 0.2));
    d3.selectAll("#pubs li")
      .classed("hide", function () { return !isVisible(this.__data__); })
      .classed("sel", function () { return this.__data__ === state.selected; });
    d3.select("#count").text(`(${works.filter(isVisible).length})`);
    document.dispatchEvent(new Event("map:refresh"));
  }

  function select(d) {
    state.selected = state.selected === d ? null : d;
    renderPanel(state.selected);
    refresh();
  }

  const isolateTheme = buildFilters(refresh);
  window.researchMap = { works, themes: THEMES, state, isVisible, select, isolateTheme };
  buildYear(minYear, maxYear, refresh);
  buildList(works, select);
  refresh();
  document.dispatchEvent(new Event("map:ready"));
}

// Hubs sit on a ring around the centre, evenly spaced.
function layoutHubs() {
  return THEMES.map((t, i) => {
    const angle = (2 * Math.PI * i) / THEMES.length - Math.PI / 2;
    return {
      ...t,
      type: "hub",
      fx: WIDTH / 2 + Math.cos(angle) * WIDTH * HUB_RADIUS_RATIO,
      fy: HEIGHT / 2 + Math.sin(angle) * HEIGHT * HUB_RADIUS_RATIO,
    };
  });
}

// Returns isolate(id), shared by the chips and the map glyphs.
function buildFilters(onChange) {
  const box = d3.select("#filters");

  // Isolates a theme; isolating the isolated theme again restores all.
  const isolate = (id) => {
    const isolated = state.active.size === 1 && state.active.has(id);
    state.active = new Set(isolated ? THEMES.map((x) => x.id) : [id]);
    box.selectAll(".chip").attr("aria-pressed", (_, i) => state.active.has(THEMES[i].id));
    onChange();
  };

  THEMES.forEach((t) => {
    box
      .append("button")
      .attr("class", "chip")
      .attr("aria-pressed", "true")
      .style("--c", themeColor(t.id))
      .html(`<i></i>${t.label}`)
      .on("click", () => isolate(t.id));
  });
  return isolate;
}

function buildYear(min, max, onChange) {
  const input = document.getElementById("year");
  const out = document.getElementById("year-out");
  Object.assign(input, { min, max, value: max, step: 1 });
  out.textContent = max;
  input.addEventListener("input", () => {
    state.maxYear = +input.value;
    out.textContent = input.value;
    onChange();
  });
}

function buildList(works, onSelect) {
  d3.select("#pubs")
    .selectAll("li")
    .data(works)
    .join("li")
    .on("click", (_, d) => onSelect(d))
    .html(
      (d) => `<span class="y">${d.year}</span>
        <span><a ${d.doi ? `href="${DOI_BASE}${d.doi}"` : ""}>${d.title}</a>
        <div class="meta">${d.journal}</div></span>`,
    );
}

function renderPanel(d) {
  const panel = document.getElementById("panel");
  panel.hidden = !d;
  if (!d) return;

  panel.innerHTML = `<button aria-label="Close">×</button>
    <h3>${d.title}</h3>
    <p>${d.journal ? d.journal + " · " : ""}${d.year}</p>
    <p>${d.themes.map(themeLabel).join(" · ")}</p>
    ${d.doi ? `<p><a href="${DOI_BASE}${d.doi}">${d.doi}</a></p>` : ""}`;
  panel.querySelector("button").onclick = () => {
    state.selected = null;
    panel.hidden = true;
    d3.selectAll(".node").classed("sel", false);
    d3.selectAll("#pubs li").classed("sel", false);
    document.dispatchEvent(new Event("map:refresh"));
  };
}
