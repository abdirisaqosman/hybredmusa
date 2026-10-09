import type { Muscle } from "@plexapro/react-body-highlighter";

/**
 * Which muscles each exercise works, used to draw the body diagram.
 *
 * The exercise rows in the database only carry a single `muscle_group` string, which is enough to
 * group and search but too coarse to shade a body model. This map adds the detail for the built in
 * library, keyed by the stable slug ids from `0001_seed_exercises.sql`. Coach created exercises have
 * random ids, so they fall back to their muscle group, and anything we cannot place gets no diagram
 * rather than a wrong one.
 *
 * `primary` muscles are the movers, `secondary` the assistors. The diagram shades them differently.
 */
export interface MuscleMap {
  primary: Muscle[];
  secondary: Muscle[];
}

const map = (primary: Muscle[], secondary: Muscle[] = []): MuscleMap => ({ primary, secondary });

const byExerciseId: Record<string, MuscleMap> = {
  // Legs
  ex_barbell_back_squat: map(
    ["quadriceps", "gluteal"],
    ["hamstring", "adductor", "lower-back", "abs"],
  ),
  ex_barbell_front_squat: map(["quadriceps"], ["gluteal", "abs", "upper-back"]),
  ex_goblet_squat: map(["quadriceps"], ["gluteal", "abs"]),
  ex_hack_squat: map(["quadriceps"], ["gluteal"]),
  ex_leg_press: map(["quadriceps", "gluteal"], ["hamstring"]),
  ex_bulgarian_split_squat: map(["quadriceps", "gluteal"], ["hamstring", "adductor"]),
  ex_walking_lunge: map(["quadriceps", "gluteal"], ["hamstring", "calves"]),
  ex_leg_extension: map(["quadriceps"]),
  ex_lying_leg_curl: map(["hamstring"], ["calves"]),
  ex_seated_leg_curl: map(["hamstring"], ["calves"]),
  ex_romanian_deadlift: map(["hamstring", "gluteal"], ["lower-back", "forearm"]),
  ex_stiff_leg_deadlift: map(["hamstring", "gluteal"], ["lower-back", "forearm"]),
  ex_conventional_deadlift: map(
    ["lower-back", "gluteal", "hamstring"],
    ["quadriceps", "trapezius", "upper-back", "forearm"],
  ),
  ex_sumo_deadlift: map(
    ["gluteal", "quadriceps", "adductor"],
    ["lower-back", "hamstring", "trapezius", "forearm"],
  ),
  ex_trap_bar_deadlift: map(
    ["quadriceps", "gluteal"],
    ["hamstring", "lower-back", "trapezius", "forearm"],
  ),
  ex_hip_thrust: map(["gluteal"], ["hamstring", "abs"]),
  ex_glute_bridge: map(["gluteal"], ["hamstring", "abs"]),
  ex_cable_kickback: map(["gluteal"], ["hamstring"]),
  ex_standing_calf_raise: map(["calves"]),
  ex_seated_calf_raise: map(["calves"]),

  // Chest
  ex_barbell_bench_press: map(["chest"], ["front-deltoids", "triceps"]),
  ex_incline_barbell_bench_press: map(["chest", "front-deltoids"], ["triceps"]),
  ex_dumbbell_bench_press: map(["chest"], ["front-deltoids", "triceps"]),
  ex_incline_dumbbell_press: map(["chest", "front-deltoids"], ["triceps"]),
  ex_machine_chest_press: map(["chest"], ["front-deltoids", "triceps"]),
  ex_cable_fly: map(["chest"], ["front-deltoids"]),
  ex_pec_deck: map(["chest"], ["front-deltoids"]),
  ex_push_up: map(["chest"], ["front-deltoids", "triceps", "abs"]),
  ex_dip: map(["chest", "triceps"], ["front-deltoids"]),

  // Back
  ex_pull_up: map(["upper-back"], ["biceps", "forearm", "back-deltoids"]),
  ex_chin_up: map(["upper-back", "biceps"], ["forearm", "abs"]),
  ex_lat_pulldown: map(["upper-back"], ["biceps", "forearm"]),
  ex_close_grip_lat_pulldown: map(["upper-back"], ["biceps", "forearm"]),
  ex_seated_cable_row: map(["upper-back"], ["biceps", "trapezius", "forearm"]),
  ex_barbell_row: map(["upper-back"], ["biceps", "trapezius", "lower-back", "forearm"]),
  ex_pendlay_row: map(["upper-back"], ["biceps", "trapezius", "lower-back", "forearm"]),
  ex_dumbbell_row: map(["upper-back"], ["biceps", "trapezius", "forearm"]),
  ex_chest_supported_row: map(["upper-back", "trapezius"], ["biceps", "forearm"]),
  ex_t_bar_row: map(["upper-back"], ["biceps", "trapezius", "forearm"]),
  ex_straight_arm_pulldown: map(["upper-back"], ["triceps", "abs"]),

  // Shoulders
  ex_face_pull: map(["back-deltoids", "trapezius"], ["upper-back"]),
  ex_overhead_press: map(["front-deltoids"], ["triceps", "trapezius", "abs"]),
  ex_seated_dumbbell_press: map(["front-deltoids"], ["triceps", "trapezius"]),
  ex_arnold_press: map(["front-deltoids"], ["triceps", "trapezius"]),
  ex_machine_shoulder_press: map(["front-deltoids"], ["triceps"]),
  ex_lateral_raise: map(["front-deltoids", "back-deltoids"], ["trapezius"]),
  ex_cable_lateral_raise: map(["front-deltoids", "back-deltoids"], ["trapezius"]),
  ex_rear_delt_fly: map(["back-deltoids"], ["trapezius", "upper-back"]),
  ex_upright_row: map(["front-deltoids", "trapezius"], ["biceps", "forearm"]),

  // Biceps
  ex_barbell_curl: map(["biceps"], ["forearm"]),
  ex_ez_bar_curl: map(["biceps"], ["forearm"]),
  ex_dumbbell_curl: map(["biceps"], ["forearm"]),
  ex_incline_dumbbell_curl: map(["biceps"], ["forearm"]),
  ex_hammer_curl: map(["biceps", "forearm"]),
  ex_preacher_curl: map(["biceps"], ["forearm"]),
  ex_cable_curl: map(["biceps"], ["forearm"]),

  // Triceps
  ex_triceps_pushdown: map(["triceps"], ["forearm"]),
  ex_rope_pushdown: map(["triceps"], ["forearm"]),
  ex_overhead_cable_extension: map(["triceps"]),
  ex_skullcrusher: map(["triceps"]),
  ex_close_grip_bench_press: map(["triceps", "chest"], ["front-deltoids"]),
  ex_triceps_dip: map(["triceps"], ["chest", "front-deltoids"]),

  // Core and lower back
  ex_plank: map(["abs"], ["obliques", "front-deltoids", "gluteal"]),
  ex_hanging_leg_raise: map(["abs"], ["obliques", "quadriceps", "forearm"]),
  ex_cable_crunch: map(["abs"], ["obliques"]),
  ex_ab_wheel_rollout: map(["abs"], ["obliques", "front-deltoids", "upper-back"]),
  ex_russian_twist: map(["obliques"], ["abs"]),
  ex_back_extension: map(["lower-back"], ["gluteal", "hamstring"]),

  // Full body
  ex_farmer_carry: map(["forearm", "trapezius"], ["abs", "obliques", "gluteal", "quadriceps"]),
  ex_kettlebell_swing: map(
    ["gluteal", "hamstring"],
    ["lower-back", "abs", "front-deltoids", "trapezius", "forearm"],
  ),

  // Cardio
  ex_treadmill_run: map(["quadriceps", "hamstring", "calves"], ["gluteal"]),
  ex_stationary_bike: map(["quadriceps"], ["gluteal", "hamstring", "calves"]),
  ex_rowing_machine: map(
    ["upper-back", "quadriceps"],
    ["biceps", "gluteal", "hamstring", "lower-back", "forearm"],
  ),
  ex_stair_climber: map(["quadriceps", "gluteal"], ["hamstring", "calves"]),
};

/** Fallback for coach created exercises, which only tell us their muscle group. */
const byMuscleGroup: Record<string, MuscleMap> = {
  legs: map(["quadriceps", "gluteal"], ["hamstring", "calves", "adductor"]),
  quads: map(["quadriceps"], ["gluteal"]),
  quadriceps: map(["quadriceps"], ["gluteal"]),
  hamstrings: map(["hamstring"], ["gluteal"]),
  hamstring: map(["hamstring"], ["gluteal"]),
  glutes: map(["gluteal"], ["hamstring"]),
  gluteal: map(["gluteal"], ["hamstring"]),
  calves: map(["calves"]),
  adductors: map(["adductor"], ["quadriceps"]),
  abductors: map(["abductors"], ["gluteal"]),
  back: map(["upper-back"], ["biceps", "trapezius", "lower-back", "forearm"]),
  lats: map(["upper-back"], ["biceps", "forearm"]),
  "upper back": map(["upper-back", "trapezius"], ["back-deltoids"]),
  "lower back": map(["lower-back"], ["gluteal", "hamstring"]),
  traps: map(["trapezius"], ["back-deltoids"]),
  trapezius: map(["trapezius"], ["back-deltoids"]),
  chest: map(["chest"], ["front-deltoids", "triceps"]),
  shoulders: map(["front-deltoids", "back-deltoids"], ["trapezius"]),
  delts: map(["front-deltoids", "back-deltoids"], ["trapezius"]),
  biceps: map(["biceps"], ["forearm"]),
  triceps: map(["triceps"], ["forearm"]),
  arms: map(["biceps", "triceps"], ["forearm"]),
  forearms: map(["forearm"]),
  core: map(["abs"], ["obliques"]),
  abs: map(["abs"], ["obliques"]),
  obliques: map(["obliques"], ["abs"]),
  neck: map(["neck"]),
  "full body": map(
    ["quadriceps", "gluteal", "upper-back", "chest"],
    ["hamstring", "abs", "front-deltoids", "trapezius", "forearm"],
  ),
  fullbody: map(
    ["quadriceps", "gluteal", "upper-back", "chest"],
    ["hamstring", "abs", "front-deltoids", "trapezius", "forearm"],
  ),
  cardio: map(["quadriceps", "hamstring", "calves"], ["gluteal"]),
};

/**
 * Muscles worked by one exercise, or null when we have nothing trustworthy to draw.
 * Prefers the per exercise detail and falls back to the muscle group.
 */
export function musclesForExercise(
  exerciseId: string,
  muscleGroup?: string | null,
): MuscleMap | null {
  const exact = byExerciseId[exerciseId];
  if (exact) return exact;

  const group = muscleGroup?.trim().toLowerCase();
  if (!group) return null;
  return byMuscleGroup[group] ?? byMuscleGroup[group.replace(/[\s_-]/g, "")] ?? null;
}

/** Merges several exercises into one map, so a whole session can be shaded on one body. */
export function mergeMuscleMaps(maps: (MuscleMap | null)[]): MuscleMap {
  const primary = new Set<Muscle>();
  const secondary = new Set<Muscle>();
  for (const entry of maps) {
    if (!entry) continue;
    for (const muscle of entry.primary) primary.add(muscle);
    for (const muscle of entry.secondary) secondary.add(muscle);
  }
  // A muscle that is primary anywhere should not also be drawn as a secondary.
  for (const muscle of primary) secondary.delete(muscle);
  return { primary: [...primary], secondary: [...secondary] };
}

/** Human readable muscle names for the diagram caption. */
export const muscleLabels: Partial<Record<Muscle, string>> = {
  trapezius: "traps",
  "upper-back": "upper back",
  "lower-back": "lower back",
  chest: "chest",
  biceps: "biceps",
  triceps: "triceps",
  forearm: "forearms",
  "back-deltoids": "rear delts",
  "front-deltoids": "front delts",
  abs: "abs",
  obliques: "obliques",
  adductor: "adductors",
  abductors: "abductors",
  hamstring: "hamstrings",
  quadriceps: "quads",
  calves: "calves",
  gluteal: "glutes",
  neck: "neck",
  head: "head",
  knees: "knees",
  ankles: "ankles",
};

export function muscleLabel(muscle: Muscle): string {
  return muscleLabels[muscle] ?? muscle.replace(/-/g, " ");
}
