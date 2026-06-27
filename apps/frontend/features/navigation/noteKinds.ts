import type { NoteKind } from "@/types/api";

/** Shared between the place detail page and the route screen's arrival
 * card so community guidance for interior/private destinations (which
 * gate, which floor, which room) groups the same way everywhere. */
export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  entrance: "Entrance",
  floor: "Floor",
  room: "Room",
  landmark: "Landmark",
  general: "General",
};

export const NOTE_KIND_ORDER: NoteKind[] = ["entrance", "floor", "room", "landmark", "general"];
