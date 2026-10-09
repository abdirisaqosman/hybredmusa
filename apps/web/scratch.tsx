import { createRoot } from "react-dom/client";
import { MuscleDiagram } from "@/components/workouts/MuscleDiagram";
import { musclesForExercise } from "@/lib/exerciseMuscles";
import "./src/index.css";

const ids = [
  ["ex_barbell_bench_press", "Barbell Bench Press"],
  ["ex_barbell_back_squat", "Barbell Back Squat"],
  ["ex_pull_up", "Pull Up"],
  ["ex_standing_calf_raise", "Standing Calf Raise"],
  ["ex_barbell_curl", "Barbell Curl"],
  ["ex_russian_twist", "Russian Twist"],
];

createRoot(document.getElementById("root")!).render(
  <div className="flex flex-wrap gap-6 bg-background p-6">
    {ids.map(([id, name]) => {
      const muscles = musclesForExercise(id, null);
      return muscles ? (
        <MuscleDiagram key={id} muscles={muscles} exerciseName={name} height={200} showLegend />
      ) : null;
    })}
  </div>,
);
