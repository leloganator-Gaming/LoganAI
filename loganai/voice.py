"""La voix est gérée côté navigateur via Web Speech API ; aucun audio n'est envoyé au serveur."""
VOICE_CAPABILITIES = {
    "speech_recognition": "Web Speech API SpeechRecognition, disponibilité variable selon navigateur",
    "speech_synthesis": "window.speechSynthesis, voix fournies par le navigateur ou le système",
    "server_audio_storage": False,
}
