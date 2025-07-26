#!/bin/bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m http.server 8080 --bind 0.0.0.0
