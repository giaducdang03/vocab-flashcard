from app.services import ai


class TestGetProvider:
    def test_no_provider_when_key_is_empty(self, monkeypatch):
        monkeypatch.setattr(ai.settings, "AI_API_KEY", "")

        assert ai.get_provider() is None
        assert ai.ai_available() is False

    def test_provider_built_when_key_is_set(self, monkeypatch):
        monkeypatch.setattr(ai.settings, "AI_API_KEY", "sk-test")
        monkeypatch.setattr(ai.settings, "AI_MODEL", "some-model")

        provider = ai.get_provider()

        assert provider is not None
        assert provider.model == "some-model"
        assert ai.ai_available() is True
