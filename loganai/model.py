import torch
from torch import nn
from torch.nn import functional as F
from .config import ModelConfig, CONFIG

class CausalSelfAttention(nn.Module):
    def __init__(self, cfg: ModelConfig):
        super().__init__()
        assert cfg.n_embd % cfg.n_head == 0
        self.heads = cfg.n_head
        self.head_dim = cfg.n_embd // cfg.n_head
        self.qkv = nn.Linear(cfg.n_embd, 3 * cfg.n_embd)
        self.proj = nn.Linear(cfg.n_embd, cfg.n_embd)
        self.dropout = nn.Dropout(cfg.dropout)
        self.register_buffer("mask", torch.tril(torch.ones(cfg.block_size, cfg.block_size)).view(1,1,cfg.block_size,cfg.block_size))

    def forward(self, x):
        b,t,c = x.shape
        q,k,v = self.qkv(x).chunk(3, dim=-1)
        shape = (b,t,self.heads,self.head_dim)
        q = q.view(shape).transpose(1,2)
        k = k.view(shape).transpose(1,2)
        v = v.view(shape).transpose(1,2)
        weights = (q @ k.transpose(-2,-1)) * (self.head_dim ** -0.5)
        weights = weights.masked_fill(self.mask[:,:,:t,:t] == 0, float("-inf"))
        weights = self.dropout(F.softmax(weights, dim=-1))
        y = (weights @ v).transpose(1,2).contiguous().view(b,t,c)
        return self.dropout(self.proj(y))

class Block(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.ln1 = nn.LayerNorm(cfg.n_embd)
        self.attn = CausalSelfAttention(cfg)
        self.ln2 = nn.LayerNorm(cfg.n_embd)
        self.mlp = nn.Sequential(nn.Linear(cfg.n_embd,4*cfg.n_embd), nn.GELU(), nn.Linear(4*cfg.n_embd,cfg.n_embd), nn.Dropout(cfg.dropout))
    def forward(self,x):
        x = x + self.attn(self.ln1(x))
        return x + self.mlp(self.ln2(x))

class LoganLanguageModel(nn.Module):
    def __init__(self, cfg: ModelConfig = CONFIG):
        super().__init__()
        self.cfg = cfg
        self.token_embedding = nn.Embedding(cfg.vocab_size,cfg.n_embd)
        self.position_embedding = nn.Embedding(cfg.block_size,cfg.n_embd)
        self.blocks = nn.Sequential(*[Block(cfg) for _ in range(cfg.n_layer)])
        self.norm = nn.LayerNorm(cfg.n_embd)
        self.lm_head = nn.Linear(cfg.n_embd,cfg.vocab_size,bias=False)
        self.apply(self._init_weights)
        self.lm_head.weight = self.token_embedding.weight

    @staticmethod
    def _init_weights(module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None: nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx, targets=None):
        b,t = idx.shape
        if t > self.cfg.block_size: idx = idx[:,-self.cfg.block_size:]; t = idx.size(1)
        pos = torch.arange(t,device=idx.device)
        x = self.token_embedding(idx) + self.position_embedding(pos)
        logits = self.lm_head(self.norm(self.blocks(x)))
        loss = None
        if targets is not None:
            targets = targets[:,-t:]
            loss = F.cross_entropy(logits.reshape(-1,logits.size(-1)), targets.reshape(-1))
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens=160, temperature=0.85, top_k=40):
        self.eval()
        for _ in range(max_new_tokens):
            context = idx[:,-self.cfg.block_size:]
            logits,_ = self(context)
            logits = logits[:,-1,:] / max(temperature,0.05)
            if top_k:
                values,_ = torch.topk(logits,min(top_k,logits.size(-1)))
                logits[logits < values[:,-1,None]] = -float("inf")
            probs = F.softmax(logits,dim=-1)
            next_id = torch.multinomial(probs,num_samples=1)
            idx = torch.cat((idx,next_id),dim=1)
        return idx
