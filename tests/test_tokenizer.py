from loganai.tokenizer import LoganTokenizer

def test_round_trip():
    text = "Bonjour LoganAI — été 😊"
    assert LoganTokenizer().decode(LoganTokenizer().encode(text)) == text

def test_byte_range():
    assert all(0 <= x < 256 for x in LoganTokenizer().encode("é"))
