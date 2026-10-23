"""Admit individual generated painted icons with provenance and deterministic runtime encoding."""
import hashlib
import json
import shutil
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
source_dir = root / 'meadow-3d/art/mastery-icons'
runtime_dir = root / 'meadow-3d/public/assets/mastery-painted'
manifest_file = source_dir / 'manifest.json'
manifest = json.loads(manifest_file.read_text('utf-8'))
rows = json.loads(Path(sys.argv[1]).read_text('utf-8'))
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source_dir.mkdir(parents=True, exist_ok=True)
runtime_dir.mkdir(parents=True, exist_ok=True)
for row in rows:
    original = Path(row['path'])
    source = source_dir / f"{row['id']}-icon-v1.png"
    if source.exists() and digest(source) != digest(original):
        raise ValueError(f'Refusing to overwrite a different source: {source}')
    if not source.exists():
        shutil.copy2(original, source)
    with Image.open(source) as image:
        if image.width != image.height or image.width < 128:
            raise ValueError(f'Icon must be square and at least128px: {source}')
        icon = image.convert('RGB').resize((128, 128), Image.Resampling.LANCZOS)
        temporary = runtime_dir / f"{row['id']}-icon-v1.webp"
        icon.save(temporary, 'WEBP', quality=92, method=6)
    sha = digest(temporary)
    runtime = runtime_dir / f"{row['id']}-icon-v1-{sha[:12]}.webp"
    if runtime.exists():
        if digest(runtime) != sha:
            raise ValueError(f'Runtime hash collision: {runtime}')
        temporary.unlink()
    else:
        temporary.rename(runtime)
    manifest['icons'][row['id']] = {
        'file': runtime.name, 'width': 128, 'height': 128,
        'source': source.relative_to(root).as_posix(), 'sourceSha256': digest(source),
        'sha256': sha, 'prompt': row['prompt'],
        'reference': 'meadow-3d/art/mastery-icons/mage_01-icon-v1.png',
        'provenance': {'tool':'built-in image_gen', 'externalPaidProvider':False, 'generatedFile':original.name},
        'status':'Normalized and runtime-bound; native-scale game review pending'
    }
manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'admitted':[r['id'] for r in rows], 'manifestIcons':len(manifest['icons'])}))
