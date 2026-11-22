"""Vision locale expérimentale : encodeur patch et débruiteur diffusion non conditionnel."""
import torch
from torch import nn

class LoganVisionEncoder(nn.Module):
    """Encodeur visuel initialisé aléatoirement ; l'alignement texte/image reste à entraîner."""
    def __init__(self, image_size=128, patch=16, width=128):
        super().__init__()
        self.patchify = nn.Conv2d(3, width, kernel_size=patch, stride=patch)
        self.position = nn.Parameter(torch.randn(1, (image_size // patch) ** 2, width) * 0.02)
        self.norm = nn.LayerNorm(width)
        self.projection = nn.Linear(width, width)
    def forward(self, image):
        x = self.patchify(image).flatten(2).transpose(1, 2)
        return self.projection(self.norm(x + self.position[:, :x.size(1)]))

class LoganDenoiser(nn.Module):
    """Petit débruiteur convolutionnel DDPM, sans conditionnement textuel."""
    def __init__(self, channels=3, hidden=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(channels + 1, hidden, 3, padding=1), nn.SiLU(),
            nn.Conv2d(hidden, hidden, 3, padding=1), nn.SiLU(),
            nn.Conv2d(hidden, hidden, 3, padding=1), nn.SiLU(),
            nn.Conv2d(hidden, channels, 3, padding=1)
        )
    def forward(self, noisy, timestep):
        t = timestep.float().view(-1, 1, 1, 1).expand(-1, 1, noisy.size(2), noisy.size(3)) / 1000
        return self.net(torch.cat([noisy, t], dim=1))
