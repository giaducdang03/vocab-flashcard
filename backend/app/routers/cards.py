from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from io import BytesIO
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.card import Card, Synonym
from app.models.session import Session
from app.models.user import User
from app.schemas.card import CardCreate, CardOut, CardUpdate, LearnedToggleRequest

router = APIRouter()


@router.post("/sessions/{session_id}/cards", response_model=CardOut)
async def create_card(
    session_id: str,
    payload: CardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CardOut:
    from sqlalchemy.orm import selectinload

    session = await db.get(Session, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    card = Card(
        session_id=session_id,
        card_type=payload.card_type,
        front_text=payload.front_text,
        front_phonetic=payload.front_phonetic,
        back_text=payload.back_text,
        example=payload.example,
        is_learned=payload.is_learned,
        position=payload.position,
    )
    db.add(card)
    await db.flush()

    for synonym_payload in payload.synonyms:
        db.add(Synonym(card_id=card.id, word=synonym_payload.word, phonetic=synonym_payload.phonetic))

    await db.commit()
    await db.refresh(card, attribute_names=["synonyms"])
    return CardOut.model_validate(card)


@router.put("/cards/{card_id}", response_model=CardOut)
async def update_card(
    card_id: str,
    payload: CardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CardOut:
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Card)
        .join(Session, Card.session_id == Session.id)
        .where(Card.id == card_id, Session.user_id == current_user.id)
        .options(selectinload(Card.synonyms))
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    for field, value in payload.model_dump(exclude_none=True, exclude={"synonyms"}).items():
        setattr(card, field, value)

    if payload.synonyms is not None:
        for existing in list(card.synonyms):
            await db.delete(existing)
        card.synonyms = []
        for synonym_payload in payload.synonyms:
            card.synonyms.append(Synonym(word=synonym_payload.word, phonetic=synonym_payload.phonetic))

    await db.commit()
    await db.refresh(card, attribute_names=["synonyms"])
    return CardOut.model_validate(card)


@router.patch("/cards/{card_id}/learned", response_model=CardOut)
async def toggle_card_learned(
    card_id: str,
    payload: LearnedToggleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CardOut:
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Card)
        .join(Session, Card.session_id == Session.id)
        .where(Card.id == card_id, Session.user_id == current_user.id)
        .options(selectinload(Card.synonyms))
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    card.is_learned = payload.is_learned
    await db.commit()
    await db.refresh(card, attribute_names=["is_learned"])
    return CardOut.model_validate(card)


@router.delete("/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Card)
        .join(Session, Card.session_id == Session.id)
        .where(Card.id == card_id, Session.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    await db.delete(card)
    await db.commit()


@router.get("/cards/template/download")
async def download_template():
    template_content = """front_text,phonetic,back_text,example,synonyms
abundant,/əˈbʌndənt/,"dồi dào, phong phú",The region has abundant natural resources.,plentiful /ˈplentɪfəl/; copious /ˈkoʊpiəs/; ample /ˈæmpəl/
make a decision,,"đưa ra quyết định",We need to make a decision before the deadline.,
"""

    csv_bytes = template_content.encode("utf-8")
    return StreamingResponse(
        BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vocab_template.csv"}
    )
