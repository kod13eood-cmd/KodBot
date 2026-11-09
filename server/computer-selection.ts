/** A stored bot record writes `computer: null` for Auto, while older code and
 * the TypeScript field use `undefined`. Normalise both before the turn
 * dispatcher tests the destination; routines may override Auto with cloud. */
export type ComputerDestination = "cloud" | "vm" | "local" | "off" | undefined;

export function resolveComputerDestination(
  runOn: "crew" | "cloud" | undefined,
  computer: "cloud" | "vm" | "local" | "off" | null | undefined,
): ComputerDestination {
  if (runOn === "cloud") return "cloud";
  return computer ?? undefined;
}
