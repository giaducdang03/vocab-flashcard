import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.card import Card, Synonym
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion, QuizSourceSession
from app.models.session import Session
from app.models.user import User
from app.schemas.quiz import (
    AttemptStartOut,
    CapacityRequest,
    CapacityResponse,
    QuestionOut,
    QuizCreate,
    QuizDetailOut,
    QuizListItem,
    AttemptSummary,
)
from app.services.quiz_generator import MIN_POOL_SIZE, compute_capacity, generate_questions

router = APIRouter()


async def _load_user_sessions(
    db: AsyncSession, user_id: str, session_ids: list[str]
) -> list[Session]:
    """Load and validate that all sessions belong to the user."""
    result = await db.execute(
        select(Session).where(
            Session.user_id == user_id,
            Session.id.in_(session_ids),
        )
    )
    sessions = result.scalars().all()

    if len(sessions) != len(session_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session not found",
        )

    return sessions


async def _load_user_cards(
    db: AsyncSession, user_id: str, session_ids: list[str]
) -> list[Card]:
    """Load all cards from sessions, eager-loading synonyms."""
    result = await db.execute(
        select(Card)
        .options(selectinload(Card.synonyms))
        .join(Session)
        .where(
            Session.user_id == user_id,
            Session.id.in_(session_ids),
        )
    )
    return result.scalars().all()


async def _get_owned_quiz(
    db: AsyncSession, quiz_id: str, user_id: str
) -> Quiz:
    """Load a quiz owned by the user or raise 404."""
    result = await db.execute(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.user_id == user_id)
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )

    return quiz


async def _quiz_list_item(db: AsyncSession, quiz: Quiz) -> QuizListItem:
    """Convert a Quiz to QuizListItem with computed stats."""
    # Load source sessions
    result = await db.execute(
        select(QuizSourceSession).where(QuizSourceSession.quiz_id == quiz.id)
    )
    source_sessions_list = result.scalars().all()

    # Fetch session titles
    session_ids = [ss.session_id for ss in source_sessions_list]
    if session_ids:
        result = await db.execute(
            select(Session).where(Session.id.in_(session_ids))
        )
        sessions = result.scalars().all()
        source_session_titles = [s.title for s in sessions]
    else:
        source_session_titles = []

    # Load attempts to compute stats
    result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.quiz_id == quiz.id)
    )
    attempts = result.scalars().all()

    # Compute stats
    submitted_attempts = [a for a in attempts if a.submitted_at is not None]
    attempt_count = len(submitted_attempts)
    best_score = max([a.score for a in submitted_attempts], default=None) if submitted_attempts else None
    last_attempt_at = max([a.submitted_at for a in submitted_attempts], default=None) if submitted_attempts else None

    # Count questions
    result = await db.execute(
        select(func.count(QuizQuestion.id)).where(QuizQuestion.quiz_id == quiz.id)
    )
    question_count = result.scalar() or 0

    # Parse question types
    question_types = quiz.question_types.split(",")

    return QuizListItem(
        id=quiz.id,
        title=quiz.title,
        question_types=question_types,
        question_count=question_count,
        source_session_titles=source_session_titles,
        attempt_count=attempt_count,
        best_score=best_score,
        last_attempt_at=last_attempt_at,
        created_at=quiz.created_at,
    )


@router.post("/capacity", response_model=CapacityResponse)
async def compute_capacity_endpoint(
    payload: CapacityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CapacityResponse:
    """Compute capacity for given sessions and question types."""
    # Validate and load sessions
    sessions = await _load_user_sessions(db, current_user.id, payload.session_ids)

    # Load cards
    cards = await _load_user_cards(db, current_user.id, payload.session_ids)

    if len(cards) < MIN_POOL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Need at least {MIN_POOL_SIZE} cards to generate questions",
        )

    # Compute capacity
    per_type = compute_capacity(cards, payload.question_types)

    total_cards = len(cards)
    max_questions = sum(per_type.values())

    return CapacityResponse(
        total_cards=total_cards,
        per_type=per_type,
        max_questions=max_questions,
    )


@router.post("", response_model=QuizListItem)
async def create_quiz(
    payload: QuizCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizListItem:
    """Create a new quiz."""
    # Validate and load sessions
    sessions = await _load_user_sessions(db, current_user.id, payload.session_ids)

    # Load cards
    cards = await _load_user_cards(db, current_user.id, payload.session_ids)

    if len(cards) < MIN_POOL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Need at least {MIN_POOL_SIZE} cards to generate questions",
        )

    # Generate questions
    generated = generate_questions(cards, payload.question_types, payload.question_count)

    if not generated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not generate questions with given parameters",
        )

    # Create Quiz
    question_types_str = ",".join(payload.question_types)
    quiz = Quiz(
        user_id=current_user.id,
        title=payload.title,
        question_types=question_types_str,
    )
    db.add(quiz)
    await db.flush()  # Get the quiz ID

    # Create QuizSourceSessions
    for session in sessions:
        source_session = QuizSourceSession(
            quiz_id=quiz.id,
            session_id=session.id,
        )
        db.add(source_session)

    # Create QuizQuestions
    for position, gen_question in enumerate(generated):
        quiz_question = QuizQuestion(
            quiz_id=quiz.id,
            card_id=gen_question.card_id,
            question_type=gen_question.question_type,
            prompt_text=gen_question.prompt_text,
            prompt_phonetic=gen_question.prompt_phonetic,
            options=json.dumps(gen_question.options),
            correct_index=gen_question.correct_index,
            position=position,
        )
        db.add(quiz_question)

    await db.commit()
    await db.refresh(quiz)

    return await _quiz_list_item(db, quiz)


@router.get("", response_model=list[QuizListItem])
async def list_quizzes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[QuizListItem]:
    """List all quizzes for the current user."""
    result = await db.execute(
        select(Quiz)
        .where(Quiz.user_id == current_user.id)
        .order_by(Quiz.created_at.desc())
    )
    quizzes = result.scalars().all()

    items = []
    for quiz in quizzes:
        item = await _quiz_list_item(db, quiz)
        items.append(item)

    return items


@router.get("/{quiz_id}", response_model=QuizDetailOut)
async def get_quiz(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizDetailOut:
    """Get quiz details with attempt history."""
    quiz = await _get_owned_quiz(db, quiz_id, current_user.id)

    # Load attempts
    result = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz_id)
        .order_by(QuizAttempt.submitted_at.desc().nullslast())
    )
    attempts = result.scalars().all()

    # Build list of submitted attempts
    attempt_summaries = []
    for attempt in attempts:
        if attempt.submitted_at is not None:
            attempt_summaries.append(
                AttemptSummary(
                    id=attempt.id,
                    submitted_at=attempt.submitted_at,
                    score=attempt.score,
                    total_questions=attempt.total_questions,
                    duration_seconds=attempt.duration_seconds,
                )
            )

    quiz_item = await _quiz_list_item(db, quiz)

    return QuizDetailOut(
        quiz=quiz_item,
        attempts=attempt_summaries,
    )


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a quiz and all related data."""
    quiz = await _get_owned_quiz(db, quiz_id, current_user.id)

    await db.delete(quiz)
    await db.commit()


@router.post("/{quiz_id}/attempts", response_model=AttemptStartOut)
async def start_attempt(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptStartOut:
    """Start a new quiz attempt."""
    quiz = await _get_owned_quiz(db, quiz_id, current_user.id)

    # Load quiz questions with options
    result = await db.execute(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz_id)
        .order_by(QuizQuestion.position)
    )
    quiz_questions = result.scalars().all()

    # Delete unsubmitted attempts
    result = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.user_id == current_user.id,
            QuizAttempt.submitted_at.is_(None),
        )
    )
    unsubmitted_attempts = result.scalars().all()
    for attempt in unsubmitted_attempts:
        await db.delete(attempt)

    # Create new attempt
    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=current_user.id,
        started_at=datetime.now(timezone.utc),
        total_questions=len(quiz_questions),
    )
    db.add(attempt)
    await db.flush()
    attempt_id = attempt.id

    # Build questions for response (without correct_index)
    questions = []
    for qq in quiz_questions:
        options = json.loads(qq.options)
        question = QuestionOut(
            id=qq.id,
            question_type=qq.question_type,
            prompt_text=qq.prompt_text,
            prompt_phonetic=qq.prompt_phonetic,
            options=options,
            position=qq.position,
        )
        questions.append(question)

    await db.commit()

    return AttemptStartOut(
        attempt_id=attempt_id,
        quiz_id=quiz_id,
        quiz_title=quiz.title,
        questions=questions,
    )
