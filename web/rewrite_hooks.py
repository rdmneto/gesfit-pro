import re

with open("src/lib/hooks.ts", "r") as f:
    content = f.read()

# Replace useCollection with useLiveCollection inside the generic hooks
content = content.replace("function useCollection<T>", "function useLiveCollection<T>")
content = content.replace("function useDocument<T>", "function useLiveDocument<T>")
content = content.replace("export { useCollection, useDocument };", "export { useLiveCollection, useLiveDocument, useFetchCollection, useFetchDocument };")

# Add the new useFetchCollection and useFetchDocument
fetch_hooks = """
/** Pure React Query collection fetch (no real-time subscription) */
function useFetchCollection<T>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
  fallback: T[] = [],
  deps: unknown[] = [],
): { data: T[]; loading: boolean; error: string | null } {
  const queryKey = ["fetchCollection", collectionPath, ...deps];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!db) return fallback;
      const ref = query(collection(db, collectionPath), ...constraints);
      const snapshot = await getDocs(ref);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    data: data ?? fallback,
    loading: isLoading && !!db,
    error: error instanceof Error ? error.message : null,
  };
}

/** Pure React Query document fetch (no real-time subscription) */
function useFetchDocument<T>(
  collectionPath: string,
  docId: string | null | undefined,
  fallback: T | null = null,
): { data: T | null; loading: boolean; error: string | null } {
  const queryKey = ["fetchDocument", collectionPath, docId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!db || !docId) return fallback;
      const ref = doc(db, collectionPath, docId);
      const snapshot = await getDoc(ref);
      return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
    },
    enabled: !!docId && !!db,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    data: data !== undefined ? data : fallback,
    loading: isLoading && !!docId && !!db,
    error: error instanceof Error ? error.message : null,
  };
}
"""

content = content.replace("export { useLiveCollection, useLiveDocument", fetch_hooks + "\nexport { useLiveCollection, useLiveDocument")

# Now update the domain specific hooks:
# 1. Static ones -> useFetch...
# 2. Live ones -> useLive...

static_hooks = [
    ("useTeam", "useDocument", "useFetchDocument"),
    ("useStudentEnrollments", "useCollection", "useFetchCollection"),
    ("useTrainerEnrollments", "useCollection", "useFetchCollection"),
    ("useStudents", "useCollection", "useFetchCollection"),
    ("useStudent", "useDocument", "useFetchDocument"),
    ("useMeasurements", "useCollection", "useFetchCollection"),
    ("usePendingMeasurements", "useCollection", "useFetchCollection"),
    ("useAllPendingMeasurements", "useCollection", "useFetchCollection"),
    ("useClassProducts", "useCollection", "useFetchCollection"),
    ("useStudentPurchases", "useCollection", "useFetchCollection"),
    ("usePendingPurchases", "useCollection", "useFetchCollection"),
    ("usePaidPurchases", "useCollection", "useFetchCollection"),
    ("useTeamMembers", "useCollection", "useFetchCollection"),
    ("usePartnerRates", "useCollection", "useFetchCollection"),
    ("useActivePartnerTeams", "useCollection", "useFetchCollection"),
    ("usePendingTeamInvites", "useCollection", "useFetchCollection"),
]

live_hooks = [
    ("useWorkoutSessions", "useCollection", "useLiveCollection"),
    ("useBookings", "useCollection", "useLiveCollection"),
    ("useAssignedSessions", "useCollection", "useLiveCollection"),
    ("useTrainerChats", "useCollection", "useLiveCollection"),
]

for hook_name, old_base, new_base in static_hooks + live_hooks:
    # Find the function definition
    # Replace the return statement
    # We need to be careful. useTrainerChats calls useCollection twice.
    if hook_name == "useTrainerChats":
        content = content.replace('useCollection<TrainerChat>', 'useLiveCollection<TrainerChat>')
    else:
        # Regex to find the return statement inside the function
        pattern = r"(export function " + hook_name + r"\b.*?return )" + old_base + r"<"
        content = re.sub(pattern, r"\1" + new_base + "<", content, flags=re.DOTALL)

with open("src/lib/hooks.ts", "w") as f:
    f.write(content)

