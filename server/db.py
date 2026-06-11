"""SQLite persistence — single-player v1 (player id=1), schema co-op-ready."""
import json
import os
import sqlite3
import time

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    name TEXT DEFAULT 'angler',
    money INTEGER,
    gear TEXT DEFAULT '[]',          -- json list of catalog ids
    creel TEXT DEFAULT '[]',         -- json list of {species, weight, pct, value_est}
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


def connect():
    os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    now = time.time()
    conn.execute(
        "INSERT OR IGNORE INTO world (id, clock_epoch, weather_seed) VALUES (1, ?, ?)",
        (now, config.WEATHER_SEED_DEFAULT))
    conn.execute(
        """INSERT OR IGNORE INTO players (id, money, creel_slots, created, seen)
           VALUES (1, ?, ?, ?, ?)""",
        (config.START_MONEY, config.START_CREEL, int(now), int(now)))
    conn.commit()
    return conn


def get_world_row(conn):
    return conn.execute("SELECT * FROM world WHERE id=1").fetchone()


def get_player(conn):
    p = conn.execute("SELECT * FROM players WHERE id=1").fetchone()
    return {
        "money": p["money"],
        "gear": json.loads(p["gear"]),
        "creel": json.loads(p["creel"]),
        "creel_slots": p["creel_slots"],
        "pos": json.loads(p["pos"]),
    }


def save_player(conn, player):
    conn.execute(
        "UPDATE players SET money=?, gear=?, creel=?, creel_slots=?, pos=?, seen=? WHERE id=1",
        (player["money"], json.dumps(player["gear"]), json.dumps(player["creel"]),
         player["creel_slots"], json.dumps(player["pos"]), int(time.time())))
    conn.commit()


def record_catch(conn, species_id, weight, pct, region, conditions):
    conn.execute(
        "INSERT INTO catches (player, species, weight, pct, region, conditions, ts) VALUES (1,?,?,?,?,?,?)",
        (species_id, weight, pct, region, json.dumps(conditions), int(time.time())))
    conn.commit()


def is_first_catch(conn, species_id):
    return conn.execute(
        "SELECT COUNT(*) c FROM catches WHERE player=1 AND species=?", (species_id,)
    ).fetchone()["c"] == 0


def last_catch_ts(conn):
    row = conn.execute("SELECT MAX(ts) m FROM catches WHERE player=1").fetchone()
    return row["m"]


def collection_log(conn):
    rows = conn.execute(
        """SELECT species, COUNT(*) n, MAX(weight) best, MIN(ts) first_ts
           FROM catches WHERE player=1 GROUP BY species""").fetchall()
    return {r["species"]: {"n": r["n"], "best": r["best"], "first_ts": r["first_ts"]} for r in rows}
