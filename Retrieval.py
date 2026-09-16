import sqlite3
import chromadb

def query_memory(symptom_description: str, top_k: int = 4):
    chroma_client = chromadb.PersistentClient(path="./chroma_db")
    collection = chroma_client.get_collection(name="dispensing_memory")

    # Semantic search in ChromaDB
    results = collection.query(
        query_texts=[symptom_description],
        n_results=top_k
    )

    matched_ids = results["ids"][0]
    matched_docs = results["documents"][0]

    # Query SQLite for verified causes and recommended actions
    conn = sqlite3.connect("dispensing_history.db")
    cursor = conn.cursor()
    placeholders = ",".join("?" * len(matched_ids))

    cursor.execute(f"""
        SELECT confirmed_cause, recommended_action, COUNT(*) as frequency 
        FROM cases 
        WHERE case_id IN ({placeholders}) 
        GROUP BY confirmed_cause 
        ORDER BY frequency DESC
    """, matched_ids)

    stats = cursor.fetchall()
    conn.close()

    total_matches = len(matched_ids)
    ranked_causes = [
        {
            "cause": row[0],
            "action": row[1],
            "count": row[2],
            "likelihood_pct": round((row[2] / total_matches) * 100)
        }
        for row in stats
    ]

    return {
        "matched_ids": matched_ids,
        "matched_docs": matched_docs,
        "ranked_causes": ranked_causes
    }