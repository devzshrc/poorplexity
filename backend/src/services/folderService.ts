import * as folderRepository from "../repositories/folderRepository";

export const folderService = {
  createFolder: folderRepository.createFolder,
  deleteFolder: folderRepository.deleteFolder,
  renameFolder: folderRepository.renameFolder,
};
