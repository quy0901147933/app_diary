"""Shared persona-to-prompt builder.

Used by chat_engine and vision so Lumina speaks with the same voice everywhere
(same xưng hô, same energy, same soul age, same nickname for the user).
"""

from __future__ import annotations

from typing import Any, Literal

from app.core.supabase_client import get_service_client

Mode = Literal["chat", "vision"]


def fetch_persona(user_id: str) -> dict[str, Any] | None:
    sb = get_service_client()
    res = (
        sb.table("user_personas")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return res.data if res and res.data else None


def _pronouns(rel: str, gender: str, soul: str, nick: str) -> tuple[str, str]:
    """Return (ai_self, addressing user)."""
    if rel == "lover":
        ai_self = "em" if gender == "female" else "anh" if gender == "male" else "mình"
        user_addr = "anh" if gender == "female" else "em" if gender == "male" else "bạn"
    elif rel == "mentor":
        ai_self = "tôi" if soul == "older" else "mình"
        user_addr = nick or "bạn"
    else:  # best_friend
        ai_self = "tớ" if soul == "younger" else "mình"
        user_addr = nick or "cậu"
    return ai_self, user_addr


def build_persona_block(p: dict[str, Any] | None, mode: Mode) -> str:
    """Render persona as a system-prompt block in Vietnamese.

    `mode='chat'` → conversational instructions.
    `mode='vision'` → photo-comment style instructions.
    """
    if not p:
        return ""

    nick = (p.get("user_nickname") or "").strip()
    rel = p.get("ai_relationship") or "best_friend"
    gender = p.get("ai_gender") or "neutral"
    energy = int(p.get("ai_energy") or 0)
    style = int(p.get("ai_response_style") or 0)
    soul = p.get("ai_soul_age") or "peer"
    interests = p.get("user_interests") or []
    age_group = p.get("user_age_group") or ""
    goal = p.get("user_goal") or ""
    ai_name = (p.get("ai_name") or "Lumina").strip() or "Lumina"

    ai_self, user_addr = _pronouns(rel, gender, soul, nick)

    rel_label = {
        "best_friend": "người bạn thân",
        "lover": "người thương",
        "mentor": "tiền bối / cố vấn",
    }.get(rel, "người bạn đồng hành")

    energy_word = (
        "trầm tĩnh, ít lời, nhẹ nhàng"
        if energy < -10
        else "tăng động, hay khơi chuyện"
        if energy > 10
        else "vừa đủ, dịu dàng"
    )
    style_word = (
        "lắng nghe và chữa lành, không cà khịa"
        if style < -10
        else "thường xuyên cà khịa hài hước, trêu nhẹ"
        if style > 10
        else "điềm đạm, dí dỏm vừa phải"
    )
    soul_word = {
        "older": "lớn tuổi hơn người dùng — vững chãi, từng trải",
        "younger": "nhỏ tuổi hơn người dùng — đáng yêu, hồn nhiên",
    }.get(soul, "ngang tuổi người dùng — bình đẳng")

    age_label_map = {
        "student": "sinh viên / đi học, hay deadline đồ án",
        "young-adult": "mới đi làm, đang định hình bản thân",
        "working": "đi làm ổn định, cân bằng đời sống",
        "parent": "có gia đình, ít thời gian riêng",
        "senior": "trung niên / lớn tuổi, sống chậm",
    }
    goal_label_map = {
        "tam-su": "cần người tâm sự",
        "xa-stress": "muốn xả stress",
        "luu-ky-niem": "muốn lưu kỷ niệm",
        "tu-phat-trien": "muốn tự phát triển",
    }

    lines = [
        "BỘ GEN CỦA BẠN (BẮT BUỘC TUÂN THỦ — KHÔNG ĐƯỢC PHÁ CHARACTER):",
        f"- Tên bạn: {ai_name}.",
        f"- Bạn là {rel_label} của người dùng. Tự xưng \"{ai_self}\", gọi người dùng là \"{user_addr}\".",
        f"- Tính cách: {energy_word}; {style_word}.",
        f"- Tuổi tâm hồn: {soul_word}.",
    ]
    if nick:
        lines.append(f"- Tên người dùng: {nick}.")
    if age_group:
        lines.append(f"- Hoàn cảnh người dùng: {age_label_map.get(age_group, age_group)}.")
    if goal:
        lines.append(f"- Lý do dùng app: {goal_label_map.get(goal, goal)}.")
    if interests:
        lines.append(f"- Sở thích người dùng: {' '.join(interests)}.")

    if rel == "lover":
        lines.append(
            "- Giọng người yêu: ngọt ngào nhưng không sến; hỏi han mệt mỏi, ăn ngủ; dùng "
            "biểu cảm tự nhiên (\"hihi\", \"hmm\"); KHÔNG dùng từ thân mật quá mức (cưng, baby, "
            "honey) trừ khi user dùng trước."
        )
    if rel == "best_friend" and style > 10:
        lines.append("- Có thể cà khịa nhẹ nhàng khi user kể chuyện vui/buồn nho nhỏ.")
    if rel == "mentor":
        lines.append("- Giọng cố vấn: gợi mở câu hỏi phản tư, không áp đặt; trích dẫn ngắn gọn.")

    if mode == "vision":
        lines.append(
            "- Khi nhìn ảnh: KHÔNG mô tả vật lý khô khan như \"đây là cái máy tính\", \"có 1 ly cafe\". "
            "Hãy nói với cảm xúc — cổ vũ, trêu nhẹ, hoặc quan tâm — đúng theo bộ gen ở trên. "
            "Dùng ngữ cảnh GIỜ + ĐỊA ĐIỂM nếu có để tạo cớ hỏi han tự nhiên."
        )
    return "\n".join(lines)
