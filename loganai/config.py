from dataclasses import dataclass

@dataclass
class ModelConfig:
    vocab_size: int = 256
    block_size: int = 256
    n_embd: int = 128
    n_head: int = 4
    n_layer: int = 4
    dropout: float = 0.1

CONFIG = ModelConfig()
