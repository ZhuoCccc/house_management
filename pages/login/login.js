const fs = wx.getFileSystemManager();
// const db = require('../../utils/db.js'); // Removed local db dependency
const app = getApp(); // Get app instance

// Cloud Storage Constants - Ensure YOUR_CLOUD_ENV_ID is correctly set here too, or manage constants globally
const USER_MANIFEST_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/user_data_json/user_manifest.json'; // Example, use your actual one
const USER_DATA_BASE_CLOUD_PATH = 'user_data_json/';

Page({
  data: {
    username: '',
    password: ''
  },

  bindUsernameInput: function (e) {
    this.setData({
      username: e.detail.value
    });
  },

  bindPasswordInput: function (e) {
    this.setData({
      password: e.detail.value
    });
  },

  login: async function () { // Changed to async function
    const { username, password } = this.data;
    if (!username || !password) {
      wx.showToast({
        title: '请输入用户名和密码',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      // 1. Download user manifest
      let userManifest = [];
      try {
        console.log('[Login] Attempting to download user manifest:', USER_MANIFEST_CLOUD_PATH);
        const manifestDownloadRes = await wx.cloud.downloadFile({ fileID: USER_MANIFEST_CLOUD_PATH });
        const manifestContentStr = fs.readFileSync(manifestDownloadRes.tempFilePath, 'utf-8');
        userManifest = JSON.parse(manifestContentStr);
        console.log('[Login] User manifest downloaded and parsed. Files count:', userManifest.length);
      } catch (manifestError) {
        console.error('[Login] Error downloading or parsing user manifest:', manifestError);
        wx.hideLoading();
        wx.showToast({ title: '登录服务暂时不可用', icon: 'none', duration: 2000 });
        return;
      }

      if (!Array.isArray(userManifest) || userManifest.length === 0) {
        console.log('[Login] No users found in manifest or manifest is invalid.');
        wx.hideLoading();
        wx.showToast({ title: '用户名或密码错误', icon: 'none', duration: 2000 });
        return;
      }

      // 2. Iterate through manifest, download user files, and check credentials
      let foundUser = null;
      for (const userFileName of userManifest) {
        if (typeof userFileName !== 'string' || userFileName.trim() === '') continue;

        const userFileRelativePath = USER_DATA_BASE_CLOUD_PATH + userFileName.trim();
        // Construct full FileID for download (similar to user_management.js)
        const cloudPrefix = USER_MANIFEST_CLOUD_PATH.substring(0, USER_MANIFEST_CLOUD_PATH.lastIndexOf('/') - USER_DATA_BASE_CLOUD_PATH.length +1 );
        const fullUserFileIDToDownload = cloudPrefix + userFileRelativePath;
        
        try {
          console.log('[Login] Attempting to download user file:', fullUserFileIDToDownload);
          const downloadRes = await wx.cloud.downloadFile({ fileID: fullUserFileIDToDownload });
          const fileContent = fs.readFileSync(downloadRes.tempFilePath, 'utf-8');
          const userData = JSON.parse(fileContent);

          // IMPORTANT: Username comparison should ideally be case-insensitive or normalized
          if (userData.username && userData.username.trim() === username.trim()) {
            // CRITICAL SECURITY FLAW: Plain text password comparison.
            // In a real app, HASH the input password and compare with a STORED HASH.
            if (userData.password === password) {
              foundUser = userData;
              console.log('[Login] User found and password matches:', foundUser.username);
              break; // User found, no need to check further
            }
          }
        } catch (userLoadError) {
          console.error(`[Login] Failed to load or parse user file ${userFileRelativePath}:`, userLoadError);
          // Continue to the next file if one fails
        }
      }

      wx.hideLoading();

      if (foundUser) {
        const loggedInUserData = { username: foundUser.username, type: foundUser.type }; 
        app.globalData.loggedInUser = loggedInUserData;
        wx.setStorageSync('loggedInUser', loggedInUserData);

        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });

        if (foundUser.type === 'user') {
          wx.switchTab({ url: '/pages/home/home' });
        } else if (foundUser.type === 'admin') {
          wx.redirectTo({ url: '/pages/admin/admin_hub_selection/admin_hub_selection' });
        }
      } else {
        wx.showToast({
          title: '用户名或密码错误',
          icon: 'none',
          duration: 2000
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('[Login] General error during login process:', error);
      wx.showToast({ title: '登录出错，请稍后重试', icon: 'error', duration: 2000 });
    }
  },

  navigateToRegister: function () {
    wx.navigateTo({ url: '/pages/register/register' });
  },

  onLoad: function (options) {},
  onReady: function () {},
  onShow: function () {},
  onHide: function () {},
  onUnload: function () {},
  onPullDownRefresh: function () {},
  onReachBottom: function () {},
  onShareAppMessage: function () {}
}); 