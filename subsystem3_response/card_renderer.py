import io
import textwrap
import logging
from PIL import Image, ImageDraw, ImageFont
from subsystem2_detection.models import VerdictPayload

logger = logging.getLogger(__name__)

# Color Palette (Warm, Accessible, High Contrast)
COLOR_BG_FALSE = (255, 246, 246)        # Warm soft red/cream
COLOR_HEADER_FALSE = (217, 83, 79)      # Calm warm red
COLOR_BG_UNVERIFIED = (255, 250, 240)   # Warm soft amber
COLOR_HEADER_UNVERIFIED = (217, 131, 38)# Calm warm amber
COLOR_BG_TRUE = (245, 255, 245)         # Soft sage green
COLOR_HEADER_TRUE = (46, 139, 87)       # Calm green

COLOR_TEXT_DARK = (40, 40, 40)
COLOR_CARD_BORDER = (220, 220, 220)
COLOR_TAG_BG = (238, 240, 248)
COLOR_TAG_TEXT = (60, 70, 130)

def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Safely loads cross-platform TrueType fonts with fallback."""
    font_candidates = (
        ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf", "Helvetica-Bold.ttf"]
        if bold else
        ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf", "Helvetica.ttf"]
    )
    for font_name in font_candidates:
        try:
            return ImageFont.truetype(font_name, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()

class CardRenderer:
    def create_correction_card(self, payload: VerdictPayload) -> bytes:
        """
        Renders a visually clean, warm, easy-to-read correction card as PNG bytes.
        Suitable for instant forwarding on WhatsApp / Telegram.
        """
        width = 800
        # Calculate height dynamically based on content length
        estimated_lines = 10
        if payload.matched_claim:
            estimated_lines += len(payload.matched_claim) // 45 + 2
        if payload.manipulation_tags:
            estimated_lines += 3
        
        height = max(600, min(850, 450 + (estimated_lines * 22)))
        
        # Select color theme based on verdict
        v_upper = payload.verdict.upper()
        if v_upper == "FALSE":
            bg_color = COLOR_BG_FALSE
            header_color = COLOR_HEADER_FALSE
            status_title = "Please Double-Check This Message"
            icon_symbol = "⚠️"
        elif v_upper == "MISLEADING":
            bg_color = COLOR_BG_UNVERIFIED
            header_color = (204, 102, 0)
            status_title = "Misleading - Context Missing"
            icon_symbol = "⚠️"
        elif v_upper in ["UNVERIFIABLE", "UNVERIFIED"]:
            bg_color = COLOR_BG_UNVERIFIED
            header_color = COLOR_HEADER_UNVERIFIED
            status_title = "Unverified Claim - Caution Advised"
            icon_symbol = "🔍"
        else: # TRUE
            bg_color = COLOR_BG_TRUE
            header_color = COLOR_HEADER_TRUE
            status_title = "Verified Information"
            icon_symbol = "✅"

        image = Image.new("RGB", (width, height), bg_color)
        draw = ImageDraw.Draw(image)

        # Draw outer rounded border & banner
        draw.rectangle([(16, 16), (width - 16, height - 16)], outline=header_color, width=4)
        draw.rectangle([(16, 16), (width - 16, 96)], fill=header_color)

        # Fonts
        font_title = load_font(30, bold=True)
        font_body = load_font(21, bold=False)
        font_bold = load_font(23, bold=True)
        font_small = load_font(17, bold=False)

        # Render Header
        draw.text((36, 38), f"{icon_symbol}  {status_title}", fill=(255, 255, 255), font=font_title)

        y_offset = 125

        # Claim Section
        if payload.matched_claim:
            draw.text((36, y_offset), "Check Result:", fill=header_color, font=font_bold)
            y_offset += 32
            
            wrapped_claim = textwrap.fill(f"\"{payload.matched_claim}\"", width=54)
            for line in wrapped_claim.split("\n"):
                draw.text((36, y_offset), line, fill=COLOR_TEXT_DARK, font=font_body)
                y_offset += 28
            y_offset += 12

        # Circulating Since
        if payload.first_seen_date:
            draw.text((36, y_offset), f"🗓️ First circulating: {payload.first_seen_date}", fill=COLOR_TEXT_DARK, font=font_body)
            y_offset += 36

        # Persuasion Technique Tags
        if payload.manipulation_tags:
            draw.text((36, y_offset), "Persuasion Techniques Detected:", fill=COLOR_TEXT_DARK, font=font_bold)
            y_offset += 32
            
            tag_str = " • ".join([t.replace("_", " ").title() for t in payload.manipulation_tags])
            draw.rectangle([(36, y_offset), (width - 36, y_offset + 38)], fill=COLOR_TAG_BG, outline=COLOR_TAG_TEXT)
            draw.text((50, y_offset + 7), f"🏷️ {tag_str}", fill=COLOR_TAG_TEXT, font=font_bold)
            y_offset += 55

        # Practical Next Step
        draw.text((36, y_offset), "Recommended Action:", fill=COLOR_TEXT_DARK, font=font_bold)
        y_offset += 32
        
        next_step = "Please do not forward unverified messages. Check with family before sharing!" if payload.verdict != "true" else "Verified info. Safe to share with family."
        wrapped_step = textwrap.fill(next_step, width=56)
        for line in wrapped_step.split("\n"):
            draw.text((36, y_offset), line, fill=COLOR_TEXT_DARK, font=font_body)
            y_offset += 26

        # Footer Banner
        draw.rectangle([(16, height - 56), (width - 16, height - 16)], fill=(230, 230, 230))
        draw.text((36, height - 44), "Family Misinformation Decoder  |  Keeping Family Chats Safe & Kind 🌸", fill=(90, 90, 90), font=font_small)

        # Output PNG bytes
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

card_renderer = CardRenderer()

