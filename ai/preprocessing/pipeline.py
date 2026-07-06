"""
PANOPTICON Preprocessing Pipeline
Normalize, resize, augment and convert datasets for YOLOv8, ByteTrack, FastReID.
"""

from __future__ import annotations

import json
import logging
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger("panopticon.preprocessing")

PREPROCESS_ROOT = Path(__file__).parent.parent / "preprocessed"


def normalize_image(img: np.ndarray, mean: Tuple[float, ...] = (0.485, 0.456, 0.406),
                    std: Tuple[float, ...] = (0.229, 0.224, 0.225)) -> np.ndarray:
    """Normalize image to ImageNet mean/std (float32, 0-1 range)."""
    img = img.astype(np.float32) / 255.0
    img -= np.array(mean, dtype=np.float32)
    img /= np.array(std, dtype=np.float32)
    return img


def resize_with_padding(img: np.ndarray, target_size: Tuple[int, int],
                        pad_value: int = 114) -> Tuple[np.ndarray, float, Tuple[int, int]]:
    """Resize image maintaining aspect ratio with letterboxing. Returns (img, scale, pad)."""
    h, w = img.shape[:2]
    th, tw = target_size
    scale = min(tw / w, th / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    pad_w = (tw - new_w) // 2
    pad_h = (th - new_h) // 2
    padded = np.full((th, tw, 3), pad_value, dtype=np.uint8)
    padded[pad_h:pad_h + new_h, pad_w:pad_w + new_w] = resized
    return padded, scale, (pad_w, pad_h)


def convert_coco_to_yolo(
    ann_file: Path,
    images_dir: Path,
    output_dir: Path,
    split: str = "val",
    img_size: int = 640,
) -> Dict[str, Any]:
    """Convert COCO annotations to YOLOv8 format (normalized xywh)."""
    import json as _json
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "images" / split).mkdir(parents=True, exist_ok=True)
    (output_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    if not ann_file.exists():
        logger.warning(f"Annotation file not found: {ann_file}")
        return {"status": "skipped", "reason": "annotation file missing"}

    with open(ann_file) as f:
        data = _json.load(f)

    cat_map = {c["id"]: i for i, c in enumerate(data["categories"])}
    img_map = {img["id"]: img for img in data["images"]}
    ann_by_img: Dict[int, List] = {}
    for ann in data["annotations"]:
        ann_by_img.setdefault(ann["image_id"], []).append(ann)

    processed = 0
    for img_id, img_info in img_map.items():
        W, H = img_info["width"], img_info["height"]
        anns = ann_by_img.get(img_id, [])
        label_lines = []
        for ann in anns:
            cls_id = cat_map.get(ann["category_id"])
            if cls_id is None:
                continue
            x, y, w, h = ann["bbox"]
            cx = (x + w / 2) / W
            cy = (y + h / 2) / H
            nw = w / W
            nh = h / H
            label_lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")

        stem = Path(img_info["file_name"]).stem
        label_file = output_dir / "labels" / split / f"{stem}.txt"
        label_file.write_text("\n".join(label_lines))
        processed += 1

    # YAML config
    yaml_content = f"""path: {output_dir}
train: images/train
val: images/val
nc: {len(cat_map)}
names: {[c['name'] for c in data['categories']]}
"""
    (output_dir / "dataset.yaml").write_text(yaml_content)
    logger.info(f"COCO → YOLO conversion: {processed} images, {len(cat_map)} classes")
    return {"processed": processed, "classes": len(cat_map), "output": str(output_dir)}


def prepare_reid_dataset(
    market_root: Path,
    output_dir: Path,
    img_size: Tuple[int, int] = (256, 128),
) -> Dict[str, Any]:
    """
    Prepare Market-1501 for FastReID training.
    Resizes all images to 256×128 and organizes by identity/split.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    for split in ["bounding_box_train", "bounding_box_test", "query"]:
        split_in  = market_root / split
        split_out = output_dir / split
        split_out.mkdir(exist_ok=True)
        if not split_in.exists():
            continue
        for img_path in split_in.glob("*.jpg"):
            img = cv2.imread(str(img_path))
            if img is None:
                continue
            resized = cv2.resize(img, (img_size[1], img_size[0]))
            out_path = split_out / img_path.name
            cv2.imwrite(str(out_path), resized)
            total += 1
    logger.info(f"ReID preprocessing complete: {total} images → {output_dir}")
    return {"total_images": total, "output": str(output_dir), "size": img_size}


def prepare_mot17_for_bytetrack(
    mot_root: Path,
    output_dir: Path,
) -> Dict[str, Any]:
    """
    Convert MOT17 to ByteTrack-compatible format.
    Creates one directory per sequence with images and detection text.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    seq_count = 0
    for seq_dir in sorted(mot_root.iterdir()):
        if not seq_dir.is_dir() or not seq_dir.name.startswith("MOT17-"):
            continue
        out_seq = output_dir / seq_dir.name
        out_seq.mkdir(exist_ok=True)

        # Copy gt.txt if present
        gt = seq_dir / "gt" / "gt.txt"
        if gt.exists():
            shutil.copy2(gt, out_seq / "gt.txt")

        # Copy seqinfo
        seqinfo = seq_dir / "seqinfo.ini"
        if seqinfo.exists():
            shutil.copy2(seqinfo, out_seq / "seqinfo.ini")

        seq_count += 1
    logger.info(f"MOT17 → ByteTrack: {seq_count} sequences prepared")
    return {"sequences": seq_count, "output": str(output_dir)}


def run_preprocessing(
    dataset: str,
    progress_cb=None,
    **kwargs,
) -> Dict[str, Any]:
    """Dispatch preprocessing by dataset name."""
    from ..datasets.base import DATASETS_ROOT

    if dataset == "coco":
        ann_file = DATASETS_ROOT / "coco" / "annotations" / "instances_val2017.json"
        out = PREPROCESS_ROOT / "coco_yolo"
        result = convert_coco_to_yolo(ann_file, DATASETS_ROOT / "coco" / "val2017", out)
    elif dataset == "market1501":
        from ..datasets.market1501_manager import Market1501DatasetManager
        mgr = Market1501DatasetManager(DATASETS_ROOT / "market1501")
        root = mgr._find_market_root() or DATASETS_ROOT / "market1501"
        out = PREPROCESS_ROOT / "market1501_reid"
        result = prepare_reid_dataset(root, out)
    elif dataset == "mot17":
        from ..datasets.mot17_manager import MOT17DatasetManager
        mgr = MOT17DatasetManager(DATASETS_ROOT / "mot17")
        root = mgr._find_mot_root() or DATASETS_ROOT / "mot17"
        out = PREPROCESS_ROOT / "mot17_bytetrack"
        result = prepare_mot17_for_bytetrack(root, out)
    else:
        result = {"status": "skipped", "reason": f"no preprocessor for {dataset}"}

    if progress_cb:
        progress_cb(100, f"Preprocessing {dataset} complete")
    return result
