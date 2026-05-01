import * as userRepository from "../repositories/userRepository";

export const userService = {
  deleteStoredUserData: userRepository.deleteStoredUserData,
  exportUserData: userRepository.exportUserData,
  getPublicProfile: userRepository.getPublicProfile,
  getUsageDashboard: userRepository.getUsageDashboard,
  getWorkspace: userRepository.getWorkspace,
  searchWorkspace: userRepository.searchWorkspace,
  syncUser: userRepository.syncUser,
  updateUserPreferences: userRepository.updateUserPreferences,
  updateUserProfile: userRepository.updateUserProfile,
};
