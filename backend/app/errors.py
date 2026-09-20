"""Mã lỗi có cấu trúc để client tự dịch sang ngôn ngữ người dùng."""

from enum import Enum
from typing import Any

from fastapi import HTTPException


class ErrorCode(str, Enum):
    """Danh mục mã lỗi. Mỗi mã có dạng <domain>.<reason>, viết thường.

    Client ánh xạ mã này sang câu dịch trong namespace `errors`.
    Thêm mã mới thì phải thêm bản dịch ở cả en lẫn vi, nếu không
    scripts/check-i18n.mjs sẽ chặn build.
    """

    # auth
    NOT_AUTHENTICATED = "auth.not_authenticated"
    INVALID_TOKEN = "auth.invalid_token"
    INVALID_CREDENTIALS = "auth.invalid_credentials"
    INVALID_OR_EXPIRED_CODE = "auth.invalid_or_expired_code"
    EMAIL_ALREADY_REGISTERED = "auth.email_already_registered"
    ADMIN_REQUIRED = "auth.admin_required"

    # user
    USER_NOT_FOUND = "user.not_found"

    # session
    SESSION_NOT_FOUND = "session.not_found"
    SESSION_POOL_TOO_SMALL = "session.pool_too_small"

    # card
    CARD_NOT_FOUND = "card.not_found"

    # quiz
    QUIZ_NOT_FOUND = "quiz.not_found"
    QUIZ_POOL_TOO_SMALL = "quiz.pool_too_small"
    QUIZ_NO_MATCHING_CARDS = "quiz.no_matching_cards"
    QUIZ_NOT_ENOUGH_FOR_TYPES = "quiz.not_enough_for_types"
    QUIZ_GENERATION_FAILED = "quiz.generation_failed"
    QUIZ_STILL_GENERATING = "quiz.still_generating"
    QUIZ_RETRY_LIMIT = "quiz.retry_limit"
    QUIZ_NOT_AI_GENERATED = "quiz.not_ai_generated"

    # attempt
    ATTEMPT_NOT_FOUND = "attempt.not_found"
    ATTEMPT_ALREADY_SUBMITTED = "attempt.already_submitted"
    ATTEMPT_NOT_SUBMITTED = "attempt.not_submitted"
    QUESTION_NOT_IN_QUIZ = "attempt.question_not_in_quiz"
    QUESTION_ALREADY_ANSWERED = "attempt.question_already_answered"

    # import
    IMPORT_UNSUPPORTED_TYPE = "import.unsupported_type"
    IMPORT_PARSE_FAILED = "import.parse_failed"

    # ai
    AI_DISABLED = "ai.disabled"
    AI_QUOTA_EXCEEDED = "ai.quota_exceeded"


def api_error(status_code: int, code: ErrorCode, message: str, **params: Any) -> HTTPException:
    """Dựng HTTPException có detail máy đọc được.

    `message` là câu tiếng Anh, giữ làm lưới an toàn cho client cũ và cho
    trường hợp frontend chưa có bản dịch của mã này.
    `params` là các giá trị chèn vào câu dịch, ví dụ min=8.
    """
    return HTTPException(
        status_code=status_code,
        detail={"code": code.value, "message": message, "params": params},
    )
