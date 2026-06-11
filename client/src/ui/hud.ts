/** DOM HUD: status bar, bite prompt, fight bars, shop panel, toasts. No three.js here. */
import type { CatalogItem, Player } from "../net/api";

const css = `
#topbar{position:fixed;top:8px;left:8px;right:8px;display:flex;gap:14px;color:#e8f1ff;
  font:13px monospace;text-shadow:0 1px 3px #000;pointer-events:none;justify-content:space-between}
#fight{position:fixed;bottom:14%;left:50%;transform:translateX(-50%);width:340px;display:none;
  font:12px monospace;color:#fff;text-shadow:0 1px 2px #000}
.bar{height:14px;background:#1a2330;border:1px solid #5a6b80;border-radius:3px;position:relative;margin:4px 0}
.fill{height:100%;border-radius:2px}
#tz{position:absolute;top:0;bottom:0;background:rgba(220,60,50,.35);border-left:1px solid #d43}
#prompt{position:fixed;top:38%;left:50%;transform:translate(-50%,-50%);font:bold 26px monospace;
  color:#ffd24a;text-shadow:0 2px 6px #000;display:none}
#toast{position:fixed;top:54px;left:50%;transform:translateX(-50%);font:13px monospace;color:#cfe3ff;
  text-shadow:0 1px 3px #000;opacity:0;transition:opacity .3s}
#shop{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#101822ee;color:#dfe9f5;
  font:13px monospace;padding:18px;border:1px solid #3c5068;border-radius:8px;display:none;min-width:430px;max-height:70vh;overflow:auto}
#shop h3{margin:0 0 10px}
#shop button{background:#1d2c3e;color:#cfe3ff;border:1px solid #3c5068;border-radius:4px;
  font:12px monospace;padding:4px 10px;cursor:pointer;margin-left:8px}
#shop button:disabled{opacity:.4;cursor:default}
.shoprow{display:flex;justify-content:space-between;align-items:center;padding:3px 0}
`;

export class Hud {
  private money = document.createElement("span");
  private creel = document.createElement("span");
  private env = document.createElement("span");
  private region = document.createElement("span");
  private fight = document.createElement("div");
  private tFill = document.createElement("div");
  private tZone = document.createElement("div");
  private dFill = document.createElement("div");
  private fightLabel = document.createElement("div");
  private prompt = document.createElement("div");
  private toastEl = document.createElement("div");
  private shop = document.createElement("div");
  private toastTimer = 0;

  constructor() {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    document.getElementById("hud")?.remove();

    const bar = document.createElement("div");
    bar.id = "topbar";
    bar.append(this.region, this.env, this.creel, this.money);
    document.body.appendChild(bar);

    this.fight.id = "fight";
    this.fightLabel.textContent = "";
    const tBar = document.createElement("div"); tBar.className = "bar";
    this.tFill.className = "fill"; this.tZone.id = "tz";
    tBar.append(this.tFill, this.tZone);
    const dBar = document.createElement("div"); dBar.className = "bar";
    this.dFill.className = "fill"; this.dFill.style.background = "#4a9dd4";
    dBar.append(this.dFill);
    const tLabel = document.createElement("div"); tLabel.textContent = "TENSION — hold to reel";
    const dLabel = document.createElement("div"); dLabel.textContent = "LINE OUT";
    this.fight.append(this.fightLabel, tLabel, tBar, dLabel, dBar);
    document.body.appendChild(this.fight);

    this.prompt.id = "prompt";
    document.body.appendChild(this.prompt);
    this.toastEl.id = "toast";
    document.body.appendChild(this.toastEl);
    this.shop.id = "shop";
    document.body.appendChild(this.shop);
  }

  setStatus(regionName: string, phase: string, weather: string, aurora: boolean, player: Player) {
    this.region.textContent = regionName;
    this.env.textContent = `${phase} · ${weather}${aurora ? " · AURORA" : ""}`;
    this.creel.textContent = `creel ${player.creel.length}/${player.creel_slots}`;
    this.money.textContent = `$${player.money}`;
  }

  showPrompt(text: string) { this.prompt.textContent = text; this.prompt.style.display = "block"; }
  hidePrompt() { this.prompt.style.display = "none"; }

  showFight(label: string) { this.fightLabel.textContent = label; this.fight.style.display = "block"; }
  hideFight() { this.fight.style.display = "none"; }

  updateFight(tension: number, redStart: number, distance: number, maxDistance: number) {
    this.tFill.style.width = `${Math.min(100, tension)}%`;
    this.tFill.style.background = tension >= redStart ? "#e04434" : tension >= 55 ? "#d4a23a" : "#52a86a";
    this.tZone.style.left = `${redStart}%`;
    this.tZone.style.right = "0";
    this.dFill.style.width = `${Math.max(0, (distance / maxDistance) * 100)}%`;
  }

  toast(text: string, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = "1";
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.style.opacity = "0"), ms);
  }

  /** Render shop panel. onBuy/onSell wired by caller; returns visibility toggles. */
  renderShop(catalog: Record<string, CatalogItem>, player: Player,
             onBuy: (id: string) => void, onSell: () => void) {
    this.shop.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = "Tern Bay Trading Post";
    this.shop.appendChild(h);

    const sellRow = document.createElement("div");
    sellRow.className = "shoprow";
    const total = player.creel.reduce((a, c) => a + c.value, 0);
    sellRow.textContent = `Sell creel (${player.creel.length} fish)`;
    const sellBtn = document.createElement("button");
    sellBtn.textContent = `Sell $${total}`;
    sellBtn.disabled = player.creel.length === 0;
    sellBtn.onclick = onSell;
    sellRow.appendChild(sellBtn);
    this.shop.appendChild(sellRow);

    for (const [id, item] of Object.entries(catalog)) {
      const row = document.createElement("div");
      row.className = "shoprow";
      const owned = player.gear.includes(id);
      row.textContent = `${item.label}`;
      const btn = document.createElement("button");
      btn.textContent = owned ? "owned" : `$${item.price}`;
      btn.disabled = owned || player.money < item.price;
      btn.onclick = () => onBuy(id);
      row.appendChild(btn);
      this.shop.appendChild(row);
    }
    const hint = document.createElement("div");
    hint.style.marginTop = "10px";
    hint.style.opacity = "0.6";
    hint.textContent = "E to close";
    this.shop.appendChild(hint);
  }

  get shopOpen() { return this.shop.style.display === "block"; }
  setShopOpen(open: boolean) { this.shop.style.display = open ? "block" : "none"; }
}
