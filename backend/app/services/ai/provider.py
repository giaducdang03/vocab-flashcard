from typing import Protocol


class LLMProvider(Protocol):
    model: str

    async def complete_json(self, system: str, user: str, max_tokens: int = 4096) -> str:
        """Trả về nội dung text thô của model. Việc parse là của lớp trên."""
        ...
