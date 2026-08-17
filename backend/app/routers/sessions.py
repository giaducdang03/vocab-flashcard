from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.card import Card, Synonym
from app.models.session import Session
from app.models.user import User
from app.schemas.card import CardOut
from app.schemas.session import SessionCreate, SessionOut, SessionUpdate

router = APIRouter()


@router.get("", response_model=list[SessionOut])
async def list_sessions(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[SessionOut]:
    result = await db.execute(
        select(Session).where(Session.user_id == current_user.id).order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()
    return [SessionOut.model_validate(session) for session in sessions]


@router.post("", response_model=SessionOut)
async def create_session(payload: SessionCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SessionOut:
    session = Session(user_id=current_user.id, title=payload.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionOut.model_validate(session)


@router.get("/{session_id}", response_model=dict)
async def get_session(session_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.cards).selectinload(Card.synonyms))
        .where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    cards = sorted(session.cards, key=lambda c: (c.position, c.created_at))

    return {
        "session": SessionOut.model_validate(session),
        "cards": [CardOut.model_validate(card) for card in cards],
    }


@router.put("/{session_id}", response_model=SessionOut)
async def update_session(session_id: str, payload: SessionUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SessionOut:
    result = await db.execute(select(Session).where(Session.id == session_id, Session.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session.title = payload.title
    await db.commit()
    await db.refresh(session)
    return SessionOut.model_validate(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> None:
    result = await db.execute(select(Session).where(Session.id == session_id, Session.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    await db.delete(session)
    await db.commit()
