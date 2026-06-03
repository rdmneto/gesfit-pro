import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const projectId = "gestao-treinador-rules-test";
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(resolve("firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseData();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore tenant rules", () => {
  it("blocks a student from reading another team", async () => {
    const db = testEnv
      .authenticatedContext("student-a", { role: "student", teamId: "team-a" })
      .firestore();

    await assertFails(getDoc(doc(db, "teams/team-b/students/student-b")));
  });

  it("blocks a student from reading another student in the same team", async () => {
    const db = testEnv
      .authenticatedContext("student-a", { role: "student", teamId: "team-a" })
      .firestore();

    await assertFails(getDoc(doc(db, "teams/team-a/students/student-c")));
  });

  it("allows cancellation outside the 2h window", async () => {
    const db = testEnv
      .authenticatedContext("student-a", { role: "student", teamId: "team-a" })
      .firestore();

    await assertSucceeds(
      updateDoc(doc(db, "teams/team-a/bookings/future-booking"), {
        status: "cancelled",
        cancelledAt: Timestamp.fromDate(new Date()),
      }),
    );
  });

  it("blocks cancellation inside the 2h window", async () => {
    const db = testEnv
      .authenticatedContext("student-a", { role: "student", teamId: "team-a" })
      .firestore();

    await assertFails(
      updateDoc(doc(db, "teams/team-a/bookings/near-booking"), {
        status: "cancelled",
        cancelledAt: Timestamp.fromDate(new Date()),
      }),
    );
  });

  it("denies client writes to subscription payment state", async () => {
    const db = testEnv
      .authenticatedContext("student-a", { role: "student", teamId: "team-a" })
      .firestore();

    await assertFails(
      setDoc(doc(db, "teams/team-a/subscriptions/student-a"), {
        gateway: "asaas",
        gatewaySubscriptionId: "sub_123",
        status: "active",
        lastPaymentStatus: "PAYMENT_CONFIRMED",
        updatedAt: Timestamp.fromDate(new Date()),
      }),
    );
  });

  it("lets a trainer read the whole team", async () => {
    const db = testEnv
      .authenticatedContext("trainer-a", { role: "trainer", teamId: "team-a" })
      .firestore();

    const snapshot = await assertSucceeds(getDoc(doc(db, "teams/team-a/students/student-c")));
    expect(snapshot.exists()).toBe(true);
  });
});

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = Date.now();

    await setDoc(doc(db, "teams/team-a"), {
      name: "Team A",
      slug: "team-a",
      ownerUid: "trainer-a",
      isSolo: false,
      publicListing: true,
      branding: {
        primaryColor: "#0f766e",
        welcomeMessage: "Bem-vindo",
        bio: "Equipe A",
      },
      settings: {
        cancelWindowHours: 2,
        reminderHoursBefore: 3,
        reminderAuto: true,
        reminderTemplate: "Ola {{nome}}",
      },
      createdAt: Timestamp.fromDate(new Date(now - 1_000)),
    });
    await setDoc(doc(db, "teams/team-b"), {
      name: "Team B",
      slug: "team-b",
      ownerUid: "trainer-b",
      isSolo: true,
      publicListing: true,
      branding: {
        primaryColor: "#b45309",
        welcomeMessage: "Bem-vindo",
        bio: "Equipe B",
      },
      settings: {
        cancelWindowHours: 2,
        reminderHoursBefore: 3,
        reminderAuto: true,
        reminderTemplate: "Ola {{nome}}",
      },
      createdAt: Timestamp.fromDate(new Date(now - 1_000)),
    });
    await setDoc(doc(db, "teams/team-a/students/student-a"), {
      uid: "student-a",
      displayName: "Student A",
      status: "active",
      assignedTo: "trainer-a",
      onboarding: {},
      physiological: {},
    });
    await setDoc(doc(db, "teams/team-a/students/student-c"), {
      uid: "student-c",
      displayName: "Student C",
      status: "active",
      assignedTo: "trainer-a",
      onboarding: {},
      physiological: {},
    });
    await setDoc(doc(db, "teams/team-b/students/student-b"), {
      uid: "student-b",
      displayName: "Student B",
      status: "active",
      assignedTo: "trainer-b",
      onboarding: {},
      physiological: {},
    });
    await setDoc(doc(db, "teams/team-a/bookings/future-booking"), {
      studentId: "student-a",
      trainerId: "trainer-a",
      startsAt: Timestamp.fromDate(new Date(now + 3 * 60 * 60 * 1000)),
      endsAt: Timestamp.fromDate(new Date(now + 4 * 60 * 60 * 1000)),
      focus: "Membros inferiores",
      status: "scheduled",
      createdAt: Timestamp.fromDate(new Date(now - 1_000)),
    });
    await setDoc(doc(db, "teams/team-a/bookings/near-booking"), {
      studentId: "student-a",
      trainerId: "trainer-a",
      startsAt: Timestamp.fromDate(new Date(now + 60 * 60 * 1000)),
      endsAt: Timestamp.fromDate(new Date(now + 2 * 60 * 60 * 1000)),
      focus: "Peito e ombros",
      status: "scheduled",
      createdAt: Timestamp.fromDate(new Date(now - 1_000)),
    });
  });
}
