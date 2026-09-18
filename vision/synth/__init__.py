"""Synthetic dispensing-defect image generator.

Four independent stages, so 17 defect classes across 5 pattern types compose
instead of being hand-enumerated:

    layouts   -- where dots nominally go, and the order they'd be dispensed in
    spec      -- the per-dot record every stage reads and writes
    defects   -- operators that mutate a subset of dots; compose by sequencing
    render    -- turns the final dot list into a grayscale image
    dataset   -- ties the above together, picks compatible defect sets, writes
                 an image + a per-dot ground-truth JSON sidecar per sample
"""
