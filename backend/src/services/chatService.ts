import * as chatRepository from "../repositories/chatRepository";

export const chatService = {
  appendMessage: chatRepository.appendMessage,
  archiveChat: chatRepository.archiveChat,
  branchChat: chatRepository.branchChat,
  buildAssistantMetadata: chatRepository.buildAssistantMetadata,
  createChat: chatRepository.createChat,
  getChatContext: chatRepository.getChatContext,
  getChatDetail: chatRepository.getChatDetail,
  getMessageEntitlement: chatRepository.getMessageEntitlement,
  pinChat: chatRepository.pinChat,
  restoreChat: chatRepository.restoreChat,
  rewriteChatFromMessage: chatRepository.rewriteChatFromMessage,
  softDeleteChat: chatRepository.softDeleteChat,
  updateChat: chatRepository.updateChat,
};
