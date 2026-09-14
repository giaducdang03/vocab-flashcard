import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import AsyncSessionLocal, get_db
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
from app.services.ai import ai_available, get_provider
from app.services.ai.quiz_ai import generate_ai_questions
from app.services.quiz_generator import (
    AI_QUESTION_TYPES,
    MIN_POOL_SIZE,
    compute_capacity,
    generate_questions,
    split_question_count,
)

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
        status=quiz.status,
        uses_ai=quiz.uses_ai,
        error_message=quiz.error_message,
        ai_question_count=quiz.ai_question_count,
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


def _add_questions(db: AsyncSession, quiz_id: str, generated, start_position: int) -> int:
    """Ghi các câu hỏi sinh ra vào DB. Trả về vị trí kế tiếp còn trống."""
    position = start_position
    for gen_question in generated:
        db.add(
            QuizQuestion(
                quiz_id=quiz_id,
                card_id=gen_question.card_id,
                question_type=gen_question.question_type,
                prompt_text=gen_question.prompt_text,
                prompt_phonetic=gen_question.prompt_phonetic,
                options=json.dumps(gen_question.options),
                correct_index=gen_question.correct_index,
                explanation=gen_question.explanation,
                source=gen_question.source,
                position=position,
            )
        )
        position += 1
    return position


async def _enforce_daily_ai_limit(db: AsyncSession, user_id: str) -> None:
    """Chặn khi user đã dùng hết lượt sinh đề AI trong 24 giờ qua."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await db.execute(
        select(func.count(Quiz.id)).where(
            Quiz.user_id == user_id,
            Quiz.uses_ai.is_(True),
            Quiz.created_at >= since,
        )
    )
    used_today = result.scalar() or 0

    if used_today >= settings.AI_DAILY_QUIZ_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Bạn đã dùng hết {settings.AI_DAILY_QUIZ_LIMIT} lượt soạn đề bằng AI "
                "trong 24 giờ qua"
            ),
        )


async def run_ai_generation(quiz_id: str) -> None:
    """Sinh phần câu hỏi AI của một quiz đang 'pending'.

    Chạy sau khi response đã trả, nên tự mở session DB riêng: session của
    request đã đóng ở thời điểm này.
    """
    async with AsyncSessionLocal() as db:
        quiz = await db.get(Quiz, quiz_id)
        if quiz is None or quiz.status != "pending":
            return

        source_result = await db.execute(
            select(QuizSourceSession.session_id).where(
                QuizSourceSession.quiz_id == quiz_id
            )
        )
        session_ids = list(source_result.scalars().all())
        cards = await _load_user_cards(db, quiz.user_id, session_ids)

        selected_types = quiz.question_types.split(",")
        ai_types = [t for t in selected_types if t in AI_QUESTION_TYPES]
        fallback_types = [t for t in selected_types if t not in AI_QUESTION_TYPES]

        existing = await db.execute(
            select(func.count(QuizQuestion.id)).where(QuizQuestion.quiz_id == quiz_id)
        )
        algo_count = existing.scalar() or 0

        split = split_question_count(cards, selected_types, quiz.requested_count)
        ai_count = sum(split.get(question_type, 0) for question_type in ai_types)

        provider = get_provider()
        if provider is None:
            quiz.status = "ready" if algo_count else "failed"
            quiz.error_message = None if algo_count else "Tính năng AI chưa được cấu hình"
            await db.commit()
            return

        result = await generate_ai_questions(
            provider, cards, ai_types, ai_count, fallback_types
        )

        _add_questions(db, quiz_id, result.questions, algo_count)
        quiz.ai_question_count = result.ai_count

        if not result.questions and algo_count == 0:
            quiz.status = "failed"
            quiz.error_message = result.error or "AI không soạn được câu hỏi nào hợp lệ"
        else:
            quiz.status = "ready"
            quiz.error_message = None

        await db.commit()


@router.post("", response_model=QuizListItem)
async def create_quiz(
    payload: QuizCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizListItem:
    """Tạo quiz mới.

    Chỉ dạng cũ thì sinh đồng bộ như trước. Có dạng AI thì phần thuật toán
    được ghi ngay, quiz để 'pending', và phần AI sinh ở background task — nhờ
    vậy AI hỏng cũng không làm mất phần câu hỏi đã có.
    """
    sessions = await _load_user_sessions(db, current_user.id, payload.session_ids)
    cards = await _load_user_cards(db, current_user.id, payload.session_ids)

    if len(cards) < MIN_POOL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Need at least {MIN_POOL_SIZE} cards to generate questions",
        )

    ai_types = [t for t in payload.question_types if t in AI_QUESTION_TYPES]
    algo_types = [t for t in payload.question_types if t not in AI_QUESTION_TYPES]

    if ai_types and not ai_available():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tính năng soạn đề bằng AI chưa được bật trên máy chủ",
        )

    if ai_types:
        await _enforce_daily_ai_limit(db, current_user.id)

    split = split_question_count(cards, payload.question_types, payload.question_count)
    algo_count = sum(split.get(question_type, 0) for question_type in algo_types)

    generated = []
    if algo_count > 0:
        generated = generate_questions(cards, algo_types, algo_count)

    if not ai_types and not generated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not generate questions with given parameters",
        )

    quiz = Quiz(
        user_id=current_user.id,
        title=payload.title,
        question_types=",".join(payload.question_types),
        requested_count=payload.question_count,
        uses_ai=bool(ai_types),
        status="pending" if ai_types else "ready",
    )
    db.add(quiz)
    await db.flush()

    for session in sessions:
        db.add(QuizSourceSession(quiz_id=quiz.id, session_id=session.id))

    _add_questions(db, quiz.id, generated, 0)

    await db.commit()
    await db.refresh(quiz)

    if ai_types:
        background_tasks.add_task(run_ai_generation, quiz.id)

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
