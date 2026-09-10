import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# 1. Register
email = f"quiz-{uuid.uuid4().hex[:8]}@test.com"
register = client.post(
    "/auth/register",
    json={"email": email, "password": "123456", "display_name": "Quiz Tester"},
)
print("REGISTER", register.status_code, register.json())
assert register.status_code == 200, register.text
headers = {"Authorization": f"Bearer {register.json()['token']}"}

# 2. Create session + cards
session = client.post("/sessions", json={"title": "Quiz Source"}, headers=headers)
print("SESSION_CREATE", session.status_code)
assert session.status_code == 200, session.text
session_id = session.json()["id"]

WORDS = [
    ("abundant", "dồi dào", "plentiful"),
    ("scarce", "khan hiếm", "rare"),
    ("swift", "nhanh nhẹn", "rapid"),
    ("sturdy", "bền bỉ", "robust"),
    ("gloomy", "u ám", "dismal"),
    ("vivid", "sống động", "vibrant"),
]
for index, (front, back, synonym) in enumerate(WORDS):
    response = client.post(
        f"/sessions/{session_id}/cards",
        json={
            "card_type": "vocab",
            "front_text": front,
            "front_phonetic": f"/{front}/",
            "back_text": back,
            "position": index,
            "synonyms": [{"word": synonym, "phonetic": f"/{synonym}/"}],
        },
        headers=headers,
    )
    print(f"CARD_CREATE_{index}", response.status_code)
    assert response.status_code == 200, response.text

# 3. Capacity
capacity = client.post(
    "/quizzes/capacity",
    json={"session_ids": [session_id], "question_types": ["en_to_vi", "vi_to_en", "synonym"]},
    headers=headers,
)
print("CAPACITY", capacity.status_code, capacity.json())
assert capacity.status_code == 200, capacity.text
assert capacity.json()["max_questions"] == 18, f"Expected max_questions=18, got {capacity.json()['max_questions']}"

# 4. Create quiz
create = client.post(
    "/quizzes",
    json={
        "title": "Smoke Quiz",
        "session_ids": [session_id],
        "question_count": 6,
        "question_types": ["en_to_vi", "vi_to_en", "synonym"],
    },
    headers=headers,
)
print("QUIZ_CREATE", create.status_code, create.json())
assert create.status_code == 200, create.text
quiz_id = create.json()["id"]
assert create.json()["question_count"] == 6
assert create.json()["attempt_count"] == 0
assert create.json()["best_score"] is None

# 5. List
listing = client.get("/quizzes", headers=headers)
print("QUIZ_LIST", listing.status_code, len(listing.json()))
assert listing.status_code == 200, listing.text
assert len(listing.json()) == 1

# 6. Start attempt
start = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers)
print("ATTEMPT_START", start.status_code)
assert start.status_code == 200, start.text
payload = start.json()
attempt_id = payload["attempt_id"]
questions = payload["questions"]
assert len(questions) == 6

# Important: verify no correct_index in questions
for question in questions:
    assert "correct_index" not in question, f"correct_index should not be in question: {question}"
    assert len(question["options"]) == 4
    assert len({option.lower() for option in question["options"]}) == 4

# 7. Answer questions
expected_score = 0
for index, question in enumerate(questions):
    probe = client.post(
        f"/attempts/{attempt_id}/answers",
        json={"question_id": question["id"], "selected_index": 0},
        headers=headers,
    )
    print(f"ANSWER_{index}", probe.status_code, probe.json() if probe.status_code == 200 else probe.text)
    assert probe.status_code == 200, probe.text
    assert "is_correct" in probe.json()
    assert "correct_index" in probe.json()
    if probe.json()["is_correct"]:
        expected_score += 1

    # Test duplicate
    duplicate = client.post(
        f"/attempts/{attempt_id}/answers",
        json={"question_id": question["id"], "selected_index": 1},
        headers=headers,
    )
    print(f"DUPLICATE_{index}", duplicate.status_code)
    assert duplicate.status_code == 409, f"Expected 409 for duplicate answer, got {duplicate.status_code}: {duplicate.text}"

# 8. Submit
submit = client.post(f"/attempts/{attempt_id}/submit", headers=headers)
print("ATTEMPT_SUBMIT", submit.status_code, submit.json())
assert submit.status_code == 200, submit.text
assert submit.json()["score"] == expected_score
assert submit.json()["total_questions"] == 6
assert "duration_seconds" in submit.json()

# 9. Review
review = client.get(f"/attempts/{attempt_id}", headers=headers)
print("ATTEMPT_REVIEW", review.status_code)
assert review.status_code == 200, review.text
assert len(review.json()["questions"]) == 6
for question in review.json()["questions"]:
    assert 0 <= question["correct_index"] <= 3, f"correct_index out of range: {question['correct_index']}"
    assert "selected_index" in question
    assert question["is_correct"] == (question["selected_index"] == question["correct_index"])

# 10. Quiz detail
detail = client.get(f"/quizzes/{quiz_id}", headers=headers)
print("QUIZ_DETAIL", detail.status_code, detail.json())
assert detail.status_code == 200, detail.text
assert detail.json()["quiz"]["attempt_count"] == 1
assert detail.json()["quiz"]["best_score"] == expected_score
assert len(detail.json()["attempts"]) == 1

# 11. Delete
deleted = client.delete(f"/quizzes/{quiz_id}", headers=headers)
print("QUIZ_DELETE", deleted.status_code)
assert deleted.status_code == 204, deleted.text

# 12. Verify deleted
not_found = client.get(f"/quizzes/{quiz_id}", headers=headers)
print("QUIZ_NOT_FOUND", not_found.status_code)
assert not_found.status_code == 404

print("QUIZ_SMOKE_OK")
