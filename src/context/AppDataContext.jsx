import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "./AuthContext";
import {
  addObservationWindow,
  addSessionScreenshot,
  endTeacherSession,
  enrollTeacherFace,
  fetchAppData,
  removeTeacherFace,
  saveTeacherRecord,
  startTeacherSession,
  updateUserProfile
} from "../services/campusService";

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const { user, loading: authLoading, setUserProfile } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh(options = {}) {
    const { silent = false } = options;

    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      const nextData = await fetchAppData(user);
      setData(nextData);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    refresh();
  }, [user, authLoading]);

  const value = useMemo(
    () => ({
      data,
      loading,
      refresh,
      async updateProfile(updates) {
        if (!user) {
          return null;
        }

        try {
          const nextProfile = await updateUserProfile(user, updates);
          setUserProfile(nextProfile);
          toast.success("Profile updated.");
          await refresh();
          return nextProfile;
        } catch (error) {
          toast.error(error.message);
          return null;
        }
      },
      async saveTeacher(payload, existingTeacher) {
        if (!user) {
          return null;
        }

        try {
          const result = await saveTeacherRecord({ existingTeacher, payload });
          toast.success(existingTeacher ? "Teacher updated." : "Teacher registered.");
          await refresh({ silent: true });
          return result;
        } catch (error) {
          toast.error(error.message);
          return null;
        }
      },
      async saveTeacherFace(teacher, descriptor) {
        if (!user) {
          return null;
        }

        try {
          const result = await enrollTeacherFace({
            teacher,
            descriptor,
            actorProfile: user
          });
          toast.success("Teacher face enrolled.");
          await refresh();
          return result;
        } catch (error) {
          toast.error(error.message);
          return null;
        }
      },
      async deleteTeacherFace(teacher) {
        if (!user) {
          return null;
        }

        try {
          const result = await removeTeacherFace(teacher);
          toast.success(
            result?.invalidatedSession
              ? "Teacher face deleted and active monitoring session invalidated."
              : "Teacher face deleted."
          );
          await refresh();
          return result;
        } catch (error) {
          toast.error(error.message);
          return null;
        }
      },
      async startVerifiedSession({ scheduleId, matchedTeacher, audioEnabled, verification }) {
        if (!user) {
          return null;
        }

        try {
          const result = await startTeacherSession({
            scheduleId,
            matchedTeacher,
            actorProfile: user,
            audioEnabled,
            verification
          });
          toast.success(
            verification?.override
              ? "Session started with admin override."
              : "Teacher verified and session started."
          );
          await refresh();
          return result;
        } catch (error) {
          toast.error(error.message);
          return null;
        }
      },
      async captureObservation(sessionId, windowData) {
        if (!user) {
          return null;
        }

        try {
          const result = await addObservationWindow({ sessionId, windowData });
          await refresh();
          return result;
        } catch (error) {
          toast.error(error.message);
          return null;
        }
      },
      async saveSessionScreenshot(sessionId, screenshot) {
        if (!user) {
          return null;
        }

        try {
          const result = await addSessionScreenshot({ sessionId, screenshot });
          await refresh({ silent: true });
          return result;
        } catch (error) {
          toast.error(error.message);
          return null;
        }
      },
      async endSession(sessionId, options = {}) {
        if (!user) {
          return null;
        }

        try {
          const result = await endTeacherSession({
            sessionId,
            actorProfile: user,
            visionAnalysis: options.visionAnalysis ?? null
          });
          toast.success("Class session ended and summary generated.");
          await refresh();
          return result;
        } catch (error) {
          toast.error(error.message);
          return null;
        }
      }
    }),
    [data, loading, user]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider.");
  }

  return context;
}
