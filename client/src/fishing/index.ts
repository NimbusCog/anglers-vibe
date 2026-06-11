/** Fishing orchestrator with methods (float/spin/fly/jig) and full fight presentation.
 *  SPACE: hold=cast power, tap=hookset, hold=reel. Keys 1-4 switch method. */
import * as THREE from "three";
import { waterLevelAt } from "../world/heightmap";
import { regionAt } from "../world/regions";
import type { PlayerController } from "../player/controller";
import type { Hud } from "../ui/hud";
import type { SpeciesDef, WorldState } from "../net/api";
import { consumeLure, submitCatch } from "../net/api";
import { biteWait, hookWindow, sampleBite } from "./bite";
import { FightSim, gearParams } from "./fight";
import { audio } from "../audio";

type Phase = "idle" | "casting" | "waiting" | "hookset" | "fighting";
export type Method = "float" | "spin" | "fly" | "jig";

const METHOD_ROD: Record<Method, string | null> = { float: null, spin: "spinrod", fly: "flyrod", jig: "jigrod" };
const METHOD_LURES: Record<Method, string[]> = {
  float: [], spin: ["spoon", "spinner"], fly: ["fly"], jig: ["icejig", "glowjig"],
};

export class Fishing {
  phase: Phase = "idle";
  method: Method = "float";
  private power = 0;
  private bobber: THREE.Mesh;
  private splash: THREE.Mesh;
  private shadow: THREE.Mesh;          // the fish, seen as a dark shape under the surface
  private line: THREE.Line;
  private lineGeo: THREE.BufferGeometry;
  private rod: THREE.Mesh;
  private castDir = new THREE.Vector3();
  private castPoint = new THREE.Vector3();
  private castLen = 0;
  private waitLeft = 0;
  private hookLeft = 0;
  private twitchLeft = 0;             // jig: time until next twitch prompt
  private twitchWindow = 0;           // jig: open prompt window
  private pending: { species: SpeciesDef; weight: number; pct: number } | null = null;
  private sim: FightSim | null = null;
  private maxDistance = 1;
  private shadowAngle = 0;
  private space = false;
  private spaceJustDown = false;

  constructor(
    private scene: THREE.Scene,
    private player: PlayerController,
    private hud: Hud,
    private getWorld: () => WorldState,
    private getSpecies: () => SpeciesDef[],
    private getGearTiers: () => { rod: number; reel: number; line: number },
    private getGear: () => string[],
    private getLures: () => Record<string, number>,
    private getMethodMult: (m: Method) => Record<string, number>,
    private onLanded: (sp: SpeciesDef, weight: number, value: number, first: boolean, record: boolean) => void,
    private onLureLost: (lure: string) => void,
  ) {
    this.bobber = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xe04434 }),
    );
    this.bobber.visible = false;
    this.splash = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.5, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.splash.rotation.x = -Math.PI / 2;
    this.splash.visible = false;
    // fish shadow: flattened dark blob just under the surface
    this.shadow = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 6),
      new THREE.MeshBasicMaterial({ color: 0x06141c, transparent: true, opacity: 0.55 }),
    );
    this.shadow.scale.set(1.4, 0.18, 0.5);
    this.shadow.visible = false;
    // fishing line
    this.lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0xd8e4ee, transparent: true, opacity: 0.7 }));
    this.line.visible = false;
    // rod: thin cylinder held by the angler, bends (tilts) with tension
    this.rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.045, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f }),
    );
    this.rod.position.set(0.35, 1.5, -0.3);
    this.rod.rotation.x = -0.9;
    this.player.body.add(this.rod);
    scene.add(this.bobber, this.splash, this.shadow, this.line);

    addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.code === "Space") { if (!this.space) this.spaceJustDown = true; this.space = true; e.preventDefault(); }
      if (this.phase === "idle" || this.phase === "waiting") {
        if (e.code === "Digit1") this.setMethod("float");
        if (e.code === "Digit2") this.setMethod("spin");
        if (e.code === "Digit3") this.setMethod("fly");
        if (e.code === "Digit4") this.setMethod("jig");
      }
    });
    addEventListener("keyup", (e: KeyboardEvent) => { if (e.code === "Space") this.space = false; });
  }

  get busy() { return this.phase !== "idle"; }

  private setMethod(m: Method) {
    if (m !== "float") {
      const rod = METHOD_ROD[m]!;
      if (!this.getGear().includes(rod)) { this.hud.toast(`need a ${rod.replace("rod", " rod")} for that`); return; }
      if (!this.currentLure(m)) { this.hud.toast(`no ${m} lures — buy some at the trading post`); return; }
    }
    if (this.phase === "waiting") this.reset("");
    this.method = m;
    this.hud.toast(`method: ${m} fishing`);
  }

  /** Best owned lure for a method (spoon beats spinner, icejig beats glowjig). */
  private currentLure(m: Method = this.method): string | null {
    for (const l of METHOD_LURES[m]) if ((this.getLures()[l] ?? 0) > 0) return l;
    return null;
  }

  update(dt: number) {
    switch (this.phase) {
      case "idle": {
        if (this.spaceJustDown) {
          this.phase = "casting";
          this.power = 0;
          this.hud.showPrompt("…");
        }
        break;
      }
      case "casting": {
        if (this.space) {
          this.power = Math.min(100, this.power + 90 * dt);
          this.hud.showPrompt(`CAST ${"▮".repeat(Math.ceil(this.power / 10))}`);
        } else {
          this.hud.hidePrompt();
          this.tryCast();
        }
        break;
      }
      case "waiting": {
        this.bobber.position.y = this.castPoint.y + Math.sin(performance.now() / 300) * 0.06;
        // method behaviors while waiting
        if (this.method === "spin") {
          // active retrieval: bite clock only runs while you reel; lure crawls back
          if (this.space) {
            this.waitLeft -= dt * 3;
            this.castLen = Math.max(2, this.castLen - 1.2 * dt);
            this.castPoint.copy(this.player.pos).addScaledVector(this.castDir, this.castLen);
            const lvl = waterLevelAt(this.castPoint.x, this.castPoint.z);
            if (lvl === null || this.castLen <= 2.2) { this.reset("retrieved — cast again"); break; }
            this.castPoint.y = lvl + 0.05;
            this.bobber.position.copy(this.castPoint);
            audio.update(dt, true);
          }
        } else if (this.method === "jig") {
          this.twitchLeft -= dt;
          if (this.twitchWindow > 0) {
            this.twitchWindow -= dt;
            if (this.spaceJustDown) {
              this.waitLeft -= this.waitLeft * 0.35;   // good twitch: big bite-clock cut
              this.twitchWindow = 0;
              this.hud.hidePrompt();
              audio.splash();
            } else if (this.twitchWindow <= 0) {
              this.hud.hidePrompt();
            }
          } else if (this.twitchLeft <= 0) {
            this.twitchLeft = 3 + Math.random() * 2.5;
            this.twitchWindow = 0.6;
            this.hud.showPrompt("TWITCH!");
          }
          this.waitLeft -= dt * 0.4;                   // jigging is slow unless you twitch well
        } else {
          this.waitLeft -= dt;
          if (this.spaceJustDown) { this.reset("reeled in early"); break; }
        }
        if (this.method !== "spin" || this.space) this.waitLeft -= 0;  // (clock handled above)
        if (this.method === "float" || this.method === "fly") this.waitLeft -= 0;
        if (this.waitLeft <= 0) this.triggerBite();
        break;
      }
      case "hookset": {
        this.hookLeft -= dt;
        if (this.spaceJustDown && this.pending) {
          const g = gearParams(this.getGearTiers());
          if (this.method === "fly") g.redStart -= 5;                 // finesse: tighter margin
          this.sim = new FightSim({
            weight: this.pending.weight, personality: this.pending.species.personality, gear: g,
          });
          if (this.method === "fly") this.sim.stamina *= 0.8;         // …but fish tire faster
          this.maxDistance = this.sim.distance;
          this.phase = "fighting";
          this.hud.hidePrompt();
          this.hud.showFight(`something's on… (${this.method})`);
          this.shadow.visible = true;
        } else if (this.hookLeft <= 0) {
          this.reset("missed it");
        }
        break;
      }
      case "fighting": {
        if (!this.sim || !this.pending) { this.reset(""); break; }
        this.sim.step(dt, this.space);
        const g = gearParams(this.getGearTiers());
        if (this.method === "fly") g.redStart -= 5;
        this.hud.updateFight(this.sim.tension, g.redStart, this.sim.distance, this.maxDistance);

        // fish position along the cast line + darting
        const frac = Math.max(0.05, this.sim.distance / this.maxDistance);
        const base = this.player.pos.clone().addScaledVector(this.castDir, this.castLen * frac);
        this.shadowAngle += dt * (this.sim.running ? 7 : 1.5);
        const dart = this.sim.running ? 1.6 : 0.4;
        this.shadow.position.set(
          base.x + Math.sin(this.shadowAngle) * dart,
          this.castPoint.y - 0.35,
          base.z + Math.cos(this.shadowAngle * 1.3) * dart,
        );
        this.shadow.rotation.y = this.shadowAngle;
        const size = 0.6 + this.pending.weight / 12;
        this.shadow.scale.set(1.4 * size, 0.18 * size, 0.5 * size);
        this.bobber.position.set(this.shadow.position.x, this.castPoint.y, this.shadow.position.z);
        this.splash.position.copy(this.bobber.position);
        this.splash.visible = this.sim.running;
        this.splash.scale.setScalar(1 + Math.sin(performance.now() / 90) * 0.3);

        this.player.camShake = this.sim.running ? 0.18 : this.sim.tension > 70 ? 0.07 : 0;
        audio.update(dt, this.space);
        audio.setRunning(this.sim.running, this.sim.tension);

        if (this.sim.state === "landed") { audio.chime(); this.finishCatch(); }
        else if (this.sim.state === "snapped") { audio.snap(); this.hud.flash("#e04434"); this.loseLure(); }
        else if (this.sim.state === "thrown") this.reset("it threw the hook");
        break;
      }
    }
    this.updateLineAndRod();
    this.spaceJustDown = false;
  }

  private updateLineAndRod() {
    const active = this.phase === "waiting" || this.phase === "hookset" || this.phase === "fighting";
    this.line.visible = active;
    const tension = this.sim?.tension ?? 20;
    this.rod.rotation.x = -0.9 - (tension / 100) * 0.5;               // rod bends with tension
    if (!active) return;
    const tip = new THREE.Vector3(0.35, 2.7, -0.5).applyMatrix4(this.player.body.matrixWorld);
    const end = this.bobber.position.clone();
    const mid = tip.clone().lerp(end, 0.5);
    mid.y -= (1 - tension / 100) * 1.6;                               // slack line sags
    this.lineGeo.setFromPoints([tip, mid, end]);
  }

  private tryCast() {
    if (this.method !== "float" && !this.currentLure()) {
      this.reset(`out of ${this.method} lures`); return;
    }
    const dist = 4 + (this.power / 100) * 21;
    this.castDir.set(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
    const target = this.player.pos.clone().addScaledVector(this.castDir, dist);
    const lvl = waterLevelAt(target.x, target.z);
    if (lvl === null) { this.reset("didn't land on water"); return; }
    this.castLen = dist;
    this.castPoint.set(target.x, lvl + 0.05, target.z);
    this.bobber.position.copy(this.castPoint);
    this.bobber.visible = true;
    const baseWait = biteWait();
    this.waitLeft = this.method === "fly" ? baseWait * 0.75 : baseWait;
    this.twitchLeft = 3;
    this.twitchWindow = 0;
    audio.splash();
    this.phase = "waiting";
  }

  private triggerBite() {
    const world = this.getWorld();
    const region = regionAt(this.castPoint.x, this.castPoint.z);
    const bite = sampleBite(this.getSpecies(), region, world, Math.random, this.getMethodMult(this.method));
    if (!bite) { this.reset("nothing biting here"); return; }
    this.pending = bite;
    let win = hookWindow(bite.species.rarity);
    if (this.method === "fly") win *= 0.6;                            // delicate takes
    this.hookLeft = win;
    this.phase = "hookset";
    this.bobber.position.y = this.castPoint.y - 0.25;
    this.splash.position.copy(this.castPoint);
    this.splash.visible = true;
    this.hud.showPrompt("!");
    audio.splash();
  }

  private async loseLure() {
    const lure = this.currentLure();
    if (lure && this.method !== "float") {
      void consumeLure(lure);
      this.onLureLost(lure);
      this.reset(`LINE SNAPPED — lost your ${lure}`);
    } else {
      this.reset("LINE SNAPPED — lost the lure");
    }
  }

  private async finishCatch() {
    const p = this.pending!;
    this.hud.hideFight();
    const region = regionAt(this.castPoint.x, this.castPoint.z);
    const res = await submitCatch(p.species.id, p.weight, p.pct, region);
    if (res.accepted) {
      this.onLanded(p.species, p.weight, res.value ?? 0, res.first_catch ?? false, res.record ?? false);
    } else {
      this.hud.toast(`rejected: ${res.reason}`);
    }
    this.reset("");
  }

  private reset(msg: string) {
    if (msg) this.hud.toast(msg);
    this.player.camShake = 0;
    audio.setRunning(false, 0);
    this.phase = "idle";
    this.pending = null;
    this.sim = null;
    this.bobber.visible = false;
    this.splash.visible = false;
    this.shadow.visible = false;
    this.hud.hidePrompt();
    this.hud.hideFight();
  }
}
