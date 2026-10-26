import type { Issue } from "@alreadycovered/shared";
import type { AppContext } from "../context.js";
import type { AssembledPacket } from "./readiness.js";

export type PacketBlockView = {
  timetableBlockId: string;
  subject: string;
  startMinute: number;
  endMinute: number;
  materialLink: {
    id: string;
    status: string;
    sourceFileId: string | null;
    sourceFileName: string | null;
    exportPermission: string;
    selectedBy: string;
  } | null;
  instruction: {
    id: string;
    lessonTitle: string;
    summary: string;
    steps: string[];
    unsupportedQuestions: string[];
    modelTag: string;
    citedChunkIds: string[];
  } | null;
  needsGeneration: boolean;
};

export type PacketView = {
  packetId: string;
  profileId: string;
  localDate: string;
  revision: number;
  state: string;
  sourceFingerprint: string;
  blocks: PacketBlockView[];
  issues: Issue[];
};

export async function buildPacketView(ctx: AppContext, profileId: string, userId: string, localDate: string, assembled: AssembledPacket): Promise<PacketView> {
  const blocks: PacketBlockView[] = await Promise.all(
    assembled.blocks.map(async (b) => {
      const link = b.materialLinkId ? await ctx.lessons.getMaterialLinkById(b.materialLinkId) : null;
      const file = link?.sourceFileId ? await ctx.sources.getByIdForUser(link.sourceFileId, userId) : null;
      const instruction = b.generatedInstructionId
        ? await ctx.lessons.getGeneratedInstruction(b.timetableBlock.id, localDate, b.blockFingerprint)
        : null;

      return {
        timetableBlockId: b.timetableBlock.id,
        subject: b.timetableBlock.subject,
        startMinute: b.timetableBlock.startMinute,
        endMinute: b.timetableBlock.endMinute,
        materialLink: link
          ? {
              id: link.id,
              status: link.status,
              sourceFileId: link.sourceFileId,
              sourceFileName: file?.displayName ?? null,
              exportPermission: link.exportPermission,
              selectedBy: link.selectedBy,
            }
          : null,
        instruction: instruction
          ? {
              id: instruction.id,
              lessonTitle: instruction.lessonTitle,
              summary: instruction.summary,
              steps: instruction.steps,
              unsupportedQuestions: instruction.unsupportedQuestions,
              modelTag: instruction.modelTag,
              citedChunkIds: instruction.citedChunkIds,
            }
          : null,
        needsGeneration: b.needsGeneration,
      };
    }),
  );

  return {
    packetId: assembled.packetId,
    profileId,
    localDate,
    revision: assembled.revision,
    state: assembled.state,
    sourceFingerprint: assembled.sourceFingerprint,
    blocks,
    issues: assembled.issues,
  };
}
