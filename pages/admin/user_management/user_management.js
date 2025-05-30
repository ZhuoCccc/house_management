const fs = wx.getFileSystemManager();
const db = require('../../../utils/db.js');
const app = getApp();

// Cloud Storage Constants - REPLACE 'YOUR_CLOUD_ENV_ID' WITH YOUR ACTUAL ENVIRONMENT ID
const USER_MANIFEST_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/user_data_json/user_manifest.json'; // Example: cloud://dev-env-12345.xxx/user_data_json/user_manifest.json
const USER_DATA_BASE_CLOUD_PATH = 'user_data_json/'; // Relative path to the folder containing user JSON files

Page({
  data: {
    users: [],
    displayedUsers: [],
    searchQuery: '',
    isLoading: false, // To show a loading indicator
    showAddModal: false,
    showEditModal: false,
    newUser: {
      username: '',
      password: '',
      email: '',
      type: 'user' // 默认添加普通用户
    },
    editingUser: { // 用于编辑时存储当前用户信息
      id: '',
      username: '',
      // password: '', // 安全起见，一般不直接在表单显示和修改密码，或单独处理
      email: '',
      type: 'user',
      newPassword: '' // Added for the new password field in edit modal
    },
    userTypes: ['user', 'admin'], // 可选用户类型
    editingUserOriginalUsername: '', // 用于在编辑时检查用户名是否更改且重复
    navBarHeight: app.globalData.navBarHeight,
  },

  // Helper function to extract relative path from cloud FileID
  getRelativeCloudPath: function(fileID) {
    if (!fileID || !fileID.startsWith('cloud://')) {
      console.error('[getRelativeCloudPath] Invalid or non-cloud fileID provided:', fileID);
      return null;
    }
    const parts = fileID.split('/');
    if (parts.length < 4) {
      console.error('[getRelativeCloudPath] Cannot extract relative path from fileID, structure unexpected:', fileID);
      return null;
    }
    return parts.slice(3).join('/');
  },

  onLoad: function (options) {
    console.log('user_management.js: onLoad triggered');
    this.loadUsers();
  },

  onShow: function () {
    console.log('user_management.js: onShow triggered');
    // Consider if loadUsers is always needed onShow, might cause multiple loads if navigating back and forth
    this.loadUsers();
  },

  loadUsers: async function () {
    console.log('[UserManagement] loadUsers: Starting to load users from cloud storage.');
    this.setData({ isLoading: true, users: [], displayedUsers: [] });

    try {
      // 1. Download or initialize Manifest File
      let userManifest = [];
      let manifestFileID = USER_MANIFEST_CLOUD_PATH;
      let manifestExists = true;

      try {
        console.log('[UserManagement] loadUsers: Attempting to download manifest:', manifestFileID);
        const manifestDownloadRes = await wx.cloud.downloadFile({ fileID: manifestFileID });
        const manifestContentStr = fs.readFileSync(manifestDownloadRes.tempFilePath, 'utf-8');
        userManifest = JSON.parse(manifestContentStr);
        console.log('[UserManagement] loadUsers: Manifest downloaded and parsed. User files listed:', userManifest.length);
      } catch (manifestDownloadError) {
        if (manifestDownloadError.errCode === -404011 || (manifestDownloadError.errMsg && manifestDownloadError.errMsg.includes("does not exist"))) { // File not found
          console.warn('[UserManagement] loadUsers: user_manifest.json not found. Will attempt to create an empty one.');
          manifestExists = false;
          userManifest = []; // Initialize with empty array
        } else {
          console.error('[UserManagement] loadUsers: Error downloading manifest:', manifestDownloadError);
          throw manifestDownloadError; // Re-throw other errors
        }
      }

      if (!manifestExists) {
        try {
          const emptyManifestStr = JSON.stringify([], null, 2);
          const tempManifestPath = `${wx.env.USER_DATA_PATH}/temp_empty_user_manifest.json`;
          fs.writeFileSync(tempManifestPath, emptyManifestStr, 'utf-8');
          const relativeManifestPath = this.getRelativeCloudPath(manifestFileID);
          if (!relativeManifestPath) {
             console.error("[UserManagement] loadUsers: Cannot derive relative path for new manifest from:", manifestFileID);
             throw new Error("Cannot create manifest due to path issue.");
          }
          await wx.cloud.uploadFile({
            cloudPath: relativeManifestPath, // e.g., user_data_json/user_manifest.json
            filePath: tempManifestPath
          });
          console.log('[UserManagement] loadUsers: Empty user_manifest.json created successfully.');
          fs.unlinkSync(tempManifestPath);
        } catch (createManifestError) {
          console.error('[UserManagement] loadUsers: Failed to create empty user_manifest.json:', createManifestError);
          // Continue with empty userManifest array, but log error
        }
      }

      if (!Array.isArray(userManifest)) {
        console.error('[UserManagement] loadUsers: Manifest content is not an array. Found:', userManifest);
        userManifest = []; // Treat as empty if malformed
      }

      // 2. Download each user JSON file based on the manifest
      const loadedUsers = [];
      if (userManifest.length > 0) {
        console.log(`[UserManagement] loadUsers: Attempting to load ${userManifest.length} user files.`);
        for (const userFileName of userManifest) {
          if (typeof userFileName !== 'string' || userFileName.trim() === '') {
            console.warn('[UserManagement] loadUsers: Invalid user filename in manifest:', userFileName);
            continue;
          }
          const userFileCloudPath = USER_DATA_BASE_CLOUD_PATH + userFileName.trim();
          try {
            console.log('[UserManagement] loadUsers: Downloading user file:', userFileCloudPath);
            // We need the full FileID to download, but userFileCloudPath is relative for now.
            // Assuming USER_DATA_BASE_CLOUD_PATH is part of the full manifestFileID structure for simplicity for now.
            // This needs refinement if USER_DATA_BASE_CLOUD_PATH is at a different root than manifest.
            // For now, let's construct a plausible full FileID for download.
            // A more robust way is for user_manifest.json to store full FileIDs or have a known base cloud:// path.
            
            // Let's assume USER_MANIFEST_CLOUD_PATH gives us the base for user files too.
            const cloudPrefix = USER_MANIFEST_CLOUD_PATH.substring(0, USER_MANIFEST_CLOUD_PATH.lastIndexOf('/') - USER_DATA_BASE_CLOUD_PATH.length +1 ); //e.g. cloud://ENV_ID.xxx/
            const fullUserFileIDToDownload = cloudPrefix + userFileCloudPath;

            console.log('[UserManagement] loadUsers: Attempting to download with constructed full FileID:', fullUserFileIDToDownload);

            const downloadRes = await wx.cloud.downloadFile({ fileID: fullUserFileIDToDownload });
            const fileContent = fs.readFileSync(downloadRes.tempFilePath, 'utf-8');
            const userData = JSON.parse(fileContent);
            userData.fileName = userFileName.trim(); // Store filename for easier updates/deletions later
            console.log(`[Debug] loadUsers: User: ${userData.username}, FileName assigned: ${userData.fileName}, Original userFileName from manifest: ${userFileName}`); // Added for debugging
            loadedUsers.push(userData);
            console.log('[UserManagement] loadUsers: Successfully loaded and parsed user:', userData.username, 'FileName:', userData.fileName);
          } catch (userLoadError) {
            console.error(`[UserManagement] loadUsers: Failed to load or parse user file ${userFileCloudPath}:`, userLoadError);
            // Optionally, add this error to a list to show the user which files failed
          }
        }
      } else {
        console.log('[UserManagement] loadUsers: Manifest is empty. No user files to load.');
      }

      this.setData({ users: loadedUsers, isLoading: false });
      this.updateDisplayedUsers();
      console.log('[UserManagement] loadUsers: Finished loading users. Count:', loadedUsers.length);

    } catch (error) {
      console.error('[UserManagement] loadUsers: General error during user loading process:', error);
      this.setData({ isLoading: false, users: [] });
      wx.showToast({ title: '加载用户列表失败', icon: 'error', duration: 2000 });
    }
  },

  handleSearchInput: function(e) {
    const searchQuery = e.detail.value;
    this.setData({ searchQuery: searchQuery });
    if (!searchQuery) { // If search query is cleared, update display immediately
        this.updateDisplayedUsers(); 
    }
  },

  handleSearchConfirm: function() {
    this.updateDisplayedUsers();
  },

  clearSearchQuery: function() {
    this.setData({ searchQuery: '' });
    this.updateDisplayedUsers();
  },

  updateDisplayedUsers: function() {
    const allUsers = this.data.users;
    const query = this.data.searchQuery.toLowerCase().trim();

    if (!query) {
      this.setData({ displayedUsers: allUsers });
      return;
    }

    const filtered = allUsers.filter(user => {
      const nameMatch = user.username && user.username.toLowerCase().includes(query);
      const emailMatch = user.email && user.email.toLowerCase().includes(query);
      return nameMatch || emailMatch;
    });
    this.setData({ displayedUsers: filtered });
  },

  // --- 添加用户相关 --- 
  openAddModal: function () {
    this.setData({
      showAddModal: true,
      newUser: {
        username: '',
        password: '',
        email: '',
        type: 'user'
      }
    });
  },

  closeAddModal: function () {
    this.setData({ showAddModal: false });
  },

  handleAddInputChange: function (e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`newUser.${field}`]: e.detail.value
    });
  },

  handleAddUserTypeChange: function(e) {
    this.setData({
      'newUser.type': this.data.userTypes[e.detail.value]
    });
  },

  confirmAddUser: async function () {
    const { username, password, email, type } = this.data.newUser;
    if (!username || !password || !email) {
      wx.showToast({ title: '用户名、密码和邮箱不能为空', icon: 'none' });
      return;
    }
    // Basic email validation (can be more complex)
    if (!email.includes('@')) {
        wx.showToast({ title: '请输入有效的邮箱地址', icon: 'none' });
        return;
    }
    // Basic password length (can be more complex)
    if (password.length < 6) {
        wx.showToast({ title: '密码至少需要6位', icon: 'none' });
        return;
    }

    wx.showLoading({ title: '添加用户中...' });

    try {
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const registrationDate = new Date().toISOString();
      const newUserJsonFileName = `user_${username.trim().replace(/\s+/g, '_')}_${Date.now()}.json`;
      
      const newUserCloudPath = USER_DATA_BASE_CLOUD_PATH + newUserJsonFileName;

      const userData = {
        id: newUserId,
        username: username.trim(),
        password: password, // In a real app, hash the password before saving!
        email: email.trim(),
        type: type,
        registrationDate: registrationDate,
        avatarFileID: null, // Default
        // Add any other default fields for a new user
      };

      // 1. Upload the new user's JSON data
      const tempUserFilePath = `${wx.env.USER_DATA_PATH}/${newUserJsonFileName}`;
      fs.writeFileSync(tempUserFilePath, JSON.stringify(userData, null, 2), 'utf-8');
      
      console.log('[UserManagement] confirmAddUser: Uploading new user JSON to:', newUserCloudPath);
      await wx.cloud.uploadFile({
        cloudPath: newUserCloudPath, // Relative path
        filePath: tempUserFilePath
      });
      fs.unlinkSync(tempUserFilePath); // Clean up local temp file
      console.log('[UserManagement] confirmAddUser: New user JSON uploaded successfully.');

      // 2. Update the manifest file
      let userManifest = [];
      try {
        const manifestDownloadRes = await wx.cloud.downloadFile({ fileID: USER_MANIFEST_CLOUD_PATH });
        userManifest = JSON.parse(fs.readFileSync(manifestDownloadRes.tempFilePath, 'utf-8'));
      } catch (e) {
        // Manifest might not exist or be empty, which is handled if it's an array later
        console.warn('[UserManagement] confirmAddUser: Could not download or parse existing manifest, will create/overwrite.', e);
        userManifest = []; // Initialize as empty if error
      }

      if (!Array.isArray(userManifest)) { // Ensure it's an array
          console.warn('[UserManagement] confirmAddUser: Manifest was not an array, re-initializing.');
          userManifest = [];
      }

      userManifest.push(newUserJsonFileName); // Add the new user's filename

      const tempManifestPath = `${wx.env.USER_DATA_PATH}/temp_user_manifest_updated.json`;
      fs.writeFileSync(tempManifestPath, JSON.stringify(userManifest, null, 2), 'utf-8');
      
      const relativeManifestPath = this.getRelativeCloudPath(USER_MANIFEST_CLOUD_PATH);
      if (!relativeManifestPath) {
          wx.hideLoading();
          wx.showToast({ title: 'Manifest路径错误', icon: 'error' });
          console.error("[UserManagement] confirmAddUser: Could not derive relative manifest path from:", USER_MANIFEST_CLOUD_PATH);
          // Attempt to delete the just-uploaded user JSON to avoid orphaned file
          try { await wx.cloud.deleteFile({ fileList: [newUserCloudPath] }); } catch (delErr) { console.error("Failed to delete orphaned user JSON after manifest error", delErr);}
          return;
      }

      console.log('[UserManagement] confirmAddUser: Uploading updated manifest to:', relativeManifestPath);
      await wx.cloud.uploadFile({
        cloudPath: relativeManifestPath, // Relative path to overwrite manifest
        filePath: tempManifestPath
      });
      fs.unlinkSync(tempManifestPath);
      console.log('[UserManagement] confirmAddUser: Manifest updated successfully.');

      wx.hideLoading();
      wx.showToast({ title: '用户添加成功', icon: 'success' });
      this.closeAddModal();
      this.loadUsers(); // Refresh the user list

    } catch (error) {
      wx.hideLoading();
      console.error('[UserManagement] confirmAddUser: Error adding user:', error);
      wx.showToast({ title: '添加用户失败，请重试', icon: 'error' });
    }
  },

  // --- 修改用户相关 --- 
  openEditModal: function (e) {
    console.log('[Debug] openEditModal dataset:', e.currentTarget.dataset); // Added for debugging
    const userFileName = e.currentTarget.dataset.filename; 
    // const userToEdit = this.data.users.find(user => user.fileName === userFileName);
    // Defensive check for userFileName itself before finding
    if (!userFileName) {
      wx.showToast({ title: '无法获取用户信息 (文件名丢失)', icon: 'none' });
      console.error("[UserManagement] openEditModal: e.currentTarget.dataset.filename is undefined or empty.");
      return;
    }

    const userToEdit = this.data.users.find(user => user.fileName === userFileName);

    if (userToEdit) {
      console.log("[UserManagement] openEditModal: Editing user:", userToEdit.username, "FileName:", userFileName);
      this.setData({
        showEditModal: true,
        editingUser: { 
          ...userToEdit, // Spread existing user data (which includes fileName and id)
          newPassword: '' // Initialize newPassword as empty
        }, 
        // We might not need editingUserOriginalUsername if usernames are immutable or filenames are ID-based
        // For now, let's keep it if your UI might still allow username field changes, for validation logic.
        editingUserOriginalUsername: userToEdit.username 
      });
    } else {
      wx.showToast({ title: '未找到用户信息', icon: 'none' });
      console.error("[UserManagement] openEditModal: Could not find user with fileName:", userFileName, "in this.data.users");
    }
  },

  closeEditModal: function () {
    this.setData({ showEditModal: false });
  },

  handleEditInputChange: function (e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`editingUser.${field}`]: e.detail.value
    });
  },
  
  handleEditUserTypeChange: function(e) {
    this.setData({
      'editingUser.type': this.data.userTypes[e.detail.value]
    });
  },

  confirmEditUser: async function () {
    const { id, username, email, type, newPassword, fileName } = this.data.editingUser;
    
    if (!username || !email) {
      wx.showToast({ title: '用户名和邮箱不能为空', icon: 'none' });
      return;
    }
    if (!email.includes('@')) {
      wx.showToast({ title: '请输入有效的邮箱地址', icon: 'none' });
      return;
    }
    if (newPassword && newPassword.length < 6 && newPassword.length > 0) { // only validate if newPassword is not empty
        wx.showToast({ title: '新密码至少需要6位', icon: 'none' });
        return;
    }

    wx.showLoading({ title: '更新中...' });

    try {
      // 1. Fetch the original user data to preserve fields not in the edit form (like original password if not changing)
      // This is crucial if `this.data.editingUser` doesn't hold the complete user object.
      const userFileCloudPath = USER_DATA_BASE_CLOUD_PATH + fileName;
      const tempFullFileIDBase = USER_MANIFEST_CLOUD_PATH.substring(0, USER_MANIFEST_CLOUD_PATH.lastIndexOf('/') - USER_DATA_BASE_CLOUD_PATH.length +1 );
      const fullUserFileIDToDownload = tempFullFileIDBase + userFileCloudPath;

      let originalUserData = {};
      try {
        console.log("[UserManagement] confirmEditUser: Fetching original user data from", fullUserFileIDToDownload);
        const downloadRes = await wx.cloud.downloadFile({ fileID: fullUserFileIDToDownload });
        originalUserData = JSON.parse(fs.readFileSync(downloadRes.tempFilePath, 'utf-8'));
      } catch (fetchErr) {
        console.error("[UserManagement] confirmEditUser: Failed to fetch original user data for update:", fetchErr);
        throw new Error("无法获取原始用户数据以更新。");
      }

      // 2. Prepare the updated user data object
      const updatedUserData = {
        ...originalUserData, // Start with all original data
        username: username.trim(),
        email: email.trim(),
        type: type,
        // id: id, // id should not change from originalUserData
        // registrationDate from originalUserData will be preserved
        // avatarFileID from originalUserData will be preserved
      };

      if (newPassword) { // If a new password was entered, update it
        updatedUserData.password = newPassword; // SECURITY: Hash this in a real app!
      } else {
        // Password remains as it was in originalUserData, already spread.
      }
      
      // Note: Username change affecting filename is not handled here.
      // If username changes and filename is based on username, manifest and file rename logic is needed.
      // Assuming filename (and thus user ID for file access) is stable.

      // 3. Upload the updated user JSON data
      const tempUserEditFilePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
      fs.writeFileSync(tempUserEditFilePath, JSON.stringify(updatedUserData, null, 2), 'utf-8');
      
      const relativeUserFilePath = this.getRelativeCloudPath(fullUserFileIDToDownload); // Get relative path for upload
       if (!relativeUserFilePath) {
          console.error("[UserManagement] confirmEditUser: Cannot derive relative path for user file upload from:", fullUserFileIDToDownload);
          throw new Error("User file path error during edit.");
      }

      console.log('[UserManagement] confirmEditUser: Uploading updated user JSON to:', relativeUserFilePath);
      await wx.cloud.uploadFile({
        cloudPath: relativeUserFilePath, 
        filePath: tempUserEditFilePath
      });
      fs.unlinkSync(tempUserEditFilePath);
      console.log('[UserManagement] confirmEditUser: User data updated successfully in cloud.');

      // 4. Update local UI
      const userIndex = this.data.users.findIndex(u => u.fileName === fileName);
      if (userIndex !== -1) {
        const updatedUsers = [...this.data.users];
        updatedUsers[userIndex] = { ...updatedUsers[userIndex], ...updatedUserData, fileName: fileName }; // Ensure fileName is preserved
        this.setData({ users: updatedUsers });
        this.updateDisplayedUsers(); // Update displayed users after edit
      } else {
        this.loadUsers(); // Fallback to full reload if user not found in local list (should not happen)
      }
      
      this.closeEditModal();
      wx.hideLoading();
      wx.showToast({ title: '用户信息更新成功', icon: 'success' });

    } catch (err) {
      wx.hideLoading();
      console.error('[UserManagement] confirmEditUser: Error updating user:', err);
      wx.showToast({ title: err.message || '更新失败，请重试', icon: 'none', duration: 3000 });
    }
  },

  // Renamed from deleteUser and implemented for cloud storage
  confirmCloudDeleteUser: async function (e) {
    console.log('[Debug] confirmCloudDeleteUser dataset:', e.currentTarget.dataset); // Added for debugging
    const userFileName = e.currentTarget.dataset.filename;
    if (!userFileName) {
      wx.showToast({ title: '无法获取用户信息（文件名丢失）', icon: 'none' });
      console.error("[UserManagement] confirmCloudDeleteUser: Filename is undefined from dataset.");
      return;
    }
    const userToDelete = this.data.users.find(u => u.fileName === userFileName);
    if (!userToDelete) {
      wx.showToast({ title: '未找到该用户', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除用户 "${userToDelete.username}" 吗？此操作不可恢复。`,
      confirmText: "删除",
      confirmColor: "#ee0a24",
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          try {
            const userFileCloudPath = USER_DATA_BASE_CLOUD_PATH + userFileName;
            // Construct full FileID for deletion - this needs to be accurate.
            // Assuming userFileCloudPath is relative to the root for deletion if prefix method is complex here
            // More robust: store full FileID in userManifest or on user object upon load.
            // For now, try deleting directly with relative path, which works if permissions are set at folder level.
            // Let's use getRelativeCloudPath based on a known full path structure (like manifest path)
            const tempFullFileIDBase = USER_MANIFEST_CLOUD_PATH.substring(0, USER_MANIFEST_CLOUD_PATH.lastIndexOf('/') - USER_DATA_BASE_CLOUD_PATH.length +1 );
            const fullFileIDToDelete = tempFullFileIDBase + userFileCloudPath;

            console.log('[UserManagement] Attempting to delete user JSON:', fullFileIDToDelete);
            await wx.cloud.deleteFile({ fileList: [fullFileIDToDelete] });
            console.log('[UserManagement] User JSON file deleted successfully:', userFileName);

            // Update manifest.json
            let userManifest = [];
            try {
              const manifestDownloadRes = await wx.cloud.downloadFile({ fileID: USER_MANIFEST_CLOUD_PATH });
              userManifest = JSON.parse(fs.readFileSync(manifestDownloadRes.tempFilePath, 'utf-8'));
            } catch (manifestReadError) {
              console.error('[UserManagement] Failed to download or parse manifest.json for delete:', manifestReadError);
              // If manifest can't be read, we can't safely update it. Critical error.
              throw new Error('无法更新用户列表，请检查清单文件。'); 
            }

            const updatedManifest = userManifest.filter(name => name !== userFileName);
            if (updatedManifest.length === userManifest.length) {
                console.warn("[UserManagement] User filename not found in manifest for deletion, but proceeding:", userFileName);
            }

            const updatedManifestStr = JSON.stringify(updatedManifest, null, 2);
            const tempManifestUploadPath = `${wx.env.USER_DATA_PATH}/temp_manifest_delete_${Date.now()}.json`;
            fs.writeFileSync(tempManifestUploadPath, updatedManifestStr, 'utf-8');
            
            // Determine relative path for manifest upload
            const relativeManifestPath = this.getRelativeCloudPath(USER_MANIFEST_CLOUD_PATH);
            if (!relativeManifestPath) {
                console.error("[UserManagement] Cannot derive relative path for manifest upload from:", USER_MANIFEST_CLOUD_PATH);
                throw new Error("Manifest path error during delete.");
            }

            await wx.cloud.uploadFile({
              cloudPath: relativeManifestPath, // e.g., user_data_json/user_manifest.json
              filePath: tempManifestUploadPath
            });
            fs.unlinkSync(tempManifestUploadPath);
            console.log('[UserManagement] user_manifest.json updated successfully after deleting user.');

            // Update local UI
            const remainingUsers = this.data.users.filter(user => user.fileName !== userFileName);
            this.setData({ users: remainingUsers });
            this.updateDisplayedUsers(); // Update displayed users after delete

            wx.hideLoading();
            wx.showToast({ title: '用户删除成功', icon: 'success' });

          } catch (err) {
            wx.hideLoading();
            console.error('[UserManagement] Error deleting user:', err);
            wx.showToast({ title: err.message || '删除失败，请重试', icon: 'none', duration: 3000 });
          }
        }
      }
    });
  },

  // --- 删除用户相关 --- 
  deleteUser: async function (e) {
    const userFileNameToDelete = e.currentTarget.dataset.userid; // Assuming this is the fileName of the user's JSON
    const userToDelete = this.data.users.find(user => user.fileName === userFileNameToDelete);

    if (!userToDelete) {
        wx.showToast({ title: '未找到该用户', icon: 'none' });
        console.error("[UserManagement] deleteUser: User with fileName not found:", userFileNameToDelete);
        return;
    }

    // Add any pre-deletion checks here if necessary (e.g., cannot delete last admin)

    wx.showModal({
      title: '确认删除用户',
      content: `确定要删除用户 "${userToDelete.username}" 吗？此操作不可逆，相关数据将从云端移除。`,
      confirmColor: "#ee0a24",
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          try {
            // 1. Delete the user's JSON file from cloud storage
            const userJsonPathToDelete = USER_DATA_BASE_CLOUD_PATH + userFileNameToDelete;
            console.log("[UserManagement] deleteUser: Attempting to delete user JSON:", userJsonPathToDelete);
            await wx.cloud.deleteFile({ fileList: [userJsonPathToDelete] }); // deleteFile expects relative paths in fileList
            console.log("[UserManagement] deleteUser: User JSON file deleted successfully from cloud.", userJsonPathToDelete);

            // (Optional) TODO: If user has an avatar (userToDelete.avatarFileID), delete it here and log failures.
            // if (userToDelete.avatarFileID) { try { await wx.cloud.deleteFile({ fileList: [userToDelete.avatarFileID]}); } catch(avatarErr) { console.error('Failed to delete avatar', avatarErr); /* log failure */ } }

            // 2. Update the manifest file
            let userManifest = [];
            try {
              const manifestDownloadRes = await wx.cloud.downloadFile({ fileID: USER_MANIFEST_CLOUD_PATH });
              userManifest = JSON.parse(fs.readFileSync(manifestDownloadRes.tempFilePath, 'utf-8'));
            } catch (downloadError) {
              // If manifest doesn't exist or is corrupted, we can't remove from it, but the user file is deleted.
              // This state is problematic. For now, log and proceed, but ideally, this should be more robust.
              console.error("[UserManagement] deleteUser: Failed to download or parse manifest for update. User file was deleted. Manifest might be inconsistent.", downloadError);
              // Depending on strategy, you might want to stop here or attempt to recreate a manifest from scratch later.
              // For now, we'll assume if manifest is broken, there's not much to remove from.
              userManifest = []; 
            }

            if (!Array.isArray(userManifest)) userManifest = []; // Ensure it's an array

            const updatedManifest = userManifest.filter(fileName => fileName !== userFileNameToDelete);

            if (updatedManifest.length !== userManifest.length) { // Only update if a change occurred
              const tempManifestPath = `${wx.env.USER_DATA_PATH}/temp_user_manifest_delete.json`;
              fs.writeFileSync(tempManifestPath, JSON.stringify(updatedManifest, null, 2), 'utf-8');
              
              const relativeManifestPath = this.getRelativeCloudPath(USER_MANIFEST_CLOUD_PATH);
              if (!relativeManifestPath) {
                // Critical error: user JSON deleted, but manifest update will fail.
                console.error("[UserManagement] deleteUser: CANNOT UPDATE MANIFEST - relative path derivation failed from:", USER_MANIFEST_CLOUD_PATH);
                wx.showToast({ title: '清单更新路径错误', icon: 'error' });
                // At this point, the user JSON is deleted, but the manifest is stale. This is bad.
                // Consider a recovery mechanism or more robust error handling here.
              } else {
                console.log("[UserManagement] deleteUser: Uploading updated manifest after deleting user:", userFileNameToDelete);
                await wx.cloud.uploadFile({
                  cloudPath: relativeManifestPath,
                  filePath: tempManifestPath
                });
                fs.unlinkSync(tempManifestPath);
                console.log("[UserManagement] deleteUser: Manifest updated successfully.");
              }
            } else {
              console.warn("[UserManagement] deleteUser: User filename was not found in the manifest. No manifest update needed.", userFileNameToDelete);
            }

            wx.hideLoading();
            wx.showToast({ title: '用户已删除', icon: 'success' });
            this.loadUsers(); // Refresh the list

          } catch (error) {
            wx.hideLoading();
            console.error('[UserManagement] deleteUser: Error deleting user:', error);
            wx.showToast({ title: '删除失败，请重试', icon: 'error' });
          }
        }
      }
    });
  }
}); 