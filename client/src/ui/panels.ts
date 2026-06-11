/** Collection log (L) and paper map (M) overlay panels. */
import { WATER_BODIES } from "../world/heightmap";
import type { StateResponse } from "../net/api";

const css = `
.panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#101822ee;
  color:#dfe9f5;font:13px monospace;padding:18px;border:1px solid #3c5068;border-radius:8px;
  display:none;max-height:74vh;overflow:auto}
#log{min-width:520px}
.loggrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.card{border:1px solid #2c3c50;border-radius:6px;padding:8px;background:#15202e}
.card .nm{font-weight:bold}
.card.unknown{opacity:.45}
.r-common{border-left:3px solid #6a8} .r-uncommon{border-left:3px solid #58a}
.r-rare{border-left:3px solid #b7a23a} .r-legendary{border-left:3px solid #b35ad4}
#map canvas{background:#0d141d;border-radius:4px}
`;

const REGION_LABELS: [string, number, number][] = [
  ["Tern Bay", 0, -560], ["Salmon Run", 35, -150], ["Eagle Bluffs", 320, 200],
  ["Icefall Cavern", -310, 330], ["The Eye", 0, 640],
];

export class Panels {
  private log = document.createElement("div");
  private map = document.createElement("div");
  private mapCanvas = document.createElement("canvas");

  constructor() {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.log.className = "panel"; this.log.id = "log";
    this.map.className = "panel"; this.map.id = "map";
    this.mapCanvas.width = 360; this.mapCanvas.height = 360;
    this.map.appendChild(this.mapCanvas);
    document.body.append(this.log, this.map);
  }

  get anyOpen() { return this.log.style.display === "block" || this.map.style.display === "block"; }
  closeAll() { this.log.style.display = "none"; this.map.style.display = "none"; }

  toggleLog(state: StateResponse | null) {
    if (this.log.style.display === "block") { this.log.style.display = "none"; return; }
    this.closeAll();
    if (!state) return;
    this.log.innerHTML = "<h3>Collection Log</h3>";
    const grid = document.createElement("div");
    grid.className = "loggrid";
    const caught = state.log;
    let n = 0;
    for (const sp of state.species) {
      const c = caught[String(sp.id)];
      const card = document.createElement("div");
      card.className = `card r-${sp.rarity}${c ? "" : " unknown"}`;
      card.innerHTML = c
        ? `<div class="nm">${sp.name}</div><div>caught ${c.n} · best ${c.best.toFixed(2)} kg</div>`
        : `<div class="nm">???</div><div>${sp.rarity} · region ${sp.regions.join("/")}</div>`;
      grid.appendChild(card);
      if (c) n++;
    }
    const head = this.log.querySelector("h3")!;
    head.textContent = `Collection Log — ${n}/${state.species.length}`;
    this.log.appendChild(grid);
    this.log.style.display = "block";
  }

  toggleMap(playerX: number, playerZ: number, gear: string[]) {
    if (this.map.style.display === "block") { this.map.style.display = "none"; return; }
    this.closeAll();
    const ctx = this.mapCanvas.getContext("2d")!;
    const W = this.mapCanvas.width;
    const sx = (x: number) => ((x + 750) / 1500) * W;
    const sz = (z: number) => W - ((z + 750) / 1500) * W;   // north up
    ctx.clearRect(0, 0, W, W);
    // terrain wash: simple south-green → north-white gradient
    const grad = ctx.createLinearGradient(0, W, 0, 0);
    grad.addColorStop(0, "#1d3322"); grad.addColorStop(0.7, "#3a4438"); grad.addColorStop(1, "#cfd8e2");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, W);
    for (const w of WATER_BODIES) {
      ctx.beginPath();
      ctx.arc(sx(w.x), sz(w.z), (w.r / 1500) * W, 0, Math.PI * 2);
      ctx.fillStyle = w.region >= 3 ? "#2a5f7a" : "#3fa8a0";
      ctx.fill();
    }
    ctx.fillStyle = "#dfe9f5";
    ctx.font = "10px monospace";
    const unlocked = (r: number) =>
      r === 1 || (r === 2 && gear.includes("waders")) || (r === 3 && gear.includes("rope"))
      || (r === 4 && gear.includes("lantern")) || (r === 5 && gear.includes("parka") && gear.includes("rope"));
    REGION_LABELS.forEach(([name, x, z], i) => {
      ctx.fillStyle = unlocked(i + 1) ? "#dfe9f5" : "#5a6b80";
      ctx.fillText(unlocked(i + 1) ? name : `${name} (locked)`, sx(x) - 28, sz(z) - 14);
    });
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.arc(sx(playerX), sz(playerZ), 4, 0, Math.PI * 2);
    ctx.fill();
    this.map.style.display = "block";
  }
}
