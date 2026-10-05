#!/usr/bin/env bash
# imagegen 스킬(CLI 방식)로 사이트 이미지를 만듭니다. 만들 목록은 scripts/prompts.jsonl
#   bash scripts/generate-assets.sh            실제 생성 (.env 의 OPENAI_API_KEY 필요, 요금 발생)
#   bash scripts/generate-assets.sh --dry-run  API 호출 없이 요청 내용만 확인
# 이미 만든 이미지는 건너뜁니다. 다시 만들려면 assets/gen/ 에서 해당 파일을 지우고 실행하세요.
set -euo pipefail
cd "$(dirname "$0")/.."

SKILL="${IMAGEGEN_SKILL:-$HOME/.claude/skills/imagegen}"
[ -f "$SKILL/scripts/image_gen.py" ] || SKILL="$HOME/.codex/skills/.system/imagegen"
IMAGE_GEN="$SKILL/scripts/image_gen.py"
CHROMA="$SKILL/scripts/remove_chroma_key.py"

set -a; source .env; set +a
DRY=""; [ "${1:-}" = "--dry-run" ] && DRY="--dry-run"
if [ -z "$DRY" ] && [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "OPENAI_API_KEY 가 비어 있어요. .env 에 키를 넣고 다시 실행하세요." >&2; exit 1
fi
MODEL="${OPENAI_IMAGE_MODEL:-gpt-image-2}"
RAW=tmp/imagegen/raw
OUT=assets/gen
mkdir -p "$RAW" "$OUT"

# 아직 없는 이미지만 작업 목록에 넣고, CLI 가 모르는 후처리 정보(web)는 따로 빼 둠
python3 - "$MODEL" "$OUT" <<'PY'
import json, os, sys
model, out_dir = sys.argv[1], sys.argv[2]
jobs, post = [], []
for line in open("scripts/prompts.jsonl", encoding="utf-8"):
    if not line.strip():
        continue
    job = json.loads(line)
    web = job.pop("web", "cutout")  # jpg: 불투명 배경 / cutout: 단색 배경을 지워 투명 PNG
    max_dim = job.pop("max", 512)    # cutout 최종 크기 (긴 변, px)
    pad = job.pop("pad", 0.04)        # cutout 둘레 여백 비율 (0 이면 딱 맞게)
    stem = os.path.splitext(job["out"])[0]
    final = os.path.join(out_dir, stem + (".jpg" if web == "jpg" else ".png"))
    if os.path.exists(final):
        continue
    job["model"] = model
    job.setdefault("quality", "high")
    jobs.append(job)
    post.append({"raw": job["out"], "final": final, "web": web, "max": max_dim, "pad": pad})
with open("tmp/imagegen/jobs.jsonl", "w", encoding="utf-8") as f:
    f.writelines(json.dumps(j, ensure_ascii=False) + "\n" for j in jobs)
with open("tmp/imagegen/post.jsonl", "w", encoding="utf-8") as f:
    f.writelines(json.dumps(p) + "\n" for p in post)
print(f"만들 이미지 {len(jobs)}개 (모델 {model})")
PY

if [ ! -s tmp/imagegen/jobs.jsonl ]; then
  echo "이미지가 모두 준비돼 있어요."
else
  uv run --with openai --with pillow python "$IMAGE_GEN" generate-batch \
    --input tmp/imagegen/jobs.jsonl --out-dir "$RAW" \
    --concurrency "${CONCURRENCY:-4}" --force $DRY
  if [ -n "$DRY" ]; then rm -rf tmp/imagegen; rmdir tmp 2>/dev/null || true; exit 0; fi

  # 후처리: 배경은 가벼운 JPG로, 소품·아이콘은 단색 배경을 지우고 여백을 잘라 투명 PNG(512px)로
  # 고해상도 원본은 스킬 규칙대로 output/imagegen/ 에 보관 (git 에는 안 올라감)
  uv run --with pillow python - "$CHROMA" "$RAW" <<'PY'
import json, shutil, subprocess, sys
from pathlib import Path
from PIL import Image
chroma, raw_dir = sys.argv[1], Path(sys.argv[2])
keep = Path("output/imagegen")
keep.mkdir(parents=True, exist_ok=True)
for line in open("tmp/imagegen/post.jsonl", encoding="utf-8"):
    p = json.loads(line)
    src, final = raw_dir / p["raw"], Path(p["final"])
    if not src.exists():
        print("생성 실패, 건너뜀:", src.name)
        continue
    if p["web"] == "jpg":
        im = Image.open(src).convert("RGB")
        im.thumbnail((1920, 1920))
        im.save(final, "JPEG", quality=84, optimize=True, progressive=True)
        shutil.copy(src, keep / src.name)
    else:
        cut = src.with_name(src.stem + "-cut.png")
        subprocess.run([sys.executable, chroma, "--input", str(src), "--out", str(cut),
                        "--auto-key", "border", "--soft-matte", "--spill-cleanup", "--force"], check=True)
        shutil.copy(cut, keep / src.name)
        im = Image.open(cut).convert("RGBA")
        box = im.getchannel("A").getbbox()
        if box:  # 투명 여백을 잘라내고 살짝 숨 쉴 공간만 남김
            pad = int(max(box[2] - box[0], box[3] - box[1]) * p.get("pad", 0.04))
            im = im.crop((max(0, box[0] - pad), max(0, box[1] - pad),
                          min(im.width, box[2] + pad), min(im.height, box[3] + pad)))
        im.thumbnail((p.get("max", 512), p.get("max", 512)))
        im.save(final, "PNG", optimize=True)
    print("완성:", final)
PY
fi
rm -rf tmp/imagegen # 중간 파일 정리 (스킬 규칙)
rmdir tmp 2>/dev/null || true

# 사이트가 읽는 목록 (있는 이미지만 화면에 씀)
python3 - "$OUT" <<'PY'
import json, os, sys
out_dir = sys.argv[1]
files = sorted(f for f in os.listdir(out_dir) if f.endswith((".png", ".jpg")))
json.dump(files, open(os.path.join(out_dir, "manifest.json"), "w"), indent=1)
print("manifest.json:", len(files), "개")
PY
