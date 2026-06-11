"""SQLite persistence — per-player saves keyed by client token (localStorage uuid)."""
import json
import os
import sqlite3
import time

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE,
    name TEXT DEFAULT 'angler',
    money INTEGER,
    gear TEXT DEFAULT '[]',          -- json list of catalog ids
    lures TEXT DEFAULT '{}',         -- json {lure_id: count}
    creel TEXT DEFAULT '[]',         -- json list of {species, weight, pct, value}
    creel_slots INTEGER,
    pos TEXT DEFAULT '[0,-700]',
    created INTEGER, seen INTEGER
);
CREATE TABLE IF NOT EXISTS catches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player INTEGER, species INTEGER, weight REAL, pct REAL,
    region INTEGER, conditions TEXT, ts INTEGER
);
CREATE INDEX IF NOT EXISTS idx_catches_player_species ON catches(player, species);
CREATE TABLE IF NOT EXISTS world (
    id INTEGER PRIMARY KEY CHECK (id=1),
    clock_epoch REAL, weather_seed INTEGER
);
"""

LEGACY_TOKEN = "legacy"   # pre-token saves (the original single player row) live under this


def connect():
    os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    # migrate: pre-token players table had no token/lures columns
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(players)")}
    if "token" not in cols:
        conn.execute("ALTER TABLE players ADD COLUMN token TEXT")
        conn.execute("UPDATE players SET token=? WHERE token IS NULL", (LEGACY_TOKEN,))
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_players_token ON players(token)")
    if "lures" not in cols:
        conn.execute("ALTER TABLE players ADD COLUMN lures TEXT DEFAULT '{}'")
    now = time.time()
    conn.execute(
        "INSERT OR IGNORE INTO world (id, clock_epoch, weather_seed) VALUES (1, ?, ?)",
        (now, config.WEATHER_SEED_DEFAULT))
    conn.commit()
    return conn


def _row_to_player(p):
    return {
        "id": p["id"],
        "money": p["money"],
        "gear": json.loads(p["gear"]),
        "lures": json.loads(p["lures"] or "{}"),
        "creel": json.loads(p["creel"]),
        "creel_slots": p["creel_slots"],
        "pos": json.loads(p["pos"]),
    }


def get_player(conn, token):
    """Fetch-or-create the save for a client token."""
    token = (token or LEGACY_TOKEN)[:64]
    p = conn.execute("SELECT * FROM players WHERE token=?", (token,)).fetchone()
    if p is None:
        now = int(time.time())
        conn.execute(
            "INSERT INTO players (token, money, creel_slots, created, seen) VALUES (?,?,?,?,?)",
            (token, config.START_MONEY, config.START_CREEL, now, now))
        conn.commit()
        p = conn.execute("SELECT * FROM players WHERE token=?", (token,)).fetchone()
    return _row_to_player(p)


def save_player(conn, player):
    conn.execute(
        "UPDATE players SET money=?, gear=?, lures=?, creel=?, creel_slots=?, pos=?, seen=? WHERE id=?",
        (player["money"], json.dumps(player["gear"]), json.dumps(player["lures"]),
         json.dumps(player["creel"]), player["creel_slots"], json.dumps(player["pos"]),
         int(time.time()), player["id"]))
    conn.commit()


def get_world_row(conn):
    return conn.execute("SELECT * FROM world WHERE id=1").fetchone()


def record_catch(conn, player_id, species_id, weight, pct, region, conditions):
    conn.execute(
        "INSERT INTO catches (player, species, weight, pct, region, conditions, ts) VALUES (?,?,?,?,?,?,?)",
        (player_id, species_id, weight, pct, region, json.dumps(conditions), int(time.time())))
    conn.commit()


def is_first_catch(conn, player_id, species_id):
    return conn.execute(
        "SELECT COUNT(*) c FROM catches WHERE player=? AND species=?", (player_id, species_id)
    ).fetchone()["c"] == 0


def best_weight(conn, player_id, species_id):
    row = conn.execute(
        "SELECT MAX(weight) m FROM catches WHERE player=? AND species=?", (player_id, species_id)
    ).fetchone()
    return row["m"]


def last_catch_ts(conn, player_id):
    row = conn.execute("SELECT MAX(ts) m FROM catches WHERE player=?", (player_id,)).fetchone()
    return row["m"]


def collection_log(conn, player_id):
    rows = conn.execute(
        """SELECT species, COUNT(*) n, MAX(weight) best, MIN(ts) first_ts
           FROM catches WHERE player=? GROUP BY species""", (player_id,)).fetchall()
    return {r["species"]: {"n": r["n"], "best": r["best"], "first_ts": r["first_ts"]} for r in rows}
