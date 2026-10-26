import json
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

MODEL_DIR = "/Users/mac/videos/scrutineer-demo/tts"
voice = sys.argv[1] if len(sys.argv) > 1 else "af_heart"
k = Kokoro(f"{MODEL_DIR}/kokoro-v1.0.onnx", f"{MODEL_DIR}/voices-v1.0.bin")
total = 0.0
for scene in json.load(open("script.json")):
    samples, rate = k.create(scene["text"], voice=voice, speed=1.0, lang="en-us")
    sf.write(f"../film/assets/vo_{scene['id']}.wav", samples, rate)
    dur = len(samples) / rate
    total += dur
    print(f"{scene['id']} {dur:.2f}s")
print(f"total {total:.1f}s")
