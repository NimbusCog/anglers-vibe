"""Anglers Vibe server — static client + REST API + WS world ticks."""
import asyncio
import json
import logging
import os
import sys
import time

from aiohttp import web, WSMsgType

import config
import db
import economy
import species
import validate
import world

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                    stream=sys.stdout)
log = logging.getLogger("anglers")

WS_CLIENTS: set = set()


def player_token(request):
    return request.headers.get("X-Player") or request.query.get("player") or "legacy"


def world_snap(conn):
    w = db.get_world_row(conn)
    return world.snapshot(time.time(), w["clock_epoch"], w["weather_seed"])


def daily_want(conn):
    """One species at 3x today — deterministic per game day, drawn from unlocked-ish pool."""
    w = db.get_world_row(conn)
    day, _ = world.game_time(time.time(), w["clock_epoch"])
    ids = [sp["id"] for sp in species.SPECIES if sp["rarity"] in ("common", "uncommon")]
    return ids[(day * 7 + 3) % len(ids)]


async def api_state(request):
    conn = request.app["db"]
    player = db.get_player(conn, player_token(request))
    return web.json_response({
        "player": player,
        "world": world_snap(conn),
        "want": daily_want(conn),
        "log": db.collection_log(conn, player["id"]),
        "species": [{k: v for k, v in sp.items()} for sp in species.SPECIES],
        "method_mult": species.METHOD_MULT,
        "catalog": economy.CATALOG,
    })


async def api_catch(request):
    conn = request.app["db"]
    body = await request.json()
    sid, weight, pct, region = (body.get("species_id"), float(body.get("weight", 0)),
                                float(body.get("pct", 0.5)), int(body.get("region", 1)))
    snap = world_snap(conn)
    player = db.get_player(conn, player_token(request))
    ok, reason = validate.validate_catch(sid, weight, region, snap, db.last_catch_ts(conn, player["id"]), time.time())
    if not ok:
        log.warning(f"catch rejected: {reason} (sp={sid} w={weight} r={region})")
        return web.json_response({"accepted": False, "reason": reason})
    if len(player["creel"]) >= player["creel_slots"]:
        return web.json_response({"accepted": False, "reason": "creel full"})
    first = db.is_first_catch(conn, player["id"], sid)
    prev_best = db.best_weight(conn, player["id"], sid)
    value = economy.catch_value(sid, pct, first, daily_want(conn))
    player["creel"].append({"species": sid, "weight": weight, "pct": pct, "value": value})
    db.record_catch(conn, player["id"], sid, weight, pct, region, snap)
    db.save_player(conn, player)
    log.info(f"catch: {species.BY_ID[sid]['name']} {weight}kg ${value} first={first}")
    return web.json_response({"accepted": True, "first_catch": first, "value": value,
                              "record": prev_best is None or weight > prev_best,
                              "prev_best": prev_best, "creel": player["creel"]})


async def api_sell(request):
    conn = request.app["db"]
    player = db.get_player(conn, player_token(request))
    total = sum(item["value"] for item in player["creel"])
    sold = player["creel"]
    player["money"] += total
    player["creel"] = []
    db.save_player(conn, player)
    log.info(f"sold {len(sold)} fish for ${total}")
    return web.json_response({"sold": len(sold), "total": total, "money": player["money"]})


async def api_buy(request):
    conn = request.app["db"]
    body = await request.json()
    item_id = body.get("item_id")
    item = economy.CATALOG.get(item_id)
    if item is None:
        return web.json_response({"ok": False, "reason": "no such item"})
    player = db.get_player(conn, player_token(request))
    if item["kind"] != "lure" and item_id in player["gear"]:
        return web.json_response({"ok": False, "reason": "already owned"})
    if player["money"] < item["price"]:
        return web.json_response({"ok": False, "reason": "not enough money"})
    player["money"] -= item["price"]
    if item["kind"] == "lure":
        player["lures"][item_id] = player["lures"].get(item_id, 0) + 1
    else:
        player["gear"].append(item_id)
    if item["kind"] == "creel":
        player["creel_slots"] = item["slots"]
    db.save_player(conn, player)
    log.info(f"bought {item_id} for ${item['price']}")
    return web.json_response({"ok": True, "money": player["money"], "gear": player["gear"],
                              "lures": player["lures"], "creel_slots": player["creel_slots"]})


async def api_rest(request):
    """Campfire rest: jump the world clock to dawn/dusk/night."""
    conn = request.app["db"]
    body = await request.json()
    target = body.get("to")
    if target not in world.REST_TARGETS:
        return web.json_response({"ok": False, "reason": "bad target"})
    w = db.get_world_row(conn)
    new_epoch = world.epoch_for_rest(time.time(), w["clock_epoch"], target)
    conn.execute("UPDATE world SET clock_epoch=? WHERE id=1", (new_epoch,))
    conn.commit()
    snap = world_snap(conn)
    log.info(f"rest -> {target} (now {snap['phase']})")
    return web.json_response({"ok": True, "world": snap})


async def api_consume(request):
    """Lure lost (line snap) or spent — server-authoritative inventory."""
    conn = request.app["db"]
    body = await request.json()
    lure_id = body.get("lure_id")
    player = db.get_player(conn, player_token(request))
    n = player["lures"].get(lure_id, 0)
    if n <= 0:
        return web.json_response({"ok": False, "lures": player["lures"]})
    player["lures"][lure_id] = n - 1
    db.save_player(conn, player)
    return web.json_response({"ok": True, "lures": player["lures"]})


async def api_pos(request):
    conn = request.app["db"]
    body = await request.json()
    player = db.get_player(conn, player_token(request))
    player["pos"] = [float(body.get("x", 0)), float(body.get("z", -700))]
    db.save_player(conn, player)
    return web.json_response({"ok": True})


async def ws_handler(request):
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    WS_CLIENTS.add(ws)
    try:
        async for msg in ws:
            if msg.type == WSMsgType.ERROR:
                break
    finally:
        WS_CLIENTS.discard(ws)
    return ws


async def world_ticker(app):
    """Push world snapshot every 5s so the client sky tracks server truth."""
    conn = app["db"]
    try:
        while True:
            snap = world_snap(conn)
            dead = set()
            for ws in WS_CLIENTS:
                try:
                    await ws.send_json({"type": "world", "world": snap})
                except Exception:
                    dead.add(ws)
            WS_CLIENTS.difference_update(dead)
            await asyncio.sleep(5)
    except asyncio.CancelledError:
        pass


async def on_startup(app):
    app["ticker"] = asyncio.create_task(world_ticker(app))


async def on_cleanup(app):
    app["ticker"].cancel()


def make_app():
    app = web.Application()
    app["db"] = db.connect()
    app.router.add_get("/api/state", api_state)
    app.router.add_post("/api/catch", api_catch)
    app.router.add_post("/api/sell", api_sell)
    app.router.add_post("/api/buy", api_buy)
    app.router.add_post("/api/pos", api_pos)
    app.router.add_post("/api/consume", api_consume)
    app.router.add_post("/api/rest", api_rest)
    app.router.add_get("/ws", ws_handler)
    candidates = [
        config.CLIENT_DIST,
        "/app/client/dist",
        os.path.join(os.getcwd(), "client", "dist"),
    ]
    dist = next((p for p in candidates if os.path.isdir(p)), None)
    log.info(f"static dist resolved: {dist} (cwd={os.getcwd()}, candidates checked={candidates})")
    if dist:
        app.router.add_get("/", lambda r: web.FileResponse(os.path.join(dist, "index.html")))
        app.router.add_static("/", dist)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


if __name__ == "__main__":
    log.info(f"Anglers Vibe server on :{config.PORT}")
    web.run_app(make_app(), port=config.PORT, print=None)
