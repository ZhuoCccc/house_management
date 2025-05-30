const app = getApp(); // Assuming app.js is set up for global data if needed
const fs = wx.getFileSystemManager();

// Define the manifest file path (ensure your ENV_ID is correct)
const MANIFEST_FILE_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/hotel_data_json/manifest.json';
const HOTEL_DATA_BASE_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/hotel_data_json/'; // Base path for hotel JSON files

Page({
  data: {
    hotels: [],
    displayedHotels: [],
    searchQuery: '',
    // statusBarHeight: wx.getSystemInfoSync().statusBarHeight, // Keep if using custom nav
    // navigationBarHeight: wx.getSystemInfoSync().platform === 'android' ? wx.getSystemInfoSync().statusBarHeight + 50 : wx.getSystemInfoSync().statusBarHeight + 45 // Keep if using custom nav
    // Removed modal related data: showAddModal, newHotelName, newHotelLocation
  },

  onLoad: function (options) {
    this.loadHotels();
  },

  onShow: function () {
    this.loadHotels();
  },

  loadHotels: async function () {
    wx.showLoading({ title: '加载中...' });
    let hotelJsonFileNamesFromManifest = [];
    try {
      console.log('[LoadHotels] Attempting to download manifest:', MANIFEST_FILE_CLOUD_PATH);
      const manifestDownloadRes = await wx.cloud.downloadFile({
        fileID: MANIFEST_FILE_CLOUD_PATH
      });
      const manifestContent = fs.readFileSync(manifestDownloadRes.tempFilePath, 'utf-8');
      hotelJsonFileNamesFromManifest = JSON.parse(manifestContent);
      console.log('[LoadHotels] Loaded hotel filenames from manifest:', hotelJsonFileNamesFromManifest);
    } catch (err) {
      console.error('[LoadHotels] 加载 manifest.json 失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载酒店列表清单失败',
        icon: 'none'
      });
      this.setData({ hotels: [] });
      return;
    }

    const loadedHotels = [];
    const validHotelJsonFileNames = []; // To store names of successfully loaded/verified files
    let manifestNeedsUpdate = false;

    if (hotelJsonFileNamesFromManifest && hotelJsonFileNamesFromManifest.length > 0) {
      for (const fileName of hotelJsonFileNamesFromManifest) {
        if (!fileName || typeof fileName !== 'string') { // Basic validation for filename
            console.warn('[LoadHotels] Invalid filename in manifest:', fileName);
            manifestNeedsUpdate = true; // Mark for update if invalid entry found
            continue;
        }
        const fullFilePath = `${HOTEL_DATA_BASE_CLOUD_PATH}${fileName}`;
        try {
          console.log('[LoadHotels] Attempting to download hotel JSON:', fullFilePath);
          const downloadRes = await wx.cloud.downloadFile({
            fileID: fullFilePath
          });
          const fileContent = fs.readFileSync(downloadRes.tempFilePath, 'utf-8');
          const hotelData = JSON.parse(fileContent);
          hotelData.filePath = fullFilePath; 
          hotelData.fileName = fileName; 
          loadedHotels.push(hotelData);
          validHotelJsonFileNames.push(fileName); // Add to valid names list
        } catch (err) {
          console.error(`[LoadHotels] 加载酒店JSON文件 (${fileName}) 失败:`, err);
          // Check if the error indicates file not found (e.g., -403003 or similar)
          // We assume any download error for a specific hotel JSON means it's an invalid entry in manifest.
          manifestNeedsUpdate = true; 
        }
      }
    }

    // After attempting to load all files, check if manifest needs to be updated
    if (manifestNeedsUpdate) {
        // Only update if the content of valid names is different from original manifest names
        // This avoids unnecessary uploads if manifest was already correct but had e.g. an empty string initially
        const originalManifestContentString = JSON.stringify(hotelJsonFileNamesFromManifest.sort());
        const validManifestContentString = JSON.stringify(validHotelJsonFileNames.sort());

        if (originalManifestContentString !== validManifestContentString) {
            console.log('[LoadHotels] Manifest.json needs update. Original count:', hotelJsonFileNamesFromManifest.length, 'Valid count:', validHotelJsonFileNames.length);
            try {
                const updatedManifestStr = JSON.stringify(validHotelJsonFileNames, null, 2);
                const tempManifestUploadPath = `${wx.env.USER_DATA_PATH}/temp_manifest_repair_${Date.now()}.json`;
                fs.writeFileSync(tempManifestUploadPath, updatedManifestStr, 'utf-8');
                
                await wx.cloud.uploadFile({
                    cloudPath: 'hotel_data_json/manifest.json', // Relative path to overwrite
                    filePath: tempManifestUploadPath
                });
                console.log('[LoadHotels] Manifest.json successfully repaired and uploaded to cloud with valid filenames:', validHotelJsonFileNames);
                fs.unlink({ filePath: tempManifestUploadPath, fail: (unlinkErr) => console.warn('[LoadHotels] Failed to delete temporary repaired manifest file:', unlinkErr) });
            } catch (manifestUpdateErr) {
                console.error('[LoadHotels] Failed to repair and upload manifest.json:', manifestUpdateErr);
                // If manifest repair fails, we still proceed with the hotels that were successfully loaded
            }
        } else {
            console.log('[LoadHotels] Manifest was marked for update, but valid list is identical to original. No re-upload needed.');
        }
    }

    this.setData({
      hotels: loadedHotels
    });
    this.updateDisplayedHotels();

    if (loadedHotels.length === 0 && hotelJsonFileNamesFromManifest.length > 0 && validHotelJsonFileNames.length === 0) {
      wx.showToast({
        title: '未能加载任何酒店数据',
        icon: 'none'
      });
    } 
    wx.hideLoading();
  },

  handleSearchInput: function(e) {
    const searchQuery = e.detail.value;
    this.setData({ searchQuery: searchQuery });
    if (!searchQuery) { // If search query is cleared, update display immediately
        this.updateDisplayedHotels(); 
    }
  },

  handleSearchConfirm: function() {
    this.updateDisplayedHotels();
  },

  clearSearchQuery: function() {
    this.setData({ searchQuery: '' });
    this.updateDisplayedHotels();
  },

  updateDisplayedHotels: function() {
    const allHotels = this.data.hotels;
    const query = this.data.searchQuery.toLowerCase().trim();

    if (!query) {
      this.setData({ displayedHotels: allHotels });
      return;
    }

    const filtered = allHotels.filter(hotel => {
      const nameMatch = hotel.name && hotel.name.toLowerCase().includes(query);
      const locationMatch = hotel.location && hotel.location.toLowerCase().includes(query);
      // You can add more fields to search in if necessary, e.g., hotel.description
      return nameMatch || locationMatch;
    });
    this.setData({ displayedHotels: filtered });
  },

  navigateToAddHotelPage: function () {
    wx.navigateTo({
      url: '/pages/admin/hotel_edit/hotel_edit'
    });
  },

  confirmDeleteHotel: async function (e) {
    const hotelFilePath = e.currentTarget.dataset.hotelid; // This is the full cloud FileID for the JSON
    const hotelName = e.currentTarget.dataset.hotelname;
    const hotelFileName = e.currentTarget.dataset.filename; // Just the 'hotel_xyz.json'

    if (!hotelFilePath || !hotelFileName) {
        wx.showToast({ title: '酒店文件信息不完整', icon: 'none' });
        return;
    }

    const hotelToDelete = this.data.hotels.find(h => h.filePath === hotelFilePath);
    const hotelImageFileID = hotelToDelete ? hotelToDelete.hotelImageFileID : null;

    wx.showModal({
        title: '确认删除',
        content: `确定要删除酒店 "${hotelName}" 吗？相关图片也会被删除。此操作不可恢复。`,
        confirmText: "删除",
        confirmColor: "#ee0a24",
        success: async (res) => {
            if (res.confirm) {
                wx.showLoading({ title: '删除中...' });
                try {
                    // 1. Attempt to delete the hotel image if it exists
                    if (hotelImageFileID) {
                        console.log('[DeleteHotel] Attempting to delete image:', hotelImageFileID);
                        try {
                            await wx.cloud.deleteFile({ fileList: [hotelImageFileID] });
                            console.log('[DeleteHotel] Hotel image deleted successfully:', hotelImageFileID);
                        } catch (imgErr) {
                            console.error('[DeleteHotel] Hotel image deletion failed:', hotelImageFileID, imgErr);
                            let failedDeletions = wx.getStorageSync('failed_image_deletions') || [];
                            failedDeletions.push({
                                fileID: hotelImageFileID,
                                type: 'hotel_image_on_hotel_delete',
                                parentId: hotelFilePath,
                                attemptedDeleteTime: new Date().toISOString(),
                                error: JSON.stringify(imgErr)
                            });
                            wx.setStorageSync('failed_image_deletions', failedDeletions);
                            wx.showToast({ title: '图片删除失败,已记录', icon: 'none' });
                        }
                    }

                    // 2. Delete the hotel JSON file
                    console.log('[DeleteHotel] Attempting to delete JSON file:', hotelFilePath);
                    await wx.cloud.deleteFile({ fileList: [hotelFilePath] });
                    console.log('[DeleteHotel] Hotel JSON file deleted successfully:', hotelFilePath);

                    // 3. Update manifest.json
                    console.log('[DeleteHotel] Attempting to update manifest.json after deleting:', hotelFileName);
                    let manifestFileNames = [];
                    try {
                        console.log('[DeleteHotel] Manifest Step 1: Downloading current manifest.');
                        const manifestDownloadRes = await wx.cloud.downloadFile({ fileID: MANIFEST_FILE_CLOUD_PATH });
                        const manifestTempPath = manifestDownloadRes.tempFilePath;
                        console.log('[DeleteHotel] Manifest Step 2: Reading manifest from temp path:', manifestTempPath);
                        const manifestContentStr = fs.readFileSync(manifestTempPath, 'utf-8');
                        console.log('[DeleteHotel] Manifest Step 3: Parsing manifest content.');
                        manifestFileNames = JSON.parse(manifestContentStr);
                        console.log('[DeleteHotel] Manifest Step 4: Current manifest filenames:', manifestFileNames);
                    } catch (manifestReadError) {
                        console.error('[DeleteHotel] Failed to download or parse manifest.json:', manifestReadError);
                        throw new Error('Failed to read or parse manifest for update.'); // Propagate error to main catch
                    }

                    // Remove the filename from the array
                    const originalLength = manifestFileNames.length;
                    manifestFileNames = manifestFileNames.filter(name => name !== hotelFileName);
                    console.log(`[DeleteHotel] Manifest Step 5: Filtered manifest. New length: ${manifestFileNames.length}, Old length: ${originalLength}. Removed: ${hotelFileName}`);

                    const updatedManifestStr = JSON.stringify(manifestFileNames, null, 2);
                    const tempManifestUploadPath = `${wx.env.USER_DATA_PATH}/temp_manifest_delete_${Date.now()}.json`;
                    
                    console.log('[DeleteHotel] Manifest Step 6: Writing updated manifest to temp file:', tempManifestUploadPath);
                    fs.writeFileSync(tempManifestUploadPath, updatedManifestStr, 'utf-8');

                    try {
                        console.log('[DeleteHotel] Manifest Step 7: Uploading updated manifest to cloud.');
                        await wx.cloud.uploadFile({
                            cloudPath: 'hotel_data_json/manifest.json', // Relative path to overwrite
                            filePath: tempManifestUploadPath
                        });
                        console.log('[DeleteHotel] Manifest.json updated successfully in cloud after deleting:', hotelFileName);
                    } catch (manifestUploadError) {
                        console.error('[DeleteHotel] Failed to upload updated manifest.json:', manifestUploadError);
                        throw new Error('Failed to upload updated manifest.'); // Propagate error to main catch
                    } finally {
                        fs.unlink({ filePath: tempManifestUploadPath, fail: (unlinkErr) => console.warn('[DeleteHotel] Failed to delete temporary manifest file:', unlinkErr) });
                    }
                    
                    wx.hideLoading();
                    wx.setStorageSync('hotel_data_dirty', true);
                    console.log('[HotelManagement] Set hotel_data_dirty flag to true after delete.');
                    wx.showToast({ title: '酒店删除成功', icon: 'success' });
                    
                    // New logic: Directly update the local hotels data
                    const updatedHotels = this.data.hotels.filter(hotel => hotel.fileName !== hotelFileName);
                    this.setData({ hotels: updatedHotels });
                    this.updateDisplayedHotels();
                    console.log('[DeleteHotel] Local hotel list updated directly. New count:', updatedHotels.length);

                } catch (err) { // This is the main catch block
                    wx.hideLoading();
                    console.error('[DeleteHotel] Overall error in confirmDeleteHotel:', err.message, err);
                    wx.showToast({ title: err.message || '删除失败，请重试', icon: 'none', duration: 3000 });
                }
            }
        }
    });
  },

  navigateToManageRoomTypes: function (e) {
    console.log('[NavToRoomTypes] Button clicked. Event data:', e);
    const hotelFilePath = e.currentTarget.dataset.hotelid;
    const hotelName = e.currentTarget.dataset.hotelname;
    console.log('[NavToRoomTypes] Extracted Hotel FilePath (hotelid):', hotelFilePath);
    console.log('[NavToRoomTypes] Extracted Hotel Name (hotelname):', hotelName);

    if (!hotelFilePath) {
        wx.showToast({ title: '酒店ID丢失,无法导航', icon: 'none' });
        console.error('[NavToRoomTypes] hotelFilePath is missing or undefined.');
        return;
    }
    if (!hotelName) {
        // Depending on whether hotelName is strictly required for the next page, 
        // you might just warn or allow navigation with a placeholder.
        console.warn('[NavToRoomTypes] hotelName is missing or undefined. Proceeding without it if possible.');
        // If hotelName is essential for the manage_room_types page, you might want to return here too.
    }

    const targetUrl = `/pages/admin/manage_room_types/manage_room_types?hotelId=${encodeURIComponent(hotelFilePath)}&hotelName=${encodeURIComponent(hotelName || '')}`;
    console.log('[NavToRoomTypes] Navigating to URL:', targetUrl);

    wx.navigateTo({
      url: targetUrl,
      fail: function(err) {
        console.error('[NavToRoomTypes] wx.navigateTo failed:', err);
        wx.showToast({ title: '导航失败,请查看控制台', icon: 'none' });
      }
    });
  },

  navigateToHotelEdit: function(e) {
    const hotelFilePath = e.currentTarget.dataset.hotelid;
    if (!hotelFilePath) {
      wx.showToast({ title: '错误：酒店文件路径丢失', icon: 'error' });
      return;
    }
    wx.navigateTo({
      url: `/pages/admin/hotel_edit/hotel_edit?hotelId=${encodeURIComponent(hotelFilePath)}`
    });
  },
  
  // navigateBack: function() { // Keep if you have a custom back button
  //   wx.navigateBack();
  // }
}); 