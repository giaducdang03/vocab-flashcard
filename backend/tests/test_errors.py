from fastapi import status

from app.errors import ErrorCode, api_error


def test_api_error_builds_structured_detail():
    exc = api_error(status.HTTP_404_NOT_FOUND, ErrorCode.QUIZ_NOT_FOUND, "Quiz not found")

    assert exc.status_code == status.HTTP_404_NOT_FOUND
    assert exc.detail == {
        "code": "quiz.not_found",
        "message": "Quiz not found",
        "params": {},
    }


def test_api_error_carries_params():
    exc = api_error(
        status.HTTP_400_BAD_REQUEST,
        ErrorCode.QUIZ_POOL_TOO_SMALL,
        "Need at least 8 cards to generate questions",
        min=8,
    )

    assert exc.detail["code"] == "quiz.pool_too_small"
    assert exc.detail["params"] == {"min": 8}


def test_error_codes_are_unique():
    values = [member.value for member in ErrorCode]
    assert len(values) == len(set(values)), "có mã lỗi bị trùng"


def test_error_codes_follow_domain_dot_reason():
    for member in ErrorCode:
        assert member.value.count(".") == 1, f"{member.name} phải có dạng <domain>.<reason>"
        assert member.value.islower(), f"{member.name} phải viết thường"
