import sqlite3
import chromadb

def setup_databases():
    # 1. Structured SQL Database
    conn = sqlite3.connect("dispensing_history.db")
    cursor = conn.cursor()
    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS cases (
                                                        case_id TEXT PRIMARY KEY,
                                                        material TEXT,
                                                        defect_type TEXT,
                                                        confirmed_cause TEXT,
                                                        recommended_action TEXT
                   )
                   """)

    # 2. Vector Database
    chroma_client = chromadb.PersistentClient(path="./chroma_db")
    # Reset or get collection
    try:
        chroma_client.delete_collection("dispensing_memory")
    except Exception:
        pass
    collection = chroma_client.create_collection(name="dispensing_memory")

    # 3. 12 realistic industrial dispensing cases
    cases = [
        # Air Bubble issues
        {"id": "NSW-01", "material": "Epoxy", "defect": "Inconsistent Volume",
         "symptoms": "Dots are undersized intermittently during long shift runs with occasional dry shots.",
         "cause": "Air Bubble", "action": "Purge syringe barrel to remove entrapped microbubbles."},
        {"id": "NSW-02", "material": "Epoxy", "defect": "Inconsistent Volume",
         "symptoms": "Intermittent dot dropouts, syringe pressure fluctuating, missing dots every 10 cycles.",
         "cause": "Air Bubble", "action": "Degas adhesive cartridge and inspect air feed line."},
        {"id": "NSW-03", "material": "Sealant", "defect": "Inconsistent Volume",
         "symptoms": "Popping sound at dispense tip followed by partial dot formation.",
         "cause": "Air Bubble", "action": "Bleed valve manifold and re-prime fluid line."},

        # Nozzle Clog issues
        {"id": "NSW-04", "material": "Solder Paste", "defect": "Missing Dots",
         "symptoms": "Complete missing dots and tiny dry deposits with crust visible around needle tip.",
         "cause": "Nozzle Blockage", "action": "Ultrasonic clean nozzle needle or replace tip."},
        {"id": "NSW-05", "material": "Solder Paste", "defect": "Undersized Dots",
         "symptoms": "Dot diameter progressively shrinking over two hours, needle orifice restricted.",
         "cause": "Nozzle Blockage", "action": "Flush tip with solvent wipe and replace 27G needle."},
        {"id": "NSW-06", "material": "Epoxy", "defect": "Tail / Stringing",
         "symptoms": "Needle dragging glue strings between pads, dried residue sticking to tip outer wall.",
         "cause": "Nozzle Blockage", "action": "Clean outer tip bevel and inspect for mechanical burrs."},

        # Viscosity & Temperature Drift
        {"id": "NSW-07", "material": "Epoxy", "defect": "Material Spreading",
         "symptoms": "Glue is watery and spreads excessively past bonding pads, bead diameter too large.",
         "cause": "Viscosity Drift", "action": "Check cleanroom ambient temperature and pot-life timer."},
        {"id": "NSW-08", "material": "Epoxy", "defect": "Slump / Spreading",
         "symptoms": "Dot profile collapsing flat immediately after dispense cycle.",
         "cause": "Viscosity Drift", "action": "Verify material thaw time was at least 60 minutes."},
        {"id": "NSW-09", "material": "Sealant", "defect": "Heavy Dispense",
         "symptoms": "Overdispensing across all pads despite standard program timer settings.",
         "cause": "Viscosity Drift", "action": "Recalibrate fluid temperature controller to 23°C target."},

        # Pressure & Calibration Drift
        {"id": "NSW-10", "material": "Solder Paste", "defect": "Missing Dots",
         "symptoms": "Total dispense failure across multiple consecutive boards, zero paste dispensed.",
         "cause": "Pressure Regulator Fault", "action": "Check main pneumatic supply pressure gauge and regulator."},
        {"id": "NSW-11", "material": "Epoxy", "defect": "Undersized Dots",
         "symptoms": "Uniform small dots across all components, line pressure reading dropped below 2.0 bar.",
         "cause": "Pressure Regulator Fault", "action": "Restore regulator to 2.8 bar specification."},
        {"id": "NSW-12", "material": "Epoxy", "defect": "Irregular Shape",
         "symptoms": "Dots oval instead of circular, needle height scraping substrate surface.",
         "cause": "Standoff Height Error", "action": "Perform optical z-height recalibration and gap check."}
    ]

    for c in cases:
        cursor.execute("INSERT OR REPLACE INTO cases VALUES (?, ?, ?, ?, ?)",
                       (c["id"], c["material"], c["defect"], c["cause"], c["action"]))
        collection.add(
            ids=[c["id"]],
            documents=[c["symptoms"]],
            metadatas=[{"cause": c["cause"], "material": c["material"]}]
        )

    conn.commit()
    conn.close()
    print("Memory database updated with 12 rich defect cases!")

if __name__ == "__main__":
    setup_databases()