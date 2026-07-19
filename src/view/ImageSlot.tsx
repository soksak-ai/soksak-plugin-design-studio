// image-slot — 이미지 드래그 앤 드롭 슬롯. 채워지면 cover 렌더, 비면 대각선 해칭 placeholder.
// 저장은 소유 섹션의 images[slotKey](dataURL) — 스토어 커밋 경로로만 변이한다.
import { useState, type DragEvent } from "react";
import { FONT_MONO } from "@/styles";
import { useExportMode } from "@/view/common";

export function ImageSlot(props: {
  src?: string;
  placeholder: string;
  radius?: number;
  dark: boolean;
  /** DOM 투명성 — 노출 주소(data-node). 외부(ui.input.dnd files)가 이미지 드롭을 구동한다. */
  node?: string;
  onImage: (dataURL: string) => void;
}) {
  const [over, setOver] = useState(false);
  const exportMode = useExportMode();
  const rad = props.radius ?? 0;
  if (exportMode) {
    if (props.src)
      return (
        <div style={{ width: "100%", height: "100%", borderRadius: rad, overflow: "hidden" }}>
          <img src={props.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      );
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: rad,
          background: props.dark
            ? "repeating-linear-gradient(45deg,#1b2740,#1b2740 8px,#22304f 8px,#22304f 16px)"
            : "repeating-linear-gradient(45deg,#e7ecf1,#e7ecf1 8px,#eff3f7 8px,#eff3f7 16px)",
        }}
      />
    );
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") props.onImage(reader.result);
    };
    reader.readAsDataURL(file);
  };
  if (props.src) {
    return (
      <div
        data-node={props.node}
        style={{ width: "100%", height: "100%", borderRadius: rad, overflow: "hidden" }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
      >
        <img src={props.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  return (
    <div
      data-node={props.node}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: rad,
        background: props.dark
          ? "repeating-linear-gradient(45deg,#1b2740,#1b2740 8px,#22304f 8px,#22304f 16px)"
          : "repeating-linear-gradient(45deg,#e7ecf1,#e7ecf1 8px,#eff3f7 8px,#eff3f7 16px)",
        border: over ? "1.5px dashed var(--cs-accent)" : "1px solid transparent",
        display: "grid",
        placeItems: "center",
        fontFamily: FONT_MONO,
        fontSize: 9.5,
        color: props.dark ? "#5f7096" : "#8a94a3",
        letterSpacing: ".04em",
        textAlign: "center",
        padding: 8,
      }}
    >
      {props.placeholder}
    </div>
  );
}
