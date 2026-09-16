import streamlit as st
import pandas as pd
import sqlite3
import chromadb
from Retrieval import query_memory
from Bridge import run_rag_diagnosis

st.set_page_config(page_title="NSW Defect Detective", layout="wide")
st.title("AI Dispensing Defect Detective")
st.caption("Intelligent Defect Diagnosis & Historical Retrieval Engine")

left_col, right_col = st.columns([1, 1])

with left_col:
    st.subheader("1. Defect Intake")
    uploaded_file = st.file_uploader("Upload Inspection Image (Person 1 Vision)", type=["jpg", "png"])
    material = st.selectbox("Fluid Material", ["Epoxy", "Solder Paste", "Sealant"])
    user_symptom = st.text_area(
        "Operator Symptom Description",
        value="Glue dots are tiny, skipping every few shots, and nozzle looks crusty"
    )

    st.subheader("2. Troubleshooting Context (Person 2 Flow)")
    q1 = st.radio("Defect Frequency", ["Occasional / Intermittent", "Continuous / Every Dot"])
    q2 = st.radio("Recent Changes", ["No changes to pressure or syringe", "Recently changed fluid lot / needle"])

    diagnose_btn = st.button("Run Diagnostic Engine", type="primary")

# 2. Right column where the RAG retrieval + LLM output renders
with right_col:
    st.subheader("3. AI Diagnosis & Memory Evidence")

    if diagnose_btn:
        with st.spinner("Querying factory memory & generating LLM diagnosis..."):
            # 1. RETRIEVE: Query ChromaDB & SQLite
            rag_data = query_memory(user_symptom, top_k=4)

            # 2. AUGMENT & GENERATE: Pass retrieved evidence directly to Person 2's LLM
            llm_output = run_rag_diagnosis(
                symptom=user_symptom,
                material=material,
                q_freq=q1,
                q_changes=q2,
                retrieved_rag_data=rag_data
            )

        st.success("Diagnostic Retrieval Successful")

        # Top Metric Card
        top_cause = rag_data["ranked_causes"][0] if rag_data["ranked_causes"] else {"cause": "Unknown", "likelihood_pct": 0}
        st.metric(
            label="Top Suspected Root Cause",
            value=top_cause["cause"],
            delta=f"{top_cause['likelihood_pct']}% Likelihood"
        )

        # Person 2's LLM Narrative Assessment
        st.markdown("#### AI Root Cause Assessment")
        st.write(llm_output["assessment"])

        # Historical Probability Breakdown Table
        st.markdown("#### Ranked Likelihood Scores")
        table_df = pd.DataFrame([
            {
                "Suspected Cause": item["cause"],
                "Historical Frequency": f"{item['count']}/4 matches",
                "Likelihood": f"{item['likelihood_pct']}%"
            }
            for item in rag_data.get("ranked_causes", [])
        ])
        st.table(table_df)

        # Grounding Tickets
        st.info(f"**Evidence Grounding:** Matched ticket IDs: `{', '.join(rag_data['matched_ids'])}`.")

        # Person 2's LLM SOP Plan
        st.markdown("#### LLM Recommended Action Plan (SOP)")
        for i, step in enumerate(llm_output.get("sop_steps", []), 1):
            st.markdown(f"**Step {i}:** {step}")

# Bonus Challenge 3: Write back to memory
st.divider()
st.subheader("Bonus Challenge 3: Log Verified Resolution to Memory")
with st.expander("Record a newly resolved defect into the knowledge base"):
    with st.form("new_case_form"):
        f_id = st.text_input("Case ID", value="NSW-13")
        f_mat = st.selectbox("Material", ["Epoxy", "Solder Paste", "Sealant"], key="f_mat")
        f_defect = st.text_input("Defect Name", value="Needle Stringing")
        f_symptom = st.text_area("Observed Symptom Description")
        f_cause = st.text_input("Verified Root Cause")
        f_action = st.text_input("Verified Action Taken")
        submit_case = st.form_submit_button("Save to Long-Term Memory")

        if submit_case:
            conn = sqlite3.connect("dispensing_history.db")
            cur = conn.cursor()
            cur.execute("INSERT OR REPLACE INTO cases VALUES (?, ?, ?, ?, ?)",
                        (f_id, f_mat, f_defect, f_cause, f_action))
            conn.commit()
            conn.close()

            chroma_client = chromadb.PersistentClient(path="./chroma_db")
            col = chroma_client.get_collection("dispensing_memory")
            col.add(ids=[f_id], documents=[f_symptom], metadatas=[{"cause": f_cause, "material": f_mat}])

            st.success(f"Case {f_id} permanently saved into vector memory and SQL history!")