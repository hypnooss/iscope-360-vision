const RADIAN = Math.PI / 180;
const MIN_SPACING = 48;
const HORIZONTAL_LEN = 40;
const MARGIN = 16;

interface SliceData {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  name: string;
  value: number;
  percent: number;
  color: string;
}

interface SidedItem {
  name: string;
  value: number;
  color: string;
  percent: number;
  cx: number;
  cy: number;
  ex1: number;
  ey1: number;
  ex2: number;
  ey2: number;
  naturalY: number;
  finalY: number;
  isRight: boolean;
  isBottom: boolean;
}

interface OuterLabelsLayerProps {
  sliceData: SliceData[];
  techData: Array<{ name: string; value: number; color: string; _total: number }>;
  width: number;
  height: number;
}

export function OuterLabelsLayer({ sliceData, techData, width, height }: OuterLabelsLayerProps) {
  if (!sliceData?.length || !techData.length || !width || !height) return null;

  const extLen = 20;
  const total = techData.reduce((s, d) => s + d.value, 0) || 1;

  // Build items using REAL Recharts coordinates
  const allItems: SidedItem[] = sliceData
    .filter(s => s && s.cx && s.cy)
    .map((slice, i) => {
      const { cx, cy, midAngle, outerRadius } = slice;
      const td = techData[i];
      const color = td?.color || slice.color;
      const name = td?.name || slice.name;
      const value = td?.value ?? slice.value;

      // Use Recharts' exact convention: cos(-midAngle), sin(-midAngle)
      const ex1 = cx + outerRadius * Math.cos(-midAngle * RADIAN);
      const ey1 = cy + outerRadius * Math.sin(-midAngle * RADIAN);
      const extR = outerRadius + extLen;
      const ex2 = cx + extR * Math.cos(-midAngle * RADIAN);
      const ey2 = cy + extR * Math.sin(-midAngle * RADIAN);

      const isRight = ex2 >= cx;
      const isBottom = ey2 > cy;

      return {
        name, value, color,
        percent: value / total,
        cx, cy,
        ex1, ey1, ex2, ey2,
        naturalY: ey2,
        finalY: ey2,
        isRight,
        isBottom,
      };
    });

  if (!allItems.length) return null;

  // Group into 4 quadrants based on real position
  const groups = {
    topRight: allItems.filter(i => i.isRight && !i.isBottom),
    topLeft: allItems.filter(i => !i.isRight && !i.isBottom),
    bottomRight: allItems.filter(i => i.isRight && i.isBottom),
    bottomLeft: allItems.filter(i => !i.isRight && i.isBottom),
  };

  const minY = 20;
  const maxY = height - 20;

  function resolveCollisions(group: SidedItem[], pushDown: boolean) {
    // Sort by naturalY: top-to-bottom
    group.sort((a, b) => a.naturalY - b.naturalY);
    for (const item of group) {
      item.finalY = Math.max(minY, Math.min(maxY, item.naturalY));
    }

    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      if (pushDown) {
        // Push downward on collision
        for (let i = 1; i < group.length; i++) {
          if (group[i].finalY - group[i - 1].finalY < MIN_SPACING) {
            group[i].finalY = group[i - 1].finalY + MIN_SPACING;
            moved = true;
          }
        }
      } else {
        // Push upward on collision
        for (let i = group.length - 2; i >= 0; i--) {
          if (group[i + 1].finalY - group[i].finalY < MIN_SPACING) {
            group[i].finalY = group[i + 1].finalY - MIN_SPACING;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    // Clamp
    if (group.length) {
      if (group[0].finalY < minY) {
        const shift = minY - group[0].finalY;
        for (const item of group) item.finalY += shift;
      }
      if (group[group.length - 1].finalY > maxY) {
        const shift = group[group.length - 1].finalY - maxY;
        for (const item of group) item.finalY -= shift;
      }
    }
  }

  // Top quadrants: push upward; Bottom quadrants: push downward
  resolveCollisions(groups.topRight, false);
  resolveCollisions(groups.topLeft, false);
  resolveCollisions(groups.bottomRight, true);
  resolveCollisions(groups.bottomLeft, true);

  const MAX_LABEL_CHARS = 18;

  function renderGroup(group: SidedItem[]) {
    return group.map((item, i) => {
      const { ex1, ey1, ex2, isRight, isBottom, cy } = item;
      const ey3 = item.finalY;

      let ex3 = isRight ? ex2 + HORIZONTAL_LEN : ex2 - HORIZONTAL_LEN;
      ex3 = isRight
        ? Math.min(ex3, width - MARGIN)
        : Math.max(ex3, MARGIN);

      const textAnchor = isRight ? 'start' : 'end';
      const textX = isRight ? ex3 + 6 : ex3 - 6;
      const pct = (item.percent * 100).toFixed(0);
      const displayName = item.name.length > MAX_LABEL_CHARS
        ? item.name.slice(0, MAX_LABEL_CHARS) + '…'
        : item.name;

      // Direction based on REAL hemisphere from Recharts
      const textGoesDown = isBottom;
      const nameY = textGoesDown ? ey3 + 12 : ey3 - 22;
      const valueY = textGoesDown ? ey3 + 25 : ey3 - 9;

      const key = `label-${isRight ? 'r' : 'l'}-${isBottom ? 'b' : 't'}-${i}`;

      return (
        <g key={key}>
          <polyline
            points={`${ex1},${ey1} ${ex2},${item.ey2} ${ex3},${ey3}`}
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
      {renderGroup(groups.topRight)}
      {renderGroup(groups.topLeft)}
      {renderGroup(groups.bottomRight)}
      {renderGroup(groups.bottomLeft)}
    </g>
  );
}
