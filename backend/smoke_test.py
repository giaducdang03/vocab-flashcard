from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

register_response = client.post(
    '/auth/register',
    json={'email': 'a@test.com', 'password': '123456', 'display_name': 'Alice'},
)
print('REGISTER', register_response.status_code, register_response.json())
assert register_response.status_code == 200, register_response.text

token = register_response.json()['token']
headers = {'Authorization': f"Bearer {token}"}

me_response = client.get('/auth/me', headers=headers)
print('ME', me_response.status_code, me_response.json())
assert me_response.status_code == 200, me_response.text

session_response = client.post('/sessions', json={'title': 'Daily Vocab'}, headers=headers)
print('SESSION_CREATE', session_response.status_code, session_response.json())
assert session_response.status_code == 200, session_response.text
session_id = session_response.json()['id']

card_response = client.post(
    f'/sessions/{session_id}/cards',
    json={
        'card_type': 'vocab',
        'front_text': 'happy',
        'front_phonetic': '/ˈhæpi/',
        'back_text': 'vui',
        'example': 'I am happy.',
        'synonyms': [{'word': 'glad', 'phonetic': '/ɡlæd/'}],
    },
    headers=headers,
)
print('CARD_CREATE', card_response.status_code, card_response.json())
assert card_response.status_code == 200, card_response.text
card_id = card_response.json()['id']

learned_response = client.patch(f'/cards/{card_id}/learned', json={'is_learned': True}, headers=headers)
print('CARD_TOGGLE', learned_response.status_code, learned_response.json())
assert learned_response.status_code == 200, learned_response.text

session_detail = client.get(f'/sessions/{session_id}', headers=headers)
print('SESSION_GET', session_detail.status_code, session_detail.json())
assert session_detail.status_code == 200, session_detail.text

delete_response = client.delete(f'/cards/{card_id}', headers=headers)
print('CARD_DELETE', delete_response.status_code)
assert delete_response.status_code == 204, delete_response.text

print('SMOKE_OK')
