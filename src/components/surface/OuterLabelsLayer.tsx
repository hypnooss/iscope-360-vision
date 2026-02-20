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

  // Recharts default: startAngle=0 (3 o'clock), endAngle=360, counter-clockwise
  const items: LabelItem[] = [];
  let currentAngle = 0; // Recharts default startAngle
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

  // Split into right (cos >= 0) and left (cos < 0)
  const rightItems: (LabelItem & { naturalY: number; finalY: number })[] = [];
  const leftItems: (LabelItem & { naturalY: number; finalY: number })[] = [];

  for (const item of items) {
    const a = item.midAngle;
    // Recharts coordinate: x = cx + r * cos(angle), y = cy - r * sin(angle)
    const naturalY = cy - outerRadius * Math.sin(a * RADIAN);
    const cosA = Math.cos(a * RADIAN);

    if (cosA >= 0) {
      rightItems.push({ ...item, naturalY, finalY: naturalY });
    } else {
      leftItems.push({ ...item, naturalY, finalY: naturalY });
    }
  }

  // Sort each group by naturalY (top to bottom)
  rightItems.sort((a, b) => a.naturalY - b.naturalY);
  leftItems.sort((a, b) => a.naturalY - b.naturalY);

  const minY = 20;
  const maxY = height - 20;

  function resolveCollisions(group: typeof rightItems) {
    if (group.length === 0) return;

    // Step 1: resolve overlaps
    for (let i = 1; i < group.length; i++) {
      if (group[i].finalY - group[i - 1].finalY < MIN_SPACING) {
        group[i].finalY = group[i - 1].finalY + MIN_SPACING;
      }
    }

    // Step 2: center block around cy
    const topBlock = group[0].finalY;
    const bottomBlock = group[group.length - 1].finalY;
    const blockCenter = (topBlock + bottomBlock) / 2;
    const offset = cy - blockCenter;
    for (const item of group) {
      item.finalY += offset;
    }

    // Step 3: clamp within bounds
    if (group[0].finalY < minY) {
      const shift = minY - group[0].finalY;
      for (const item of group) item.finalY += shift;
    }
    if (group[group.length - 1].finalY > maxY) {
      const shift = group[group.length - 1].finalY - maxY;
      for (const item of group) item.finalY -= shift;
    }

    // Step 4: re-resolve collisions after centering/clamping
    for (let i = 1; i < group.length; i++) {
      if (group[i].finalY - group[i - 1].finalY < MIN_SPACING) {
        group[i].finalY = group[i - 1].finalY + MIN_SPACING;
      }
    }
  }

  resolveCollisions(rightItems);
  resolveCollisions(leftItems);

  const EDGE_MARGIN = 55;
  const extLen = 20;

  function renderGroup(group: typeof rightItems, isRight: boolean) {
    return group.map((item, i) => {
      const a = item.midAngle;
      const ex1 = cx + outerRadius * Math.cos(a * RADIAN);
      const ey1 = cy - outerRadius * Math.sin(a * RADIAN);

      const extR = outerRadius + extLen;
      const ex2 = cx + extR * Math.cos(a * RADIAN);
      const ey2 = cy - extR * Math.sin(a * RADIAN);

      // Position labels at container edges
      const ex3 = isRight ? width - EDGE_MARGIN : EDGE_MARGIN;
      const ey3 = item.finalY;

      const textAnchor = isRight ? 'start' : 'end';
      const textX = isRight ? ex3 + 6 : ex3 - 6;
      const pct = (item.percent * 100).toFixed(0);

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
            {item.name}
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
