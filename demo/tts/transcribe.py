import json, pathlib
import mlx_whisper

SCENES = ["s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11"]
FILM = pathlib.Path(__file__).parent.parent / "film"
WORDS = pathlib.Path(__file__).parent.parent / "words"
WORDS.mkdir(exist_ok=True)

for sid in SCENES:
    wav = str(FILM / "assets" / f"vo_{sid}.wav")
    result = mlx_whisper.transcribe(wav, word_timestamps=True, path_or_hf_repo="mlx-community/whisper-small.en-mlx")
    words = []
    i = 0
    for seg in result["segments"]:
        for w in seg.get("words", []):
            words.append({"text": w["word"].strip(), "start": round(w["start"], 3), "end": round(w["end"], 3), "id": f"w{i}"})
            i += 1
    (WORDS / f"{sid}.json").write_text(json.dumps(words, indent=1))
    print(sid, len(words), "words")
