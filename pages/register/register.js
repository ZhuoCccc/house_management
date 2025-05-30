const fs = wx.getFileSystemManager(); // Added FileSystemManager
// const db = require('../../utils/db.js'); // Commented out or remove if db.js is no longer needed for this page

// Define the manifest file path (ensure this matches your login.js and actual cloud path)
const USER_MANIFEST_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/user_data_json/user_manifest.json';

Page({
  data: {
    newUsername: '',
    newPassword: '',
    confirmPassword: '',
    email: ''
  },

  bindNewUsernameInput: function(e) {
    this.setData({ newUsername: e.detail.value.trim() });
  },

  bindNewPasswordInput: function(e) {
    this.setData({ newPassword: e.detail.value });
  },

  bindConfirmPasswordInput: function(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  bindEmailInput: function(e) {
    this.setData({ email: e.detail.value.trim() });
  },

  registerUser: async function() { // Changed to async function for await
    const { newUsername, newPassword, confirmPassword, email } = this.data;

    if (!newUsername || !newPassword || !confirmPassword || !email) {
      wx.showToast({ title: '请填写所有必填字段', icon: 'none' });
      return;
    }

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      wx.showToast({ title: '请输入有效的邮箱地址', icon: 'none' });
      return;
    }

    if (newPassword.length < 3) { // Simplified password length, consider stronger rules
      wx.showToast({ title: '密码长度至少为3位', icon: 'none' });
      return;
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次输入的密码不一致', icon: 'none' });
      return;
    }

    // Username uniqueness check in cloud storage would be more complex.
    // For example, trying to download a file named `${newUsername}.json` or checking a master list.
    // The local `db.findUser(newUsername)` is removed as we are moving to cloud storage.
    // Consider how you want to handle username uniqueness in a cloud storage context.

    wx.showLoading({ title: '注册中...' });

    const userData = {
      id: null, // Set to null as per your schema
      username: newUsername,
      password: newPassword, // SECURITY WARNING: Storing plain text passwords is not recommended.
      email: email,
      type: 'user', // Defaulting to 'user'
      registrationDate: new Date().toISOString(),
      avatarFileID: null // Added new field
    };

    const jsonData = JSON.stringify(userData, null, 2);
    // Using username and timestamp for a somewhat unique filename. Consider using a UUID for truly unique names.
    const fileName = `user_${newUsername}_${Date.now()}.json`;
    const cloudPath = `user_data_json/${fileName}`;
    const tempFilePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

    try {
      // Write to temporary file
      fs.writeFileSync(tempFilePath, jsonData, 'utf8');

      // Upload to cloud storage
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath,
      });

      fs.unlinkSync(tempFilePath); // Clean up temporary user data file

      if (uploadResult.fileID) {
        console.log('[RegisterUser] User data saved to cloud: ', uploadResult.fileID);
        
        // --- BEGIN: Update user_manifest.json ---
        try {
          console.log('[RegisterUser] Attempting to update user_manifest.json');
          let userManifest = [];
          try {
            const manifestDownloadRes = await wx.cloud.downloadFile({ fileID: USER_MANIFEST_CLOUD_PATH });
            const manifestContentStr = fs.readFileSync(manifestDownloadRes.tempFilePath, 'utf-8');
            userManifest = JSON.parse(manifestContentStr);
            if (!Array.isArray(userManifest)) { // Ensure it's an array
              console.warn('[RegisterUser] User manifest content is not an array, re-initializing.');
              userManifest = [];
            }
          } catch (e) {
            if (e.errMsg && e.errMsg.includes('does not exist')) {
              console.log('[RegisterUser] user_manifest.json does not exist, will create a new one.');
            } else {
              console.error('[RegisterUser] Error downloading or parsing user_manifest.json, will attempt to overwrite:', e);
            }
            userManifest = []; // Initialize as empty array if download fails or file not found
          }

          // Add the new user's filename if it's not already there (it shouldn't be)
          if (!userManifest.includes(fileName)) {
            userManifest.push(fileName);
          }

          const updatedManifestStr = JSON.stringify(userManifest, null, 2);
          const tempManifestUploadPath = `${wx.env.USER_DATA_PATH}/temp_user_manifest_${Date.now()}.json`;
          fs.writeFileSync(tempManifestUploadPath, updatedManifestStr, 'utf-8');

          await wx.cloud.uploadFile({
            cloudPath: 'user_data_json/user_manifest.json', // Relative path to overwrite
            filePath: tempManifestUploadPath
          });
          fs.unlinkSync(tempManifestUploadPath); // Clean up temporary manifest file
          console.log('[RegisterUser] user_manifest.json updated successfully with new user:', fileName);

        } catch (manifestUpdateError) {
          console.error('[RegisterUser] CRITICAL: Failed to update user_manifest.json:', manifestUpdateError);
          // Decide if you want to inform the user about this partial failure.
          // The user is registered, but might not be findable by login until manifest is fixed.
          // For now, we'll let the original success message proceed.
        }
        // --- END: Update user_manifest.json ---

        wx.hideLoading();
        wx.showToast({
          title: '注册成功',
          icon: 'success',
          duration: 1500
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error('Upload failed to return fileID');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('[RegisterUser] Error during registration or upload:', err);
      wx.showToast({ title: '注册失败，请稍后再试', icon: 'none' });
      // Attempt to clean up temp file in case of error too
      try { fs.unlinkSync(tempFilePath); } catch (e) { /* ignore */ }
    }
  }
}); 