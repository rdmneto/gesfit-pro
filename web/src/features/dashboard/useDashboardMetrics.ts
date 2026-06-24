import { useState, useMemo } from "react";
import { isSameDay } from "./dashboardUtils";
import { useTeam, useTrainerStudents, useWorkoutSessions, usePaidPurchases } from "../../lib/hooks";

export function useDashboardMetrics(trainerId?: string, teamId?: string) {
  const { data: dbTeam, loading: teamLoading } = useTeam(teamId);
  const { data: dbStudents, loading: studentsLoading } = useTrainerStudents(trainerId);
  const { data: dbWorkoutSessions, loading: workoutsLoading } = useWorkoutSessions(
    trainerId ? { trainerId } : {}
  );
  const { data: dbPaidPurchases } = usePaidPurchases(teamId);

  const loading = teamLoading || studentsLoading || workoutsLoading;

  const defaultBranding = {
    bannerPhotoURL: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1600&q=80",
    primaryColor: "#0f766e",
    secondaryColor: "#f59e0b",
    welcomeMessage: "Foco nos treinos!",
    bio: "",
  };

  const team = dbTeam
    ? { ...dbTeam, branding: { ...defaultBranding, ...dbTeam.branding } }
    : { name: "Meu Time", branding: defaultBranding };

  const students = dbStudents ?? [];
  const trainerWorkouts = useMemo(() => {
    const list = dbWorkoutSessions ?? [];
    return [...list].sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));
  }, [dbWorkoutSessions]);

  const activeStudents = useMemo(
    () => students.filter((s) => s.enrollment?.status === "active"),
    [students],
  );

  const pendingRequestCount = useMemo(
    () => students.filter((s) => s.enrollment?.status === "pending").length,
    [students],
  );

  const [nowTime] = useState(() => Date.now());
  
  const unfinishedPastWorkouts = useMemo(() => {
    return trainerWorkouts.filter(w => {
      const isPast = new Date(w.startsAt).getTime() < nowTime;
      const isPending = w.status === "scheduled" || w.status === "in_progress";
      return isPast && isPending;
    });
  }, [trainerWorkouts, nowTime]);

  const todayWorkouts = useMemo(() => {
    return trainerWorkouts.filter((w) => isSameDay(w.startsAt, new Date()));
  }, [trainerWorkouts]);

  const nextWorkouts = useMemo(() => {
    return trainerWorkouts.filter((w) => {
      const isFuture = new Date(w.startsAt).getTime() >= nowTime;
      const isPending = w.status === "scheduled" || w.status === "in_progress";
      return isFuture && isPending;
    }).slice(0, 5);
  }, [trainerWorkouts, nowTime]);

  const totalMinutesToday = useMemo(() => {
    return todayWorkouts.reduce((s, w) => s + w.durationMinutes, 0);
  }, [todayWorkouts]);

  const uniqueStudentsToday = useMemo(() => {
    return new Set(todayWorkouts.map((w) => w.studentId)).size;
  }, [todayWorkouts]);

  const monthRevenue = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return (dbPaidPurchases ?? [])
      .filter((p) => String(p.reviewedAt || p.submittedAt || "").startsWith(ym))
      .reduce((sum, p) => sum + (p.amountCents || 0), 0) / 100;
  }, [dbPaidPurchases]);

  const presenceRate = useMemo(() => {
    const marked = trainerWorkouts.filter((w) => w.status === "completed" || w.status === "no_show");
    if (marked.length === 0) return 100;
    const attended = marked.filter((w) => w.status === "completed").length;
    return Math.round((attended / marked.length) * 100);
  }, [trainerWorkouts]);

  const noShowCount = useMemo(
    () => trainerWorkouts.filter((w) => w.status === "no_show").length,
    [trainerWorkouts],
  );

  const remainingCreditsCount = useMemo(() => {
    return activeStudents.reduce((sum, s) => {
      const quota = s.enrollment?.classesQuota ?? 0;
      const used = s.enrollment?.classesUsed ?? 0;
      return sum + (quota - used);
    }, 0);
  }, [activeStudents]);

  const subTrainersPerformance = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    const stats: Record<string, { id: string; name: string; completed: number }> = {};
    
    for (const w of trainerWorkouts) {
      if (w.assignedToId && w.status === "completed" && w.completedAt?.startsWith(ym)) {
        if (!stats[w.assignedToId]) {
          stats[w.assignedToId] = {
            id: w.assignedToId,
            name: w.assignedToName || "Sub-treinador",
            completed: 0
          };
        }
        stats[w.assignedToId].completed++;
      }
    }
    
    return Object.values(stats).sort((a, b) => b.completed - a.completed);
  }, [trainerWorkouts]);

  return {
    loading,
    team,
    activeStudents,
    pendingRequestCount,
    unfinishedPastWorkouts,
    todayWorkouts,
    nextWorkouts,
    totalMinutesToday,
    uniqueStudentsToday,
    monthRevenue,
    presenceRate,
    noShowCount,
    remainingCreditsCount,
    subTrainersPerformance,
  };
}
