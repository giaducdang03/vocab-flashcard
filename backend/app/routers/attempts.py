import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.quiz import Quiz, QuizAnswer, QuizAttempt, QuizQuestion
from app.models.user import User
from app.schemas.quiz import (
    AnswerSubmitRequest,
    AnswerSubmitResponse,
    AttemptReviewOut,
    AttemptSubmitResponse,
    ReviewQuestionOut,
)

router = APIRouter()


async def _get_owned_attempt(
    db: AsyncSession, attempt_id: str, user_id: str
) -> QuizAttempt:
    """Load an attempt owned by the user or raise 404."""
    result = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.id == attempt_id,
            QuizAttempt.user_id == user_id,
        )
    )
    attempt = result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found",
        )

    return attempt


@router.post("/{attempt_id}/answers", response_model=AnswerSubmitResponse)
async def submit_answer(
    attempt_id: str,
    payload: AnswerSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnswerSubmitResponse:
    """Submit an answer for a question in an attempt."""
    # Fetch and validate attempt belongs to user
    attempt = await _get_owned_attempt(db, attempt_id, current_user.id)

    # Check if attempt is already submitted
    if attempt.submitted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attempt already submitted",
        )

    # Fetch and validate question belongs to quiz
    result = await db.execute(
        select(QuizQuestion).where(
            QuizQuestion.id == payload.question_id,
            QuizQuestion.quiz_id == attempt.quiz_id,
        )
    )
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found in this quiz",
        )

    # Check for duplicate answer (unique constraint on attempt_id, question_id)
    result = await db.execute(
        select(QuizAnswer).where(
            QuizAnswer.attempt_id == attempt_id,
            QuizAnswer.question_id == payload.question_id,
        )
    )
    existing_answer = result.scalar_one_or_none()

    if existing_answer:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Question already answered",
        )

    # Determine if answer is correct
    is_correct = payload.selected_index == question.correct_index if payload.selected_index is not None else False

    # Create QuizAnswer record
    quiz_answer = QuizAnswer(
        attempt_id=attempt_id,
        question_id=payload.question_id,
        selected_index=payload.selected_index,
        is_correct=is_correct,
        answered_at=datetime.now(timezone.utc),
    )
    db.add(quiz_answer)

    # Increment attempt score if correct
    if is_correct:
        attempt.score += 1

    await db.commit()

    return AnswerSubmitResponse(
        is_correct=is_correct,
        correct_index=question.correct_index,
    )


@router.post("/{attempt_id}/submit", response_model=AttemptSubmitResponse)
async def submit_attempt(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptSubmitResponse:
    """Submit an attempt, finalize it, and create unanswered questions."""
    # Fetch and validate attempt belongs to user
    attempt = await _get_owned_attempt(db, attempt_id, current_user.id)

    # Check if already submitted
    if attempt.submitted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attempt already submitted",
        )

    # Get all questions in the quiz
    result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.quiz_id == attempt.quiz_id)
    )
    all_questions = result.scalars().all()

    # Get all answered questions for this attempt
    result = await db.execute(
        select(QuizAnswer).where(QuizAnswer.attempt_id == attempt_id)
    )
    answered_questions = result.scalars().all()
    answered_question_ids = {ans.question_id for ans in answered_questions}

    # Create QuizAnswer records for unanswered questions
    for question in all_questions:
        if question.id not in answered_question_ids:
            unanswered_answer = QuizAnswer(
                attempt_id=attempt_id,
                question_id=question.id,
                selected_index=None,
                is_correct=False,
                answered_at=datetime.now(timezone.utc),
            )
            db.add(unanswered_answer)

    # Set submitted_at and calculate duration_seconds
    now = datetime.now(timezone.utc)
    attempt.submitted_at = now
    attempt.duration_seconds = int((now - attempt.started_at).total_seconds())

    await db.commit()

    return AttemptSubmitResponse(
        attempt_id=attempt.id,
        score=attempt.score,
        total_questions=attempt.total_questions,
        duration_seconds=attempt.duration_seconds,
    )


@router.get("/{attempt_id}", response_model=AttemptReviewOut)
async def review_attempt(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptReviewOut:
    """Review a submitted attempt with all questions, answers, and correct indices."""
    # Fetch and validate attempt belongs to user
    attempt = await _get_owned_attempt(db, attempt_id, current_user.id)

    # Check if attempt is submitted
    if attempt.submitted_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attempt not yet submitted",
        )

    # Fetch quiz for title
    result = await db.execute(select(Quiz).where(Quiz.id == attempt.quiz_id))
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )

    # Fetch all questions for the quiz
    result = await db.execute(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == attempt.quiz_id)
        .order_by(QuizQuestion.position)
    )
    questions = result.scalars().all()

    # Fetch all answers for the attempt
    result = await db.execute(
        select(QuizAnswer).where(QuizAnswer.attempt_id == attempt_id)
    )
    answers = result.scalars().all()

    # Build a map of question_id -> answer
    answer_map = {ans.question_id: ans for ans in answers}

    # Build review questions
    review_questions = []
    for question in questions:
        answer = answer_map.get(question.id)
        options = json.loads(question.options)

        review_question = ReviewQuestionOut(
            id=question.id,
            question_type=question.question_type,
            prompt_text=question.prompt_text,
            prompt_phonetic=question.prompt_phonetic,
            options=options,
            position=question.position,
            correct_index=question.correct_index,
            selected_index=answer.selected_index if answer else None,
            is_correct=answer.is_correct if answer else False,
            card_id=question.card_id,
        )
        review_questions.append(review_question)

    return AttemptReviewOut(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        score=attempt.score,
        total_questions=attempt.total_questions,
        duration_seconds=attempt.duration_seconds,
        submitted_at=attempt.submitted_at,
        questions=review_questions,
    )
