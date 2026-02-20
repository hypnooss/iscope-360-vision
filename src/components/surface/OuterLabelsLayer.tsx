const RADIAN = Math.PI / 180;
const MIN_SPACING = 48;
const HORIZONTAL_LEN = 30;
const MARGIN = 10;

interface LabelItem {
  name: string;
  value: number;
  color: string;
  midAngle: number;
  percent: number;
}

interface OuterLabelsLayerProps {
  techData: Array<{ name: string; value: number; color: string; _total: number }>;
  cx: number;
  cy: number;
  outerRadius: number;
  width: number;
  height: number;
}

export function OuterLabelsLayer({ techData, cx, cy, outerRadius, width, height }: OuterLabelsLayerProps) {
  if (!techData.length || !cx || !cy || !outerRadius) return null;

  const total = techData.reduce((s, d) => s + d.value, 0) || 1;

  const items: LabelItem[] = [];
  let currentAngle = 0;
  for (const d of techData) {
    const sliceAngle = (d.value / total) * 360;
    const midAngle = currentAngle + sliceAngle / 2;
    items.push({
      name: d.name,
      value: d.value,
      color: d.color,
      midAngle,
      percent: d.value / total,
    });
    currentAngle += sliceAngle;
  }

  type SidedItem = LabelItem & { naturalY: number; finalY: number; naturalSide: 'right' | 'left'; ex2: number; ey2: number };
  const extLen = 20;

  const allItems: SidedItem[] = items.map(item => {
    const a = item.midAngle;
    const naturalY = cy - outerRadius * Math.sin(a * RADIAN);
    const cosA = Math.cos(a * RADIAN);
    const extR = outerRadius + extLen;
    const ex2 = cx + extR * Math.cos(a * RADIAN);
    const ey2 = cy - extR * Math.sin(a * RADIAN);
    return { ...item, naturalY, finalY: naturalY, naturalSide: cosA >= 0 ? 'right' : 'left', ex2, ey2 };
  });

  // No balancing — pure side assignment
  const rightItems = allItems.filter(i => i.naturalSide === 'right');
  const leftItems = allItems.filter(i => i.naturalSide === 'left');

  // Sort each group by naturalY (top to bottom)
  rightItems.sort((a, b) => a.naturalY - b.naturalY);
  leftItems.sort((a, b) => a.naturalY - b.naturalY);

  const minY = 20;
  const maxY = height - 20;

  function resolveCollisions(group: SidedItem[]) {
    if (group.length === 0) return;

    for (const item of group) {
      item.finalY = Math.max(minY, Math.min(maxY, item.naturalY));
    }

    // Iterative symmetric relaxation
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      for (let i = 1; i < group.length; i++) {
        const gap = group[i].finalY - group[i - 1].finalY;
        if (gap < MIN_SPACING) {
          const overlap = MIN_SPACING - gap;
          group[i - 1].finalY -= overlap / 2;
          group[i].finalY += overlap / 2;
          moved = true;
        }
      }
      if (!moved) break;
    }

    // Clamp within bounds
    if (group[0].finalY < minY) {
      const shift = minY - group[0].finalY;
      for (const item of group) item.finalY += shift;
    }
    if (group[group.length - 1].finalY > maxY) {
      const shift = group[group.length - 1].finalY - maxY;
      for (const item of group) item.finalY -= shift;
    }

    // Final pass
    for (let i = 1; i < group.length; i++) {
      if (group[i].finalY - group[i - 1].finalY < MIN_SPACING) {
        group[i].finalY = group[i - 1].finalY + MIN_SPACING;
      }
    }
  }

  resolveCollisions(rightItems);
  resolveCollisions(leftItems);

  const MAX_LABEL_CHARS = 18;

  function renderGroup(group: SidedItem[], isRight: boolean) {
    return group.map((item, i) => {
      const a = item.midAngle;
      const ex1 = cx + outerRadius * Math.cos(a * RADIAN);
      const ey1 = cy - outerRadius * Math.sin(a * RADIAN);

      // Dynamic X: extend radially then add horizontal segment
      let ex3 = isRight ? item.ex2 + HORIZONTAL_LEN : item.ex2 - HORIZONTAL_LEN;
      // Clamp within card bounds
      ex3 = isRight
        ? Math.min(ex3, width - MARGIN)
        : Math.max(ex3, MARGIN);

      const ey3 = item.finalY;

      const textAnchor = isRight ? 'start' : 'end';
      const textX = isRight ? ex3 + 6 : ex3 - 6;
      const pct = (item.percent * 100).toFixed(0);
      const displayName = item.name.length > MAX_LABEL_CHARS
        ? item.name.slice(0, MAX_LABEL_CHARS) + '…'
        : item.name;

      return (
        <g key={`label-${isRight ? 'r' : 'l'}-${i}`}>
          <polyline
            points={`${ex1},${ey1} ${item.ex2},${item.ey2} ${ex3},${ey3}`}
            fill="none"
            stroke={item.color}
            strokeWidth={1.2}
            strokeOpacity={0.7}
          />
          <circle cx={ex3} cy={ey3} r={3} fill={item.color} />
          <text
            x={textX}
            y={ey3 - 1}
            textAnchor={textAnchor}
            dominantBaseline="central"
            fontSize={11}
            fontWeight={600}
            fill="hsl(var(--foreground))"
          >
            {displayName}
          </text>
          <text
            x={textX}
            y={ey3 + 14}
            textAnchor={textAnchor}
            dominantBaseline="central"
            fontSize={10}
            fill="hsl(var(--muted-foreground))"
          >
            {item.value} ({pct}%)
          </text>
        </g>
      );
    });
  }

  return (
    <g className="outer-labels-layer">
      {renderGroup(rightItems, true)}
      {renderGroup(leftItems, false)}
    </g>
  );
}
