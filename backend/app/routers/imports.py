from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.card import Card, Synonym
from app.models.session import Session
from app.models.user import User
from app.services.import_parser import parse_import_file

router = APIRouter()


@router.post("/{session_id}/import")
async def import_cards(
    session_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if not (file.filename or "").lower().endswith((".csv", ".xlsx")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .csv and .xlsx files are allowed")

    contents = await file.read()
    try:
        rows = parse_import_file(contents, file.filename or "")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse file: {exc}") from exc

    created = 0
    for index, row in enumerate(rows, start=1):
        if not row.get("front_text") or not row.get("back_text"):
            continue

        card = Card(
            session_id=session_id,
            card_type=row.get("card_type", "vocab"),
            front_text=row["front_text"],
            front_phonetic=row.get("front_phonetic"),
            back_text=row["back_text"],
            example=row.get("example"),
            position=index,
        )
        db.add(card)
        await db.flush()

        for synonym in row.get("synonyms", []):
            db.add(Synonym(card_id=card.id, word=synonym["word"], phonetic=synonym.get("phonetic")))

        created += 1

    await db.commit()
    return {"created": created, "total_rows": len(rows)}
