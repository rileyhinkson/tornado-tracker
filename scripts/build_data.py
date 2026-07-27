#!/usr/bin/env python3
"""
Parse the raw NOAA SPC tornado database CSV (data-source/spc_tornadoes.csv)
into clean per-year JSON files under data/years/<year>.json, plus a
data/index.json summary used to build the homepage table of contents.

Source: NOAA Storm Prediction Center Severe Weather Database
        https://www.spc.noaa.gov/wcm/#data
Column spec: SPC_severe_database_description.pdf (SPC, last updated 2010-04-07,
             fc field added 2016)
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_CSV = ROOT / "data-source" / "spc_tornadoes.csv"
YEARS_DIR = ROOT / "data" / "years"
INDEX_JSON = ROOT / "data" / "index.json"

STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
    "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska",
    "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina",
    "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon",
    "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
    "DC": "District of Columbia", "PR": "Puerto Rico", "VI": "Virgin Islands",
}

# Pre-1996 `loss` field: coded property-damage category, not a dollar figure.
LOSS_CATEGORY = {
    "0": "Unknown", "": "Unknown",
    "1": "Under $50", "2": "$50 - $500", "3": "$500 - $5,000",
    "4": "$5,000 - $50,000", "5": "$50,000 - $500,000",
    "6": "$500,000 - $5,000,000", "7": "$5,000,000 - $50,000,000",
    "8": "$50,000,000 - $500,000,000", "9": "$500,000,000+",
}


def magnitude_label(mag, year):
    if mag == "-9" or mag == "":
        return "Unrated"
    scale = "F" if year < 2007 else "EF"
    return f"{scale}{mag}"


def format_loss(loss, year):
    if year < 1996:
        return LOSS_CATEGORY.get(loss.strip(), "Unknown")
    try:
        millions = float(loss)
    except ValueError:
        return "Unknown"
    if millions <= 0:
        return "Unknown"
    dollars = millions * 1_000_000
    if dollars >= 1_000_000_000:
        return f"${dollars / 1_000_000_000:.2f}B"
    if dollars >= 1_000_000:
        return f"${dollars / 1_000_000:.2f}M"
    return f"${dollars:,.0f}"


def coord(value):
    try:
        f = float(value)
    except ValueError:
        return None
    return f if f != 0.0 else None


def build():
    years = {}

    with SOURCE_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            year = int(row["yr"])
            state_abbr = row["st"].strip()
            mag = row["mag"].strip()

            record = {
                "id": f"{year}-{row['om']}",
                "date": row["date"],
                "time": row["time"],
                "state": state_abbr,
                "stateName": STATE_NAMES.get(state_abbr, state_abbr),
                "magnitude": magnitude_label(mag, year),
                "magnitudeRaw": mag,
                "injuries": int(row["inj"] or 0),
                "fatalities": int(row["fat"] or 0),
                "propertyLoss": format_loss(row["loss"], year),
                "lengthMiles": float(row["len"] or 0),
                "widthYards": float(row["wid"] or 0),
                "startLat": coord(row["slat"]),
                "startLon": coord(row["slon"]),
                "endLat": coord(row["elat"]),
                "endLon": coord(row["elon"]),
            }
            years.setdefault(year, []).append(record)

    YEARS_DIR.mkdir(parents=True, exist_ok=True)
    index = {}

    for year, records in sorted(years.items()):
        records.sort(key=lambda r: (r["date"], r["time"]))
        out_path = YEARS_DIR / f"{year}.json"
        out_path.write_text(json.dumps(records, indent=2), encoding="utf-8")

        rated = [r["magnitudeRaw"] for r in records if r["magnitudeRaw"] not in ("-9", "")]
        strongest = magnitude_label(max(rated, key=int), year) if rated else "Unrated"

        index[str(year)] = {
            "count": len(records),
            "fatalities": sum(r["fatalities"] for r in records),
            "injuries": sum(r["injuries"] for r in records),
            "strongest": strongest,
        }

    INDEX_JSON.write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"Wrote {len(years)} year files and index.json "
          f"({sum(v['count'] for v in index.values())} total tornado records)")


if __name__ == "__main__":
    build()
