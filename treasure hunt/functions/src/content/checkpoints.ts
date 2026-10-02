/**
 * checkpoints.ts — Content tied to a campus checkpoint.
 *
 * ⚠️  PLACEHOLDER FILE — All strings are TODO_* placeholders.
 *     The story/AR team must replace these before the event.
 *
 * Keyed by checkpoint (GAMEPLAY.md §3):
 *   stationReaction  plays when this checkpoint is solved
 *   locationClue     the riddle that sends a team TO this checkpoint
 *   objectHint       what this checkpoint's scan object looks like
 */

import type { CampusCheckpointId, ObjectHintView, ReactionView } from "../schema.js";

export interface CheckpointContent {
  stationReaction: ReactionView;
  locationClue: string;
  objectHint: ObjectHintView;
}

export const CHECKPOINT_CONTENT: Record<CampusCheckpointId, CheckpointContent> = {
  CP2: {
    stationReaction: { text: "TODO_REACTION_CP2", audioUrl: "TODO_REACTION_AUDIO_CP2" },
    locationClue: "TODO_CLUE_CP2",
    objectHint: { text: "TODO_OBJECT_HINT_CP2", imageUrl: "TODO_OBJECT_HINT_IMAGE_CP2" },
  },
  CP3: {
    stationReaction: { text: "TODO_REACTION_CP3", audioUrl: "TODO_REACTION_AUDIO_CP3" },
    locationClue: "TODO_CLUE_CP3",
    objectHint: { text: "TODO_OBJECT_HINT_CP3", imageUrl: "TODO_OBJECT_HINT_IMAGE_CP3" },
  },
  CP4: {
    stationReaction: { text: "TODO_REACTION_CP4", audioUrl: "TODO_REACTION_AUDIO_CP4" },
    locationClue: "TODO_CLUE_CP4",
    objectHint: { text: "TODO_OBJECT_HINT_CP4", imageUrl: "TODO_OBJECT_HINT_IMAGE_CP4" },
  },
  CP5: {
    stationReaction: { text: "TODO_REACTION_CP5", audioUrl: "TODO_REACTION_AUDIO_CP5" },
    locationClue: "TODO_CLUE_CP5",
    objectHint: { text: "TODO_OBJECT_HINT_CP5", imageUrl: "TODO_OBJECT_HINT_IMAGE_CP5" },
  },
  CP6: {
    stationReaction: { text: "TODO_REACTION_CP6", audioUrl: "TODO_REACTION_AUDIO_CP6" },
    locationClue: "TODO_CLUE_CP6",
    objectHint: { text: "TODO_OBJECT_HINT_CP6", imageUrl: "TODO_OBJECT_HINT_IMAGE_CP6" },
  },
  CP7: {
    stationReaction: { text: "TODO_REACTION_CP7", audioUrl: "TODO_REACTION_AUDIO_CP7" },
    locationClue: "TODO_CLUE_CP7",
    objectHint: { text: "TODO_OBJECT_HINT_CP7", imageUrl: "TODO_OBJECT_HINT_IMAGE_CP7" },
  },
  CP8: {
    stationReaction: { text: "TODO_REACTION_CP8", audioUrl: "TODO_REACTION_AUDIO_CP8" },
    locationClue: "TODO_CLUE_CP8",
    objectHint: { text: "TODO_OBJECT_HINT_CP8", imageUrl: "TODO_OBJECT_HINT_IMAGE_CP8" },
  },
};
