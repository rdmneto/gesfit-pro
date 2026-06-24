import os
import re

FILES = [
    "src/features/dashboard/PendingPurchasesList.tsx",
    "src/features/team/TeamManagementPanel.tsx",
    "src/features/team/PartnerFinancialPanel.tsx",
    "src/features/team/SubTrainerInviteBanner.tsx",
    "src/lib/enrollments.ts",
    "src/pages/MeasurementsPage.tsx",
    "src/pages/TeamsPage.tsx",
    "src/pages/StudentClassesPage.tsx",
    "src/pages/TrainerWorkspacePage.tsx",
    "src/pages/TeamLandingPage.tsx",
    "src/pages/PackagesPage.tsx",
    "src/pages/StudentProfilePage.tsx"
]

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Determine import path to main.tsx
    depth = filepath.count('/') - 1
    import_path = "../" * depth + "main"
    if "queryClient" not in content:
        import_stmt = f'import {{ queryClient }} from "{import_path}";\n'
        # Insert import after the last import
        last_import = content.rfind('import ')
        if last_import != -1:
            end_of_last_import = content.find('\n', last_import) + 1
            content = content[:end_of_last_import] + import_stmt + content[end_of_last_import:]
        else:
            content = import_stmt + content

    # Find mutations and append invalidation
    # We want to match: await addDoc(...), await updateDoc(...), await setDoc(...), await deleteDoc(...)
    # and safely append: queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });

    # Because there might be multi-line await setDoc(...) we can't just regex perfectly,
    # but we can look for "await updateDoc" "await addDoc" "await setDoc" "await deleteDoc"
    # Wait, it's safer to just invalidate at the end of the success blocks or try blocks.
    # Actually, a regex that matches `await (updateDoc|addDoc|setDoc|deleteDoc)\([^;]+;`
    # will work if the statement ends with a semicolon.
    # Let's try it.
    
    pattern = re.compile(r'(await (updateDoc|addDoc|setDoc|deleteDoc)\(.*?\);)', re.DOTALL)
    
    # We shouldn't invalidate infinitely or multiple times in the same block if there are multiple awaits,
    # but queryClient.invalidateQueries batches automatically in React Query, so calling it 5 times is fine.
    
    def repl(m):
        original = m.group(1)
        # Avoid duplicating
        if "queryClient.invalidateQueries" in original:
            return original
        return f'{original}\n      queryClient.invalidateQueries({{ queryKey: ["fetchCollection"] }});'

    new_content = pattern.sub(repl, content)

    # Some might not have semicolon if prettier wasn't run, but most do.
    # What if it doesn't end with semicolon but instead is inside an array map? Promise.all(sessions.map(s => addDoc(...)))
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for f in FILES:
    process_file(f)

