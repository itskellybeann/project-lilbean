import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/auth";
import BottomNav from "./components/BottomNav";
import Login from "./pages/Login";
import Today from "./pages/Today";
import Settings from "./pages/Settings";
import Household from "./pages/Household";
import ExerciseLibrary from "./pages/workouts/ExerciseLibrary";
import ExerciseDetail from "./pages/workouts/ExerciseDetail";
import RoutineList from "./pages/workouts/RoutineList";
import RoutineEditor from "./pages/workouts/RoutineEditor";
import ActiveWorkout from "./pages/workouts/ActiveWorkout";
import WorkoutHistory from "./pages/workouts/WorkoutHistory";
import WorkoutsHome from "./pages/workouts/WorkoutsHome";
import PRFeed from "./pages/workouts/PRFeed";
import Diary from "./pages/nutrition/Diary";
import AddFood from "./pages/nutrition/AddFood";
import Recipes from "./pages/nutrition/Recipes";
import Trends from "./pages/nutrition/Trends";
import BodyHome from "./pages/body/BodyHome";
import ProgressPhotos from "./pages/body/ProgressPhotos";
import HealthMetrics from "./pages/body/HealthMetrics";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20">
      {children}
      <BottomNav />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950 text-white/40">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Today />} />

        <Route path="/workouts" element={<WorkoutsHome />} />
        <Route path="/workouts/exercises" element={<ExerciseLibrary />} />
        <Route path="/workouts/exercises/:id" element={<ExerciseDetail />} />
        <Route path="/workouts/routines" element={<RoutineList />} />
        <Route path="/workouts/routines/new" element={<RoutineEditor />} />
        <Route path="/workouts/routines/:id/edit" element={<RoutineEditor />} />
        <Route path="/workouts/active/:id" element={<ActiveWorkout />} />
        <Route path="/workouts/history" element={<WorkoutHistory />} />
        <Route path="/workouts/prs" element={<PRFeed />} />

        <Route path="/nutrition" element={<Diary />} />
        <Route path="/nutrition/add" element={<AddFood />} />
        <Route path="/nutrition/recipes" element={<Recipes />} />
        <Route path="/nutrition/trends" element={<Trends />} />

        <Route path="/body" element={<BodyHome />} />
        <Route path="/body/photos" element={<ProgressPhotos />} />
        <Route path="/body/health" element={<HealthMetrics />} />

        <Route path="/settings" element={<Settings />} />
        <Route path="/household" element={<Household />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
