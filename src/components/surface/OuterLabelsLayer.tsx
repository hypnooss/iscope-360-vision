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

type Quadrant = 'top-right' | 'top-left' | 'bottom-left' | 'bottom-right';

type SidedItem = LabelItem & {
  naturalY: number;
  finalY: number;
  quadrant: Quadrant;
  ex2: number;
  ey2: number;
};

function getQuadrant(midAngle: number): Quadrant {
  const a = ((midAngle % 360) + 360) % 360;
  if (a < 90) return 'top-right';
  if (a < 180) return 'top-left';
  if (a < 270) return 'bottom-left';
  return 'bottom-right';
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

  const extLen = 20;

  const allItems: SidedItem[] = items.map(item => {
    const a = item.midAngle;
    const naturalY = cy - outerRadius * Math.sin(a * RADIAN);
    const extR = outerRadius + extLen;
    const ex2 = cx + extR * Math.cos(a * RADIAN);
    const ey2 = cy - extR * Math.sin(a * RADIAN);
    return { ...item, naturalY, finalY: naturalY, quadrant: getQuadrant(a), ex2, ey2 };
  });

  // Group by quadrant
  const quadrants: Record<Quadrant, SidedItem[]> = {
    'top-right': [],
    'top-left': [],
    'bottom-left': [],
    'bottom-right': [],
  };
  for (const item of allItems) {
    quadrants[item.quadrant].push(item);
  }

  const minY = 20;
  const maxY = height - 20;

  // Top quadrants: sort by naturalY descending (bottom-to-top), resolve upward
  // Bottom quadrants: sort by naturalY ascending (top-to-bottom), resolve downward

  function resolveTop(group: SidedItem[]) {
    group.sort((a, b) => b.naturalY - a.naturalY); // bottom first
    for (const item of group) {
      item.finalY = Math.max(minY, Math.min(maxY, item.naturalY));
    }
    // Push upward on collision (iterate from bottom to top, i.e. index 0 is bottom-most)
    for (let i = group.length - 2; i >= 0; i--) {
      if (group[i].finalY - group[i + 1].finalY > -MIN_SPACING) {
        // group[i] should be above group[i+1]... wait, sorted desc so group[0].finalY > group[1].finalY
        // Actually: sorted descending by naturalY, so group[0] is the one closest to center (highest naturalY = lowest on screen for top quadrant... no)
        // naturalY = cy - outerRadius * sin(a). For top quadrant (0-180°), sin > 0, so naturalY < cy. Lower naturalY = higher on screen.
        // Descending by naturalY means group[0] has the largest naturalY = lowest on screen (closest to center line)
      }
    }
    // Simpler approach: sort so that on-screen order is top-to-bottom, then resolve
    group.sort((a, b) => a.naturalY - b.naturalY); // top of screen first (smallest Y)
    for (const item of group) {
      item.finalY = Math.max(minY, Math.min(maxY, item.naturalY));
    }
    // Push items upward: if two collide, move the upper one up
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      for (let i = group.length - 2; i >= 0; i--) {
        const gap = group[i + 1].finalY - group[i].finalY;
        if (gap < MIN_SPACING) {
          // Push item[i] upward
          group[i].finalY = group[i + 1].finalY - MIN_SPACING;
          moved = true;
        }
      }
      if (!moved) break;
    }
    // Clamp top
    if (group.length && group[0].finalY < minY) {
      const shift = minY - group[0].finalY;
      for (const item of group) item.finalY += shift;
    }
  }

  function resolveBottom(group: SidedItem[]) {
    group.sort((a, b) => a.naturalY - b.naturalY); // top of screen first
    for (const item of group) {
      item.finalY = Math.max(minY, Math.min(maxY, item.naturalY));
    }
    // Push items downward: if two collide, move the lower one down
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      for (let i = 1; i < group.length; i++) {
        const gap = group[i].finalY - group[i - 1].finalY;
        if (gap < MIN_SPACING) {
          group[i].finalY = group[i - 1].finalY + MIN_SPACING;
          moved = true;
        }
      }
      if (!moved) break;
    }
    // Clamp bottom
    if (group.length && group[group.length - 1].finalY > maxY) {
      const shift = group[group.length - 1].finalY - maxY;
      for (const item of group) item.finalY -= shift;
    }
  }

  resolveTop(quadrants['top-right']);
  resolveTop(quadrants['top-left']);
  resolveBottom(quadrants['bottom-right']);
  resolveBottom(quadrants['bottom-left']);

  const MAX_LABEL_CHARS = 18;

  function renderGroup(group: SidedItem[]) {
    return group.map((item, i) => {
      const a = item.midAngle;
      const isRight = item.ex2 >= cx;
      const ex1 = cx + outerRadius * Math.cos(a * RADIAN);
      const ey1 = cy - outerRadius * Math.sin(a * RADIAN);

      let ex3 = isRight ? item.ex2 + HORIZONTAL_LEN : item.ex2 - HORIZONTAL_LEN;
      ex3 = isRight
        ? Math.min(ex3, width - MARGIN)
        : Math.max(ex3, MARGIN);

      const ey3 = item.finalY;

      const textGoesDown = ey3 >= cy;
      const textAnchor = isRight ? 'start' : 'end';
      const textX = isRight ? ex3 + 6 : ex3 - 6;
      const pct = (item.percent * 100).toFixed(0);
      const displayName = item.name.length > MAX_LABEL_CHARS
        ? item.name.slice(0, MAX_LABEL_CHARS) + '…'
        : item.name;

      const nameY = textGoesDown ? ey3 + 5 : ey3 - 16;
      const valueY = textGoesDown ? ey3 + 18 : ey3 - 3;

      return (
        <g key={`label-${item.quadrant}-${i}`}>
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
            y={nameY}
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
            y={valueY}
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
      {renderGroup(quadrants['top-right'])}
      {renderGroup(quadrants['top-left'])}
      {renderGroup(quadrants['bottom-right'])}
      {renderGroup(quadrants['bottom-left'])}
    </g>
  );
}
