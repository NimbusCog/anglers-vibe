/** REST + WS client. In dev (vite :8800) the API lives on :8801; in prod same origin. */

export interface WorldState { day: number; frac: number; phase: string; weather: string; aurora: boolean; }
export interface SpeciesDef {
  id: number; name: string; regions: number[]; rarity: string;
  wmin: number; wmax: number; price: number; personality: string;
  cond: { time?: Record<string, number>; weather?: Record<string, number>;
          only_time?: string[]; only_weather?: string[]; only_aurora?: boolean };
}
export interface CatalogItem { label: string; price: number; kind: string; tier?: number; slots?: number; }
export interface Player {
  money: number; gear: string[]; creel: { species: number; weight: number; pct: number; value: number }[];
  creel_slots: number; pos: number[];
}
export interface StateResponse {
  player: Player; world: WorldState; want: number;
  log: Record<string, { n: number; best: number; first_ts: number }>;
  species: SpeciesDef[]; catalog: Record<string, CatalogItem>;
}

const API = location.port === "8800" ? `http://${location.hostname}:8801` : "";

export async function getState(): Promise<StateResponse> {
  const r = await fetch(`${API}/api/state`);
  return r.json();
}

export async function submitCatch(species_id: number, weight: number, pct: number, region: number) {
  const r = await fetch(`${API}/api/catch`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ species_id, weight, pct, region }),
  });
  return r.json() as Promise<{ accepted: boolean; reason?: string; first_catch?: boolean; value?: number; creel?: Player["creel"] }>;
}

export async function sellCreel() {
  const r = await fetch(`${API}/api/sell`, { method: "POST" });
  return r.json() as Promise<{ sold: number; total: number; money: number }>;
}

export async function buyItem(item_id: string) {
  const r = await fetch(`${API}/api/buy`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id }),
  });
  return r.json() as Promise<{ ok: boolean; reason?: string; money?: number; gear?: string[]; creel_slots?: number }>;
}

export async function savePos(x: number, z: number) {
  await fetch(`${API}/api/pos`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, z }),
  }).catch(() => {});
}

export function subscribeWorld(onWorld: (w: WorldState) => void) {
  const wsProto = location.protocol === "https:" ? "wss" : "ws";
  const url = API ? `${API.replace(/^http/, wsProto)}/ws` : `${wsProto}://${location.host}/ws`;
  const connect = () => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      setTimeout(connect, 5000);   // never let WS failure kill the game
      return;
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "world") onWorld(msg.world);
      } catch { /* ignore */ }
    };
    ws.onclose = () => setTimeout(connect, 3000);
  };
  connect();
}
