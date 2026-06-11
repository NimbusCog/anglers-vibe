/** Fishing orchestrator: idle → casting(power) → waiting → hookset → fighting → result.
 *  SPACE drives everything: hold to power cast, tap to set hook, hold to reel. */
import * as THREE from "three";
import { waterLevelAt } from "../world/heightmap";
import { regionAt } from "../world/regions";
import type { PlayerController } from "../player/controller";
import type { Hud } from "../ui/hud";
import type { SpeciesDef, WorldState } from "../net/api";
import { submitCatch } from "../net/api";
import { biteWait, hookWindow, sampleBite } from "./bite";
import { FightSim, gearParams } from "./fight";
import { audio } from "../audio";

type Phase = "idle" | "casting" | "waiting" | "hookset" | "fighting";

export class Fishing {
  phase: Phase = "idle";
  private power = 0;
  private bobber: THREE.Mesh;
  private splash: THREE.Mesh;
  private castDir = new THREE.Vector3();
  private castPoint = new THREE.Vector3();
  private waitLeft = 0;
  private hookLeft = 0;
  private pending: { species: SpeciesDef; weight: number; pct: number } | null = null;
  private sim: FightSim | null = null;
  private maxDistance = 1;
  private space = false;
  private spaceJustDown = false;

  constructor(
    private scene: THREE.Scene,
    private player: PlayerController,
    private hud: Hud,
    private getWorld: () => WorldState,
    private getSpecies: () => SpeciesDef[],
    private getGearTiers: () => { rod: number; reel: number; line: number },
    private onLanded: (speciesName: string, weight: number, value: number, first: boolean) => void,
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
    scene.add(this.bobber, this.splash);

    addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.code === "Space") { if (!this.space) this.spaceJustDown = true; this.space = true; e.preventDefault(); }
    });
    addEventListener("keyup", (e: KeyboardEvent) => { if (e.code === "Space") this.space = false; });
  }

  get busy() { return this.phase !== "idle"; }

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
        this.waitLeft -= dt;
        if (this.spaceJustDown) { this.reset("reeled in early"); break; }
        if (this.waitLeft <= 0) {
          const world = this.getWorld();
          const region = regionAt(this.castPoint.x, this.castPoint.z);
          const bite = sampleBite(this.getSpecies(), region, world);
          if (!bite) { this.reset("nothing biting here"); break; }
          this.pending = bite;
          this.hookLeft = hookWindow(bite.species.rarity);
          this.phase = "hookset";
          this.bobber.position.y = this.castPoint.y - 0.25;          // dip!
          this.splash.position.copy(this.castPoint);
          this.splash.visible = true;
          this.hud.showPrompt("!");
          audio.splash();
        }
        break;
      }
      case "hookset": {
        this.hookLeft -= dt;
        if (this.spaceJustDown && this.pending) {
          const g = gearParams(this.getGearTiers());
          this.sim = new FightSim({ weight: this.pending.weight, personality: this.pending.species.personality, gear: g });
          this.maxDistance = this.sim.distance;
          this.phase = "fighting";
          this.hud.hidePrompt();
          this.hud.showFight("something's on…");
        } else if (this.hookLeft <= 0) {
          this.reset("missed it");
        }
        break;
      }
      case "fighting": {
        if (!this.sim || !this.pending) { this.reset(""); break; }
        this.sim.step(dt, this.space);
        const g = gearParams(this.getGearTiers());
        this.hud.updateFight(this.sim.tension, g.redStart, this.sim.distance, this.maxDistance);
        // bobber tracks the fish along the cast line
        const frac = Math.max(0.05, this.sim.distance / this.maxDistance);
        this.bobber.position.copy(this.player.pos).addScaledVector(this.castDir, this.castLen * frac);
        this.bobber.position.y = this.castPoint.y;
        this.splash.position.copy(this.bobber.position);
        this.splash.visible = this.sim.running;
        this.splash.scale.setScalar(1 + Math.sin(performance.now() / 90) * 0.3);
        this.player.camShake = this.sim.running ? 0.18 : this.sim.tension > 70 ? 0.07 : 0;
        audio.update(dt, this.space);
        audio.setRunning(this.sim.running, this.sim.tension);

        if (this.sim.state === "landed") { audio.chime(); this.finishCatch(); }
        else if (this.sim.state === "snapped") { audio.snap(); this.reset("LINE SNAPPED — lost the lure"); }
        else if (this.sim.state === "thrown") this.reset("it threw the hook");
        break;
      }
    }
    this.spaceJustDown = false;
  }

  private castLen = 0;

  private tryCast() {
    const dist = 4 + (this.power / 100) * 21;                      // 4–25 m
    this.castDir.set(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
    const target = this.player.pos.clone().addScaledVector(this.castDir, dist);
    const lvl = waterLevelAt(target.x, target.z);
    if (lvl === null) { this.reset("didn't land on water"); return; }
    this.castLen = dist;
    this.castPoint.set(target.x, lvl + 0.05, target.z);
    this.bobber.position.copy(this.castPoint);
    this.bobber.visible = true;
    this.waitLeft = biteWait();
    this.phase = "waiting";
  }

  private async finishCatch() {
    const p = this.pending!;
    this.hud.hideFight();
    const region = regionAt(this.castPoint.x, this.castPoint.z);
    const res = await submitCatch(p.species.id, p.weight, p.pct, region);
    if (res.accepted) {
      this.onLanded(p.species.name, p.weight, res.value ?? 0, res.first_catch ?? false);
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
    this.hud.hidePrompt();
    this.hud.hideFight();
  }
}
