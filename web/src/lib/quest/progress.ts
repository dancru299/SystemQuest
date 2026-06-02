import type { Mission } from "@/lib/validation/quest";

export function getMainMissions(missions: Mission[]) {
  return missions.filter((mission) => mission.type === "main");
}

export function getDayProgress(missions: Mission[], completedMissionIds: string[]) {
  const total = missions.length;
  const completed = missions.filter((mission) =>
    completedMissionIds.includes(mission.id),
  ).length;

  return {
    completed,
    total,
    percentage: total ? Math.round((completed / total) * 100) : 0,
  };
}

export function isDayComplete(missions: Mission[], completedMissionIds: string[]) {
  const mainMissions = getMainMissions(missions);
  return (
    mainMissions.length > 0 &&
    mainMissions.every((mission) => completedMissionIds.includes(mission.id))
  );
}

