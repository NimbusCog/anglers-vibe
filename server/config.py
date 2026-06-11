"""Anglers Vibe server config."""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# DB_DIR override lets Railway point at a mounted volume (e.g. /data) so saves survive deploys
DB_PATH = os.path.join(os.environ.get("DB_DIR", os.path.join(BASE_DIR, "data")), "anglers.db")
CLIENT_DIST = os.path.join(os.path.dirname(BASE_DIR), "client", "dist")

PORT = int(os.environ.get("PORT", 8801))
DAY_SECONDS = 1200          # 20 real minutes per game day
MIN_CATCH_INTERVAL = 10     # seconds between accepted catches (anti-cheat)
START_MONEY = 20
START_CREEL = 6
WEATHER_SEED_DEFAULT = 20260610
