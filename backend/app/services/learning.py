from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card, CardLearnEvent


def apply_learned_state(db: AsyncSession, card: Card, is_learned: bool) -> None:
    """Đổi trạng thái đã học của card và ghi lại lịch sử.

    Chỉ sinh event khi trạng thái thực sự thay đổi, nên gọi nhiều lần với
    cùng một giá trị sẽ không tạo event rác.

    Dùng db.add(...) chứ không phải card.learn_events.append(...): trong async
    SQLAlchemy, chạm vào collection của object đã persistent sẽ kích hoạt lazy
    load và ném MissingGreenlet.

    Lưu ý: card phải đã có `id` (tức là đã flush) trước khi gọi hàm này.
    """
    if card.is_learned == is_learned:
        return

    card.is_learned = is_learned
    db.add(
        CardLearnEvent(
            card_id=card.id,
            event_type="learned" if is_learned else "unlearned",
        )
    )
