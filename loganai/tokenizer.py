"""Tokenizer indépendant : encodage UTF-8 byte-level, sans vocabulaire préentraîné."""
class LoganTokenizer:
    vocab_size = 256

    def encode(self, text: str) -> list[int]:
        return list(text.encode("utf-8", errors="replace"))

    def decode(self, tokens: list[int]) -> str:
        safe = bytes(max(0, min(255, int(t))) for t in tokens)
        return safe.decode("utf-8", errors="replace")

    def save(self, path: str) -> None:
        # Le tokenizer est déterministe : aucune table apprise à sauvegarder.
        with open(path, "w", encoding="utf-8") as f:
            f.write('{"type":"utf8-byte-level","vocab_size":256}\n')
