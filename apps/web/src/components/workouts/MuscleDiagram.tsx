import { useMemo } from "react";
import { Model, anteriorData, posteriorData } from "@plexapro/react-body-highlighter";
import type { IExerciseData, ISVGModelData, Muscle } from "@plexapro/react-body-highlighter";
import { cn } from "cn";
import { muscleLabel, type MuscleMap } from "@/lib/exerciseMuscles";

/**
 * Front and back body diagram with the worked muscles shaded.
 *
 * Primary movers get the strongest shade, assisting muscles a mid shade. Colors are passed as CSS
 * variable references rather than hex, so the diagram follows the app theme without any JS.
 */

const colors = {
  body: "var(--muted)",
  // Index 0 is used for a frequency of 1 (secondary), index 1 for 2 (primary).
  highlighted: ["var(--muted-foreground)", "var(--foreground)"],
  border: "var(--border)",
};

/**
 * The model draws a general polygon (for example `chest`) and then the left and right copies of the
 * same polygon on top of it, so shading only the general key gets painted over. This index maps each
 * muscle to every key that covers the same polygons, found by matching the raw SVG points, which
 * also catches the pairs that are not named alike (anterior `calves` is drawn as the shin polygons).
 */
function buildOverlapIndex(data: ISVGModelData[]): Record<string, Muscle[]> {
  const byPoints = new Map<string, Muscle[]>();
  for (const entry of data) {
    for (const points of entry.svgPoints) {
      const keys = byPoints.get(points) ?? [];
      keys.push(entry.muscle);
      byPoints.set(points, keys);
    }
  }

  const index: Record<string, Muscle[]> = {};
  for (const entry of data) {
    const keys = new Set<Muscle>();
    for (const points of entry.svgPoints) {
      for (const key of byPoints.get(points) ?? []) keys.add(key);
    }
    index[entry.muscle] = [...keys];
  }
  return index;
}

const anteriorIndex = buildOverlapIndex(anteriorData);
const posteriorIndex = buildOverlapIndex(posteriorData);

/** The soleus has no general key of its own, so shade it along with the calves. */
const extraKeys: Partial<Record<Muscle, Muscle[]>> = {
  calves: ["left-soleus", "right-soleus"],
};

function keysFor(muscle: Muscle, side: "anterior" | "posterior"): Muscle[] {
  const index = side === "anterior" ? anteriorIndex : posteriorIndex;
  const keys = index[muscle] ?? [];
  const extra = (extraKeys[muscle] ?? []).filter((key) => (index[key] ?? []).length > 0);
  return [...keys, ...extra];
}

/** One entry per muscle, with the frequency the model turns into a shade. */
function toModelData(
  muscles: MuscleMap,
  side: "anterior" | "posterior",
  exerciseName: string,
): IExerciseData[] {
  const entries: IExerciseData[] = [];
  const add = (muscle: Muscle, frequency: number) => {
    const keys = keysFor(muscle, side);
    if (keys.length > 0) entries.push({ name: exerciseName, muscles: keys, frequency });
  };
  for (const muscle of muscles.secondary) add(muscle, 1);
  for (const muscle of muscles.primary) add(muscle, 2);
  return entries;
}

interface Props {
  muscles: MuscleMap;
  /** Used for the accessible description and the model tooltips. */
  exerciseName: string;
  /** Height of each body in pixels. */
  height?: number;
  /** Shows the worked muscle names under the bodies. */
  showLegend?: boolean;
  className?: string;
}

export function MuscleDiagram({
  muscles,
  exerciseName,
  height = 150,
  showLegend = false,
  className,
}: Props) {
  const anterior = useMemo(() => toModelData(muscles, "anterior", exerciseName), [
    muscles,
    exerciseName,
  ]);
  const posterior = useMemo(() => toModelData(muscles, "posterior", exerciseName), [
    muscles,
    exerciseName,
  ]);

  if (muscles.primary.length === 0 && muscles.secondary.length === 0) return null;

  const primaryNames = muscles.primary.map(muscleLabel);
  const secondaryNames = muscles.secondary.map(muscleLabel);

  return (
    <figure className={cn("m-0 space-y-1", className)}>
      <div
        className="flex items-end justify-center gap-1"
        role="img"
        aria-label={`Muscles worked by ${exerciseName}: ${primaryNames.join(", ")}${
          secondaryNames.length > 0 ? `, assisted by ${secondaryNames.join(", ")}` : ""
        }`}
      >
        <Model
          type="anterior"
          data={anterior}
          bodyColor={colors.body}
          highlightedColors={colors.highlighted}
          borderColor={colors.border}
          borderWidth={0.4}
          style={{ height, width: height / 2 }}
          svgStyle={{ height: "100%", width: "100%" }}
        />
        <Model
          type="posterior"
          data={posterior}
          bodyColor={colors.body}
          highlightedColors={colors.highlighted}
          borderColor={colors.border}
          borderWidth={0.4}
          style={{ height, width: height / 2 }}
          svgStyle={{ height: "100%", width: "100%" }}
        />
      </div>
      {showLegend && (
        <figcaption className="text-center text-xs text-muted-foreground">
          <span className="text-foreground">{primaryNames.join(", ")}</span>
          {secondaryNames.length > 0 && <> - also {secondaryNames.join(", ")}</>}
        </figcaption>
      )}
    </figure>
  );
}
