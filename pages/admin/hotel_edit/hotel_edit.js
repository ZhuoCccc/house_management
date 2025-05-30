const app = getApp();
const fs = wx.getFileSystemManager(); // Added FileSystemManager
const provinceCityData = require('../../../utils/province_city_data.js'); // Keep for now if picker is planned

// Define the manifest file path (ensure your ENV_ID is correct)
const MANIFEST_FILE_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/hotel_data_json/manifest.json';

Page({
  data: {
    hotel: { // Initialize with a base structure
      name: '',
      location: '',
      description: '', // Added description field
      cityName: '', // From previous structure, assuming it's still relevant
      hotelImageFileID: null,
      filePath: null // This will store the cloud path of the loaded JSON file
    },
    currentEditingFilePath: null, // This will be set to the filePath in edit mode, or null in add mode.
    isEditMode: false,
    // cityNameInput: '', // Will be part of hotel object
    // hotelLocationInput: '', // Will be part of hotel object
    // hotelImageFileID: null, // Will be part of hotel object
    isUploadingImage: false,
    originalImageFileID: null, // To track if the image was changed during edit
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
    if (options.hotelId) { // hotelId from route is the encoded cloud file path
      const hotelFileCloudPath = decodeURIComponent(options.hotelId);
      this.setData({
        currentEditingFilePath: hotelFileCloudPath, // Store the actual file path for saving
        isEditMode: true,
        'hotel.filePath': hotelFileCloudPath // Also store it in the hotel object if needed for display/logic
      });
      wx.setNavigationBarTitle({ title: '编辑酒店信息' });
      this.loadHotelDetails(hotelFileCloudPath);
    } else {
      this.setData({
        isEditMode: false,
        currentEditingFilePath: null,
        hotel: { // Reset to default for add mode
          name: '',
          location: '',
          description: '',
          cityName: '',
          hotelImageFileID: null,
          filePath: null
        }
      });
      wx.setNavigationBarTitle({ title: '添加新酒店' });
    }
  },

  loadHotelDetails: async function (hotelFileCloudPath) {
    wx.showLoading({ title: '加载中...' });
    try {
      const downloadRes = await wx.cloud.downloadFile({
        fileID: hotelFileCloudPath
      });
      const fileContent = fs.readFileSync(downloadRes.tempFilePath, 'utf-8');
      const hotelData = JSON.parse(fileContent);
      
      this.setData({
        hotel: {
            ...hotelData, // Spread the loaded data
            filePath: hotelFileCloudPath // Ensure filePath is set on the hotel object
        },
        originalImageFileID: hotelData.hotelImageFileID || null
      });
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error(`[云存储] [加载JSON文件 ${hotelFileCloudPath}] 失败：`, err);
      wx.showToast({
        title: '加载酒店信息失败',
        icon: 'error',
        duration: 2000,
        complete: () => {
          wx.navigateBack();
        }
      });
    }
  },

  // Generic input handler
  handleInputChange: function(e) {
    const field = e.currentTarget.dataset.field; // e.g., "hotel.name", "hotel.location"
    let value = e.detail.value;

    // Create a deep copy of the hotel object to modify
    let hotelData = JSON.parse(JSON.stringify(this.data.hotel));

    // Update the nested property
    // Example: field = "name" -> hotelData['name'] = value
    // Example: field = "description" -> hotelData['description'] = value
    // This assumes simple, non-nested fields on the hotel object for now
    // For truly nested like 'hotel.name', a helper function to set nested properties would be better.
    // Let's assume WXML data-field directly maps to keys in this.data.hotel
    hotelData[field] = value;

    this.setData({ hotel: hotelData });
  },

  uploadHotelImage: function() {
    const that = this;
    if (that.data.isUploadingImage) return;

    let idForPath = that.data.currentEditingFilePath; // This is the JSON file path in edit mode.
    let imageNamePrefix = 'hotel_image'; // Default prefix
    if(that.data.hotel && that.data.hotel.name) {
        imageNamePrefix = that.data.hotel.name.replace(/\s+/g, '_');
    }

    if (!idForPath && !that.data.isEditMode) { // ADD mode
        // For add mode, images are uploaded before the main JSON exists.
        // The image path should be structured to be identifiable, maybe using a temp user-specific folder or a generic new items folder.
        // For simplicity, let's make a generic path for unlinked images for now.
        idForPath = 'unlinked_hotel_images/' + Date.now(); 
        console.warn("ADD mode: Image will be uploaded to a temporary path format: ", idForPath);
    } else if (!idForPath && that.data.isEditMode) { // Should not happen in EDIT mode
        wx.showToast({ title: '酒店文件路径丢失,无法上传图片', icon: 'none' });
        return;
    }

    wx.chooseMedia({
      mediaType: ['image'], count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success(res) {
        if (res.tempFiles && res.tempFiles.length > 0) {
          that.setData({ isUploadingImage: true });
          const tempFilePath = res.tempFiles[0].tempFilePath;
          const timestamp = Date.now();
          const fileExtension = tempFilePath.match(/\.[^.]+?$/) ? tempFilePath.match(/\.[^.]+?$/)[0] : '.jpg';
          
          // Revised cloudPath for image: hotel_images/<imageNamePrefix_timestamp>.ext OR hotel_images/<JSON_FILE_NAME_AS_FOLDER>/<imageNamePrefix_timestamp>.ext
          // Let's use a simpler path: hotel_images/imageNamePrefix_timestamp.ext for now
          // More robust: hotel_images/PARENT_JSON_FILENAME_OR_ID/imageNamePrefix_timestamp.ext
          // For now, keeping it simpler, not directly tying to JSON file path in image path to avoid overly long paths
          const imageCloudPath = `hotel_images/${imageNamePrefix}_${timestamp}${fileExtension}`;

          wx.cloud.uploadFile({
            cloudPath: imageCloudPath, filePath: tempFilePath,
            success: uploadResult => {
              const newFileID = uploadResult.fileID;
              const oldFileIDInHotelObject = that.data.hotel.hotelImageFileID;
              that.setData({ 'hotel.hotelImageFileID': newFileID, isUploadingImage: false });
              wx.showToast({ title: '图片上传成功!', icon: 'success' });

              if (that.data.isEditMode && oldFileIDInHotelObject && oldFileIDInHotelObject !== newFileID) {
                wx.cloud.deleteFile({
                  fileList: [oldFileIDInHotelObject],
                  success: () => { console.log('旧酒店图片删除成功:', oldFileIDInHotelObject); },
                  fail: deleteErr => {
                    console.error('旧酒店图片删除失败:', oldFileIDInHotelObject, deleteErr);
                    let failedDeletions = wx.getStorageSync('failed_image_deletions') || [];
                    failedDeletions.push({
                      fileID: oldFileIDInHotelObject, type: 'hotel_image',
                      parentId: that.data.currentEditingFilePath, // Use JSON file path as parentId
                      attemptedDeleteTime: new Date().toISOString(), error: JSON.stringify(deleteErr)
                    });
                    wx.setStorageSync('failed_image_deletions', failedDeletions);
                    wx.showToast({ title: '旧图云端删除失败,已记录', icon: 'none' });
                  }
                });
              }
            },
            fail: err => { that.setData({ isUploadingImage: false }); wx.showToast({ title: '图片上传失败', icon: 'none' }); console.error('酒店图片上传失败:', err); }
          });
        }
      }
    });
  },

  removeHotelImage: function() {
    if (this.data.isUploadingImage) {
      wx.showToast({ title: '正在上传图片', icon: 'none'});
      return;
    }
    // We don't delete from cloud here, only on successful replacement or if user explicitly deletes the hotel.
    // This just clears it from the current form state.
    this.setData({
      'hotel.hotelImageFileID': null
    });
    wx.showToast({title: '图片已从表单移除', icon: 'none' });
  },

  handleSaveHotel: async function () {
    const hotelDataToSave = { ...this.data.hotel };
    
    // Ensure filePath is not part of the actual saved JSON data if it was just for state
    // delete hotelDataToSave.filePath; // Or keep if your hotel object schema includes it

    if (!this.data.isEditMode) {
        // Add default empty roomTypes array for new hotels
        hotelDataToSave.roomTypes = [];
        console.log('[HandleSaveHotel] Added default roomTypes: [] for new hotel.');

        // Add a unique ID to the new hotel object if it doesn't have one
        // This ID is for the hotel itself, for internal use (e.g. linking rooms if db.js was used)
        if (!hotelDataToSave.id) {
            hotelDataToSave.id = `hotel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log('[HandleSaveHotel] Generated new hotel ID for internal use:', hotelDataToSave.id);
        }
    }

    // Remove the filePath property before saving if it was only for local state management in the form
    // and not part of the actual hotel data schema you want to save in the JSON file.
    // If your hotel JSON schema *should* contain its own cloud path, then don't delete this.
    // For now, assuming filePath was primarily for edit mode identification.
    if (hotelDataToSave.hasOwnProperty('filePath')) {
        delete hotelDataToSave.filePath;
        console.log('[HandleSaveHotel] Removed temporary filePath property before saving hotel JSON.');
    }

    if (!hotelDataToSave.name || !hotelDataToSave.name.trim()) {
        wx.showToast({ title: '酒店名称不能为空', icon: 'none' });
        return;
    }
    // Add other validations as needed (e.g., cityName)
    if (!hotelDataToSave.cityName || !hotelDataToSave.cityName.trim()) {
        wx.showToast({ title: '城市标签不能为空', icon: 'none' });
        return;
    }

    wx.showLoading({ title: '保存中...' });

    // Convert data to JSON string
    const jsonString = JSON.stringify(hotelDataToSave, null, 2); // null, 2 for pretty print if desired
    const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_hotel_data_${Date.now()}.json`;
    let newHotelJsonFileName = null; // To store the new file name for manifest update

    try {
        fs.writeFileSync(tempFilePath, jsonString, 'utf8');

        let targetCloudPathForUpload;
        let originalFullFileID = null; // To store the full FileID for logging/reference if needed

        if (this.data.isEditMode) {
            if (!this.data.currentEditingFilePath) {
                wx.hideLoading();
                wx.showToast({ title: '错误: 酒店文件路径丢失', icon: 'error'});
                console.error('Cannot save in edit mode: currentEditingFilePath is missing');
                return;
            }
            originalFullFileID = this.data.currentEditingFilePath; // This is the full cloud FileID
            targetCloudPathForUpload = this.getRelativeCloudPath(originalFullFileID);
            if (!targetCloudPathForUpload) {
                wx.hideLoading();
                wx.showToast({ title: '错误: 酒店保存路径解析失败', icon: 'error'});
                console.error('Cannot save in edit mode: could not derive relative path from', originalFullFileID);
                return;
            }
            console.log('Editing hotel, will overwrite relative path:', targetCloudPathForUpload);
        } else {
            // ADD Mode: Generate a new cloud path (already relative)
            const fileName = (hotelDataToSave.name.replace(/\s+/g, '_') || 'hotel') + '_' + Date.now() + '.json';
            newHotelJsonFileName = fileName; // Store for manifest update
            targetCloudPathForUpload = `hotel_data_json/${fileName}`; 
            console.log('New hotel JSON will be saved to relative path:', targetCloudPathForUpload);
        }

        await wx.cloud.uploadFile({
            cloudPath: targetCloudPathForUpload, // Use the correctly determined relative path
            filePath: tempFilePath
        });

        // If ADD mode was successful, update manifest.json
        if (!this.data.isEditMode && newHotelJsonFileName) {
            try {
                console.log('Attempting to update manifest.json for new hotel:', newHotelJsonFileName);
                // 1. Download current manifest
                const manifestDownloadRes = await wx.cloud.downloadFile({ fileID: MANIFEST_FILE_CLOUD_PATH });
                const manifestTempPath = manifestDownloadRes.tempFilePath;
                const manifestContentStr = fs.readFileSync(manifestTempPath, 'utf-8');
                let manifestFileNames = JSON.parse(manifestContentStr);

                // 2. Add new hotel filename
                if (!manifestFileNames.includes(newHotelJsonFileName)) {
                    manifestFileNames.push(newHotelJsonFileName);
                }

                // 3. Write updated manifest back to a temporary file
                const updatedManifestStr = JSON.stringify(manifestFileNames, null, 2);
                const tempManifestUploadPath = `${wx.env.USER_DATA_PATH}/temp_manifest_${Date.now()}.json`;
                fs.writeFileSync(tempManifestUploadPath, updatedManifestStr, 'utf-8');

                // 4. Upload updated manifest
                await wx.cloud.uploadFile({
                    cloudPath: 'hotel_data_json/manifest.json', // Use relative path to overwrite
                    filePath: tempManifestUploadPath
                });
                console.log('manifest.json updated successfully with:', newHotelJsonFileName);
                fs.unlink({ filePath: tempManifestUploadPath, fail: (unlinkErr) => console.warn('删除临时 manifest.json 文件失败', unlinkErr) });


            } catch (manifestErr) {
                console.error('更新 manifest.json 失败:', manifestErr);
                // Decide if this error should block the user or just be a warning
                wx.showToast({ title: '酒店已添加,但列表更新失败', icon: 'none', duration: 3000 });
            }
        }


        wx.hideLoading();
        wx.setStorageSync('hotel_data_dirty', true);
        console.log('[HotelEdit] Set hotel_data_dirty flag to true after save.');
        wx.showToast({ title: this.data.isEditMode ? '更新成功' : '添加成功,列表已更新', icon: 'success' });
        setTimeout(() => { wx.navigateBack(); }, 1500);

    } catch (err) {
        wx.hideLoading();
        console.error('[云存储] [保存酒店JSON] 失败:', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
        // Clean up temporary file
        fs.unlink({ filePath: tempFilePath, fail: (unlinkErr) => console.warn('删除临时JSON文件失败', unlinkErr) });
    }
  },

  navigateBack: function() {
    wx.navigateBack();
  }

  // City Picker functions can remain as they are if you plan to use them.
  /*
  loadAllCities: function() { ... },
  openCityPicker: function() { ... },
  closeCityPicker: function() { ... },
  handleCityPick: function(e) { ... },
  onCityPickerConfirm: function() { ... }
  */
}); 