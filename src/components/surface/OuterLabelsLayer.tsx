const RADIAN = Math.PI / 180;
const MIN_SPACING = 48;

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

  // Natural side assignment based on cosine
  type SidedItem = LabelItem & { naturalY: number; finalY: number; naturalSide: 'right' | 'left' };
  const allItems: SidedItem[] = items.map(item => {
    const a = item.midAngle;
    const naturalY = cy - outerRadius * Math.sin(a * RADIAN);
    const cosA = Math.cos(a * RADIAN);
    return { ...item, naturalY, finalY: naturalY, naturalSide: cosA >= 0 ? 'right' : 'left' };
  });

  // Balance: if one side has too many more, move boundary items to the other side
  let rightItems = allItems.filter(i => i.naturalSide === 'right');
  let leftItems = allItems.filter(i => i.naturalSide === 'left');

  const maxImbalance = 2;
  while (rightItems.length - leftItems.length > maxImbalance) {
    // Move the right-side item closest to the boundary (angle near 90° or 270°)
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < rightItems.length; i++) {
      const a = rightItems[i].midAngle % 360;
      const distTo90 = Math.abs(a - 90);
      const distTo270 = Math.abs(a - 270);
      const dist = Math.min(distTo90, distTo270);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      const [moved] = rightItems.splice(bestIdx, 1);
      leftItems.push(moved);
    } else break;
  }
  while (leftItems.length - rightItems.length > maxImbalance) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < leftItems.length; i++) {
      const a = leftItems[i].midAngle % 360;
      const distTo90 = Math.abs(a - 90);
      const distTo270 = Math.abs(a - 270);
      const dist = Math.min(distTo90, distTo270);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      const [moved] = leftItems.splice(bestIdx, 1);
      rightItems.push(moved);
    } else break;
  }

  // Sort each group by naturalY (top to bottom)
  rightItems.sort((a, b) => a.naturalY - b.naturalY);
  leftItems.sort((a, b) => a.naturalY - b.naturalY);

  const minY = 20;
  const maxY = height - 20;

  // Improved collision resolution: anchor to natural positions, spread symmetrically
  function resolveCollisions(group: SidedItem[]) {
    if (group.length === 0) return;

    // Start from natural positions
    for (const item of group) {
      item.finalY = Math.max(minY, Math.min(maxY, item.naturalY));
    }

    // Iterative relaxation: push overlapping pairs apart symmetrically
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      for (let i = 1; i < group.length; i++) {
        const gap = group[i].finalY - group[i - 1].finalY;
        if (gap < MIN_SPACING) {
          const overlap = MIN_SPACING - gap;
          const pushUp = overlap / 2;
          const pushDown = overlap / 2;
          group[i - 1].finalY -= pushUp;
          group[i].finalY += pushDown;
          moved = true;
        }
      }
      if (!moved) break;
    }

    // Clamp within bounds and re-resolve if needed
    if (group[0].finalY < minY) {
      const shift = minY - group[0].finalY;
      for (const item of group) item.finalY += shift;
    }
    if (group[group.length - 1].finalY > maxY) {
      const shift = group[group.length - 1].finalY - maxY;
      for (const item of group) item.finalY -= shift;
    }

    // Final pass to ensure no overlaps after clamping
    for (let i = 1; i < group.length; i++) {
      if (group[i].finalY - group[i - 1].finalY < MIN_SPACING) {
        group[i].finalY = group[i - 1].finalY + MIN_SPACING;
      }
    }
  }

  resolveCollisions(rightItems);
  resolveCollisions(leftItems);

  const EDGE_MARGIN = 200;
  const MAX_LABEL_CHARS = 18;
  const extLen = 20;

  function renderGroup(group: SidedItem[], isRight: boolean) {
    return group.map((item, i) => {
      const a = item.midAngle;
      const ex1 = cx + outerRadius * Math.cos(a * RADIAN);
      const ey1 = cy - outerRadius * Math.sin(a * RADIAN);

      const extR = outerRadius + extLen;
      const ex2 = cx + extR * Math.cos(a * RADIAN);
      const ey2 = cy - extR * Math.sin(a * RADIAN);

      const ex3 = isRight ? width - EDGE_MARGIN : EDGE_MARGIN;
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
            points={`${ex1},${ey1} ${ex2},${ey2} ${ex3},${ey3}`}
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
