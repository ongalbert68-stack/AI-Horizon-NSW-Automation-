from dataclasses import asdict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import case as cases_crud
from app.domains.intake.spec import IMAGE_ONLY_SIGNATURE_VALUE
from app.domains.vision.schema import VisionResultOut
from app.domains.vision.service import run_vision

router = APIRouter(prefix="/cases/{case_id}/vision", tags=["Vision (step 3)"])


@router.post(
    "",
    response_model=VisionResultOut,
    summary="Analyse a dispense photo",
    description=(
        "Runs vision/detect/ against the uploaded photo using this case's own "
        "profile geometry as the expected layout. Quality gate first: an "
        "unmeasurable image reports why and leaves the fingerprint's signals "
        "empty rather than feeding both ranking passes a false measurement. "
        "On success, folds the derived signals into the case's fingerprint and, "
        "only above chance, adds the image-only carryover signature."
    ),
)
async def analyse_photo(
    case_id: int, photo: UploadFile = File(...), db: Session = Depends(get_db)
) -> VisionResultOut:
    case = cases_crud.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Case {case_id} not found")

    raw = await photo.read()
    result = run_vision(raw, case.profile.geometry, case.profile.spec_limit)

    fingerprint = case.fingerprint or {"axes": {}, "signals": {}}
    fingerprint.setdefault("axes", {})
    fingerprint.setdefault("signals", {})
    fingerprint["signals"].update(result.signals)

    if result.small_then_big_above_chance:
        signature = fingerprint["axes"].setdefault("signature", [])
        if IMAGE_ONLY_SIGNATURE_VALUE not in signature:
            signature.append(IMAGE_ONLY_SIGNATURE_VALUE)

    case.fingerprint = fingerprint
    case.vision_result = {
        "quality_ok": result.quality_ok,
        "quality_reason": result.quality_reason,
        "magnitude": result.magnitude,
        # Kept so a reload mid-interview can still open axis 1 pre-filled
        # rather than losing what the photo already answered.
        "suggested_signature": result.suggested_signature,
        "cv_output": result.cv_output,
    }
    db.commit()

    return VisionResultOut(**{k: v for k, v in asdict(result).items() if k in VisionResultOut.model_fields})
