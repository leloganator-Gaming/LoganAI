from dataclasses import dataclass

@dataclass
class ModelConfig:
    # Le tokenizer travaille en octets UTF-8 : 512 tokens donnent un contexte
    # plus utile que 256, tout en restant raisonnable pour un petit serveur CPU.
    vocab_size: int = 256
    block_size: int = 512
    n_embd: int = 128
    n_head: int = 4
    n_layer: int = 4
    dropout: float = 0.1

CONFIG = ModelConfig()
